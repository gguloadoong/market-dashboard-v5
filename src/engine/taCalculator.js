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

// ─── 갭 분석 ─────────────────────────────────────────────

/**
 * 갭 감지 — 전일 종가 vs 당일 시가 비교
 * @param {Array<{ open: number, close: number }>} candles - OHLCV 캔들 배열 (오래된→최신), 최소 2개
 * @returns {{ gapPct: number, direction: string }|null}
 */
export function detectGap(candles) {
  if (!candles || candles.length < 2) return null;
  const prev = candles[candles.length - 2];
  const curr = candles[candles.length - 1];
  if (!prev?.close || !curr?.open) return null;

  const gapPct = ((curr.open - prev.close) / prev.close) * 100;
  return { gapPct: +gapPct.toFixed(2), direction: gapPct >= 0 ? 'up' : 'down' };
}

// ─── 리밸런싱 윈도우 감지 ──────────────────────────────────

/**
 * 월말/분기말 리밸런싱 윈도우 감지
 * @returns {{ isRebalancing: boolean, isQuarterEnd: boolean, daysLeft: number }|null}
 */
export function detectRebalancingWindow() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // 이번 달 마지막 날
  const lastDay = new Date(year, month + 1, 0).getDate();

  // 월말까지 남은 영업일 계산 (주말 제외)
  let businessDaysLeft = 0;
  const today = now.getDate();
  for (let d = today + 1; d <= lastDay; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) businessDaysLeft++;
  }

  // 당일이 영업일이면 당일 포함 (D-0)
  const todayDow = now.getDay();
  const isTodayBusinessDay = todayDow !== 0 && todayDow !== 6;
  if (isTodayBusinessDay && today === lastDay) {
    businessDaysLeft = 0; // 마지막 날 당일
  }

  if (businessDaysLeft > 3) return null; // 영업일 3일 초과 → 시그널 없음

  // 분기말 여부 (3, 6, 9, 12월 = month index 2, 5, 8, 11)
  const quarterEndMonths = [2, 5, 8, 11];
  const isQuarterEnd = quarterEndMonths.includes(month);

  return { isRebalancing: true, isQuarterEnd, daysLeft: businessDaysLeft };
}

// ─── 환율 영향 감지 ────────────────────────────────────────

/**
 * 환율 변동 영향 감지 — KRW/USD 변동률 기반
 * @param {number} krwRate - 현재 원/달러 환율
 * @param {number} prevRate - 이전 원/달러 환율
 * @returns {{ changePct: number, direction: string, impact: string }|null}
 */
export function detectFxImpact(krwRate, prevRate) {
  if (!krwRate || !prevRate || prevRate <= 0) return null;

  const changePct = ((krwRate - prevRate) / prevRate) * 100;
  // 임계값 필터 제거 — 호출처 useInvestorSignals.detectFxImpactSignal에서 THRESHOLDS.FX.MIN_CHANGE_PCT 체크

  // 환율 상승 = 원화 약세 → 수입주 약세, 수출주 수혜
  // 환율 하락 = 원화 강세 → 수입주 수혜
  const direction = changePct > 0 ? 'bearish' : 'bullish'; // 수입주 기준 기본 방향
  const impact = changePct > 0
    ? '원화 약세 — 수입 비용 증가, 수출 수혜'
    : '원화 강세 — 수입 비용 감소';

  return { changePct: +changePct.toFixed(2), direction, impact };
}

// ─── 지지/저항선 감지 ──────────────────────────────────────

/**
 * 지지/저항선 탐색 — 60일 캔들에서 로컬 극값 클러스터링
 * @param {Array<{ high: number, low: number, close: number }>} candles - OHLCV 캔들 (오래된→최신)
 * @param {number} clusterPct - 클러스터 범위 (기본 2%)
 * @returns {{ supports: number[], resistances: number[], breakType: string|null, breakLevel: number|null }}
 */
