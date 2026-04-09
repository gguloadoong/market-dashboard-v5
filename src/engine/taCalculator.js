// 기술적 분석 지표 계산 — 순수 함수 (OHLCV 배열 입력 → 지표 출력)
// 의존성 없음, 서버/클라이언트 공용

/**
 * SMA (단순 이동평균)
 * @param {number[]} data - 종가 배열 (오래된→최신)
 * @param {number} period
 * @returns {number|null}
 */
export function sma(data, period) {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * EMA (지수 이동평균)
 * @param {number[]} data - 종가 배열 (오래된→최신)
 * @param {number} period
 * @returns {number|null}
 */
export function ema(data, period) {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  let prev = sma(data.slice(0, period), period);
  for (let i = period; i < data.length; i++) {
    prev = data[i] * k + prev * (1 - k);
  }
  return prev;
}

/**
 * RSI (상대강도지수) — Wilder's smoothing
 * @param {number[]} closes - 종가 배열 (오래된→최신), 최소 period+1개
 * @param {number} period - 기본 14
 * @returns {{ value: number, score: number }|null}
 *   score: -30(과매수) ~ +30(과매도), 50 중심 선형
 */
export function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;

  // 초기 평균 (첫 period개 변화)
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing (나머지)
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const value = 100 - 100 / (1 + rs);

  // 점수 변환: 30 이하 → +30(과매도=매수기회), 70 이상 → -30(과매수=매도경고)
  let score = 0;
  if (value <= 30) score = 30 * (1 - value / 30); // 0→+30, 30→0
  else if (value >= 70) score = -30 * ((value - 70) / 30); // 70→0, 100→-30
  else score = (50 - value) * (30 / 20) * 0.3; // 50 중심 약한 신호

  return { value: +value.toFixed(2), score: +score.toFixed(1) };
}

/**
 * MACD (12, 26, 9)
 * @param {number[]} closes - 종가 배열, 최소 35개 권장
 * @returns {{ macd: number, signal: number, histogram: number, score: number }|null}
 *   score: 골든크로스 +25, 데드크로스 -25, 히스토그램 기울기 반영
 */
export function macd(closes, fast = 12, slow = 26, sig = 9) {
  if (closes.length < slow + sig) return null;

  // EMA 시리즈 계산
  const emaFastArr = emaArray(closes, fast);
  const emaSlowArr = emaArray(closes, slow);
  if (!emaFastArr || !emaSlowArr) return null;

  // MACD 라인 = EMA(fast) - EMA(slow)
  const macdLine = [];
  const startIdx = slow - 1; // emaSlowArr 유효 시작점
  for (let i = startIdx; i < closes.length; i++) {
    macdLine.push(emaFastArr[i] - emaSlowArr[i]);
  }

  if (macdLine.length < sig + 1) return null;

  // 시그널 라인 = EMA(MACD, 9)
  const signalLine = emaArray(macdLine, sig);
  if (!signalLine) return null;

  const lastIdx = macdLine.length - 1;
  const prevIdx = lastIdx - 1;

  const macdVal = macdLine[lastIdx];
  const signalVal = signalLine[lastIdx];
  const histogram = macdVal - signalVal;

  const prevMacd = macdLine[prevIdx];
  const prevSignal = signalLine[prevIdx];
  const prevHistogram = prevMacd - prevSignal;

  // 점수: 크로스오버 + 히스토그램 기울기
  let score = 0;
  const justCrossedUp = prevMacd <= prevSignal && macdVal > signalVal;
  const justCrossedDown = prevMacd >= prevSignal && macdVal < signalVal;

  if (justCrossedUp) score = 25;
  else if (justCrossedDown) score = -25;
  else {
    // 히스토그램 기울기 (가속/감속)
    const slopeRatio = histogram - prevHistogram;
    score = Math.max(-15, Math.min(15, slopeRatio * 500));
  }

  return {
    macd: +macdVal.toFixed(4),
    signal: +signalVal.toFixed(4),
    histogram: +histogram.toFixed(4),
    score: +score.toFixed(1),
  };
}

/**
 * Bollinger Bands (20, 2)
 * @param {number[]} closes
 * @returns {{ upper: number, middle: number, lower: number, percentB: number, score: number }|null}
 *   percentB: 0=하단, 1=상단
 *   score: %B < 0 → +20(과매도), %B > 1 → -20(과매수)
 */
