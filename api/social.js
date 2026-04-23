// StockTwits 감성 — 무료, 키 없음
export const config = { runtime: 'edge' };

export default async function handler(request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol') || 'AAPL';

  try {
    const res = await fetch(
      `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketBot/1.0)' },
        signal: AbortSignal.timeout(6000),
      },
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ bullRatio: null, error: 'stocktwits_failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await res.json();
    const messages = data.messages ?? [];

    let bullCount = 0;
    let bearCount = 0;
    let neutralCount = 0;

    for (const msg of messages) {
      const sentiment = msg.entities?.sentiment?.basic;
      if (sentiment === 'Bullish') bullCount++;
      else if (sentiment === 'Bearish') bearCount++;
      else neutralCount++;
    }

    const total = bullCount + bearCount;
    const bullRatio = total > 0 ? bullCount / total : null;

    return new Response(
      JSON.stringify({
        symbol,
        bullCount, bearCount, neutralCount,
        totalMessages: messages.length,
        sentimentMessages: total,
        bullRatio: bullRatio !== null ? parseFloat(bullRatio.toFixed(4)) : null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ bullRatio: null, error: e.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
