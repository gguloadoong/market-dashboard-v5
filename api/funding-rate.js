// Bybit Futures Funding Rate + Open Interest (Binance 클라우드 IP 차단 대체)
export const config = { runtime: 'edge' };

const BYBIT_BASE = 'https://api.bybit.com/v5/market/tickers?category=linear';

export default async function handler(request) {
  const url = new URL(request.url);
  const rawSymbol = (url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase();
  // Bybit 심볼 형식: BTCUSDT (그대로 사용)
  const symbol = rawSymbol;

  try {
    const res = await fetch(`${BYBIT_BASE}&symbol=${symbol}`, { signal: AbortSignal.timeout(6000) });

    if (!res.ok) {
      return new Response(JSON.stringify({ fundingRate: null, error: 'fetch_failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await res.json();
    const ticker = data?.result?.list?.[0];

    if (!ticker) {
      return new Response(JSON.stringify({ fundingRate: null, error: 'no_ticker' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const fundingRate = parseFloat(ticker.fundingRate ?? 0);
    const openInterest = parseFloat(ticker.openInterest ?? 0);
    const markPrice = parseFloat(ticker.markPrice ?? 0);

    const ratePercent = fundingRate * 100;
    let signal = 'neutral';
    if (ratePercent > 0.05) signal = 'bearish';
    else if (ratePercent < -0.05) signal = 'bullish';

    return new Response(
      JSON.stringify({ symbol, fundingRate, ratePercent: parseFloat(ratePercent.toFixed(4)), openInterest, markPrice, signal }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=30',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ fundingRate: null, error: e.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
