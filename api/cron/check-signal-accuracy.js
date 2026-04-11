// api/cron/check-signal-accuracy.js — 시그널 적중률 자동 검증 크론
// 1h/4h/24h 경과한 시그널의 현재 가격을 대조하여 적중 여부 판정
// Vercel Cron: 매 30분 실행
//
// 인증 모델: anon 키 + SECURITY DEFINER RPC (#102)
//   list_pending_signals(horizon, limit)        — 평가 대상 조회
//   update_signal_evaluation_batch(horizon, []) — 배치 UPDATE (순차 await 회피)

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

async function postRpc(name, body, timeoutMs = 8000) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function listPending(horizon, limit = 100) {
  const res = await postRpc('list_pending_signals', { p_horizon: horizon, p_limit: limit });
  if (!res.ok) return [];
  return res.json();
}

async function updateEvaluationBatch(horizon, items) {
  if (!items.length) return 0;
  const res = await postRpc('update_signal_evaluation_batch', {
    p_horizon: horizon,
    p_items: items,
  });
  if (!res.ok) return 0;
  const affected = await res.json().catch(() => 0);
  return typeof affected === 'number' ? affected : 0;
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
  if (direction === 'neutral') return Math.abs(changePct) < 1;
  if (direction === 'bullish') return changePct > 0;
  if (direction === 'bearish') return changePct < 0;
  return false;
}

async function evaluateHorizon(horizon, prices) {
  const pending = await listPending(horizon, 100);
  if (!pending.length) return 0;

  const items = [];
  for (const sig of pending) {
    const curPrice = prices[sig.symbol];
    if (!curPrice || !sig.price_at_fire) continue;
    const base = Number(sig.price_at_fire);
    if (!base) continue;
    const changePct = ((curPrice - base) / base) * 100;
    items.push({
      id: sig.id,
      price: curPrice,
      change: +changePct.toFixed(2),
      hit: isHit(sig.direction, changePct),
    });
  }
  return updateEvaluationBatch(horizon, items);
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
