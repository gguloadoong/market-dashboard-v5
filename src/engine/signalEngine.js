// 시그널 엔진 — 시그널 생성/관리/만료/구독
import { SIGNAL_TYPES, DIRECTIONS, getTTL, getSignalKind } from './signalTypes';

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
export function createSignal({ type, symbol, name, market, direction, strength, title, meta, source, confidence, reasons }) {
  const now = Date.now();
  return {
    id: _generateId(),
    type,
    kind: getSignalKind(type), // 종목/시장 도메인 — 렌더 가드 단일 소스 (#343)
    symbol: symbol ?? null,
    name: name ?? null,
    market: market ?? null,
    direction: direction ?? DIRECTIONS.NEUTRAL,
    strength: Math.max(1, Math.min(5, strength ?? 1)),
    title: title ?? '',
    meta: meta ?? {},
    source: source ?? 'client',
    confidence: confidence ?? null,
    reasons: reasons ?? [],
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
    source: 'client',
    confidence: Number.isFinite(ratio) ? Math.min(Math.max(0, 0.4 + (ratio / 20)), 1.0) : null,
    reasons: Number.isFinite(ratio)
      ? [
          { label: '거래량', value: `평소 ${ratio.toFixed(1)}배` },
          ...(Math.abs(pct) >= 0.5 ? [{ label: '가격', value: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` }] : []),
        ]
      : [],
  });
  return addSignal(signal);
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

// 서버 시그널 관할 타입 (클라이언트 계산 대상에서 제외)
const SERVER_SIGNAL_TYPES = new Set([
  SIGNAL_TYPES.COMPOSITE_SCORE,
  SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK,
  SIGNAL_TYPES.DOUBLE_BOTTOM,
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
      kind: getSignalKind(raw.type), // 서버 kind 무시, type 기준 강제 주입 — 신뢰 원천은 type (#343)
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
