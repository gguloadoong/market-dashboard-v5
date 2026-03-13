// Yahoo Finance API via allorigins.win 프록시

const PROXY = 'https://api.allorigins.win/get?url=';

function yahooChartUrl(symbol, interval = '1d', range = '5d') {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
}

async function fetchYahoo(symbol, interval = '1d', range = '5d') {
  const target = yahooChartUrl(symbol, interval, range);
  const url = `${PROXY}${encodeURIComponent(target)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`proxy error ${res.status}`);
  const json = await res.json();
  return JSON.parse(json.contents);
}

export async function fetchUsStockQuote(symbol) {
  const data = await fetchYahoo(symbol, '1d', '5d');
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${symbol}`);

  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closes.filter(Boolean);

  return {
    symbol: meta.symbol,
    price: meta.regularMarketPrice,
    previousClose: meta.previousClose ?? meta.chartPreviousClose,
    change: meta.regularMarketPrice - (meta.previousClose ?? meta.chartPreviousClose),
    changePct: ((meta.regularMarketPrice - (meta.previousClose ?? meta.chartPreviousClose)) / (meta.previousClose ?? meta.chartPreviousClose)) * 100,
    volume: meta.regularMarketVolume,
    high52w: meta.fiftyTwoWeekHigh,
    low52w: meta.fiftyTwoWeekLow,
    sparkline: validCloses.slice(-20),
  };
}

export async function fetchUsStocksBatch(symbols) {
  const results = await Promise.allSettled(
    symbols.map(sym => fetchUsStockQuote(sym))
  );
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

export async function fetchIndexQuote(symbol) {
  try {
    const data = await fetchYahoo(symbol, '1d', '1d');
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      id: symbol,
      value: meta.regularMarketPrice,
      change: meta.regularMarketPrice - (meta.previousClose ?? meta.chartPreviousClose),
      changePct: ((meta.regularMarketPrice - (meta.previousClose ?? meta.chartPreviousClose)) / (meta.previousClose ?? meta.chartPreviousClose)) * 100,
    };
  } catch {
    return null;
  }
}

export async function fetchIndices() {
  const symbols = ['^KS11', '^KQ11', '^GSPC', '^IXIC', '^DJI', 'DX-Y.NYB'];
  const idMap = { '^KS11': 'KOSPI', '^KQ11': 'KOSDAQ', '^GSPC': 'SPX', '^IXIC': 'NDX', '^DJI': 'DJI', 'DX-Y.NYB': 'DXY' };

  const results = await Promise.allSettled(symbols.map(s => fetchIndexQuote(s)));
  return results
    .map((r, i) => r.status === 'fulfilled' && r.value ? { ...r.value, id: idMap[symbols[i]] } : null)
    .filter(Boolean);
}
