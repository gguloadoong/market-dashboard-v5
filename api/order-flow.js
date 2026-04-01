// Binance 호가창 불균형 — bid/ask 볼륨 분석
export const config = { runtime: 'edge' };

export default async function handler(request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase();

  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ imbalance: null, error: 'fetch_failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await res.json();
    const bids = data.bids ?? [];
    const asks = data.asks ?? [];

    // bid/ask 가중 볼륨 계산 (가격 * 수량)
    const bidVolume = bids.reduce((sum, [price, qty]) => sum + parseFloat(price) * parseFloat(qty), 0);
    const askVolume = asks.reduce((sum, [price, qty]) => sum + parseFloat(price) * parseFloat(qty), 0);

    const total = bidVolume + askVolume;
    if (total === 0) {
      return new Response(JSON.stringify({ imbalance: 0, signal: 'neutral' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const imbalance = (bidVolume - askVolume) / total;
    let signal = 'neutral';
    if (imbalance > 0.3) signal = 'bullish';
    else if (imbalance < -0.3) signal = 'bearish';

    const bestBid = bids[0]?.[0] ? parseFloat(bids[0][0]) : null;
    const bestAsk = asks[0]?.[0] ? parseFloat(asks[0][0]) : null;
    const spread = bestBid && bestAsk ? ((bestAsk - bestBid) / bestBid) * 100 : null;

    return new Response(
      JSON.stringify({
        symbol, bidVolume: parseFloat(bidVolume.toFixed(2)),
        askVolume: parseFloat(askVolume.toFixed(2)),
        imbalance: parseFloat(imbalance.toFixed(4)),
        spread: spread ? parseFloat(spread.toFixed(4)) : null,
        signal,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ imbalance: null, error: e.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
