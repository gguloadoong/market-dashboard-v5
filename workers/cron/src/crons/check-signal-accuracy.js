// crons/check-signal-accuracy.js — 시그널 적중률 자동 검증 크론 (CF Workers 이식)
// 1h/4h/24h 경과한 시그널의 현재 가격을 대조하여 적중 여부 판정
// Cron: 매 30분 실행
//
// 인증 모델: anon 키 + SECURITY DEFINER RPC + SIGNAL_RPC_SECRET (#102)
//   list_pending_signals(secret, horizon, limit)         — 평가 대상 조회
//   update_signal_evaluation_batch(secret, horizon, [])  — 배치 UPDATE

function supabaseHeaders(supabaseKey) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };
}

async function postRpc(supabaseUrl, supabaseKey, name, body, timeoutMs = 8000) {
  return fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: supabaseHeaders(supabaseKey),
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

async function listPending(supabaseUrl, supabaseKey, signalRpcSecret, horizon, limit = 100) {
  const res = await postRpc(supabaseUrl, supabaseKey, 'list_pending_signals', {
    p_secret: signalRpcSecret,
    p_horizon: horizon,
    p_limit: limit,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new RpcError('list_pending_signals', res.status, body);
  }
  return res.json();
}

async function updateEvaluationBatch(supabaseUrl, supabaseKey, signalRpcSecret, horizon, items) {
  if (!items.length) return 0;
  const res = await postRpc(supabaseUrl, supabaseKey, 'update_signal_evaluation_batch', {
    p_secret: signalRpcSecret,
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
// CF Workers에서는 프로덕션 Vercel 도메인 고정
async function getCurrentPrices() {
  try {
    const base = 'https://market-dashboard-v5.vercel.app';
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

async function evaluateHorizon(supabaseUrl, supabaseKey, signalRpcSecret, horizon, prices) {
  const pending = await listPending(supabaseUrl, supabaseKey, signalRpcSecret, horizon, 100);
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
  return updateEvaluationBatch(supabaseUrl, supabaseKey, signalRpcSecret, horizon, items);
}

export async function checkSignalAccuracy(env) {
  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_ANON_KEY;
  const SIGNAL_RPC_SECRET = env.SIGNAL_RPC_SECRET;

  if (!SUPABASE_URL || !SUPABASE_KEY || !SIGNAL_RPC_SECRET) {
    return { ok: false, error: 'supabase not configured' };
  }

  const prices = await getCurrentPrices();
  if (!Object.keys(prices).length) {
    return { ok: false, error: 'no prices' };
  }

  // allSettled 로 horizon 별 결과/에러를 독립 수집.
  // RPC 실패(시크릿 불일치, 권한 드리프트 등)는 반드시 non-2xx 로 드러나야
  // 모니터링이 "조용한 0건" 과 "DB 전면 거절" 을 구분할 수 있다.
  //
  // horizon/label 매핑을 인덱스로 묶지 않고 한 배열 안에서 관리 — horizon
  // 추가 시 label 배열을 따로 고치다 실수할 여지 제거.
  const horizons = [
    { key: 'h1',  horizon: '1h'  },
    { key: 'h4',  horizon: '4h'  },
    { key: 'h24', horizon: '24h' },
  ];
  const settled = await Promise.allSettled(
    horizons.map(({ horizon }) => evaluateHorizon(SUPABASE_URL, SUPABASE_KEY, SIGNAL_RPC_SECRET, horizon, prices)),
  );

  const updated = {};
  const errors = [];
  settled.forEach((r, i) => {
    const { key } = horizons[i];
    if (r.status === 'fulfilled') {
      updated[key] = r.value;
    } else {
      updated[key] = 0;
      errors.push({
        horizon: horizons[i].horizon,
        message: r.reason?.message || String(r.reason),
        status: r.reason?.status ?? null,
      });
    }
  });

  const payload = { ok: errors.length === 0, updated, ts: new Date().toISOString() };
  if (errors.length) payload.errors = errors;

  return payload;
}
