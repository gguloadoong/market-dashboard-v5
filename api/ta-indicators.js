// api/ta-indicators.js — 기술적 분석 지표 계산 Edge Function
// OHLCV 데이터를 가져와 RSI, MACD, BB, MA, 거래량 모멘텀 계산 후 반환
// Redis 캐싱 (5분 TTL)
import { getSnap, setSnap } from './_price-cache.js';

export const config = { runtime: 'edge' };

const TA_CACHE_PREFIX = 'ta:';
const TA_TTL = 300; // 5분

// ─── TA 계산 함수 (서버 측 인라인) ──
// ⚠️ src/engine/taCalculator.js와 동일 로직 유지 필수
// 수정 시 양쪽 동시 업데이트 (Vercel Edge는 src/ ESM import 불가)

function sma(data, period) {
  if (data.length < period) return null;
  return data.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function emaArray(data, period) {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  const result = new Array(data.length).fill(0);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  result[period - 1] = sum / period;
  for (let i = period; i < data.length; i++) result[i] = data[i] * k + result[i - 1] * (1 - k);
  return result;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const value = 100 - 100 / (1 + rs);
  let score = 0;
  if (value <= 30) score = 30 * (1 - value / 30);
  else if (value >= 70) score = -30 * ((value - 70) / 30);
  else score = (50 - value) * (30 / 20) * 0.3; // taCalculator.js와 동일
  return { value: +value.toFixed(2), score: +score.toFixed(1) };
}

function calcMACD(closes) {
  if (closes.length < 35) return null;
  const emaF = emaArray(closes, 12);
  const emaS = emaArray(closes, 26);
  if (!emaF || !emaS) return null;
  const macdLine = [];
  for (let i = 25; i < closes.length; i++) macdLine.push(emaF[i] - emaS[i]);
  if (macdLine.length < 10) return null;
  const sigLine = emaArray(macdLine, 9);
  if (!sigLine) return null;
  const last = macdLine.length - 1;
  const prev = last - 1;
  const histogram = macdLine[last] - sigLine[last];
  const prevHist = macdLine[prev] - sigLine[prev];
  const crossUp = macdLine[prev] <= sigLine[prev] && macdLine[last] > sigLine[last];
  const crossDown = macdLine[prev] >= sigLine[prev] && macdLine[last] < sigLine[last];
  let score = crossUp ? 25 : crossDown ? -25 : Math.max(-15, Math.min(15, (histogram - prevHist) * 500));
  return { macd: +macdLine[last].toFixed(4), signal: +sigLine[last].toFixed(4), histogram: +histogram.toFixed(4), score: +score.toFixed(1) };
}

function calcBB(closes, period = 20) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period);
  const upper = mid + 2 * std, lower = mid - 2 * std;
  const cur = closes[closes.length - 1];
  const bw = upper - lower;
  const pctB = bw > 0 ? (cur - lower) / bw : 0.5;
  let score = 0;
  if (pctB < 0) score = 20; else if (pctB > 1) score = -20;
  else if (pctB < 0.2) score = 15 * (1 - pctB / 0.2);
  else if (pctB > 0.8) score = -15 * ((pctB - 0.8) / 0.2);
  return { upper: +upper.toFixed(2), middle: +mid.toFixed(2), lower: +lower.toFixed(2), percentB: +pctB.toFixed(3), score: +score.toFixed(1) };
}

function calcMACross(closes) {
  if (closes.length < 21) return null;
  const s5 = sma(closes, 5), s20 = sma(closes, 20);
  const ps5 = sma(closes.slice(0, -1), 5), ps20 = sma(closes.slice(0, -1), 20);
  if (s5 == null || s20 == null || ps5 == null || ps20 == null) return null;
  const crossUp = ps5 <= ps20 && s5 > s20;
  const crossDown = ps5 >= ps20 && s5 < s20;
  const gap = ((s5 - s20) / s20) * 100;
  let score = crossUp ? 15 : crossDown ? -15 : Math.max(-10, Math.min(10, gap * 3));
  return { sma5: +s5.toFixed(2), sma20: +s20.toFixed(2), crossUp, crossDown, score: +score.toFixed(1) };
}

function calcVolMom(volumes, closes) {
  if (volumes.length < 20 || closes.length < 5) return null;
  const s = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const l = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  if (l <= 0) return null;
  const ratio = s / l;
  const dir = closes[closes.length - 1] > closes[closes.length - 5] ? 'up' : 'down';
  const volSig = Math.min(10, (ratio - 1) * 10);
  const score = dir === 'up' ? volSig : -volSig;
  return { ratio: +ratio.toFixed(2), direction: dir, score: +score.toFixed(1) };
}

