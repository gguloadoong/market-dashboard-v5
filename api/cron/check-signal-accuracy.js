// api/cron/check-signal-accuracy.js — 시그널 적중률 자동 검증 크론
// 1h/4h/24h 경과한 시그널의 현재 가격을 대조하여 적중 여부 판정
// Vercel Cron: 매 30분 실행
//
// 인증 모델: anon 키 + SECURITY DEFINER RPC (#102)

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

async function listPending(horizon, limit = 200) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/list_pending_signals`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({ p_horizon: horizon, p_limit: limit }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  return res.json();
}

async function updateEvaluation(id, horizon, price, changePct, hit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_signal_evaluation`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({
      p_id: id,
      p_horizon: horizon,
      p_price: price,
      p_change: changePct,
      p_hit: hit,
    }),
    signal: AbortSignal.timeout(5000),
  });
  return res.ok;
}

// 현재 가격 조회 (snapshot API 재활용)
async function getCurrentPrices() {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://market-dashboard-v5.vercel.app';
    const res = await fetch(`${base}/api/snapshot`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const prices = {};

    for (const c of data.coins || []) {
      prices[c.symbol] = c.priceKrw || c.priceUsd || 0;
    }
    for (const s of data.kr || []) {
      prices[s.symbol] = s.price || 0;
    }
    for (const s of data.us || []) {
      prices[s.symbol] = s.price || 0;
    }
    return prices;
  } catch {
    return {};
  }
}

// 적중 판정: 시그널 방향과 가격 변동 방향 일치 여부
function isHit(direction, changePct) {
  if (direction === 'neutral') return Math.abs(changePct) < 1; // 중립은 변동 1% 미만이면 적중
  if (direction === 'bullish') return changePct > 0;
  if (direction === 'bearish') return changePct < 0;
  return false;
}

async function evaluateHorizon(horizon, prices) {
  const pending = await listPending(horizon, 100);
  let updated = 0;
  for (const sig of pending || []) {
    const curPrice = prices[sig.symbol];
    if (!curPrice || !sig.price_at_fire) continue;
    const base = Number(sig.price_at_fire);
    if (!base) continue;
    const changePct = ((curPrice - base) / base) * 100;
    const ok = await updateEvaluation(
      sig.id,
      horizon,
      curPrice,
      +changePct.toFixed(2),
      isHit(sig.direction, changePct),
    );
    if (ok) updated++;
  }
  return updated;
}

export default async function handler() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'supabase not configured' }), { status: 500 });
  }

  const prices = await getCurrentPrices();
  if (!Object.keys(prices).length) {
    return new Response(JSON.stringify({ error: 'no prices' }), { status: 500 });
  }

  const [h1, h4, h24] = await Promise.all([
    evaluateHorizon('1h', prices),
    evaluateHorizon('4h', prices),
    evaluateHorizon('24h', prices),
  ]);

  return new Response(
    JSON.stringify({ ok: true, updated: { h1, h4, h24 }, ts: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
