// api/cron/check-signal-accuracy.js — 시그널 적중률 자동 검증 크론
// 1h/4h/24h 경과한 시그널의 현재 가격을 대조하여 적중 여부 판정
// Vercel Cron: 매 30분 실행
//
// 인증 모델: anon 키 + SECURITY DEFINER RPC + SIGNAL_RPC_SECRET (#102)
//   list_pending_signals(secret, horizon, limit)         — 평가 대상 조회
//   update_signal_evaluation_batch(secret, horizon, [])  — 배치 UPDATE

export const config = { runtime: 'edge' };

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SIGNAL_RPC_SECRET = process.env.SIGNAL_RPC_SECRET;

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

class RpcError extends Error {
  constructor(name, status, body) {
    super(`rpc ${name} failed: ${status} ${body.slice(0, 200)}`);
    this.rpcName = name;
    this.status = status;
  }
}

async function listPending(horizon, limit = 100) {
  const res = await postRpc('list_pending_signals', {
    p_secret: SIGNAL_RPC_SECRET,
    p_horizon: horizon,
    p_limit: limit,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new RpcError('list_pending_signals', res.status, body);
  }
  return res.json();
}

async function updateEvaluationBatch(horizon, items) {
  if (!items.length) return 0;
  const res = await postRpc('update_signal_evaluation_batch', {
    p_secret: SIGNAL_RPC_SECRET,
    p_horizon: horizon,
    p_items: items,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new RpcError('update_signal_evaluation_batch', res.status, body);
  }
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
  if (!SUPABASE_URL || !SUPABASE_KEY || !SIGNAL_RPC_SECRET) {
    return new Response(JSON.stringify({ error: 'supabase not configured' }), { status: 500 });
  }

  const prices = await getCurrentPrices();
  if (!Object.keys(prices).length) {
    return new Response(JSON.stringify({ error: 'no prices' }), { status: 500 });
  }

  // allSettled 로 horizon 별 결과/에러를 독립 수집.
  // RPC 실패(시크릿 불일치, 권한 드리프트 등)는 반드시 non-2xx 로 드러나야
  // 모니터링이 "조용한 0건" 과 "DB 전면 거절" 을 구분할 수 있다.
  const settled = await Promise.allSettled([
    evaluateHorizon('1h', prices),
    evaluateHorizon('4h', prices),
    evaluateHorizon('24h', prices),
  ]);

  const labels = ['h1', 'h4', 'h24'];
  const updated = {};
  const errors = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      updated[labels[i]] = r.value;
    } else {
      updated[labels[i]] = 0;
      errors.push({
        horizon: labels[i],
        message: r.reason?.message || String(r.reason),
        status: r.reason?.status ?? null,
      });
    }
  });

  const payload = { ok: errors.length === 0, updated, ts: new Date().toISOString() };
  if (errors.length) payload.errors = errors;

  return new Response(JSON.stringify(payload), {
    status: errors.length ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
