// 시그널 엔진 — 시그널 생성/관리/만료/구독
import { SIGNAL_TYPES, DIRECTIONS, getTTL, STABLECOIN_SYMBOLS } from './signalTypes';

// ─── 내부 저장소 ────────────────────────────────────────────
const MAX_SIGNALS = 100;
let _signals = [];
let _subscribers = [];

// ─── 구독자 알림 ────────────────────────────────────────────
function _notify() {
  const active = getActiveSignals();
  _subscribers.forEach(fn => fn(active));
}

// ─── ID 생성 ────────────────────────────────────────────────
let _counter = 0;
function _generateId() {
  _counter += 1;
  return `sig_${Date.now()}_${_counter}`;
}

// ─── 시그널 CRUD ────────────────────────────────────────────

/** 시그널 객체 생성 (저장소에 추가하지 않음) */
export function createSignal({ type, symbol, name, market, direction, strength, title, meta }) {
  const now = Date.now();
  return {
    id: _generateId(),
    type,
    symbol: symbol ?? null,
    name: name ?? null,
    market: market ?? null,
    direction: direction ?? DIRECTIONS.NEUTRAL,
    strength: Math.max(1, Math.min(5, strength ?? 1)),
    title: title ?? '',
    meta: meta ?? {},
    timestamp: now,
    expiresAt: now + getTTL(type),
  };
}

/**
 * 시그널 추가 — 중복 제거 (같은 type+symbol은 strength 높은 것만 유지)
 * 저장소 최대 100개, 초과 시 오래된 것부터 제거
 */
export function addSignal(signal) {
  // 중복 제거: 같은 type+symbol 조합
  const existIdx = _signals.findIndex(
    s => s.type === signal.type && s.symbol === signal.symbol,
  );
  if (existIdx !== -1) {
    if (_signals[existIdx].strength >= signal.strength) return _signals[existIdx];
    _signals.splice(existIdx, 1);
  }

  _signals.push(signal);

  // 최대 개수 초과 시 오래된 것부터 제거
  if (_signals.length > MAX_SIGNALS) {
    _signals.sort((a, b) => b.timestamp - a.timestamp);
    _signals = _signals.slice(0, MAX_SIGNALS);
  }

  _notify();
  return signal;
}

