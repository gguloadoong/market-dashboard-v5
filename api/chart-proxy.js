// api/chart-proxy.js — Yahoo Finance 차트 데이터 Vercel 프록시
// CORS 우회 + 서버사이드 취득으로 allorigins 불안정 문제 해소
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');
  const range  = searchParams.get('range') || '1mo';

  if (!symbol) {
    return new Response(JSON.stringify({ error: 'symbol required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
