// 주식 데이터
// 미국: Stooq.com (CORS OK) → Yahoo Finance v7 프록시 fallback → v8 chart fallback
// 한국: Naver Finance 모바일 API via allorigins → Yahoo .KS 프록시 fallback

const PROXY_BASE = 'https://api.allorigins.win/get?url=';

async function proxyFetch(targetUrl) {
  const res = await fetch(`${PROXY_BASE}${encodeURIComponent(targetUrl)}`, {
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const json = await res.json();
  const text = json.contents ?? JSON.stringify(json);
  return JSON.parse(text);
}

// ─── Stooq.com (미국 주식, CORS 허용) ────────────────────────
async function fetchStooq(symbols) {
  const syms = symbols.map(s => `${s.toLowerCase()}.us`).join(',');
  const url  = `https://stooq.com/q/l/?s=${syms}&f=sd2t2ohlcvn&h&e=json`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const data = await res.json();
  return (data.symbols || [])
    .filter(s => s.Close && s.Close !== 'N/D' && parseFloat(s.Close) > 0)
    .map(s => {
      const close = parseFloat(s.Close);
      const open  = parseFloat(s.Open) || close;
      return {
        symbol:    s.Symbol.split('.')[0].toUpperCase(),
        price:     close,
        // Stooq: 전일 종가 없음 → open 기준 근사치
        change:    parseFloat((close - open).toFixed(2)),
        changePct: parseFloat(((close - open) / open * 100).toFixed(2)),
        volume:    parseInt(s.Volume) || 0,
      };
    });
}

// ─── Yahoo Finance v7 (배치) via allorigins ───────────────────
async function fetchYahooQuoteBatch(symbols) {
  const url  = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`;
  const data = await proxyFetch(url);
  return data?.quoteResponse?.result ?? [];
}

// ─── Yahoo Finance v8 chart (단일, fallback) ─────────────────
async function fetchYahooChart(symbol) {
  const url    = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  const data   = await proxyFetch(url);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No chart: ${symbol}`);
  const meta   = result.meta;
  const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
  const prev   = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
  return {
    symbol:    meta.symbol?.split('.')[0],
    price:     meta.regularMarketPrice,
    change:    meta.regularMarketPrice - prev,
    changePct: ((meta.regularMarketPrice - prev) / prev) * 100,
    volume:    meta.regularMarketVolume,
    high52w:   meta.fiftyTwoWeekHigh,
    low52w:    meta.fiftyTwoWeekLow,
    sparkline: closes.slice(-20),
  };
}

// ─── 미국 주식 ─────────────────────────────────────────────────
export async function fetchUsStocksBatch(symbols) {
  // 1) Stooq (가장 빠르고 안정적)
  try {
    const data = await fetchStooq(symbols);
    if (data.length >= symbols.length * 0.7) return data;
  } catch {}

  // 2) Yahoo v7 batch via proxy
  try {
    const results = await fetchYahooQuoteBatch(symbols);
    if (results.length > 0) return results.map(r => ({
      symbol:    r.symbol,
      price:     r.regularMarketPrice,
      change:    r.regularMarketChange,
      changePct: r.regularMarketChangePercent,
      volume:    r.regularMarketVolume,
      marketCap: r.marketCap,
      high52w:   r.fiftyTwoWeekHigh,
      low52w:    r.fiftyTwoWeekLow,
    }));
  } catch {}

  // 3) Yahoo v8 개별 chart
  const settled = await Promise.allSettled(symbols.map(fetchYahooChart));
  return settled.filter(r => r.status === 'fulfilled').map(r => r.value);
}

// ─── Naver Finance 모바일 API (한국 주식) ────────────────────
async function fetchNaverSingle(symbol) {
  const url  = `https://m.stock.naver.com/api/stock/${symbol}/basic`;
  const data = await proxyFetch(url);
  const toNum = s => parseFloat((s || '').toString().replace(/,/g, '')) || 0;

  const price     = toNum(data.closePrice);
  const change    = toNum(data.compareToPreviousClosePrice);
  const changePct = toNum(data.fluctuationsRatio);
  const volume    = toNum(data.accumulatedTradingVolume);

  if (!price) throw new Error(`${symbol}: no price`);
  return { symbol, price, change, changePct, volume };
}

// ─── 한국 주식 배치 ────────────────────────────────────────────
export async function fetchKoreanStocksBatch(stocks) {
  // 1) Naver Finance (가장 정확한 국내 주가)
  try {
    const results = await Promise.allSettled(
      stocks.map(s => fetchNaverSingle(s.symbol))
    );
    const valid = results
      .filter(r => r.status === 'fulfilled' && r.value.price > 0)
      .map(r => r.value);
    if (valid.length >= stocks.length * 0.5) return valid;
  } catch {}

  // 2) Yahoo Finance .KS via proxy
  try {
    const symbols = stocks.map(s => `${s.symbol}.KS`);
    const results = await fetchYahooQuoteBatch(symbols);
    if (results.length > 0) return results.map(r => ({
      symbol:    r.symbol.replace('.KS', ''),
      price:     r.regularMarketPrice,
      change:    r.regularMarketChange,
      changePct: r.regularMarketChangePercent,
      volume:    r.regularMarketVolume,
      marketCap: r.marketCap,
      high52w:   r.fiftyTwoWeekHigh,
      low52w:    r.fiftyTwoWeekLow,
    }));
  } catch {}

  return [];
}

// ─── 지수 ────────────────────────────────────────────────────
// 국내: Naver Finance 모바일 API (KOSPI/KOSDAQ 전용, 가장 정확)
// 해외: Yahoo Finance via 여러 프록시 순서대로 시도
const toNum = s => parseFloat((s || '').toString().replace(/,/g, '')) || 0;

async function fetchNaverIndex(code) {
  const url = `https://m.stock.naver.com/api/index/${code}/basic`;
  const data = await proxyFetch(url);
  const val  = toNum(data.closePrice || data.indexNowValue);
  if (!val) throw new Error(`${code} no value`);
  return {
    id:        code,
    value:     val,
    change:    toNum(data.compareToPreviousClosePrice || data.stockExchangeType?.compareToPreviousClosePrice),
    changePct: toNum(data.fluctuationsRatio || data.stockExchangeType?.fluctuationsRatio),
  };
}

// 여러 프록시로 Yahoo Finance 시도
async function fetchYahooViaProxy(symbol, id) {
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`)}`,
  ];
  for (const proxyUrl of proxies) {
    try {
      const res  = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const json = await res.json();
      const raw  = json.contents ? JSON.parse(json.contents) : json;
      const meta = raw?.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) continue;
      const prev = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
      return {
        id,
        value:     meta.regularMarketPrice,
        change:    parseFloat((meta.regularMarketPrice - prev).toFixed(2)),
        changePct: parseFloat(((meta.regularMarketPrice - prev) / prev * 100).toFixed(2)),
      };
    } catch {}
  }
  throw new Error(`${symbol} all proxies failed`);
}

const US_INDEX_SYMBOLS = {
  'SPX': '^GSPC',
  'NDX': '^IXIC',
  'DJI': '^DJI',
  'DXY': 'DX-Y.NYB',
};

export async function fetchIndices() {
  // 국내 지수: Naver Finance (정확도 최우선)
  const krIndices = await Promise.allSettled([
    fetchNaverIndex('KOSPI'),
    fetchNaverIndex('KOSDAQ'),
  ]);

  // 해외 지수: Yahoo Finance via proxy
  const usIndices = await Promise.allSettled(
    Object.entries(US_INDEX_SYMBOLS).map(([id, sym]) => fetchYahooViaProxy(sym, id))
  );

  return [
    ...krIndices.filter(r => r.status === 'fulfilled').map(r => r.value),
    ...usIndices.filter(r => r.status === 'fulfilled').map(r => r.value),
  ];
}
