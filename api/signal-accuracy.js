// api/signal-accuracy.js — 시그널 적중률 기록/조회 API
// POST: 시그널 발화 기록 (record_signal_batch RPC)
// GET:  적중률 조회 (signal_accuracy 뷰)
//
// 인증 모델: anon 키만 사용. 쓰기 경로는 SECURITY DEFINER RPC가
//           RLS를 우회하면서 페이로드를 검증한다 (#102).

export const config = { runtime: 'edge' };

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function callRpc(name, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  return res;
}

async function fetchAccuracyView() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/signal_accuracy?select=*`, {
    headers: supabaseHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function handler(req) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(
      JSON.stringify({ error: 'supabase not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── POST: 시그널 발화 기록 ─────────────────────────────────
  if (req.method === 'POST') {
    // 서버 사이드/같은 출처/로컬에서만 허용 — 외부 abuse 1차 차단
    const origin = req.headers.get('origin') || '';
    const cronSecret = req.headers.get('x-cron-secret') || '';
    const isInternal = !origin || origin.includes('vercel.app') || origin.includes('localhost');
    const hasSecret = cronSecret && cronSecret === (process.env.CRON_SECRET || '');
    if (!isInternal && !hasSecret) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 403 });
    }

    let signals;
    try {
      signals = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
    }
    if (!Array.isArray(signals) || !signals.length) {
      return new Response(JSON.stringify({ error: 'signals array required' }), { status: 400 });
    }

    // 클라이언트 페이로드 → DB 컬럼명으로 정규화 (RPC 내부에서 다시 검증)
    const rows = signals.slice(0, 50).map((s) => ({
      signal_type: s.type,
      symbol: s.symbol,
      market: s.market || 'unknown',
      direction: s.direction || 'neutral',
      strength: s.strength || 1,
      title: s.title || '',
      price_at_fire: s.priceAtFire ?? null,
      meta: s.meta || {},
    }));

    try {
      const res = await callRpc('record_signal_batch', { signals: rows });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return new Response(
          JSON.stringify({ error: 'db write failed', status: res.status, detail: detail.slice(0, 200) }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
      const inserted = await res.json().catch(() => 0);
      return new Response(JSON.stringify({ ok: true, inserted }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message || 'rpc failed' }), { status: 500 });
    }
  }

  // ── GET: 적중률 조회 ──────────────────────────────────────
  try {
    const accuracy = await fetchAccuracyView();
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
