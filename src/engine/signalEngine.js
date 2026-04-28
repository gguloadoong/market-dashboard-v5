// 시그널 엔진 — 시그널 생성/관리/만료/구독
import { SIGNAL_TYPES, DIRECTIONS, getTTL } from './signalTypes';
import { THRESHOLDS } from '../constants/signalThresholds';

// ─── 내부 저장소 ────────────────────────────────────────────
const MAX_SIGNALS = 100;
let _signals = [];
let _subscribers = [];

// ─── 배치 모드 — 스캔 중 다수 addSignal 호출을 하나의 _notify로 압축 ──
let _batchDepth = 0;
let _batchDirty = false;

export function beginBatch() {
  _batchDepth++;
}

export function endBatch() {
  if (_batchDepth === 0) {
    if (import.meta.env?.DEV) console.warn('[signalEngine] endBatch without matching beginBatch — leak 가능성');
    return;
  }
  _batchDepth--;
  if (_batchDepth === 0 && _batchDirty) {
    _batchDirty = false;
    _notify();
  }
}

// ─── 구독자 알림 ────────────────────────────────────────────
function _notify() {
  // 배치 중이면 즉시 알림 대신 dirty 플래그만 — endBatch에서 1회 호출
  if (_batchDepth > 0) {
    _batchDirty = true;
    return;
  }
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
// 유효 가격 해석 — 0은 데이터 오류로 간주하고 건너뜀 (#116)
function _resolvePrice(meta) {
  const a = meta?.currentPrice;
  if (a != null && a > 0) return a;
  const b = meta?.priceKrw;
  if (b != null && b > 0) return b;
  return null;
}

export function addSignal(signal) {
  // 서버 관할 타입은 loadSignals 전용 — 클라이언트 경로 차단 (깜빡임 방지)
  if (SERVER_SIGNAL_TYPES.has(signal.type)) return signal;

  // 중복 제거: 같은 type+symbol 조합
  const existIdx = _signals.findIndex(
    s => s.type === signal.type && s.symbol === signal.symbol,
  );
  if (existIdx !== -1) {
    const existing = _signals[existIdx];
    const existingPrice = _resolvePrice(existing.meta);
    const newPrice = _resolvePrice(signal.meta);
    const isPriceUpgradeOnly = existing.strength >= signal.strength
      && existingPrice == null && newPrice != null;

    // 가격 업그레이드 케이스 (#116): 가격 필드만 선택적으로 갱신하고
    // 기존 비즈니스 메타(consecutiveDays, amount 등)는 보존.
    // timestamp/expiresAt도 보존하여 UI 튐 방지.
    // 최초 발화 시 null 가격은 _recordForAccuracy에서 차단되므로, 이번 업그레이드 호출이
    // 해당 시그널의 첫 적중률 기록이 된다 (이중 집계 없음).
    if (isPriceUpgradeOnly) {
      existing.meta = {
        ...existing.meta,
        currentPrice: signal.meta?.currentPrice ?? existing.meta?.currentPrice ?? null,
        priceKrw: signal.meta?.priceKrw ?? existing.meta?.priceKrw ?? null,
      };
      _recordForAccuracy(existing);
      existing._accuracyRecorded = true;
      _notify();
      return existing;
    }
    if (existing.strength >= signal.strength) return existing;
    // 더 강한 시그널로 교체 시, 신규가 가격을 못 얻었다면 기존 가격을 승계 (#116)
    // — null-price guard가 accuracy 기록을 스킵하는 문제 방지.
    if (newPrice == null && existingPrice != null) {
      signal.meta = {
        ...signal.meta,
        currentPrice: existing.meta?.currentPrice ?? signal.meta?.currentPrice ?? null,
        priceKrw: existing.meta?.priceKrw ?? signal.meta?.priceKrw ?? null,
      };
    }
    // 기존이 이미 accuracy에 기록됐다면 신규 기록을 스킵하여 이중 집계 방지 (#116)
    if (existing._accuracyRecorded) signal._accuracyRecorded = true;
    _signals.splice(existIdx, 1);
  }

  _signals.push(signal);

  // 적중률 트래킹 — 비동기 fire-and-forget (실패해도 시그널 영향 없음)
  // null 가격이면 _recordForAccuracy 내부에서 스킵되고 플래그도 세우지 않음 —
  // 이후 가격 업그레이드 호출에서 최초 기록 가능.
  if (!signal._accuracyRecorded) {
    const priceAtFire = _resolvePrice(signal.meta);
    if (priceAtFire != null) {
      _recordForAccuracy(signal);
      signal._accuracyRecorded = true;
    }
  }

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

// ─── 적중률 트래킹 ──────────────────────────────────────────

// 배치 버퍼 — 5초 모아서 한번에 POST (API 부하 최소화)
let _accuracyBuffer = [];
let _accuracyTimer = null;

function _recordForAccuracy(signal) {
  // symbol 없는 시그널은 적중률 추적 의미 없음 (NEUTRAL도 추적 — stealth activity 등)
  if (!signal.symbol) return;

  // priceAtFire 없으면 기록 보류 — 가격 업그레이드 시 다시 호출돼 최초 기록 생성 (#116)
  const priceAtFire = _resolvePrice(signal.meta);
  if (priceAtFire == null) return;

  _accuracyBuffer.push({
    type: signal.type,
    symbol: signal.symbol,
    market: signal.market || 'unknown',
    direction: signal.direction,
    strength: signal.strength || 1,
    title: signal.title || '',
    priceAtFire,
    meta: { compositeScore: signal.meta?.compositeScore, rsi: signal.meta?.rsi },
  });

  // 5초 디바운스 — 배치 전송
  if (!_accuracyTimer) {
    _accuracyTimer = setTimeout(() => {
      const batch = _accuracyBuffer.splice(0);
      _accuracyTimer = null;
      if (!batch.length) return;
      fetch('/api/signal-accuracy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      }).catch(() => {}); // fire-and-forget
    }, 5000);
  }
}

// ─── 테스트/디버그용 초기화 ──────────────────────────────────

export function _resetStore() {
  _signals = [];
  _subscribers = [];
  _counter = 0;
  // 적중률 버퍼 flush 후 정리 (미전송 데이터 손실 방지)
  if (_accuracyBuffer.length > 0) {
    const batch = _accuracyBuffer.splice(0);
    fetch('/api/signal-accuracy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    }).catch(() => {});
  }
  clearTimeout(_accuracyTimer);
  _accuracyTimer = null;
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
 * @param {number|null} currentPrice - 시그널 발화 시점 현재가 (적중률 추적용, 선택)
 */
export function createInvestorSignal(symbol, name, market, type, consecutiveDays, amount, currentPrice = null) {
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
    meta: { consecutiveDays, amount, currentPrice },
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
export function createVolumeSignal(symbol, name, market, currentVol, avgVol, changePct = 0, currentPrice = null) {
  if (!avgVol || avgVol <= 0) return null;
  const ratio = currentVol / avgVol;
  // 95th percentile 기준으로 외부에서 필터 후 호출되므로 ratio >= 1이면 통과
  if (ratio < 1) return null;

  let strength = 3;
  if (ratio >= 10) strength = 5;
  else if (ratio >= 5) strength = 4;

  // 가격 방향에 따라 direction 설정 — 거래량 폭발의 맥락 전달
  const pct = changePct ?? 0;
  const direction = Math.abs(pct) < 0.5 ? DIRECTIONS.NEUTRAL
    : pct > 0 ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;

  const title = `${name} 거래량 평소 대비 ${ratio.toFixed(1)}배`;

  const signal = createSignal({
    type: SIGNAL_TYPES.VOLUME_ANOMALY,
    symbol,
    name,
    market,
    direction,
    strength,
    title,
    meta: { currentVol, avgVol, ratio, changePct: pct, currentPrice },
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
    // BEARISH(0.70)~CAUTION_LOW(0.80): 경계 하단 — 탐욕 징후
    direction = DIRECTIONS.BEARISH;
    strength = 2;
    hint = '탐욕 징후 — 주의';
  } else {
    return null; // CAUTION_LOW(0.80)~CAUTION_HIGH(1.05): 완전 중립
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

/** VWAP 편차 평균회귀 시그널 — [비활성] 적중률 0% (#155, 2026-04-20)
 *
 * 실사용 데이터 453건 판정 결과 1h/4h/24h 적중률 모두 0.0%.
 * 원인: 평균회귀 가정(VWAP 위 이탈 → 하방, 아래 이탈 → 상방)이 현재 시장 regime에서 실패.
 *   - 391 bearish (deviation > 0) → 1h 평균 +0.01% 상승 (복귀 없음)
 *   - 62  bullish (deviation < 0) → 1h 평균 +0.01% (반등 없음)
 *
 * 복원 조건 (둘 중 하나 충족 시):
 *   1) 장기 타임프레임(24h+) 전용 판정 로직 도입
 *   2) 방향 반전(추세 추종) 버전 A/B 테스트로 유의미한 적중률 확보
 *
 * 기존 호출부는 유지 — 본 함수가 null을 반환해 신규 시그널 발화만 중단.
 */
export function createVWAPSignal(_symbol, _name, _market, _currentPrice, _vwap) {
  return null;
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

// ─── 신규 시그널 6종 헬퍼 ──────────────────────────────────

/** 교차시장 상관관계 시그널 — leader/lagger 괴리 감지 */
export function createCrossMarketSignal(leader, lagger, leaderPct, laggerPct, leaderName, laggerName) {
  const gap = Math.abs(leaderPct - laggerPct);
  const direction = leaderPct > 0 ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
  const strength = gap >= THRESHOLDS.CROSS_MARKET.STRONG ? 4 : 3;
  // 사람이 읽을 수 있는 이름 사용 (없으면 심볼 코드 fallback)
  const displayLeader = leaderName || leader;
  const displayLagger = laggerName || lagger;
  const title = `${displayLeader} ${leaderPct > 0 ? '+' : ''}${leaderPct.toFixed(1)}% → ${displayLagger} ${laggerPct > 0 ? '+' : ''}${laggerPct.toFixed(1)}% — 괴리 ${gap.toFixed(1)}%`;
  return addSignal(createSignal({
    type: SIGNAL_TYPES.CROSS_MARKET_CORRELATION,
    symbol: `${leader}_${lagger}`,
    name: `${displayLeader} → ${displayLagger}`,
    market: 'cross',
    direction,
    strength,
    title,
    meta: { leader, lagger, leaderPct: +leaderPct.toFixed(1), laggerPct: +laggerPct.toFixed(1), gap, leaderName: displayLeader, laggerName: displayLagger },
  }));
}

/** 심리 괴리 시그널 — 가격 방향 vs 뉴스 감성 불일치 */
export function createSentimentDivergenceSignal(symbol, name, market, pricePct, avgSentiment, newsCount) {
  // 가격과 뉴스가 엇갈리는 "괴리 경고" — 방향 판단이 아니므로 NEUTRAL
  const direction = DIRECTIONS.NEUTRAL;
  const strength = Math.abs(avgSentiment) >= THRESHOLDS.SENTIMENT_DIV.STRONG ? 4 : 3;
  const priceDir = pricePct > 0 ? '상승' : '하락';
  const newsDir = avgSentiment > 0 ? '호재' : '악재';
  const title = `${name} 가격 ${priceDir} ${Math.abs(pricePct).toFixed(1)}% vs 뉴스 ${newsDir} — 괴리 주의`;
  return addSignal(createSignal({
    type: SIGNAL_TYPES.SENTIMENT_DIVERGENCE,
    symbol, name, market, direction, strength,
    title,
    meta: { name, pricePct: +pricePct.toFixed(1), avgSentiment: +avgSentiment.toFixed(2), newsCount },
  }));
}

/** 스마트머니 흐름 시그널 — 외국인+기관 동시 매수/매도 */
export function createSmartMoneySignal(symbol, name, foreignDays, instDays, totalAmt, isBuy, currentPrice = null) {
  const direction = isBuy ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
  const action = isBuy ? '매수' : '매도';
  const strength = Math.min(Math.max(foreignDays, instDays), 5);
  const title = `${name} 외국인(${foreignDays}일)+기관(${instDays}일) 동시 ${action} — 스마트머니`;
  return addSignal(createSignal({
    type: SIGNAL_TYPES.SMART_MONEY_FLOW,
    symbol, name,
    market: 'kr',
    direction, strength,
    title,
    meta: { name, foreignDays, instDays, totalAmt, action, currentPrice },
  }));
}

/** 모멘텀 괴리 시그널 — 단기 vs 중기 추세 방향 불일치 */
export function createMomentumSignal(symbol, name, market, shortSlope, mediumSlope) {
  const shortDirection = shortSlope > 0 ? 'up' : 'down';
  const direction = shortSlope > 0 ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
  const strength = Math.abs(shortSlope) >= THRESHOLDS.MOMENTUM.STRONG ? 4 : Math.abs(shortSlope) >= THRESHOLDS.MOMENTUM.MID ? 3 : 2;
  const label = shortDirection === 'up' ? '반등 시작' : '꺾임 시작';
  const title = `${name} ${label} — 최근 5봉 ${shortSlope > 0 ? '+' : ''}${shortSlope.toFixed(1)}% (중기 ${mediumSlope > 0 ? '+' : ''}${mediumSlope.toFixed(1)}%)`;
  return addSignal(createSignal({
    type: SIGNAL_TYPES.MOMENTUM_DIVERGENCE,
    symbol, name, market, direction, strength,
    title,
    meta: { name, shortSlope: +shortSlope.toFixed(1), shortDirection, mediumSlope: +mediumSlope.toFixed(1) },
  }));
}

/** 거래량-가격 괴리 시그널 — accumulation 또는 weak_move */
export function createVolumePriceDivergenceSignal(symbol, name, market, pattern, pricePct, volRatio) {
  const direction = pattern === 'accumulation' ? DIRECTIONS.BULLISH : DIRECTIONS.NEUTRAL;
  const strength = pattern === 'accumulation' ? (volRatio >= THRESHOLDS.VOL_PRICE.STRONG_RATIO ? 4 : 3) : 2;
  const label = pattern === 'accumulation'
    ? `거래량 ${volRatio.toFixed(1)}배 폭발인데 가격 정체 — 누적 가능성`
    : `가격 ${Math.abs(pricePct).toFixed(1)}% 변동인데 거래량 부족 — 약한 움직임`;
  const title = `${name} ${label}`;
  return addSignal(createSignal({
    type: SIGNAL_TYPES.VOLUME_PRICE_DIVERGENCE,
    symbol, name, market, direction, strength,
    title,
    meta: { name, pattern, pricePct: +pricePct.toFixed(1), volRatio: +volRatio.toFixed(1) },
  }));
}

/** 시장 무드 전환 시그널 — 3시장 동시 방향 전환 또는 합의 */
export function createMarketMoodShiftSignal(moodType, direction, flippedMarkets, marketAvgs) {
  const strength = moodType === 'consensus' ? 4 : 3;
  const label = moodType === 'consensus'
    ? `국장·미장·코인 모두 ${direction === 'bullish' ? '상승' : '하락'} — 강한 흐름`
    : `${flippedMarkets.join('·')} 방향 전환 — 변곡점 주의`;
  const title = label;
  return addSignal(createSignal({
    type: SIGNAL_TYPES.MARKET_MOOD_SHIFT,
    symbol: 'MARKET',
    name: '시장 무드',
    market: 'all',
    direction: direction === 'bullish' ? DIRECTIONS.BULLISH : direction === 'bearish' ? DIRECTIONS.BEARISH : DIRECTIONS.NEUTRAL,
    strength,
    title,
    meta: { moodType, direction, flippedMarkets, marketAvgs },
  }));
}

/** 갭 분석 시그널 — 전일 종가 vs 당일 시가 갭 */
export function createGapSignal(symbol, name, market, gapPct) {
  if (gapPct == null) return null;
  const T = THRESHOLDS.GAP;
  if (Math.abs(gapPct) < T.MIN_PCT) return null;

  const direction = gapPct >= 0 ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
  // 점수 비례: 갭 크기에 비례, 최대 ±MAX_SCORE
  const rawScore = Math.abs(gapPct) * (T.MAX_SCORE / 10); // 10%면 최대 점수
  const strength = rawScore >= 15 ? 4 : rawScore >= 8 ? 3 : 2;
  const label = gapPct >= 0 ? '갭 상승 출발' : '갭 하락 출발';
  const title = `${name} ${label} ${gapPct > 0 ? '+' : ''}${gapPct.toFixed(1)}%`;

  return addSignal(createSignal({
    type: SIGNAL_TYPES.GAP_ANALYSIS,
    symbol, name, market, direction, strength,
    title, meta: { gapPct },
  }));
}

/** 리밸런싱 경고 시그널 — 월말/분기말 기관 매물 출회 */
export function createRebalancingSignal(isQuarterEnd, daysLeft) {
  const T = THRESHOLDS.REBALANCING;
  const strength = isQuarterEnd ? T.QUARTER_STRENGTH : T.MONTH_STRENGTH;
  const periodLabel = isQuarterEnd ? '분기말' : '월말';
  const title = `${periodLabel} D-${daysLeft} — 기관 리밸런싱 매물 출회 가능`;

  return addSignal(createSignal({
    type: SIGNAL_TYPES.REBALANCING_ALERT,
    symbol: 'MARKET',
    name: '기관 리밸런싱',
    market: 'kr',
    direction: DIRECTIONS.BEARISH,
    strength,
    title,
    meta: { isQuarterEnd, daysLeft },
  }));
}

/** 환율 영향 시그널 — KRW/USD 변동 감지 */
export function createFxImpactSignal(krwRate, prevRate, changePct, impact) {
  if (changePct == null) return null;
  const T = THRESHOLDS.FX;
  if (Math.abs(changePct) < T.MIN_CHANGE_PCT) return null;

  // 환율 상승(원화 약세) → 수입주 기준 BEARISH
  const direction = changePct > 0 ? DIRECTIONS.BEARISH : DIRECTIONS.BULLISH;
  const strength = Math.abs(changePct) >= T.STRONG_CHANGE_PCT ? 4 : 3;
  const title = `원/달러 ${krwRate.toFixed(0)}원 (${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%) — ${impact}`;

  return addSignal(createSignal({
    type: SIGNAL_TYPES.FX_IMPACT,
    symbol: 'USDKRW',
    name: '원/달러 환율',
    market: 'kr',
    direction, strength,
    title,
    meta: { rate: krwRate, prevRate, change: changePct, impact },
  }));
}

// ─── 신규 시그널 7종 (Tier 2-3: 패턴 감지 + 교차 참조) ──

/** 투매 감지 (캐피튤레이션) — 가격 급락 + 거래량 폭발 + 공포 극대 → 역발상 매수 */
// 조건 체크는 호출부(detectCapitulation)에서 수행 — 여기서는 시그널 생성만
export function createCapitulationSignal(symbol, name, market, priceDrop, volRatio, fearGreed) {
  // 기존 시그널 교차 참조 — VOLUME_ANOMALY + FEAR_GREED_SHIFT 존재 여부
  const symbolSignals = getSignalsBySymbol(symbol);
  const hasVolumeAnomaly = symbolSignals.some(s => s.type === SIGNAL_TYPES.VOLUME_ANOMALY);
  const hasFearGreed = getActiveSignals().some(s => s.type === SIGNAL_TYPES.FEAR_GREED_SHIFT);

  // 교차 확인으로 strength 보정
  let strength = 3;
  if (hasVolumeAnomaly && hasFearGreed) strength = 5;
  else if (hasVolumeAnomaly || hasFearGreed) strength = 4;

  const title = `${name} 투매 감지 — 가격 ${priceDrop.toFixed(1)}%, 거래량 ${volRatio.toFixed(1)}배, F&G ${fearGreed}`;

  return addSignal(createSignal({
    type: SIGNAL_TYPES.CAPITULATION,
    symbol, name, market,
    direction: DIRECTIONS.BULLISH, // 역발상
    strength,
    title,
    meta: { name, priceDrop, volRatio, fearGreed, hasVolumeAnomaly, hasFearGreed },
  }));
}

/** 스텔스 활동 — 거래량 폭발인데 뉴스 없음 */
export function createStealthActivitySignal(symbol, name, market, volRatio) {
  const T = THRESHOLDS.STEALTH;
  if (volRatio < T.VOLUME_RATIO) return null;

  // 교차 참조 — VOLUME_ANOMALY 있고 NEWS_SENTIMENT_CLUSTER 없어야 함
  const symbolSignals = getSignalsBySymbol(symbol);
  const hasVolume = symbolSignals.some(s => s.type === SIGNAL_TYPES.VOLUME_ANOMALY);
  const hasNews = symbolSignals.some(s => s.type === SIGNAL_TYPES.NEWS_SENTIMENT_CLUSTER);

  if (hasNews) return null; // 뉴스 있으면 스텔스 아님

  const strength = hasVolume ? 4 : 3;
  const title = `${name} 뉴스 없는 거래량 ${volRatio.toFixed(1)}배 폭발 — 거래 패턴 주목`;

  return addSignal(createSignal({
    type: SIGNAL_TYPES.STEALTH_ACTIVITY,
    symbol, name, market,
    direction: DIRECTIONS.NEUTRAL, // 방향 불명
    strength,
    title,
    meta: { name, volRatio, hasVolumeAnomaly: hasVolume },
  }));
}

/** BTC 선행 알트코인 예측 — BTC 급등락인데 알트코인 미반영 */
export function createBtcLeadingSignal(alt, btcChange, altChange) {
  const T = THRESHOLDS.BTC_LEADING;
  if (Math.abs(btcChange) < T.BTC_MIN_CHANGE || Math.abs(altChange) >= T.ALT_MAX_CHANGE) return null;

  const direction = btcChange > 0 ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
  const strength = Math.abs(btcChange) >= 5 ? 4 : 3;
  const title = `BTC ${btcChange > 0 ? '+' : ''}${btcChange.toFixed(1)}% → ${alt} 미반영 (${altChange > 0 ? '+' : ''}${altChange.toFixed(1)}%)`;

  return addSignal(createSignal({
    type: SIGNAL_TYPES.BTC_LEADING,
    symbol: alt,
    name: alt,
    market: 'crypto',
    direction,
    strength,
    title,
    meta: { alt, btcChange, altChange },
  }));
}

/** 지지/저항선 돌파 시그널 */
export function createSupportResistanceSignal(symbol, name, market, breakType, breakLevel, currentPrice) {
  if (!breakType || !breakLevel) return null;

  const direction = breakType === 'resistance' ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
  const strength = 3;
  const label = breakType === 'resistance' ? '저항선 돌파' : '지지선 이탈';
  const title = `${name} ${breakLevel.toLocaleString()} ${label}`;

  return addSignal(createSignal({
    type: SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK,
    symbol, name, market,
    direction, strength,
    title,
    meta: { name, breakType, level: breakLevel, currentPrice },
  }));
}

/** 이중바닥 패턴 시그널 */
export function createDoubleBottomSignal(symbol, name, market, bottom1, bottom2, neckline, broken, currentPrice) {
  const strength = broken ? 4 : 3;
  const label = broken ? '넥라인 돌파' : '넥라인 접근';
  const title = `${name} 이중바닥 ${label} — 넥라인 ${neckline.toLocaleString()}`;

  return addSignal(createSignal({
    type: SIGNAL_TYPES.DOUBLE_BOTTOM,
    symbol, name, market,
    direction: DIRECTIONS.BULLISH,
    strength,
    title,
    meta: { name, bottom1, bottom2, neckline, broken, currentPrice },
  }));
}

/** 회복 감지 시그널 — 급락 후 안정화 */
export function createRecoverySignal(symbol, name, market, drawdown, bbShrink, volRatio, currentPrice) {
  const strength = Math.abs(drawdown) >= 15 ? 4 : 3;
  const title = `${name} ${Math.abs(drawdown).toFixed(1)}% 급락 후 안정화 — BB 축소 ${(bbShrink * 100).toFixed(0)}%`;

  return addSignal(createSignal({
    type: SIGNAL_TYPES.RECOVERY_DETECTION,
    symbol, name, market,
    direction: DIRECTIONS.BULLISH,
    strength,
    title,
    meta: { name, drawdown, bbShrink, volRatio, currentPrice },
  }));
}

/** 섹터 이탈 종목 시그널 — 섹터 평균 대비 2σ 이상 이탈 */
export function createSectorOutlierSignal(symbol, name, market, deviation, sectorAvg, itemPct, sector, above) {
  const strength = Math.abs(deviation) >= 3 ? 4 : 3;
  const direction = above ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
  const label = above ? '섹터 대비 급등' : '섹터 대비 급락';
  const title = `${name} ${label} — ${sector} 평균 ${sectorAvg > 0 ? '+' : ''}${sectorAvg.toFixed(1)}% 대비 ${itemPct > 0 ? '+' : ''}${itemPct.toFixed(1)}% (${Math.abs(deviation).toFixed(1)}σ)`;

  return addSignal(createSignal({
    type: SIGNAL_TYPES.SECTOR_OUTLIER,
    symbol, name, market,
    direction, strength,
    title,
    meta: { name, deviation, sectorAvg, itemPct, sector, above },
  }));
}

/** 타입+심볼로 기존 시그널 제거 (동일 시그널 갱신용) */
export function removeSignalByTypeAndSymbol(type, symbol) {
  const before = _signals.length;
  _signals = _signals.filter(s => !(s.type === type && s.symbol === symbol));
  if (_signals.length !== before) _notify();
}

/** 특정 타입의 모든 시그널 제거 */
export function removeAllSignalsByType(type) {
  const before = _signals.length;
  _signals = _signals.filter(s => s.type !== type);
  if (_signals.length !== before) _notify();
}

/** 뉴스 클러스터 시그널 — 특정 종목에 뉴스 집중 (THRESHOLDS.NEWS_CLUSTER.MIN_CLUSTER 기준) */
export function createNewsClusterSignal(symbol, name, market, newsCount, bullCount, bearCount) {
  if (newsCount < THRESHOLDS.NEWS_CLUSTER.MIN_CLUSTER) return null;
  let direction = DIRECTIONS.NEUTRAL;
  const dominance = THRESHOLDS.NEWS_CLUSTER.DOMINANCE_RATIO;
  const directional = bullCount + bearCount;
  // 분모: newsCount (전체 기준) — directional만 분모로 쓰면 중립 기사 다수 시 소수 bull/bear가 방향성 과장 (#234)
  if (directional > 0 && bullCount > bearCount && bullCount / newsCount >= dominance) direction = DIRECTIONS.BULLISH;
  else if (directional > 0 && bearCount > bullCount && bearCount / newsCount >= dominance) direction = DIRECTIONS.BEARISH;
  const strength = newsCount >= 8 ? 4 : newsCount >= 5 ? 3 : 2;
  const sentimentLabel = direction === DIRECTIONS.BULLISH ? '호재 위주' : direction === DIRECTIONS.BEARISH ? '악재 위주' : '혼재';
  const title = `${name} 관련 뉴스 ${newsCount}건 집중 — ${sentimentLabel}`;
  // 동일 strength여도 count/방향 변경 시 갱신 — 공개 API로 기존 시그널 제거
  removeSignalByTypeAndSymbol(SIGNAL_TYPES.NEWS_SENTIMENT_CLUSTER, symbol);
  return addSignal(createSignal({
    type: SIGNAL_TYPES.NEWS_SENTIMENT_CLUSTER,
    symbol, name, market, direction, strength,
    title, meta: { count: newsCount, bullCount, bearCount },
  }));
}

// 서버 시그널 관할 타입 (클라이언트 계산 대상에서 제외)
const SERVER_SIGNAL_TYPES = new Set([
  SIGNAL_TYPES.COMPOSITE_SCORE,
  SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK,
  SIGNAL_TYPES.DOUBLE_BOTTOM,
  SIGNAL_TYPES.RECOVERY_DETECTION,
]);

/** 서버 사전 계산 시그널 일괄 로드 — 서버 관할 타입만 replace (stale 방지) */
export function loadSignals(serverArr) {
  if (!Array.isArray(serverArr)) return;
  const now = Date.now();

  // 서버 관할 타입 기존 시그널 전부 제거
  _signals = _signals.filter(s => !SERVER_SIGNAL_TYPES.has(s.type));

  // 서버 응답 주입
  // TODO(#215 Phase 2): addSignal 경유 시 _recordForAccuracy 호출 가능하나
  // 서버 생성 시그널은 price_at_fire가 이미 확정이므로 별도 accuracy 파이프라인 필요
  const seenIds = new Set();
  for (const raw of serverArr) {
    if (!SERVER_SIGNAL_TYPES.has(raw.type)) continue;
    if (!raw.symbol || !raw.market || !raw.direction) continue; // 필수 필드 방어
    const id = raw.id || _generateId();
    if (seenIds.has(id)) continue; // 페이로드 내 중복 방어
    seenIds.add(id);
    _signals.push({
      ...raw,
      id,
      timestamp: raw.timestamp || now,
      expiresAt: raw.expiresAt || (now + getTTL(raw.type)),
    });
  }

  if (_signals.length > MAX_SIGNALS) {
    _signals.sort((a, b) => b.timestamp - a.timestamp);
    _signals = _signals.slice(0, MAX_SIGNALS);
  }

  _notify(); // 한 번만 — 폭주 차단
}

export function isServerManagedSignalType(type) {
  return SERVER_SIGNAL_TYPES.has(type);
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
  // 시그널 5개 미만이면 극단 라벨 방지 (부팅 시드 3개만으로 "강한 강세" 방지)
  const hasEnough = signals.length >= 5;
  let label;
  if (score <= -0.5) label = hasEnough ? '강한 경계' : '중립';
  else if (score <= -0.15) label = hasEnough ? '약세 우위' : '중립';
  else if (score < 0.15) label = '중립';
  else if (score < 0.5) label = hasEnough ? '강세 징후' : '중립';
  else label = hasEnough ? '강한 강세' : '중립';
  return {
    score,
    label,
    count: signals.length,
    bullCount: signals.filter(s => s.direction === DIRECTIONS.BULLISH).length,
    bearCount: signals.filter(s => s.direction === DIRECTIONS.BEARISH).length,
    neutralCount,
  };
}
