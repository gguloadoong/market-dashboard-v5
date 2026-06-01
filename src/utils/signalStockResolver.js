// 시그널 → 종목 카드 렌더 판정 공통 유틸 (#343)
import { isMarketIndicatorSignal } from '../engine/signalTypes';

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
  if (isMarketIndicatorSignal(signal)) return false; // kind:'market' 차단(kind 우선)
  if (allItems == null) return true;                  // undefined/null 모두 lookup 미제공 → 기존 동작
  return resolveStockItem(signal, allItems) !== null; // 실제 종목 존재해야 클릭 가능
}

export function shouldRenderStockCard(signal, allItems) {
  if (isMarketIndicatorSignal(signal)) return false;
  return resolveStockItem(signal, allItems) !== null;
}
