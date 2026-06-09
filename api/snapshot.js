// api/snapshot.js — 전종목 가격 스냅샷 반환 (Edge Function)
// Redis 캐시에서 즉시 반환. 캐시 미스 시 빈 배열 (클라이언트가 skeleton 표시)
// [최적화] ETag/304 + 필드 스트리핑
export const config = { runtime: 'edge' };

import { getAllSnaps, getHotSnaps, getCronHealth, getCronLastOk } from './_price-cache.js';

// CORS 공통 헤더
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

// ─── 필드 스트리핑 (화면에 사용하는 필드만 전송) ───────────────
// 제거: Coins→highPrice/lowPrice
// #185: KR exchange(kospi/kosdaq) 보존 — 뱃지 렌더링 회귀 방지.
// #334: 네이버 연장세션 필드 5종(extendedPrice/extendedChangePct/extendedSessionType/extendedStatus/extendedAt) 패스쓰루.
//       _price-cache.js mergeExtended 가 hot/all snap 에 머지한 값을 stripStocks 가 잘라내지 않도록 화이트리스트 확장.
function stripStocks(items) {
  if (!Array.isArray(items)) return items;
  return items.map(({
    symbol, name, price, change, changePct, volume, marketCap, market, exchange,
    extendedPrice, extendedChangePct, extendedSessionType, extendedStatus, extendedAt,
  }) => ({
    symbol, name, price, change, changePct, volume, marketCap, market, exchange,
    extendedPrice, extendedChangePct, extendedSessionType, extendedStatus, extendedAt,
  }));
}

// #335: accTradePrice24h 추가 — 코인 거래대금 복구 (volume24h는 0 고정이라 사용 불가).
//       소스(update-coins.js)는 t.acc_trade_price_24h로 채우지만 strip에서 버려졌음.
//       주도주 알고리즘(leadingStocks.js)이 코인 회전율 대체값으로 소비.
function stripCoins(items) {
  if (!Array.isArray(items)) return items;
  return items.map(({ id, symbol, name, market, priceKrw, change24h, priceUsd, marketCap, volume24h, accTradePrice24h }) =>
    ({ id, symbol, name, market, priceKrw, change24h, priceUsd, marketCap, volume24h, accTradePrice24h }));
}

