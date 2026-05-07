// api/signal-history.js — 시그널 히스토리 직접 조회 (P3-14)
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const ALLOWED_LIMIT = 30;
const DEFAULT_LIMIT = 10;
const TYPE_PATTERN = /^[a-z0-9_]{3,40}$/;

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

export default async function handler(req) {
  const ERR_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Signal-History-Error': '1' };
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ history: [], _error: 'supabase not configured' }),
      { status: 200, headers: ERR_HEADERS });
  }
  const url = new URL(req.url);
  const type = url.searchParams.get('type') || '';
  const limitRaw = parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT, 1), ALLOWED_LIMIT);

  if (!TYPE_PATTERN.test(type)) {
    return new Response(JSON.stringify({ history: [], _error: 'invalid type' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const cutoffIso = new Date(Date.now() - 30 * 86400_000).toISOString();
  const cols = 'symbol,direction,fired_at,price_at_fire,hit_1h,hit_24h,change_1h,change_24h';
  const qs = `select=${cols}&signal_type=eq.${encodeURIComponent(type)}&fired_at=gte.${cutoffIso}&order=fired_at.desc&limit=${limit}`;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/signal_history?${qs}`, {
      headers: supabaseHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return new Response(JSON.stringify({
        history: [], _error: { status: res.status, detail: detail.slice(0, 200) },
      }), { status: 200, headers: ERR_HEADERS });
    }
    const rows = await res.json();
    const history = (Array.isArray(rows) ? rows : []).map((r) => ({
      symbol: r.symbol,
      direction: r.direction,
      firedAt: r.fired_at,
      priceAtFire: r.price_at_fire,
      hit1h: r.hit_1h,
      hit24h: r.hit_24h,
      change1h: r.change_1h,
      change24h: r.change_24h,
    }));
    return new Response(JSON.stringify({ history, count: history.length, ts: new Date().toISOString() }),
      { status: 200, headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      }});
  } catch (e) {
    return new Response(JSON.stringify({
      history: [], _error: { message: (e?.message || '').slice(0, 200) },
    }), { status: 200, headers: ERR_HEADERS });
  }
}