/** 만료되지 않은 활성 시그널 (최신순) */
export function getActiveSignals() {
  const now = Date.now();
  return _signals
    .filter(s => s.expiresAt > now)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/** 특정 종목 시그널 */
export function getSignalsBySymbol(symbol) {
  return getActiveSignals().filter(s => s.symbol === symbol);
}

/** 시장별 시그널 (kr, us, crypto 등) */
export function getSignalsByMarket(market) {
  return getActiveSignals().filter(s => s.market === market);
}

/** strength 상위 N개 */
export function getTopSignals(n = 5) {
  return getActiveSignals()
    .sort((a, b) => b.strength - a.strength || b.timestamp - a.timestamp)
    .slice(0, n);
}

/** 만료 시그널 제거 */
export function pruneExpired() {
  const before = _signals.length;
  const now = Date.now();
  _signals = _signals.filter(s => s.expiresAt > now);
  if (_signals.length !== before) _notify();
  return before - _signals.length;
}

// ─── 옵저버 패턴 ────────────────────────────────────────────

export function subscribe(callback) {
  _subscribers.push(callback);
}

export function unsubscribe(callback) {
  _subscribers = _subscribers.filter(fn => fn !== callback);
}

// ─── 테스트/디버그용 초기화 ──────────────────────────────────

export function _resetStore() {
  _signals = [];
  _subscribers = [];
  _counter = 0;
}

// ─── 시그널 생성 헬퍼 ───────────────────────────────────────


/** 금액을 한국어 단위로 포맷 (억 단위) */
function _formatAmount(amount) {
  const eok = Math.abs(amount) / 100_000_000;
  if (eok >= 1) return `${Math.round(eok)}억원`;
  const man = Math.abs(amount) / 10_000;
  return `${Math.round(man)}만원`;
}

/** USD 금액 포맷 ($1.2M 형태) */
function _formatUsd(usd) {
  const abs = Math.abs(usd);
  if (abs >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd}`;
}

/**
 * 외국인/기관 연속 매수매도 시그널
 * @param {string} symbol - 종목 코드
 * @param {string} name - 종목명
 * @param {string} market - 시장 (kr, us)
 * @param {string} type - SIGNAL_TYPES 중 하나
 * @param {number} consecutiveDays - 연속일수
 * @param {number} amount - 누적 금액 (원)
 */
export function createInvestorSignal(symbol, name, market, type, consecutiveDays, amount) {
  const isBuy = type === SIGNAL_TYPES.FOREIGN_CONSECUTIVE_BUY
    || type === SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_BUY;
  const direction = isBuy ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
  const strength = Math.min(consecutiveDays, 5);

  // 투자자 유형 라벨
  const isForeign = type === SIGNAL_TYPES.FOREIGN_CONSECUTIVE_BUY
    || type === SIGNAL_TYPES.FOREIGN_CONSECUTIVE_SELL;
  const investorLabel = isForeign ? '외국인' : '기관';
  const actionLabel = isBuy ? '순매수' : '순매도';
  const amountStr = _formatAmount(amount);

  const title = `${name} ${investorLabel} ${consecutiveDays}일 연속 ${actionLabel} (${amountStr})`;

  const signal = createSignal({
    type,
    symbol,
    name,
    market,
    direction,
    strength,
    title,
    meta: { consecutiveDays, amount },
  });
  return addSignal(signal);
}

/**
 * 거래량 이상치 시그널
 * @param {string} symbol - 종목 코드
 * @param {string} name - 종목명
 * @param {string} market - 시장
 * @param {number} currentVol - 현재 거래량
 * @param {number} avgVol - 평균 거래량
 */
export function createVolumeSignal(symbol, name, market, currentVol, avgVol) {
  if (!avgVol || avgVol <= 0) return null;
  const ratio = currentVol / avgVol;
  // 95th percentile 기준으로 외부에서 필터 후 호출되므로 ratio >= 1이면 통과
  if (ratio < 1) return null;

  let strength = 3;
  if (ratio >= 10) strength = 5;
  else if (ratio >= 5) strength = 4;

  const title = `${name} 거래량 평소 대비 ${ratio.toFixed(1)}배`;

  const signal = createSignal({
    type: SIGNAL_TYPES.VOLUME_ANOMALY,
    symbol,
    name,
    market,
    direction: DIRECTIONS.NEUTRAL,
    strength,
    title,
    meta: { currentVol, avgVol, ratio },
  });
  return addSignal(signal);
}

/**
 * 고래 이벤트 → 시그널 변환
 * @param {{ symbol: string, name?: string, movementType: string, amount: number, from?: string, to?: string }} event
 */
export function createWhaleSignal(event) {
  const { symbol, name, movementType, amount, from, to, tradeAmt, tradeUsd } = event;
  const isStablecoin = STABLECOIN_SYMBOLS.has(symbol?.toUpperCase());

  // 방향 결정: 거래소 입금 = 매도 압력 (스테이블코인은 반대)
  let direction = DIRECTIONS.NEUTRAL;
  let type = SIGNAL_TYPES.WHALE_LARGE_SINGLE;
  let actionDesc = '대량 이동';

  if (movementType === 'exchange_deposit') {
    direction = isStablecoin ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
    type = isStablecoin ? SIGNAL_TYPES.WHALE_STABLECOIN_INFLOW : SIGNAL_TYPES.WHALE_EXCHANGE_INFLOW;
    actionDesc = isStablecoin
      ? `${to ?? '거래소'} 스테이블코인 입금 — 매수 대기`
      : `${to ?? '거래소'} 입금 — 매도 압력`;
  } else if (movementType === 'exchange_withdrawal') {
    direction = isStablecoin ? DIRECTIONS.BEARISH : DIRECTIONS.BULLISH;
    type = SIGNAL_TYPES.WHALE_EXCHANGE_OUTFLOW;
    actionDesc = isStablecoin
      ? `${from ?? '거래소'} 스테이블코인 출금 — 매수 약화`
      : `${from ?? '거래소'}→콜드월렛 — HODLing 시그널`;
  }

  // 금액 결정: tradeAmt(원화) 또는 tradeUsd(달러) 또는 amount(기존 호환)
  const krwAmt = tradeAmt ?? amount ?? 0;
  const usdAmt = tradeUsd ?? 0;

  // 금액 기반 strength — USD 우선, 없으면 KRW (억 단위)
  let strength = 1;
  if (usdAmt > 0) {
    const usdM = usdAmt / 1_000_000;
    if (usdM >= 10) strength = 5;
    else if (usdM >= 5) strength = 4;
    else if (usdM >= 1) strength = 3;
    else if (usdM >= 0.5) strength = 2;
  } else {
    const amountInBillion = krwAmt / 1_000_000_000;
    if (amountInBillion >= 5) strength = 5;
    else if (amountInBillion >= 3) strength = 4;
    else if (amountInBillion >= 1) strength = 3;
    else if (amountInBillion >= 0.5) strength = 2;
  }

  // 금액 표시: USD + KRW 병기 또는 단독
  let amountStr;
  if (usdAmt > 0 && krwAmt > 0) {
    amountStr = `${_formatUsd(usdAmt)} (${_formatAmount(krwAmt)})`;
  } else if (usdAmt > 0) {
    amountStr = _formatUsd(usdAmt);
  } else {
    amountStr = _formatAmount(krwAmt);
  }

  const title = `${symbol} ${amountStr} ${actionDesc}`;

  const signal = createSignal({
    type,
    symbol,
    name: name ?? symbol,
    market: 'crypto',
    direction,
    strength,
    title,
    meta: { movementType, amount: krwAmt, tradeUsd: usdAmt, from, to },
  });
  return addSignal(signal);
}

/**
 * 공포탐욕 지수 전환 시그널
 * @param {number} current - 현재 F&G 값 (0~100)
 * @param {number} previous - 이전 F&G 값 (0~100)
 * @param {string} market - 시장 (crypto, us 등)
 */
export function createFearGreedSignal(current, previous, market) {
  const getZone = (v) => {
    if (v <= 20) return 'Extreme Fear';
    if (v <= 40) return 'Fear';
    if (v <= 60) return 'Neutral';
    if (v <= 80) return 'Greed';
    return 'Extreme Greed';
  };

  const currentZone = getZone(current);
  const previousZone = getZone(previous);

  // 구간이 같으면 시그널 없음
  if (currentZone === previousZone) return null;

  // 역발상: Extreme Fear → bullish, Extreme Greed → bearish
  let direction = DIRECTIONS.NEUTRAL;
  let strength = 3;

  if (currentZone === 'Extreme Fear') {
    direction = DIRECTIONS.BULLISH;
    strength = 4;
  } else if (currentZone === 'Extreme Greed') {
    direction = DIRECTIONS.BEARISH;
    strength = 4;
  } else if (currentZone === 'Fear') {
    direction = DIRECTIONS.BULLISH;
    strength = 2;
  } else if (currentZone === 'Greed') {
    direction = DIRECTIONS.BEARISH;
    strength = 2;
  }

  const zoneKo = {
    'Extreme Fear': '극단적 공포',
    'Fear': '공포',
    'Neutral': '중립',
    'Greed': '탐욕',
    'Extreme Greed': '극단적 탐욕',
  };

  const hint = currentZone === 'Extreme Fear'
    ? ' — 역발상 매수 구간'
    : currentZone === 'Extreme Greed'
      ? ' — 역발상 매도 구간'
      : '';
  const title = `공포탐욕 ${currentZone} 진입 (${previous}→${current})${hint}`;

  const signal = createSignal({
    type: SIGNAL_TYPES.FEAR_GREED_SHIFT,
    symbol: null,
    name: `공포탐욕지수 (${market})`,
    market,
    direction,
    strength,
    title,
    meta: { current, previous, currentZone, previousZone, currentZoneKo: zoneKo[currentZone] },
  });
  return addSignal(signal);
}

import { THRESHOLDS } from '../constants/signalThresholds';

/** PCR 역발상 시그널 — 경계 구간 포함 */
export function createPCRSignal(pcr, totalPuts, totalCalls) {
  if (pcr == null) return null;
  let direction = DIRECTIONS.NEUTRAL;
  let strength = 2;
  let hint = '';
  const T = THRESHOLDS.PCR;
  if (pcr > T.BULLISH) {
    direction = DIRECTIONS.BULLISH;
    strength = pcr > T.BULLISH_STRONG ? 4 : 3;
    hint = '역발상 매수 구간';
  } else if (pcr > T.CAUTION_HIGH) {
    // 1.0~1.2: 경계 상단 — 공포 징후
    direction = DIRECTIONS.BULLISH;
    strength = 2;
    hint = '공포 징후 — 주목';
  } else if (pcr < T.BEARISH) {
    direction = DIRECTIONS.BEARISH;
    strength = pcr < T.BEARISH_STRONG ? 4 : 3;
    hint = '역발상 매도 구간';
  } else if (pcr < T.CAUTION_LOW) {
    // 0.7~0.85: 경계 하단 — 탐욕 징후
    direction = DIRECTIONS.BEARISH;
    strength = 2;
    hint = '탐욕 징후 — 주의';
  } else {
    return null; // 0.85~1.0: 완전 중립
  }
  const title = `S&P500 PCR ${pcr.toFixed(2)} — ${hint}`;
  return addSignal(createSignal({
    type: SIGNAL_TYPES.PUT_CALL_RATIO,
    symbol: 'SPY', name: 'S&P500 옵션',
    market: 'us', direction, strength,
    title, meta: { pcr, totalPuts, totalCalls },
  }));
}

/** 펀딩비 과열 시그널 — 경고 구간 포함 */
export function createFundingRateSignal(symbol, fundingRate, openInterest) {
  if (fundingRate == null) return null;
  const ratePercent = fundingRate * 100;
  let direction = DIRECTIONS.NEUTRAL;
  let strength = 2;
  const T = THRESHOLDS.FUNDING;
  if (ratePercent > T.BEARISH) {
    direction = DIRECTIONS.BEARISH;
    strength = ratePercent > T.BEARISH_STRONG ? 4 : 3;
  } else if (ratePercent > T.CAUTION_BULL) {
    // 0.03%~0.05%: 과열 징후
    direction = DIRECTIONS.BEARISH;
    strength = 2;
  } else if (ratePercent < T.BULLISH) {
    direction = DIRECTIONS.BULLISH;
    strength = ratePercent < T.BULLISH_STRONG ? 4 : 3;
  } else if (ratePercent < T.CAUTION_BEAR) {
    // -0.05%~-0.03%: 숏 과열 징후
    direction = DIRECTIONS.BULLISH;
    strength = 2;
  } else {
    return null;
  }
  const label = direction === DIRECTIONS.BEARISH ? '롱 과열 — 조정 주의' : '숏 과열 — 반등 가능';
  const title = `${symbol} 펀딩비 ${ratePercent > 0 ? '+' : ''}${ratePercent.toFixed(3)}% — ${label}`;
  return addSignal(createSignal({
    type: SIGNAL_TYPES.FUNDING_RATE_EXTREME,
    symbol, name: symbol,
    market: 'crypto', direction, strength,
    title, meta: { fundingRate, openInterest },
  }));
}

/** 주문장 불균형 시그널 — 경고 구간 포함 */
export function createOrderFlowSignal(symbol, bidVolume, askVolume) {
  if (!bidVolume || !askVolume) return null;
  const total = bidVolume + askVolume;
  if (total === 0) return null;
  const imbalance = (bidVolume - askVolume) / total;
  const T = THRESHOLDS.ORDER_FLOW;
  if (Math.abs(imbalance) < T.CAUTION) return null;
  const direction = imbalance > 0 ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
  const isStrong = Math.abs(imbalance) >= T.STRONG;
  const strength = Math.abs(imbalance) > 0.5 ? 4 : isStrong ? 3 : 2;
  const label = imbalance > 0 ? (isStrong ? '매수벽 형성' : '매수세 우세') : (isStrong ? '매도벽 형성' : '매도세 우세');
  const title = `${symbol} 호가 ${label} (${(Math.abs(imbalance) * 100).toFixed(0)}% 불균형)`;
  return addSignal(createSignal({
    type: SIGNAL_TYPES.ORDER_FLOW_IMBALANCE,
    symbol, name: symbol,
    market: 'crypto', direction, strength,
    title, meta: { bidVolume, askVolume, imbalance },
  }));
}

/** VWAP 편차 평균회귀 시그널 */
export function createVWAPSignal(symbol, name, market, currentPrice, vwap) {
  if (!vwap || !currentPrice) return null;
  const deviation = ((currentPrice - vwap) / vwap) * 100;
  if (Math.abs(deviation) < 3) return null;
  // 평균회귀: VWAP 위로 이탈 → 하방, 아래로 이탈 → 상방
  const direction = deviation > 0 ? DIRECTIONS.BEARISH : DIRECTIONS.BULLISH;
  const strength = Math.abs(deviation) > 5 ? 4 : 3;
  const title = `${name} VWAP 대비 ${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}% — 평균회귀 가능`;
  return addSignal(createSignal({
    type: SIGNAL_TYPES.VWAP_DEVIATION,
    symbol, name, market, direction, strength,
    title, meta: { currentPrice, vwap, deviation },
  }));
}

/** 소셜 감성 시그널 — 최소 표본 5건 (완화), 상수 기반 임계값 */
export function createSocialSentimentSignal(symbol, name, market, bullRatio, totalMessages) {
  const T = THRESHOLDS.SOCIAL;
  if (bullRatio == null || totalMessages < T.MIN_MESSAGES) return null;
  let direction = DIRECTIONS.NEUTRAL;
  let strength = 2;
  if (bullRatio > T.BULLISH) {
    direction = DIRECTIONS.BULLISH;
    // 표본 5~9건은 신뢰도 한 단계 낮춤
    strength = bullRatio > T.BULLISH_STRONG ? (totalMessages >= 10 ? 4 : 3) : (totalMessages >= 10 ? 3 : 2);
  } else if (bullRatio < T.BEARISH) {
    direction = DIRECTIONS.BEARISH;
    strength = bullRatio < T.BEARISH_STRONG ? (totalMessages >= 10 ? 4 : 3) : (totalMessages >= 10 ? 3 : 2);
  } else {
    return null;
  }
  const label = direction === DIRECTIONS.BULLISH ? '강세 심리 우세' : '약세 심리 우세';
  const title = `${name} 소셜 ${label} (강세 ${(bullRatio * 100).toFixed(0)}%, ${totalMessages}건)`;
  return addSignal(createSignal({
    type: SIGNAL_TYPES.SOCIAL_SENTIMENT,
    symbol, name, market, direction, strength,
    title, meta: { bullRatio, totalMessages },
  }));
}

/** 마켓 온도계 — 활성 시그널 가중합 → -1(극도약세) ~ +1(극도강세) */
export function getMarketTemperature() {
  const signals = getActiveSignals();
  if (!signals.length) return { score: 0, label: '중립', count: 0, bullCount: 0, bearCount: 0, neutralCount: 0 };
  let bullWeight = 0;
  let bearWeight = 0;
  let neutralCount = 0;
  for (const sig of signals) {
    const w = sig.strength || 1;
    if (sig.direction === DIRECTIONS.BULLISH) bullWeight += w;
    else if (sig.direction === DIRECTIONS.BEARISH) bearWeight += w;
    else neutralCount++;
  }
  const total = bullWeight + bearWeight;
  const score = total === 0 ? 0 : (bullWeight - bearWeight) / total;
  let label;
  if (score <= -0.5) label = '강한 경계';
  else if (score <= -0.15) label = '약세 우위';
  else if (score < 0.15) label = '중립';
  else if (score < 0.5) label = '강세 징후';
  else label = '강한 강세';
  return {
    score,
    label,
    count: signals.length,
    bullCount: signals.filter(s => s.direction === DIRECTIONS.BULLISH).length,
    bearCount: signals.filter(s => s.direction === DIRECTIONS.BEARISH).length,
    neutralCount,
  };
}
