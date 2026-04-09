// api/snapshot.js — 전종목 가격 스냅샷 반환 (Edge Function)
// Redis 캐시에서 즉시 반환. 캐시 미스 시 빈 배열 (클라이언트가 skeleton 표시)
// [최적화] ETag/304 + 필드 스트리핑 + 델타 전송
export const config = { runtime: 'edge' };

import { getAllSnaps, getCronHealth, redis } from './_price-cache.js';

// CORS 공통 헤더
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

// ─── 필드 스트리핑 (화면에 사용하는 필드만 전송) ───────────────
function stripKr(items) {
  if (!Array.isArray(items)) return items;
  return items.map(({ symbol, name, price, change, changePct, volume, marketCap, market }) =>
    ({ symbol, name, price, change, changePct, volume, marketCap, market }));
}

function stripUs(items) {
  if (!Array.isArray(items)) return items;
  return items.map(({ symbol, name, price, change, changePct, volume, marketCap, market }) =>
    ({ symbol, name, price, change, changePct, volume, marketCap, market }));
}

function stripCoins(items) {
  if (!Array.isArray(items)) return items;
  return items.map(({ id, symbol, name, market, priceKrw, change24h, priceUsd, marketCap, volume24h }) =>
    ({ id, symbol, name, market, priceKrw, change24h, priceUsd, marketCap, volume24h }));
}

// ─── 델타 계산 (변경된 종목만 필터링) ─────────────────────────
function priceHash(item) {
  if (item.priceKrw !== undefined) return `${item.priceKrw}|${item.change24h}`;
  return `${item.price}|${item.changePct}`;
}

async function computeAndStoreDelta(kr, us, coins) {
  if (!redis) return null;
  const HASH_KEY = 'snap:price-hash';
  try {
    const prevHash = await redis.get(HASH_KEY) || {};
    const newHash = {};
    const delta = { kr: [], us: [], coins: [] };
    let changeCount = 0;

    for (const [market, items] of [['kr', kr], ['us', us], ['coins', coins]]) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const key = `${market}:${item.symbol}`;
        const hash = priceHash(item);
        newHash[key] = hash;
        if (prevHash[key] !== hash) {
          delta[market].push(item);
          changeCount++;
        }
      }
    }

    // 새 해시 저장 (TTL 10분)
    await redis.set(HASH_KEY, newHash, { ex: 600 });
    return changeCount > 0 ? delta : null;
  } catch {
    return null;
  }
}

export default async function handler(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
      },
    });
  }

  try {
    // ?health=1 파라미터 — Cron 실패 모니터링 헬스 체크 (CRON_SECRET 인증)
    const url = new URL(request.url);
    if (url.searchParams.get('health') === '1') {
      const secret = process.env.CRON_SECRET;
      if (secret) {
        const auth = request.headers.get('authorization');
        if (auth !== `Bearer ${secret}`) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401, headers: CORS_HEADERS,
          });
        }
      }
      const health = await getCronHealth();
      const isHealthy = health !== null;
      return new Response(JSON.stringify({
        ok: isHealthy,
        crons: health,
        ts: Date.now(),
      }), {
        status: isHealthy ? 200 : 503,
        headers: CORS_HEADERS,
      });
    }

    // ── ETag 체크 (Redis ts 키 3개로 변경 여부 판별) ──
    let etag = null;
    if (redis) {
      try {
        const [krTs, usTs, coinsTs] = await Promise.all([
          redis.get('snap:kr:ts'),
          redis.get('snap:us:ts'),
          redis.get('snap:coins:ts'),
        ]);
        if (krTs || usTs || coinsTs) {
          etag = `"${krTs || 0}-${usTs || 0}-${coinsTs || 0}"`;
          const clientETag = request.headers.get('if-none-match');
          if (clientETag === etag) {
            return new Response(null, {
              status: 304,
              headers: { ...CORS_HEADERS, 'ETag': etag },
            });
          }
        }
      } catch { /* ETag 실패 시 전체 응답으로 fallback */ }
    }

    const snaps = await getAllSnaps();
    const fromCache = snaps !== null;

    // Redis 연결 자체가 안 되면 503 (인프라 장애)
    if (!fromCache) {
      return new Response(JSON.stringify({
        error: 'Service Unavailable — Redis 연결 실패',
        kr: [], us: [], coins: [],
        ts: Date.now(), _fromCache: false,
      }), { status: 503, headers: CORS_HEADERS });
    }

    // 필드 스트리핑
    const kr = stripKr(snaps?.kr ?? []);
    const us = stripUs(snaps?.us ?? []);
    const coins = stripCoins(snaps?.coins ?? []);

    // ── 델타 모드: ?mode=delta 시 변경분만 반환 ──
    const mode = url.searchParams.get('mode');
    if (mode === 'delta') {
      const delta = await computeAndStoreDelta(kr, us, coins);
      if (delta) {
        return new Response(JSON.stringify({
          ...delta, ts: Date.now(), _delta: true,
        }), {
          status: 200,
          headers: { ...CORS_HEADERS, ...(etag ? { 'ETag': etag } : {}) },
        });
      }
      // 변경 없음
      return new Response(JSON.stringify({
        kr: [], us: [], coins: [], ts: Date.now(), _delta: true, _noChange: true,
      }), { status: 200, headers: CORS_HEADERS });
    }

    // ── 전체 모드 (첫 요청 또는 fallback) ──
    // 해시도 갱신 (다음 delta 요청 기준점)
    computeAndStoreDelta(kr, us, coins).catch(() => {});

    const payload = { kr, us, coins, ts: Date.now(), _fromCache: fromCache };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
        ...(etag ? { 'ETag': etag } : {}),
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
