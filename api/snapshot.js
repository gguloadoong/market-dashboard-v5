// api/snapshot.js — 전종목 가격 스냅샷 반환 (Edge Function)
// Redis 캐시에서 즉시 반환. 캐시 미스 시 빈 배열 (클라이언트가 skeleton 표시)
export const config = { runtime: 'edge' };

import { getAllSnaps, getCronHealth } from './_price-cache.js';

// CORS 공통 헤더
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

export default async function handler(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    // ?health=1 파라미터 — Cron 실패 모니터링 헬스 체크
    const url = new URL(request.url);
    if (url.searchParams.get('health') === '1') {
      const health = await getCronHealth();
      return new Response(JSON.stringify({
        ok: health !== null,
        crons: health,
        ts: Date.now(),
      }), {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    const snaps = await getAllSnaps();
    const fromCache = snaps !== null;

    const kr = snaps?.kr ?? [];
    const us = snaps?.us ?? [];
    const coins = snaps?.coins ?? [];

    // Redis null이거나 3개 배열 모두 비어있으면 503 반환
    // (데이터 소스 전체 장애 — 클라이언트가 skeleton/재시도 표시)
    if (!fromCache || (kr.length === 0 && us.length === 0 && coins.length === 0)) {
      return new Response(JSON.stringify({
        error: 'Service Unavailable — 캐시 데이터 없음',
        kr: [],
        us: [],
        coins: [],
        ts: Date.now(),
        _fromCache: fromCache,
      }), {
        status: 503,
        headers: CORS_HEADERS,
      });
    }

    const payload = {
      kr,
      us,
      coins,
      ts: Date.now(),
      _fromCache: fromCache,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
