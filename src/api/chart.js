// 캔들차트 OHLCV 데이터

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
      const text = typeof json === 'string' ? json : json.contents ?? JSON.stringify(json);
      return JSON.parse(text);
    } catch { continue; }
  }
  throw new Error('모든 프록시 실패');
}

// ─── CoinGecko OHLC (코인 캔들) ──────────────────────────────
// returns [{time, open, high, low, close}]
export async function fetchCoinCandles(coinId, days = 14) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`CoinGecko OHLC ${res.status}`);
  const raw = await res.json(); // [[timestamp, open, high, low, close], ...]
  return raw.map(([ts, open, high, low, close]) => ({
    time:  new Date(ts).toISOString().split('T')[0],
    open, high, low, close,
  }));
}

// ─── Yahoo Finance v8 차트 (주식 캔들) ───────────────────────
// range: '1wk','1mo','3mo','1y'  interval: '1d','1wk'
export async function fetchStockCandles(symbol, range = '1mo') {
  const yfSym = symbol.includes('.') ? symbol : symbol;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSym}?interval=1d&range=${range}`;
  const data = await fetchWithProxy(url);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data: ${symbol}`);

  const timestamps = result.timestamp ?? [];
  const quotes = result.indicators?.quote?.[0] ?? {};
  const { open = [], high = [], low = [], close = [] } = quotes;

  return timestamps.map((ts, i) => ({
    time:  new Date(ts * 1000).toISOString().split('T')[0],
    open:  open[i],
    high:  high[i],
    low:   low[i],
    close: close[i],
  })).filter(c => c.open && c.close);
}

// ─── 기간 → Yahoo range 변환 ─────────────────────────────────
export const PERIOD_MAP = {
  '1주': { range: '5d',  coinDays: 1  },
  '1달': { range: '1mo', coinDays: 14 },
  '3달': { range: '3mo', coinDays: 30 },
  '1년': { range: '1y',  coinDays: 90 },
};

export async function fetchCandles(item, period = '1달') {
  const { range, coinDays } = PERIOD_MAP[period] ?? PERIOD_MAP['1달'];
  if (item.id) {
    // 코인
    return fetchCoinCandles(item.id, coinDays);
  } else {
    // 주식 (한국: .KS 붙임)
    const sym = item.market === 'kr' ? `${item.symbol}.KS` : item.symbol;
    return fetchStockCandles(sym, range);
  }
}
