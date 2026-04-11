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
//
// 환경 별 base URL:
//   - production cron  : 프로덕션 도메인 고정 (VERCEL_PROJECT_PRODUCTION_URL 우선)
//   - preview/dev cron : 현재 deployment 의 VERCEL_URL (자체 DB 와 일관)
//   - 로컬             : localhost
// preview 환경의 cron 이 프로덕션 스냅샷을 긁어서 staging DB 를 오염시키는
// 일이 없어야 한다 (#102 Codex P2).
async function getCurrentPrices() {
  try {
    const isProd = process.env.VERCEL_ENV === 'production';
    let base;
    if (isProd) {
      base = process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'https://market-dashboard-v5.vercel.app';
    } else if (process.env.VERCEL_URL) {
      base = `https://${process.env.VERCEL_URL}`;
    } else {
      base = 'http://localhost:5173';
    }
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

export default async function handler(request) {
  // Vercel Cron Bearer 인증 — 다른 /api/cron/* 와 동일한 패턴.
  // CRON_SECRET 미설정 시에만 허용(로컬). 프로덕션은 항상 설정돼 있으므로
  // 외부 호출은 401.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request?.headers?.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

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
  //
  // horizon/label 매핑을 인덱스로 묶지 않고 한 배열 안에서 관리 — horizon
  // 추가 시 label 배열을 따로 고치다 실수할 여지 제거.
  const horizons = [
    { key: 'h1',  horizon: '1h'  },
    { key: 'h4',  horizon: '4h'  },
    { key: 'h24', horizon: '24h' },
  ];
  const settled = await Promise.allSettled(
    horizons.map(({ horizon }) => evaluateHorizon(horizon, prices)),
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

  return new Response(JSON.stringify(payload), {
    status: errors.length ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
