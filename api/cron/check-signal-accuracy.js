// api/cron/check-signal-accuracy.js — 시그널 적중률 자동 검증 크론
// 1h/4h/24h 경과한 시그널의 현재 가격을 대조하여 적중 여부 판정
// Vercel Cron: 매 30분 실행

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseRpc(query) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return res.json();
}

async function supabaseUpdate(id, data) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/signal_history?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(5000),
  });
  return res.ok;
}

// 현재 가격 조회 (snapshot API 재활용)
async function getCurrentPrices() {
  try {
    const res = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://market-dashboard-v5.vercel.app'}/api/snapshot`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const prices = {};

    // 코인
    for (const c of data.coins || []) {
      prices[c.symbol] = c.priceKrw || c.priceUsd || 0;
    }
    // 국장
    for (const s of data.kr || []) {
      prices[s.symbol] = s.price || 0;
    }
    // 미장
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

export default async function handler() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'supabase not configured' }), { status: 500 });
  }

  const prices = await getCurrentPrices();
  if (!Object.keys(prices).length) {
    return new Response(JSON.stringify({ error: 'no prices' }), { status: 500 });
  }

  const now = new Date();
  let updated = { h1: 0, h4: 0, h24: 0 };

  // 1시간 체크: fired_at이 1~2시간 전이고 hit_1h가 null인 시그널
  const unchecked1h = await supabaseRpc(
    `signal_history?hit_1h=is.null&fired_at=lt.${new Date(now - 3600000).toISOString()}&fired_at=gt.${new Date(now - 7200000).toISOString()}&select=id,symbol,direction,price_at_fire&limit=50`
  );
  for (const sig of unchecked1h || []) {
    const curPrice = prices[sig.symbol];
    if (!curPrice || !sig.price_at_fire) continue;
    const changePct = ((curPrice - sig.price_at_fire) / sig.price_at_fire) * 100;
    await supabaseUpdate(sig.id, {
      price_1h: curPrice,
      change_1h: +changePct.toFixed(2),
      hit_1h: isHit(sig.direction, changePct),
      checked_1h_at: now.toISOString(),
    });
    updated.h1++;
  }

  // 4시간 체크
  const unchecked4h = await supabaseRpc(
    `signal_history?hit_4h=is.null&fired_at=lt.${new Date(now - 14400000).toISOString()}&fired_at=gt.${new Date(now - 28800000).toISOString()}&select=id,symbol,direction,price_at_fire&limit=50`
  );
  for (const sig of unchecked4h || []) {
    const curPrice = prices[sig.symbol];
    if (!curPrice || !sig.price_at_fire) continue;
    const changePct = ((curPrice - sig.price_at_fire) / sig.price_at_fire) * 100;
    await supabaseUpdate(sig.id, {
      price_4h: curPrice,
      change_4h: +changePct.toFixed(2),
      hit_4h: isHit(sig.direction, changePct),
      checked_4h_at: now.toISOString(),
    });
    updated.h4++;
  }

  // 24시간 체크
  const unchecked24h = await supabaseRpc(
    `signal_history?hit_24h=is.null&fired_at=lt.${new Date(now - 86400000).toISOString()}&fired_at=gt.${new Date(now - 172800000).toISOString()}&select=id,symbol,direction,price_at_fire&limit=50`
  );
  for (const sig of unchecked24h || []) {
    const curPrice = prices[sig.symbol];
    if (!curPrice || !sig.price_at_fire) continue;
    const changePct = ((curPrice - sig.price_at_fire) / sig.price_at_fire) * 100;
    await supabaseUpdate(sig.id, {
      price_24h: curPrice,
      change_24h: +changePct.toFixed(2),
      hit_24h: isHit(sig.direction, changePct),
      checked_24h_at: now.toISOString(),
    });
    updated.h24++;
  }

  return new Response(JSON.stringify({ ok: true, updated, ts: now.toISOString() }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