// ─── OHLCV 데이터 소스 ──────────────────────────────────────

async function fetchUpbitCandles(symbol, count = 60) {
  const res = await fetch(
    `https://api.upbit.com/v1/candles/days?market=KRW-${symbol}&count=${count}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  // Upbit는 최신→과거순, 뒤집어야 함
  return data.reverse().map(d => ({
    close: d.trade_price,
    volume: d.candle_acc_trade_volume,
    high: d.high_price,
    low: d.low_price,
    open: d.opening_price,
  }));
}

async function fetchBinanceCandles(symbol, count = 60) {
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=${count}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.map(d => ({
    open: +d[1], high: +d[2], low: +d[3], close: +d[4], volume: +d[5],
  }));
}

async function fetchYahooCandles(symbol, count = 60) {
  // Yahoo Finance v8 — chart-proxy와 동일 패턴 (UA 위장 없음)
  const range = count > 100 ? '1y' : '3mo';
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const result = json.chart?.result?.[0];
  if (!result?.indicators?.quote?.[0]) return null;
  const q = result.indicators.quote[0];
  const candles = [];
  for (let i = 0; i < (q.close?.length ?? 0); i++) {
    if (q.close[i] != null) {
      candles.push({ open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] });
    }
  }
  return candles.slice(-count);
}

// ─── 종목별 소스 라우팅 ──────────────────────────────────────

const COIN_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK', 'BNB'];
const KR_SYMBOLS = { '005930': '삼성전자', '000660': 'SK하이닉스', '005380': '현대차', '373220': 'LG에너지솔루션', '035420': 'NAVER' };
const US_SYMBOLS = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'META', 'GOOGL', 'AMZN', 'AMD', 'COIN', 'MSTR'];

async function fetchCandles(symbol, market) {
  if (market === 'coin') return await fetchUpbitCandles(symbol) || await fetchBinanceCandles(symbol);
  if (market === 'us') return await fetchYahooCandles(symbol);
  if (market === 'kr') return await fetchYahooCandles(`${symbol}.KS`);
  return null;
}

// ─── 메인 핸들러 ────────────────────────────────────────────

export default async function handler(req) {
  const url = new URL(req.url);
  const symbolsParam = url.searchParams.get('symbols'); // BTC,ETH,NVDA,...
  const marketParam = url.searchParams.get('market');    // coin, us, kr

  // 기본: 코인 Top 10
  let targets = [];
  if (symbolsParam) {
    const syms = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    const market = marketParam || 'coin';
    targets = syms.map(s => ({ symbol: s, market }));
  } else {
    targets = [
      ...COIN_SYMBOLS.map(s => ({ symbol: s, market: 'coin' })),
      ...US_SYMBOLS.map(s => ({ symbol: s, market: 'us' })),
      ...Object.keys(KR_SYMBOLS).map(s => ({ symbol: s, market: 'kr' })),
    ];
  }

  const results = {};

  // 동시 요청 5개씩 배치 (외부 API rate limit 방지)
  const BATCH_SIZE = 5;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(processTarget));
  }

  async function processTarget({ symbol, market }) {
    const cacheKey = `${TA_CACHE_PREFIX}${market}:${symbol}`;

    // 캐시 확인
    const cached = await getSnap(cacheKey);
    if (cached) { results[symbol] = cached; return; }

    // OHLCV 가져오기
    const candles = await fetchCandles(symbol, market);
    if (!candles || candles.length < 20) return;

    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);

    // 지표 계산
    const ta = {
      rsi: calcRSI(closes),
      macd: calcMACD(closes),
      bb: calcBB(closes),
      maCross: calcMACross(closes),
      volumeMom: calcVolMom(volumes, closes),
      symbol,
      market,
      calculatedAt: new Date().toISOString(),
    };

    // 총점
    const scores = [ta.rsi?.score, ta.macd?.score, ta.bb?.score, ta.maCross?.score, ta.volumeMom?.score].filter(s => s != null);
    ta.totalScore = scores.length > 0 ? +scores.reduce((a, b) => a + b, 0).toFixed(1) : 0;
    ta.indicatorCount = scores.length;

    // 프론트엔드 패턴 감지용 OHLCV 원본 — 서버가 fetch한 전체 60봉 전달 (패턴 감지 lookback 보존)
    ta.candles = candles.map(({ open, high, low, close, volume }) => ({ open, high, low, close, volume }));

    // 캐시 저장
    await setSnap(cacheKey, ta, TA_TTL);
    results[symbol] = ta;
  }

  return new Response(JSON.stringify({ results, ts: Date.now() }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=120, stale-while-revalidate=300',
    },
  });
}
