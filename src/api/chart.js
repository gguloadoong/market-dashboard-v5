// 캔들차트 OHLCV 데이터
// corsproxy.io 제거 — allorigins 단일 프록시 사용 (verified working)

async function fetchWithProxy(targetUrl) {
  const encoded = encodeURIComponent(targetUrl);

  // allorigins /get (primary)
  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encoded}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const json = await res.json();
      if (json.contents) return JSON.parse(json.contents);
    }
  } catch {}

  // allorigins /raw (fallback)
  try {
    const res = await fetch(
      `https://api.allorigins.win/raw?url=${encoded}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) return res.json();
  } catch {}

  throw new Error('프록시 실패');
}

// 캔들 데이터 정제 — null 제거 + 날짜 중복 제거 (lightweight-charts setData 오류 방지)
function cleanCandles(candles) {
  const seen = new Set();
  return candles
    .filter(c => c.time && c.open != null && c.close != null && c.high != null && c.low != null)
    .filter(c => {
      if (seen.has(c.time)) return false;
      seen.add(c.time);
      return true;
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

// ─── CoinGecko OHLC (코인 캔들) ──────────────────────────────
export async function fetchCoinCandles(coinId, days = 14) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`CoinGecko OHLC ${res.status}`);
  const raw = await res.json();
  const candles = raw.map(([ts, open, high, low, close]) => ({
    time:  new Date(ts).toISOString().split('T')[0],
    open, high, low, close,
  }));
  return cleanCandles(candles);
}

// ─── Yahoo Finance v8 차트 (주식 캔들) ───────────────────────
export async function fetchStockCandles(symbol, range = '1mo') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  const data = await fetchWithProxy(url);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data: ${symbol}`);

  const timestamps = result.timestamp ?? [];
  const quotes = result.indicators?.quote?.[0] ?? {};
  const { open = [], high = [], low = [], close = [] } = quotes;

  const candles = timestamps.map((ts, i) => ({
    time:  new Date(ts * 1000).toISOString().split('T')[0],
    open:  open[i],
    high:  high[i],
    low:   low[i],
    close: close[i],
  }));
  return cleanCandles(candles);
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
    return fetchCoinCandles(item.id, coinDays);
  }
  // 한국주식: .KS suffix, 미국주식: 그대로
  const sym = item.market === 'kr' ? `${item.symbol}.KS` : item.symbol;
  return fetchStockCandles(sym, range);
}
