// api/cron/compute-signals.js — 서버 사전 계산 시그널 cron
// Vercel Cron이 10분마다 호출: */10 * * * *
// ⚠️ src/engine/ ESM import 불가 (Edge runtime 호환) — 로직 인라인 복사
// ⚠️ 수정 시 src/engine/taCalculator.js / src/engine/compositeScorer.js 와 동기화 필수
import { getSnap, setSnap, recordCronFailure } from '../_price-cache.js';
import { timingSafeEqual } from 'crypto';

export const config = { runtime: 'nodejs', maxDuration: 120 };

// ─── 시그널 타입 (signalTypes.js 와 동기화) ─────────────────
const SIGNAL_TYPES = {
  COMPOSITE_SCORE: 'composite_score',
  SUPPORT_RESISTANCE_BREAK: 'support_resistance_break',
  DOUBLE_BOTTOM: 'double_bottom',
  RECOVERY_DETECTION: 'recovery_detection',
};

const DIRECTIONS = {
  BULLISH: 'bullish',
  BEARISH: 'bearish',
  NEUTRAL: 'neutral',
};

const SIGNAL_TTL = {
  [SIGNAL_TYPES.COMPOSITE_SCORE]: 15 * 60000,
  [SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK]: 4 * 3600000,
  [SIGNAL_TYPES.DOUBLE_BOTTOM]: 8 * 3600000,
  [SIGNAL_TYPES.RECOVERY_DETECTION]: 6 * 3600000,
};

// ─── 종목 목록 (확장) ──────────────────────────────────────
const COIN_NAMES = {
  BTC:'비트코인',ETH:'이더리움',SOL:'솔라나',XRP:'리플',DOGE:'도지코인',
  ADA:'에이다',AVAX:'아발란체',DOT:'폴카닷',LINK:'체인링크',BNB:'바이낸스코인',
  TRX:'트론',TON:'톤코인',MATIC:'폴리곤',LTC:'라이트코인',BCH:'비트코인캐시',
  UNI:'유니스왑',ATOM:'코스모스',NEAR:'니어',APT:'앱토스',
  ARB:'아비트럼',OP:'옵티미즘',SUI:'수이',HBAR:'헤데라',
  ORCA:'오르카',PYTH:'파이스',JTO:'지토',BONK:'봉크',WIF:'위프',RAY:'레이디움',TIA:'셀레스티아',
};
const US_NAMES = {
  NVDA:'엔비디아',AAPL:'애플',TSLA:'테슬라',MSFT:'마이크로소프트',META:'메타',
  GOOGL:'알파벳',AMZN:'아마존',AMD:'AMD',COIN:'코인베이스',MSTR:'마이크로스트래티지',
  PLTR:'팔란티어',ARM:'ARM',MU:'마이크론',NFLX:'넷플릭스',AVGO:'브로드컴',
  ORCL:'오라클',UBER:'우버',
};
const KR_SYMBOLS = {
  '005930':'삼성전자','000660':'SK하이닉스','005380':'현대차',
  '373220':'LG에너지솔루션','035420':'NAVER','035720':'카카오',
  '005490':'POSCO홀딩스','051910':'LG화학','006400':'삼성SDI',
  '068270':'셀트리온','012330':'현대모비스','000270':'기아',
};

const TARGETS = [
  ...Object.keys(COIN_NAMES).map(s => ({ symbol: s, name: COIN_NAMES[s], market: 'crypto' })),
  ...Object.keys(US_NAMES).map(s => ({ symbol: s, name: US_NAMES[s], market: 'us' })),
  ...Object.entries(KR_SYMBOLS).map(([code, name]) => ({ symbol: code, name, market: 'kr' })),
];

// ─── TA 계산 함수 (api/ta-indicators.js 와 동기화 필수) ──
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
  if (value < 30) score = 30 * (1 - value / 30);
  else if (value > 70) score = -30 * ((value - 70) / 30);
  else score = (50 - value) * (30 / 20) * 0.3;
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

