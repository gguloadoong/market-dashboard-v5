// api/us-price.js — 미국 주식 가격 배치 조회 Vercel 프록시
// Yahoo v7 배치 1순위 (50개씩 병렬), Stooq 개별 2순위 (fallback)
export const config = { runtime: 'edge' };

// Yahoo v7 배치 — 50개씩 청크, 병렬
async function fetchYahooV7Batch(symbols) {
  const CHUNK = 50;
  const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK) {
    chunks.push(symbols.slice(i, i + CHUNK));
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${chunk.join(',')}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Yahoo v7 ${res.status}`);
      const data = await res.json();
      const quotes = data?.quoteResponse?.result ?? [];
      return quotes.map(r => {
        const price     = r.regularMarketPrice;
        const prev      = r.previousClose || price;
        const change    = r.regularMarketChange ?? parseFloat((price - prev).toFixed(2));
        const changePct = r.regularMarketChangePercent ?? (prev > 0 ? parseFloat(((price - prev) / prev * 100).toFixed(2)) : 0);
        return {
          symbol:    r.symbol,
          price:     parseFloat(price.toFixed(2)),
          change:    parseFloat(change.toFixed(2)),
          changePct: parseFloat(changePct.toFixed(2)),
          volume:    r.regularMarketVolume ?? 0,
          marketCap: 0,
          high52w:   r.fiftyTwoWeekHigh ?? null,
          low52w:    r.fiftyTwoWeekLow  ?? null,
        };
      }).filter(r => r.price > 0);
    })
  );

  return chunkResults.flat();
}

// Stooq 개별 쿼리 — fallback (EOD 데이터)
// Stooq JSON API는 대문자 필드명 반환 (Close, Prev_Close, Volume 등)
async function fetchStooqSingle(symbol) {
  const url = `https://stooq.com/q/l/?s=${symbol.toLowerCase()}.us&f=sd2t2ohlcvnp&h&e=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const data = await res.json();
  // Stooq JSON 필드명: 소문자 (close, previous, volume 등)
  const s = (data.symbols || [])[0];
  if (!s) throw new Error('N/D');
  const closeVal = s.close ?? s.Close;
  if (!closeVal || closeVal === 'N/D') throw new Error('N/D');
  const close     = parseFloat(closeVal);
  const prevClose = parseFloat(s.previous ?? s.Prev_Close) || close;
  return {
    symbol,
    price:     parseFloat(close.toFixed(2)),
    change:    prevClose > 0 ? parseFloat((close - prevClose).toFixed(2)) : 0,
    changePct: prevClose > 0 ? parseFloat(((close - prevClose) / prevClose * 100).toFixed(2)) : 0,
    volume:    parseInt(s.volume ?? s.Volume) || 0,
    marketCap: 0,
    high52w:   null,
    low52w:    null,
  };
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return new Response(JSON.stringify({ error: 'symbols required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let results = [];

  // 1순위: Yahoo v7 배치 (50개씩 병렬)
  try {
    results = await fetchYahooV7Batch(symbols);
  } catch (e) {
    console.warn('[us-price] Yahoo v7 배치 실패:', e.message);
  }

  // 70% 이상 결과면 반환, 미달이면 Stooq로 나머지 채움
  if (results.length < symbols.length * 0.7) {
    const have = new Set(results.map(r => r.symbol));
    const missing = symbols.filter(s => !have.has(s));
    const stooqSettled = await Promise.allSettled(
      missing.map(s => fetchStooqSingle(s))
    );
    for (const r of stooqSettled) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
