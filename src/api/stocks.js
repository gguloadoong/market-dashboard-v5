// 주식 데이터: Yahoo Finance v7 quote (여러 프록시 시도)

const PROXIES = [
  url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

async function fetchWithProxy(targetUrl) {
  for (const makeProxy of PROXIES) {
    try {
      const res = await fetch(makeProxy(targetUrl), { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const json = await res.json();
      // allorigins wraps in { contents: "..." }
      const text = typeof json === 'string' ? json : json.contents ?? JSON.stringify(json);
      return JSON.parse(text);
    } catch { continue; }
  }
  throw new Error('모든 프록시 실패');
}

// ─── Yahoo Finance v7 quote (배치, 여러 심볼 한번에) ──────────
async function fetchYahooQuoteBatch(symbols) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`;
  const data = await fetchWithProxy(url);
  return data?.quoteResponse?.result ?? [];
}

// ─── Yahoo Finance v8 chart (단일 심볼, 스파크라인용) ─────────
async function fetchYahooChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  const data = await fetchWithProxy(url);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data: ${symbol}`);
  const meta   = result.meta;
  const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
  const prev   = meta.previousClose ?? meta.chartPreviousClose;
  return {
    symbol: meta.symbol,
    price:     meta.regularMarketPrice,
    change:    meta.regularMarketPrice - prev,
    changePct: ((meta.regularMarketPrice - prev) / prev) * 100,
    volume:    meta.regularMarketVolume,
    high52w:   meta.fiftyTwoWeekHigh,
    low52w:    meta.fiftyTwoWeekLow,
    sparkline: closes.slice(-20),
  };
}

// ─── 미국 주식 배치 fetch ─────────────────────────────────────
export async function fetchUsStocksBatch(symbols) {
  try {
    const results = await fetchYahooQuoteBatch(symbols);
    return results.map(r => {
      const prev = r.regularMarketPreviousClose ?? r.fiftyDayAverage;
      return {
        symbol:    r.symbol,
        price:     r.regularMarketPrice,
        change:    r.regularMarketChange,
        changePct: r.regularMarketChangePercent,
        volume:    r.regularMarketVolume,
        marketCap: r.marketCap,
        high52w:   r.fiftyTwoWeekHigh,
        low52w:    r.fiftyTwoWeekLow,
        sparkline: [],   // v7에는 스파크라인 없음, mock 유지
      };
    });
  } catch {
    // v7 실패 시 개별 v8 chart fetch
    const results = await Promise.allSettled(symbols.map(fetchYahooChart));
    return results.filter(r => r.status === 'fulfilled').map(r => r.value);
  }
}

// ─── 한국 주식 배치 fetch (.KS 붙여서) ───────────────────────
export async function fetchKoreanStocksBatch(stocks) {
  const symbols = stocks.map(s => `${s.symbol}.KS`);
  try {
    const results = await fetchYahooQuoteBatch(symbols);
    return results.map(r => ({
      symbol:    r.symbol.replace('.KS', ''),
      price:     r.regularMarketPrice,
      change:    r.regularMarketChange,
      changePct: r.regularMarketChangePercent,
      volume:    r.regularMarketVolume,
      marketCap: r.marketCap,
      high52w:   r.fiftyTwoWeekHigh,
      low52w:    r.fiftyTwoWeekLow,
    }));
  } catch {
    return [];
  }
}

// ─── 지수 ────────────────────────────────────────────────────
const INDEX_SYMBOLS = {
  'KOSPI':  '^KS11',
  'KOSDAQ': '^KQ11',
  'SPX':    '^GSPC',
  'NDX':    '^IXIC',
  'DJI':    '^DJI',
  'DXY':    'DX-Y.NYB',
};

export async function fetchIndices() {
  try {
    const symbols = Object.values(INDEX_SYMBOLS);
    const results = await fetchYahooQuoteBatch(symbols);
    const symToId = Object.fromEntries(Object.entries(INDEX_SYMBOLS).map(([id, sym]) => [sym, id]));
    return results.map(r => ({
      id:        symToId[r.symbol] ?? r.symbol,
      value:     r.regularMarketPrice,
      change:    r.regularMarketChange,
      changePct: r.regularMarketChangePercent,
    })).filter(r => r.value);
  } catch {
    return [];
  }
}