export function bollingerBands(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;

  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - middle) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + mult * stdDev;
  const lower = middle - mult * stdDev;
  const current = closes[closes.length - 1];

  // %B: (현재가 - 하단) / (상단 - 하단)
  const bandwidth = upper - lower;
  const percentB = bandwidth > 0 ? (current - lower) / bandwidth : 0.5;

  // 점수: 밴드 밖이면 강한 시그널
  let score = 0;
  if (percentB < 0) score = 20; // 하단 이탈 = 과매도
  else if (percentB > 1) score = -20; // 상단 이탈 = 과매수
  else if (percentB < 0.2) score = 15 * (1 - percentB / 0.2);
  else if (percentB > 0.8) score = -15 * ((percentB - 0.8) / 0.2);

  return {
    upper: +upper.toFixed(2),
    middle: +middle.toFixed(2),
    lower: +lower.toFixed(2),
    percentB: +percentB.toFixed(3),
    score: +score.toFixed(1),
  };
}

/**
 * 이동평균 크로스 (5/20)
 * @param {number[]} closes
 * @returns {{ sma5: number, sma20: number, crossUp: boolean, crossDown: boolean, score: number }|null}
 */
export function maCross(closes, shortP = 5, longP = 20) {
  if (closes.length < longP + 1) return null;

  const curShort = sma(closes, shortP);
  const curLong = sma(closes, longP);
  const prevShort = sma(closes.slice(0, -1), shortP);
  const prevLong = sma(closes.slice(0, -1), longP);

  if (curShort == null || curLong == null || prevShort == null || prevLong == null) return null;

  const crossUp = prevShort <= prevLong && curShort > curLong;
  const crossDown = prevShort >= prevLong && curShort < curLong;

  // 점수: 크로스 + 간격 비례
  let score = 0;
  const gap = ((curShort - curLong) / curLong) * 100; // 퍼센트 간격
  if (crossUp) score = 15;
  else if (crossDown) score = -15;
  else score = Math.max(-10, Math.min(10, gap * 3));

  return {
    sma5: +curShort.toFixed(2),
    sma20: +curLong.toFixed(2),
    crossUp,
    crossDown,
    score: +score.toFixed(1),
  };
}

/**
 * 거래량 모멘텀 — 최근 5일 평균 / 20일 평균
 * @param {number[]} volumes - 거래량 배열 (오래된→최신)
 * @param {number[]} closes - 종가 배열 (방향 판단용)
 * @returns {{ ratio: number, direction: string, score: number }|null}
 */
export function volumeMomentum(volumes, closes, shortP = 5, longP = 20) {
  if (volumes.length < longP || closes.length < 2) return null;

  const shortAvg = volumes.slice(-shortP).reduce((a, b) => a + b, 0) / shortP;
  const longAvg = volumes.slice(-longP).reduce((a, b) => a + b, 0) / longP;

  if (longAvg <= 0) return null;
  const ratio = shortAvg / longAvg;

  // 가격 방향: 최근 종가 vs 5일 전
  const recentClose = closes[closes.length - 1];
  const pastClose = closes[Math.max(0, closes.length - shortP)];
  const direction = recentClose > pastClose ? 'up' : recentClose < pastClose ? 'down' : 'flat';

  // 점수: 거래량 증가 + 상승 = 강세, 거래량 증가 + 하락 = 약세
  let score = 0;
  const volSignal = Math.min(10, (ratio - 1) * 10); // 1x→0, 2x→10
  if (direction === 'up') score = volSignal;
  else if (direction === 'down') score = -volSignal;

  return {
    ratio: +ratio.toFixed(2),
    direction,
    score: +score.toFixed(1),
  };
}

/**
 * 전체 TA 지표 한번에 계산
 * @param {{ closes: number[], volumes: number[] }} ohlcv
 * @returns {{ rsi, macd, bb, maCross, volumeMom, totalScore }}
 */
export function calculateAllIndicators(closes, volumes) {
  const r = rsi(closes);
  const m = macd(closes);
  const bb = bollingerBands(closes);
  const ma = maCross(closes);
  const vol = volumeMomentum(volumes, closes);

  // TA 레이어 총점 (최대 ±100 범위를 ±40 스케일로)
  const scores = [r?.score, m?.score, bb?.score, ma?.score, vol?.score].filter(s => s != null);
  const totalScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0)
    : 0;

  return {
    rsi: r,
    macd: m,
    bb,
    maCross: ma,
    volumeMom: vol,
    totalScore: +Math.max(-100, Math.min(100, totalScore)).toFixed(1),
    indicatorCount: scores.length,
  };
}

// ─── 내부 유틸 ────────────────────────────────────────────

/** EMA 시리즈 배열 반환 (전체 인덱스에 대한 EMA 값) */
function emaArray(data, period) {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  const result = new Array(data.length).fill(0);

  // 초기 SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
    result[i] = 0; // 유효하지 않은 구간
  }
  result[period - 1] = sum / period;

  // EMA
  for (let i = period; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }

  return result;
}
