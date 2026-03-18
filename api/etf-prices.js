// api/etf-prices.js — US ETF 가격 배치 조회 Vercel 프록시
// 클라이언트 직접 Yahoo 호출 대신 서버사이드 취득으로 CORS·레이트리밋 해소
// 소형 ETF(ETHU, BITX, TSLL, CONL 등) 커버리지 우수
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return new Response(JSON.stringify({ error: 'symbols required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (symbols.length === 0) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results = [];

  // 1) Yahoo v7 배치 (커버리지 우수, ETF 최적)
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const data = await res.json();
      const quotes = data?.quoteResponse?.result ?? [];
      for (const q of quotes) {
        if (q.regularMarketPrice > 0) {
          results.push({
            symbol:    q.symbol,
            price:     q.regularMarketPrice,
            change:    q.regularMarketChange ?? 0,
            changePct: q.regularMarketChangePercent ?? 0,
            volume:    q.regularMarketVolume ?? 0,
          });
        }
      }
      if (results.length >= symbols.length * 0.7) {
        return new Response(JSON.stringify({ results }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=60',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }
  } catch {}

  // 2) Yahoo v8 개별 chart fallback — v7에서 누락된 심볼 보완
  const found = new Set(results.map(r => r.symbol));
  const missing = symbols.filter(s => !found.has(s));

  const settled = await Promise.allSettled(
    missing.map(async (symbol) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`Yahoo v8 ${res.status}`);
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta || !meta.regularMarketPrice) throw new Error('no price');
      const prev = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
      return {
        symbol,
        price:     meta.regularMarketPrice,
        change:    meta.regularMarketPrice - prev,
        changePct: ((meta.regularMarketPrice - prev) / prev) * 100,
        volume:    meta.regularMarketVolume ?? 0,
      };
    })
  );

  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(r.value);
  }

  return new Response(JSON.stringify({ results }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