// ─── ETag: JSON 문자열 해시 (모든 필드 변경 감지, 충돌 불가) ────
function simpleHash(str) {
  // DJB2 해시 — 빠르고 충돌 적음 (암호학적 보안 불필요)
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
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
      // 인증: CRON_SECRET 설정 시 Bearer 토큰 필수 (미설정 시 인증 없이 허용 — 개발 환경 대응)
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

    // #185: tier 분기 — `?tier=hot` 은 Top 200 사전 계산 키, `?tier=full`(기본) 은 전종목.
    //       ETag 네임스페이스 분리(hot-* / full-*) → tier 간 교차 오염 방지.
    const tier = url.searchParams.get('tier') === 'hot' ? 'hot' : 'full';

    if (tier === 'hot') {
      // #380: 스냅샷과 asOf(마지막 크론 성공 시각) 병렬 조회 — asOf 실패해도 스냅샷은 진행.
      const [snaps, asOf] = await Promise.all([getHotSnaps(), getCronLastOk()]);
      // Redis 연결 실패 → 503 (hot 도 Redis 의존)
      if (!snaps) {
        return new Response(JSON.stringify({
          error: 'Service Unavailable — Redis 연결 실패',
          kr: [], us: [], coins: [],
          ts: Date.now(), _fromCache: false,
        }), { status: 503, headers: CORS_HEADERS });
      }
      // hot 키 미존재(크론 첫 실행 전 등) → 빈 배열 + _fromCache:false 로 graceful degrade.
      const kr = stripStocks(snaps.kr ?? []);
      const us = stripStocks(snaps.us ?? []);
      const coins = stripCoins(snaps.coins ?? []);
      const hasAny = kr.length + us.length + coins.length > 0;
      // ETag는 데이터 내용([kr,us,coins])만 해시 — asOf/ts/_fromCache 제외(매 응답 변동 → 304 캐시 유지, #331 회귀 방지).
      const etag = `"hot-${simpleHash(JSON.stringify([kr, us, coins]))}"`;
      const body = JSON.stringify({ kr, us, coins, asOf, ts: Date.now(), _fromCache: hasAny, tier: 'hot' });
      const clientETag = request.headers.get('if-none-match');
      if (clientETag === etag) {
        return new Response(null, {
          status: 304,
          headers: { 'Access-Control-Allow-Origin': '*', 'ETag': etag },
        });
      }
      // #331: hot s-maxage 30→60 — Upstash bandwidth 12.7배 초과 대응.
      //       cron 갱신 주기 5분 대비 1분 stale은 충분히 안전 (hot 키는 자주 변동).
      return new Response(body, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=30',
          'ETag': etag,
        },
      });
    }

    // #380: 전종목 스냅샷과 asOf(마지막 크론 성공 시각) 병렬 조회.
    const [snaps, asOf] = await Promise.all([getAllSnaps(), getCronLastOk()]);
    const fromCache = snaps !== null;

    // Redis 연결 자체가 안 되면 503 (인프라 장애)
    // 코인은 24시간 거래 → coins가 비어있으면 실제 장애
    // KR/US는 장외시간에 빈 배열일 수 있으므로 503 조건에서 제외
    if (!fromCache) {
      return new Response(JSON.stringify({
        error: 'Service Unavailable — Redis 연결 실패',
        kr: [], us: [], coins: [],
        ts: Date.now(), _fromCache: false,
      }), { status: 503, headers: CORS_HEADERS });
    }

    // 필드 스트리핑
    const kr = stripStocks(snaps?.kr ?? []);
    const us = stripStocks(snaps?.us ?? []);
    const coins = stripCoins(snaps?.coins ?? []);

    // ── ETag: 데이터 내용 해시 (ts/_fromCache 제외 — 매번 바뀌므로) ──
    // #185: "full-" 프리픽스 — hot 과 ETag 네임스페이스 분리.
    const etag = `"full-${simpleHash(JSON.stringify([kr, us, coins]))}"`;
    // asOf는 ETag 해시에서 제외(ts/_fromCache와 동일) — 매 응답 변동값이라 포함 시 304 캐시 깨짐(#331).
    const body = JSON.stringify({ kr, us, coins, asOf, ts: Date.now(), _fromCache: fromCache, tier: 'full' });
    const clientETag = request.headers.get('if-none-match');
    if (clientETag === etag) {
      return new Response(null, {
        status: 304,
        headers: { 'Access-Control-Allow-Origin': '*', 'ETag': etag },
      });
    }

    // Cache-Control 설계 (Upstash bandwidth 보호):
    // - max-age=0: 브라우저 HTTP 캐시 비활성 → 클라이언트 ETag 재검증 경로 보존
    // - #331: s-maxage 60→120 — Upstash bandwidth 12.7배 초과 대응.
    //   CDN cache hit률 ~2배 → Redis MGET 호출 ~50% 감소.
    //   CF Workers cron이 5분 주기로 snap 갱신 → 2분 stale은 5분 cycle 내 안전.
    // - stale-while-revalidate=60 추가 (#350): s-maxage=120 만료 직후 최대 60s만 stale
    //   (총 stale 상한 180s) → CF Workers cron 5분(300s) 주기 대비 짧아 '수분 누적' 아님.
    //   ETag 재검증 유지 → 데이터 변경 시 304 아닌 200 반환. SWR을 s-maxage의 절반으로
    //   제한해 백그라운드 갱신 1건만 Redis MGET 호출 → bandwidth 추가 절감.
    //   ※ full tier의 서버측 소비자(check-signal-accuracy cron)는 정확도를 위해
    //     ?fresh=<ts> + cache:no-store로 CDN/SWR을 우회하므로 SWR staleness 영향 없음.
    return new Response(body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=60',
        'ETag': etag,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
