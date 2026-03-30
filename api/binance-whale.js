// api/binance-whale.js — 바이낸스 대형 거래 감지 (서버사이드, IP 차단 우회)
export const config = { runtime: 'edge' };

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT'];
const SYMBOL_NAMES = { BTCUSDT: 'BTC', ETHUSDT: 'ETH', SOLUSDT: 'SOL', XRPUSDT: 'XRP', BNBUSDT: 'BNB' };
const MIN_USD = 500_000; // $500K

export default async function handler() {
  try {
    // 현재가 조회
    const priceRes = await fetch('https://api.binance.com/api/v3/ticker/price', {
      signal: AbortSignal.timeout(5000),
    });
    if (!priceRes.ok) throw new Error(`Binance price ${priceRes.status}`);
    const allPrices = await priceRes.json();
    const priceMap = {};
    for (const p of allPrices) {
      if (SYMBOLS.includes(p.symbol)) priceMap[p.symbol] = parseFloat(p.price);
    }

    // 각 심볼별 최근 aggTrades 100건 조회
    const results = await Promise.allSettled(
      SYMBOLS.map(async (sym) => {
        const res = await fetch(
          `https://api.binance.com/api/v3/aggTrades?symbol=${sym}&limit=100`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return [];
        const trades = await res.json();
        const price = priceMap[sym] || 0;
        return trades
          .map(t => {
            const qty = parseFloat(t.q);
            const usdAmt = qty * price;
            return {
              id: `bn-${t.a}`,
              symbol: SYMBOL_NAMES[sym] || sym,
              price,
              qty,
              usdAmt: Math.round(usdAmt),
              side: t.m ? 'sell' : 'buy', // m=true: buyer is maker → taker는 매도
              time: t.T,
            };
          })
          .filter(t => t.usdAmt >= MIN_USD);
      })
    );

    const trades = results
      .flatMap(r => r.status === 'fulfilled' ? r.value : [])
      .sort((a, b) => b.time - a.time)
      .slice(0, 20);

    return new Response(JSON.stringify({ trades }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ trades: [], error: e.message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