export function findSupportResistance(candles, clusterPct = 2) {
  if (!candles || candles.length < 10) return null;

  const currentPrice = candles[candles.length - 1].close;
  if (!currentPrice) return null;

  // 로컬 극값 탐색 (앞뒤 2봉 비교)
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

  // 가까운 가격 수준을 클러스터링 (clusterPct% 이내)
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

  // 돌파 판정 — 현재가가 저항선 위 또는 지지선 아래
  let breakType = null;
  let breakLevel = null;
  const allResistances = clusterLevels(localMaxima);
  const allSupports = clusterLevels(localMinima);

  // 저항선 돌파: 현재가가 가장 가까운 저항선 위 1% 이상
  for (const r of allResistances.sort((a, b) => a - b)) {
    const pctAbove = ((currentPrice - r) / r) * 100;
    if (pctAbove >= 1 && pctAbove <= 5) {
      breakType = 'resistance';
      breakLevel = +r.toFixed(2);
      break;
    }
  }

  // 지지선 이탈: 현재가가 가장 가까운 지지선 아래 1% 이상
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

// ─── 이중바닥 패턴 감지 ───────────────────────────────────

/**
 * 이중바닥(Double Bottom) 패턴 감지 — 60일 캔들에서 탐색
 * @param {Array<{ high: number, low: number, close: number }>} candles - OHLCV 캔들 (오래된→최신)
 * @param {number} priceTolerance - 두 바닥 가격 차이 최대 % (기본 3%)
 * @param {number} necklineMinPct - 넥라인 최소 높이 % (기본 5%)
 * @returns {{ bottom1: number, bottom2: number, neckline: number, approaching: boolean }|null}
 */
export function detectDoubleBottom(candles, priceTolerance = 3, necklineMinPct = 5) {
  if (!candles || candles.length < 15) return null;

  const currentPrice = candles[candles.length - 1].close;
  if (!currentPrice) return null;

  // 로컬 최저점 탐색 (앞뒤 3봉 비교, 더 넓은 윈도우)
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

  // 모든 극저점 쌍에서 이중바닥 패턴 탐색 (최신 우선)
  for (let j = minima.length - 1; j >= 1; j--) {
    for (let k = j - 1; k >= 0; k--) {
      const b1 = minima[k];
      const b2 = minima[j];

      // 두 바닥 가격 차이 체크
      const diff = Math.abs(b1.price - b2.price) / Math.min(b1.price, b2.price) * 100;
      if (diff > priceTolerance) continue;

      // 넥라인 (두 바닥 사이 최고점) 계산
      let neckline = 0;
      for (let n = b1.idx; n <= b2.idx; n++) {
        const high = candles[n].high ?? candles[n].close;
        if (high > neckline) neckline = high;
      }

      // 넥라인이 바닥 대비 충분히 높은지 체크
      const avgBottom = (b1.price + b2.price) / 2;
      const neckPct = ((neckline - avgBottom) / avgBottom) * 100;
      if (neckPct < necklineMinPct) continue;

      // 현재가가 넥라인에 접근 또는 돌파했는지 체크
      const approachPct = ((currentPrice - neckline) / neckline) * 100;
      const approaching = approachPct >= -3; // 넥라인 3% 이내 접근

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

// ─── 회복 감지 ──────────────────────────────────────────

/**
 * 급락 후 안정화(회복) 감지 — 5일 낙폭 + BB 밴드폭 축소 + 거래량 정상화
 * @param {number[]} closes - 종가 배열 (오래된→최신)
 * @param {number[]} volumes - 거래량 배열 (오래된→최신)
 * @param {number} drawdownDays - 낙폭 측정 기간 (기본 5일)
 * @returns {{ drawdown: number, bbShrink: number, volNormalized: boolean }|null}
 */
export function detectRecovery(closes, volumes, drawdownDays = 5) {
  if (!closes || closes.length < 25 || !volumes || volumes.length < 25) return null;

  // 5일 전 대비 낙폭 계산
  const current = closes[closes.length - 1];
  const pastIdx = Math.max(0, closes.length - 1 - drawdownDays);
  const peak = Math.max(...closes.slice(pastIdx, closes.length - 1));
  const drawdown = ((current - peak) / peak) * 100;

  if (drawdown > -10) return null; // -10% 미만 낙폭은 무시

  // BB 밴드폭 축소 판정 — 최근 20봉 BB vs 이전 20봉 BB
  const recentBB = bollingerBands(closes);
  const prevCloses = closes.slice(0, -5);
  const prevBB = bollingerBands(prevCloses);

  if (!recentBB || !prevBB) return null;

  const recentBW = recentBB.upper - recentBB.lower;
  const prevBW = prevBB.upper - prevBB.lower;
  const bbShrink = prevBW > 0 ? recentBW / prevBW : 1;

  // 거래량 정상화 — 최근 3일 평균 / 20일 평균이 1.5배 이하
  const recentVol = volumes.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const volRatio = avgVol > 0 ? recentVol / avgVol : 0;
  const volNormalized = volRatio <= 1.5;

  // BB 축소 + 거래량 정상화 → 회복 감지
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
