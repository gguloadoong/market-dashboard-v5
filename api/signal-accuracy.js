// api/signal-accuracy.js — 시그널 적중률 기록/조회 API
// POST: 시그널 발화 기록
// GET: 적중률 조회 (signal_accuracy 뷰)

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseQuery(query, method = 'GET', body = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/${query}`;
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=minimal' : '',
    },
    signal: AbortSignal.timeout(5000),
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) return null;
  if (method === 'POST') return { ok: true };
  return res.json();
}

export default async function handler(req) {
  // POST: 시그널 발화 기록
  if (req.method === 'POST') {
    try {
      const signals = await req.json();
      if (!Array.isArray(signals) || !signals.length) {
        return new Response(JSON.stringify({ error: 'signals array required' }), { status: 400 });
      }

      // 배치 insert (최대 50건)
      const rows = signals.slice(0, 50).map(s => ({
        signal_type: s.type,
        symbol: s.symbol,
        market: s.market || 'unknown',
        direction: s.direction || 'neutral',
        strength: s.strength || 1,
        title: s.title || '',
        price_at_fire: s.priceAtFire || null,
        meta: s.meta || {},
      }));

      const result = await supabaseQuery('signal_history', 'POST', rows);
      if (!result) {
        return new Response(JSON.stringify({ error: 'db write failed' }), { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true, count: rows.length }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // GET: 적중률 조회
  try {
    const accuracy = await supabaseQuery('signal_accuracy?select=*');
    return new Response(JSON.stringify({ accuracy: accuracy || [], ts: Date.now() }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch {
    return new Response(JSON.stringify({ accuracy: [], ts: Date.now() }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
