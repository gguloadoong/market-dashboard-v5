// 시그널 → 종목 카드 렌더 판정 공통 유틸 (#343)
import { isMarketIndicatorSignal, SIGNAL_TYPES } from '../engine/signalTypes';

// 시장 지표지만 클릭은 허용하는 예외 타입 — 펀딩비는 코인 종목(BTC 등)으로 라우팅 가능 (#345)
// signalTypes.js의 kind 분류는 'market' 유지(가짜 종목 카드 방지), 클릭 가드만 예외 처리.
const MARKET_BUT_CLICKABLE = new Set([SIGNAL_TYPES.FUNDING_RATE_EXTREME]);

export function resolveStockItem(signal, allItems) {
  if (!signal?.symbol || !Array.isArray(allItems) || allItems.length === 0) return null;
  const sym = signal.symbol;
  // crypto→coin 정규화 — 시그널 엔진은 'crypto', 종목 _market은 'COIN'(소문자 비교 시 'coin') (#343)
  const mkt = signal.market === 'crypto' ? 'coin' : signal.market;
  return (
    allItems.find((i) => (i.symbol === sym || i.id === sym) && (!mkt || (i._market || '').toLowerCase() === mkt)) ||
    allItems.find((i) => i.symbol === sym || i.id === sym) ||
    null
  );
}

export function isStockClickable(signal, allItems) {
  if (!signal?.symbol) return false;
  // 시장 지표는 차단. 단 화이트셋(펀딩비 등)은 예외 — 코인 종목으로 라우팅 가능 (#345)
  if (isMarketIndicatorSignal(signal) && !MARKET_BUT_CLICKABLE.has(signal.type)) return false;
  if (allItems == null) return !isMarketIndicatorSignal(signal); // lookup 미제공 시 시장 지표는 보수적 차단
  return resolveStockItem(signal, allItems) !== null;            // 실제 종목 존재해야 클릭 가능
}

export function shouldRenderStockCard(signal, allItems) {
  if (isMarketIndicatorSignal(signal)) return false;
  return resolveStockItem(signal, allItems) !== null;
}