// ─── OHLCV 데이터 소스 (api/ta-indicators.js 와 동기화 필수) ──
async function fetchUpbitCandles(symbol, count = 60) {
  const res = await fetch(
    `https://api.upbit.com/v1/candles/days?market=KRW-${symbol}&count=${count}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
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
  if (!data.length) return null;
  return data.map(d => ({
    open: +d[1], high: +d[2], low: +d[3], close: +d[4], volume: +d[5],
  }));
}

async function fetchYahooCandles(symbol, count = 60) {
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
  const sliced = candles.slice(-count);
  return sliced.length > 0 ? sliced : null;
}

async function fetchCandles(symbol, market) {
  if (market === 'crypto') return await fetchUpbitCandles(symbol) || await fetchBinanceCandles(symbol);
  if (market === 'us') return await fetchYahooCandles(symbol);
  if (market === 'kr') return await fetchYahooCandles(`${symbol}.KS`) || await fetchYahooCandles(`${symbol}.KQ`);
  return null;
}

// ─── 패턴 감지 (taCalculator.js 와 동기화 필수) ──
function findSupportResistance(candles, clusterPct = 2) {
  if (!candles || candles.length < 10) return null;
  const currentPrice = candles[candles.length - 1].close;
  if (!currentPrice) return null;

  const localMaxima = [];
  const localMinima = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const high = candles[i].high ?? candles[i].close;
    const low = candles[i].low ?? candles[i].close;
    const prevH1 = candles[i - 1].high ?? candles[i - 1].close;
    const prevH2 = candles[i - 2].high ?? candles[i - 2].close;
    const nextH1 = candles[i + 1].high ?? candles[i + 1].close;
    const nextH2 = candles[i + 2].high ?? candles[i + 2].close;
    if (high >= prevH1 && high >= prevH2 && high >= nextH1 && high >= nextH2) {
      localMaxima.push(high);
    }
    const prevL1 = candles[i - 1].low ?? candles[i - 1].close;
    const prevL2 = candles[i - 2].low ?? candles[i - 2].close;
    const nextL1 = candles[i + 1].low ?? candles[i + 1].close;
    const nextL2 = candles[i + 2].low ?? candles[i + 2].close;
    if (low <= prevL1 && low <= prevL2 && low <= nextL1 && low <= nextL2) {
      localMinima.push(low);
    }
  }

  function clusterLevels(levels) {
    if (!levels.length) return [];
    const sorted = [...levels].sort((a, b) => a - b);
    const clusters = [];
    let cluster = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const avg = cluster.reduce((a, b) => a + b, 0) / cluster.length;
      if (Math.abs(sorted[i] - avg) / avg * 100 <= clusterPct) {
        cluster.push(sorted[i]);
      } else {
        if (cluster.length >= 2) clusters.push(cluster.reduce((a, b) => a + b, 0) / cluster.length);
        cluster = [sorted[i]];
      }
    }
    if (cluster.length >= 2) clusters.push(cluster.reduce((a, b) => a + b, 0) / cluster.length);
    return clusters;
  }

  const resistances = clusterLevels(localMaxima).filter(l => l > currentPrice);
  const supports = clusterLevels(localMinima).filter(l => l < currentPrice);

  let breakType = null;
  let breakLevel = null;
  const allResistances = clusterLevels(localMaxima);
  const allSupports = clusterLevels(localMinima);

  for (const r of allResistances.sort((a, b) => a - b)) {
    const pctAbove = ((currentPrice - r) / r) * 100;
    if (pctAbove >= 1 && pctAbove <= 5) {
      breakType = 'resistance';
      breakLevel = +r.toFixed(2);
      break;
    }
  }
  if (!breakType) {
    for (const s of allSupports.sort((a, b) => b - a)) {
      const pctBelow = ((s - currentPrice) / s) * 100;
      if (pctBelow >= 1 && pctBelow <= 5) {
        breakType = 'support';
        breakLevel = +s.toFixed(2);
        break;
      }
    }
  }

  return {
    supports: supports.map(s => +s.toFixed(2)),
    resistances: resistances.map(r => +r.toFixed(2)),
    breakType,
    breakLevel,
  };
}

function detectDoubleBottom(candles, priceTolerance = 3, necklineMinPct = 5) {
  if (!candles || candles.length < 15) return null;
  const currentPrice = candles[candles.length - 1].close;
  if (!currentPrice) return null;

  const minima = [];
  for (let i = 3; i < candles.length - 3; i++) {
    const low = candles[i].low ?? candles[i].close;
    let isMin = true;
    for (let j = 1; j <= 3; j++) {
      const prevL = candles[i - j].low ?? candles[i - j].close;
      const nextL = candles[i + j].low ?? candles[i + j].close;
      if (low > prevL || low > nextL) { isMin = false; break; }
    }
    if (isMin) minima.push({ idx: i, price: low });
  }
  if (minima.length < 2) return null;

  for (let j = minima.length - 1; j >= 1; j--) {
    for (let k = j - 1; k >= 0; k--) {
      const b1 = minima[k];
      const b2 = minima[j];
      const diff = Math.abs(b1.price - b2.price) / Math.min(b1.price, b2.price) * 100;
      if (diff > priceTolerance) continue;

      let neckline = 0;
      for (let n = b1.idx; n <= b2.idx; n++) {
        const high = candles[n].high ?? candles[n].close;
        if (high > neckline) neckline = high;
      }

      const avgBottom = (b1.price + b2.price) / 2;
      const neckPct = ((neckline - avgBottom) / avgBottom) * 100;
      if (neckPct < necklineMinPct) continue;

      const approachPct = ((currentPrice - neckline) / neckline) * 100;
      const approaching = approachPct >= -3;
      if (approaching) {
        return {
          bottom1: +b1.price.toFixed(2),
          bottom2: +b2.price.toFixed(2),
          neckline: +neckline.toFixed(2),
          approaching,
          broken: approachPct > 0,
        };
      }
    }
  }
  return null;
}

function bbForRecovery(closes, period = 20) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period);
  return { upper: mid + 2 * std, lower: mid - 2 * std };
}

function detectRecovery(closes, volumes, drawdownDays = 5) {
  if (!closes || closes.length < 25 || !volumes || volumes.length < 25) return null;

  const current = closes[closes.length - 1];
  const pastIdx = Math.max(0, closes.length - 1 - drawdownDays);
  const peak = Math.max(...closes.slice(pastIdx, closes.length - 1));
  const drawdown = ((current - peak) / peak) * 100;
  if (drawdown > -10) return null;

  const recentBB = bbForRecovery(closes);
  const prevCloses = closes.slice(0, -5);
  const prevBB = bbForRecovery(prevCloses);
  if (!recentBB || !prevBB) return null;

  const recentBW = recentBB.upper - recentBB.lower;
  const prevBW = prevBB.upper - prevBB.lower;
  const bbShrink = prevBW > 0 ? recentBW / prevBW : 1;

  const recentVol = volumes.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const volRatio = avgVol > 0 ? recentVol / avgVol : 0;
  const volNormalized = volRatio <= 1.5;

  if (bbShrink <= 0.7 && volNormalized) {
    return {
      drawdown: +drawdown.toFixed(1),
      bbShrink: +bbShrink.toFixed(2),
      volRatio: +volRatio.toFixed(2),
      volNormalized,
    };
  }
  return null;
}

// ─── 복합 점수 계산 (compositeScorer.js 와 동기화 필수) ──
const WEIGHT = { ta: 0.40, flow: 0.35, sentiment: 0.25 };

function calcFlowScore(flow) {
  if (!flow) return 0;
  let score = 0;
  const { foreignBuyDays = 0, foreignSellDays = 0, instBuyDays = 0, instSellDays = 0 } = flow;
  if (foreignBuyDays >= 3) score += Math.min(40, foreignBuyDays * 8);
  else if (foreignSellDays >= 3) score -= Math.min(40, foreignSellDays * 8);
  if (instBuyDays >= 3) score += Math.min(30, instBuyDays * 6);
  else if (instSellDays >= 3) score -= Math.min(30, instSellDays * 6);
  if (foreignBuyDays >= 2 && instBuyDays >= 2) score += 15;
  else if (foreignSellDays >= 2 && instSellDays >= 2) score -= 15;
  const volRatio = flow.volumeRatio ?? 1;
  if (volRatio >= 2 && score !== 0) {
    score += Math.min(20, (volRatio - 1) * 10) * (score > 0 ? 1 : -1);
  }
  return Math.max(-100, Math.min(100, score));
}

function calcSentimentScore(sentiment) {
  if (!sentiment) return 0;
  let score = 0;
  const fg = sentiment.fearGreed;
  if (fg != null) {
    if (fg <= 20) score += 30;
    else if (fg <= 35) score += 15;
    else if (fg >= 80) score -= 30;
    else if (fg >= 65) score -= 15;
  }
  const fr = sentiment.fundingRate;
  if (fr != null) {
    const frPct = fr * 100;
    if (frPct > 0.05) score -= Math.min(25, frPct * 300);
    else if (frPct < -0.05) score += Math.min(25, Math.abs(frPct) * 300);
  }
  const pcr = sentiment.pcr;
  if (pcr != null) {
    if (pcr > 1.2) score += 20;
    else if (pcr > 1.0) score += 10;
    else if (pcr < 0.7) score -= 20;
    else if (pcr < 0.85) score -= 10;
  }
  return Math.max(-100, Math.min(100, score));
}

function calculateCompositeScore(ta, flow, sentiment) {
  const taScore = ta?.totalScore ?? 0;
  const flowScore = calcFlowScore(flow);
  const sentimentScore = calcSentimentScore(sentiment);
  const raw = taScore * WEIGHT.ta + flowScore * WEIGHT.flow + sentimentScore * WEIGHT.sentiment;
  const score = Math.max(-100, Math.min(100, raw));

  let label, direction;
  if (score >= 70) { label = '강세 흐름 진행 중'; direction = DIRECTIONS.BULLISH; }
  else if (score >= 30) { label = '상승 타이밍 접근 중'; direction = DIRECTIONS.BULLISH; }
  else if (score > -30) { label = '관망 구간'; direction = DIRECTIONS.NEUTRAL; }
  else if (score > -70) { label = '하락 압력 감지'; direction = DIRECTIONS.BEARISH; }
  else { label = '강한 하락 경고'; direction = DIRECTIONS.BEARISH; }

  return {
    score: +score.toFixed(1),
    label,
    direction,
    breakdown: {
      ta: { score: taScore, weight: WEIGHT.ta, weighted: +(taScore * WEIGHT.ta).toFixed(1) },
      flow: { score: flowScore, weight: WEIGHT.flow, weighted: +(flowScore * WEIGHT.flow).toFixed(1) },
      sentiment: { score: sentimentScore, weight: WEIGHT.sentiment, weighted: +(sentimentScore * WEIGHT.sentiment).toFixed(1) },
    },
  };
}

// ─── 시그널 ID 생성 ──────────────────────────────────────
function generateId(type, symbol) {
  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${type}:${symbol}:${dateKey}`;
}

// ─── 시그널 빌더 (순수 함수) ────────────────────────────
function buildCompositeSignal(target, score, ta, currentPrice) {
  const now = Date.now();
  const direction = score.direction;
  const strength = Math.abs(score.score) >= 70 ? 4 : 3;
  const market = target.market;
  const title = `${target.name} ${score.label} (${score.score > 0 ? '+' : ''}${score.score})`;
  return {
    id: generateId(SIGNAL_TYPES.COMPOSITE_SCORE, target.symbol),
    type: SIGNAL_TYPES.COMPOSITE_SCORE,
    symbol: target.symbol,
    name: target.name,
    market,
    direction,
    strength,
    title,
    timestamp: now,
    expiresAt: now + SIGNAL_TTL[SIGNAL_TYPES.COMPOSITE_SCORE],
    meta: {
      compositeScore: score.score,
      breakdown: score.breakdown,
      rsi: ta?.rsi?.value,
      macd: ta?.macd?.histogram,
      currentPrice,
    },
  };
}

function buildSRSignal(target, sr, currentPrice) {
  if (!sr?.breakType || !sr?.breakLevel) return null;
  const now = Date.now();
  const direction = sr.breakType === 'resistance' ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
  const market = target.market;
  const label = sr.breakType === 'resistance' ? '저항선 돌파' : '지지선 이탈';
  const title = `${target.name} ${sr.breakLevel.toLocaleString()} ${label}`;
  return {
    id: generateId(SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK, target.symbol),
    type: SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK,
    symbol: target.symbol,
    name: target.name,
    market,
    direction,
    strength: 3,
    title,
    timestamp: now,
    expiresAt: now + SIGNAL_TTL[SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK],
    meta: { name: target.name, breakType: sr.breakType, level: sr.breakLevel, currentPrice },
  };
}

function buildDBSignal(target, db, currentPrice) {
  if (!db?.approaching) return null;
  const now = Date.now();
  const market = target.market;
  const strength = db.broken ? 4 : 3;
  const label = db.broken ? '넥라인 돌파' : '넥라인 접근';
  const title = `${target.name} 이중바닥 ${label} — 넥라인 ${db.neckline.toLocaleString()}`;
  return {
    id: generateId(SIGNAL_TYPES.DOUBLE_BOTTOM, target.symbol),
    type: SIGNAL_TYPES.DOUBLE_BOTTOM,
    symbol: target.symbol,
    name: target.name,
    market,
    direction: DIRECTIONS.BULLISH,
    strength,
    title,
    timestamp: now,
    expiresAt: now + SIGNAL_TTL[SIGNAL_TYPES.DOUBLE_BOTTOM],
    meta: {
      name: target.name,
      bottom1: db.bottom1,
      bottom2: db.bottom2,
      neckline: db.neckline,
      broken: db.broken,
      currentPrice,
    },
  };
}

function buildRecoverySignal(target, rec, currentPrice) {
  if (!rec) return null;
  const now = Date.now();
  const market = target.market;
  const strength = Math.abs(rec.drawdown) >= 15 ? 4 : 3;
  const title = `${target.name} ${Math.abs(rec.drawdown).toFixed(1)}% 급락 후 안정화 — BB 축소 ${(rec.bbShrink * 100).toFixed(0)}%`;
  return {
    id: generateId(SIGNAL_TYPES.RECOVERY_DETECTION, target.symbol),
    type: SIGNAL_TYPES.RECOVERY_DETECTION,
    symbol: target.symbol,
    name: target.name,
    market,
    direction: DIRECTIONS.BULLISH,
    strength,
    title,
    timestamp: now,
    expiresAt: now + SIGNAL_TTL[SIGNAL_TYPES.RECOVERY_DETECTION],
    meta: {
      name: target.name,
      drawdown: rec.drawdown,
      bbShrink: rec.bbShrink,
      volRatio: rec.volRatio,
      currentPrice,
    },
  };
}

// ─── KR 투자자 동향 일괄 fetch (Naver Finance, 인증 불필요) ───
// 응답 shape 가정: row에 frgnNetAmt/instNetAmt 와 bizDate/baseDate 중 하나 존재
// 필드명이 모두 빗나가면 silent zero가 되어 잘못된 시그널 위험 → shape 검증 후 미일치 시 null
// 장 외(장 마감 15:30 KST 이후 ~ 다음 날 장 개시 전)에만 2h 캐시 적용
// 장 중에는 Naver 일중 데이터 변동 가능성이 있으므로 매 cron 신선 fetch
const KR_FLOW_CACHE_KEY = 'flow:kr-investors';
const KR_FLOW_CACHE_TTL = 2 * 3600;
// fetch 실패 종목 fallback용 — 마지막 성공분 24h 보존 (#216)
const KR_FLOW_LAST_GOOD_KEY = 'flow:kr-investors:last-good';
const KR_FLOW_LAST_GOOD_TTL = 24 * 3600;

// KRX 공휴일 (2025~2027 법정공휴일, marketHours.js와 동기화)
// marketHours.js와 동일한 Set — 포맷 'YYYY-M-D' (선행 0 없음)
const KRX_HOLIDAYS = new Set([
  '2025-1-1','2025-1-27','2025-1-28','2025-1-29','2025-1-30',
  '2025-3-3','2025-5-5','2025-5-6','2025-6-6','2025-8-15',
  '2025-10-2','2025-10-3','2025-10-6','2025-10-7','2025-10-8','2025-10-9','2025-12-25',
  '2026-1-1','2026-2-16','2026-2-17','2026-2-18',
  '2026-3-2','2026-5-5','2026-5-25','2026-8-17',
  '2026-9-24','2026-9-25','2026-9-28','2026-10-5','2026-10-9','2026-12-25',
  '2027-1-1','2027-2-8','2027-2-9','2027-3-1','2027-5-5','2027-5-13',
  '2027-8-16','2027-9-14','2027-9-15','2027-9-16',
  '2027-10-4','2027-10-11','2027-12-27',
]);

function isKrxMarketOpen() {
  const kstMs = Date.now() + 9 * 3600 * 1000;
  const kst = new Date(kstMs);
  const day = kst.getUTCDay(); // 0=일, 6=토
  if (day === 0 || day === 6) return false;
  const dateStr = `${kst.getUTCFullYear()}-${kst.getUTCMonth() + 1}-${kst.getUTCDate()}`;
  if (KRX_HOLIDAYS.has(dateStr)) return false;
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return minutes >= 9 * 60 && minutes < 15 * 60 + 30; // KST 09:00~15:30
}

async function fetchKrFlowMap(krSymbols) {
  // 장 중에는 캐시 skip — 장 외에만 2h 캐시 (매 cron 신선 fetch로 정확도 보장)
  const cacheKey = KR_FLOW_CACHE_KEY;
  const marketOpen = isKrxMarketOpen();
  if (!marketOpen) {
    try {
      const cached = await getSnap(cacheKey);
      if (cached && typeof cached === 'object' && krSymbols.every((s) => cached[s] != null)) {
        return new Map(Object.entries(cached));
      }
    } catch { /* cache miss → fresh fetch */ }
  }

  // 실패 종목 fallback용 — 이전 cron 성공분 사전 로드 (#216)
  let lastGood = {};
  try {
    const snap = await getSnap(KR_FLOW_LAST_GOOD_KEY);
    if (snap && typeof snap === 'object') lastGood = snap;
  } catch { /* lastGood 없으면 빈 객체 유지 */ }

  const map = new Map();
  await Promise.allSettled(
    krSymbols.map(async (symbol) => {
      try {
        const url = `https://m.stock.naver.com/api/stock/${symbol}/investors?periodType=DAILY&count=10`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            'Referer': 'https://m.stock.naver.com/',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const json = await res.json();
        const rawList = Array.isArray(json) ? json : (json.list ?? json.investorList ?? json.investors ?? []);
        if (!rawList.length) return;

        // shape 검증 — null 포함 실제 값 존재 여부 확인 (`in` 연산자는 null 값도 통과)
        const hasValidForeign = rawList.some(
          (r) => r.frgnNetAmt != null || r.frgNetAmt != null || r.foreignNetAmt != null,
        );
        const hasValidInst = rawList.some(
          (r) => r.instNetAmt != null || r.institutionNetAmt != null,
        );
        if (!hasValidForeign || !hasValidInst) {
          console.warn(`[compute-signals] ${symbol} Naver shape 불일치 — flow 미적용`);
          return;
        }

        // 최신 날짜 우선 정렬 (Naver 응답 순서 미보장)
        // stcTrdDd/bizday는 investor-trend.js에서 검증된 실제 Naver 응답 필드명
        const dateKey = (r) => String(r.stcTrdDd ?? r.bizday ?? r.bizDate ?? r.baseDate ?? r.date ?? '');
        const list = rawList.slice().sort((a, b) => dateKey(b).localeCompare(dateKey(a))).slice(0, 10);

        let foreignBuyDays = 0, foreignSellDays = 0;
        let instBuyDays = 0, instSellDays = 0;
        let fBuyStreak = true, fSellStreak = true, iBuyStreak = true, iSellStreak = true;

        const toNum = (v) => { const n = parseInt(String(v ?? 0).replace(/,/g, ''), 10); return Number.isFinite(n) ? n : 0; };
        for (const row of list) {
          const foreign = toNum(row.frgnNetAmt ?? row.frgNetAmt ?? row.foreignNetAmt);
          const inst = toNum(row.instNetAmt ?? row.institutionNetAmt);
          // 양쪽 모두 0 → 거래정지/데이터 공백일 전체 건너뜀
          if (foreign === 0 && inst === 0) continue;
          // 개별 0 → 해당 측 streak 유지 (방향 없는 날은 꺾지 않음)
          if (foreign > 0) { if (fBuyStreak) foreignBuyDays++; fSellStreak = false; }
          else if (foreign < 0) { if (fSellStreak) foreignSellDays++; fBuyStreak = false; }
          if (inst > 0) { if (iBuyStreak) instBuyDays++; iSellStreak = false; }
          else if (inst < 0) { if (iSellStreak) instSellDays++; iBuyStreak = false; }
        }

        map.set(symbol, { foreignBuyDays, foreignSellDays, instBuyDays, instSellDays, volumeRatio: 1 });
      } catch (e) {
        console.warn(`[compute-signals] ${symbol} flow fetch 실패:`, e?.message);
      }
    })
  );

  // fallback 전 신선 성공 심볼 고정 (캐시 오염 방지 — Copilot/Gemini HIGH #257)
  const freshSymbols = new Set(map.keys());

  // 실패 종목에 last-good 값 fallback (flow=null 대신 이전 성공분 사용)
  for (const symbol of krSymbols) {
    if (!map.has(symbol) && lastGood[symbol]) {
      map.set(symbol, lastGood[symbol]);
      console.warn(`[compute-signals] ${symbol} flow fallback → last-good 사용`);
    }
  }

  // 신선 성공분만 last-good에 누적 저장 (fallback 값으로 기존 last-good 덮어쓰기 방지)
  if (freshSymbols.size > 0) {
    try {
      const merged = { ...lastGood };
      for (const symbol of freshSymbols) {
        merged[symbol] = map.get(symbol);
      }
      await setSnap(KR_FLOW_LAST_GOOD_KEY, merged, KR_FLOW_LAST_GOOD_TTL);
    } catch { /* last-good 저장 실패는 무시 */ }
  }

  // 장 외 + 전수 신선 성공 시에만 전수성공 캐시 저장 (fallback 포함 시 오염 방지)
  if (!marketOpen && freshSymbols.size === krSymbols.length) {
    try {
      await setSnap(cacheKey, Object.fromEntries(map), KR_FLOW_CACHE_TTL);
    } catch { /* cache write 실패는 무시 */ }
  }

  return map;
}

// ─── 시장 sentiment 글로벌 fetch (best-effort) ──
async function fetchGlobalSentiment() {
  const sentiment = { fearGreed: null, fundingRate: null, pcr: null };
  // F&G 코인 — alternative.me
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      const v = parseInt(json?.data?.[0]?.value, 10);
      if (Number.isFinite(v)) sentiment.fearGreed = v;
    }
  } catch { /* ignore */ }
  return sentiment;
}

