// api/fear-greed.js — CNN Money Fear & Greed 지수 프록시 (Edge Function)
// 클라이언트에서 직접 호출 시 CORS 차단 → 서버사이드 프록시 경유
export const config = { runtime: 'edge' };

const CNN_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';

export default async function handler() {
  try {
    const res = await fetch(CNN_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible)',
        'Accept': 'application/json',
        'Referer': 'https://edition.cnn.com/',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`CNN F&G ${res.status}`);

    const data = await res.json();
    const fg = data?.fear_and_greed;
    if (fg?.score == null) throw new Error('no score');

    return new Response(JSON.stringify({
      score: Math.round(fg.score),
      rating: fg.rating ?? '',
      previousClose: fg.previous_close ?? null,
      previousWeek: fg.previous_1_week ?? null,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    // 에러 응답에도 CORS 헤더 포함 — 브라우저가 에러 본문을 읽을 수 있도록
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
