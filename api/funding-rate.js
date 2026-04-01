// Binance Futures Funding Rate + Open Interest
export const config = { runtime: 'edge' };

const BINANCE_FUTURES = 'https://fapi.binance.com/fapi/v1';

export default async function handler(request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase();

  try {
    const [premRes, oiRes] = await Promise.allSettled([
      fetch(`${BINANCE_FUTURES}/premiumIndex?symbol=${symbol}`, { signal: AbortSignal.timeout(6000) }),
      fetch(`${BINANCE_FUTURES}/openInterest?symbol=${symbol}`, { signal: AbortSignal.timeout(6000) }),
    ]);

    let fundingRate = null;
    let openInterest = null;
    let markPrice = null;

    if (premRes.status === 'fulfilled' && premRes.value.ok) {
      const d = await premRes.value.json();
      fundingRate = parseFloat(d.lastFundingRate ?? d.fundingRate ?? 0);
      markPrice = parseFloat(d.markPrice ?? 0);
    }

    if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
      const d = await oiRes.value.json();
      openInterest = parseFloat(d.openInterest ?? 0);
    }

    if (fundingRate === null) {
      return new Response(JSON.stringify({ fundingRate: null, error: 'fetch_failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

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
          'Cache-Control': 'public, max-age=60',
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