// ─── 메인 핸들러 ────────────────────────────────────────
export default async function handler(req, res) {
  // CRON_SECRET 인증 — Vercel 내부 cron(x-vercel-cron) 또는 Bearer 토큰
  const isVercelInternal = !!req.headers['x-vercel-cron'];
  if (!isVercelInternal) {
    const authHeader = req.headers['authorization'] || '';
    if (!process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
    const incoming = Buffer.from(authHeader);
    if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const startedAt = Date.now();
  const signals = [];
  const failed = [];

  // 글로벌 sentiment (코인 F&G)
  let globalSentiment = { fearGreed: null, fundingRate: null, pcr: null };
  try {
    globalSentiment = await fetchGlobalSentiment();
  } catch { /* ignore */ }

  // KR 투자자 동향 사전 fetch (외인/기관 연속 매수매도일 계산)
  const krSymbols = TARGETS.filter((t) => t.market === 'kr').map((t) => t.symbol);
  let krFlowMap = new Map();
  try {
    krFlowMap = await fetchKrFlowMap(krSymbols);
  } catch { /* flow=null fallback */ }

  let fetchedCount = 0;
  const BATCH_SIZE = 15; // 동시 처리 상향 — maxDuration 120s로 여유 확보

  for (let i = 0; i < TARGETS.length; i += BATCH_SIZE) {
    const batch = TARGETS.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(async (target) => {
      try {
        const candles = await fetchCandles(target.symbol, target.market);
        if (!candles || candles.length < 20) {
          failed.push(target.symbol);
          return;
        }
        fetchedCount++;

        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const currentPrice = closes[closes.length - 1];

        // TA 지표 계산
        const r = calcRSI(closes);
        const m = calcMACD(closes);
        const bb = calcBB(closes);
        const ma = calcMACross(closes);
        const vol = calcVolMom(volumes, closes);
        const taScores = [r?.score, m?.score, bb?.score, ma?.score, vol?.score].filter(s => s != null);
        const totalScore = taScores.length > 0
          ? +Math.max(-100, Math.min(100, taScores.reduce((a, b) => a + b, 0))).toFixed(1)
          : 0;

        const ta = {
          rsi: r,
          macd: m,
          bb,
          maCross: ma,
          volumeMom: vol,
          totalScore,
          indicatorCount: taScores.length,
          symbol: target.symbol,
          market: target.market,
        };

        // 마켓별 sentiment 스코핑 (코인만 F&G 적용)
        const isCrypto = target.market === 'crypto';
        const sentiment = {
          fearGreed: isCrypto ? globalSentiment.fearGreed : null,
          fundingRate: isCrypto ? globalSentiment.fundingRate : null,
          pcr: isCrypto ? null : globalSentiment.pcr,
        };

        // 복합 점수 — KR 종목은 flow(외인/기관) 35% 가중치 활성화, 코인/미장은 flow=null
        // volumeRatio는 1 고정 (Naver 거래량 미포함 — 향후 통합 예정)
        // 임계값 30 — compositeScorer 라벨 경계(±30)와 일관, flow 추가 시에도 유지
        // (조건부 40 상향은 flowWeighted 경계 부근에서 역설적 시그널 누락 발생)
        const flow = target.market === 'kr' ? (krFlowMap.get(target.symbol) ?? null) : null;
        const composite = calculateCompositeScore(ta, flow, sentiment);
        if (Math.abs(composite.score) >= 30) {
          signals.push(buildCompositeSignal(target, composite, ta, currentPrice));
        }

        // 패턴 감지
        const srCandles = candles.filter(c => c.close != null);
        const recCandles = candles.filter(c => c.close != null && c.volume != null);

        if (srCandles.length >= 10) {
          const sr = findSupportResistance(srCandles);
          const srSig = buildSRSignal(target, sr, currentPrice);
          if (srSig) signals.push(srSig);
        }
        if (srCandles.length >= 15) {
          const db = detectDoubleBottom(srCandles);
          const dbSig = buildDBSignal(target, db, currentPrice);
          if (dbSig) signals.push(dbSig);
        }
        if (recCandles.length >= 25) {
          const recCloses = recCandles.map(c => c.close);
          const recVols = recCandles.map(c => c.volume);
          const rec = detectRecovery(recCloses, recVols);
          const recSig = buildRecoverySignal(target, rec, currentPrice);
          if (recSig) signals.push(recSig);
        }
      } catch (e) {
        failed.push(target.symbol);
        console.error(`[compute-signals] ${target.symbol} 실패:`, e?.message || e);
      }
    }));
  }

  const durationMs = Date.now() - startedAt;
  const payload = {
    ts: Date.now(),
    generatedAt: new Date().toISOString(),
    ttlSec: 1200,
    count: signals.length,
    signals,
    stats: {
      targetCount: TARGETS.length,
      fetchedCount,
      failedSymbols: failed.slice(0, 20),
      durationMs,
    },
  };

  // 과반 실패 시 기존 캐시 유지 — 외부 API 장애로 빈 시그널 노출 방지
  const failRate = failed.length / TARGETS.length;
  if (failRate > 0.5) {
    await recordCronFailure('compute-signals', `fetch fail rate ${(failRate * 100).toFixed(0)}% — KV write skipped`);
    return res.status(200).json({ ok: false, skipped: true, failRate, durationMs });
  }

  try {
    await setSnap('signals:latest', payload, 1200);
  } catch (e) {
    await recordCronFailure('compute-signals', e?.message || String(e));
    return res.status(500).json({ error: 'kv write failed', message: e?.message });
  }

  return res.status(200).json({ ok: true, count: signals.length, durationMs });
}
