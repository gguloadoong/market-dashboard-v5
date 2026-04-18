// api/upbit-proxy.js — Upbit API CORS 우회 + CDN 캐시 활성 (#136)
// GET 요청 전용 → Vercel Edge의 s-maxage 공유 캐시로 단일 IP rate limit 회피.
//
// 지원 경로 (p 파라미터):
//   market/all   → /v1/market/all?isDetails=false         (s-maxage=1800)
//   ticker/all   → /v1/ticker/all?quote_currencies=KRW    (s-maxage=5)
//   ticker       → /v1/ticker?markets=<m>                  (s-maxage=2)

export const config = { runtime: 'edge' };

const MARKETS_REGEX = /^[A-Za-z0-9\-,]+$/;

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.searchParams.get('p');
  const markets = url.searchParams.get('m') || '';

  let target;
  let cacheTtl;
  if (path === 'market/all') {
    target = 'https://api.upbit.com/v1/market/all?isDetails=false';
    cacheTtl = 'public, s-maxage=1800';
  } else if (path === 'ticker/all') {
    target = 'https://api.upbit.com/v1/ticker/all?quote_currencies=KRW';
    cacheTtl = 'public, s-maxage=5';
  } else if (
    path === 'ticker' && markets &&
    markets.length <= 2000 && MARKETS_REGEX.test(markets)
  ) {
    target = `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(markets)}`;
    cacheTtl = 'public, s-maxage=2';
  } else {
    return new Response(JSON.stringify({ error: 'invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const r = await fetch(target, { signal: AbortSignal.timeout(8000) });
    const txt = await r.text();
    return new Response(txt, {
      status: r.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // 업스트림 에러는 no-store — 장애 응답의 장시간 CDN 캐시 방지
        'Cache-Control': r.ok ? cacheTtl : 'no-store',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'upbit upstream error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
