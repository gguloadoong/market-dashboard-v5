// 시그널 엔진 React Hooks — 시그널 구독 및 조회
import { useState, useEffect } from 'react';
import {
  getActiveSignals,
  getSignalsBySymbol,
  getTopSignals,
  subscribe,
  unsubscribe,
} from '../engine/signalEngine';

/** 전체 활성 시그널 구독 */
export function useSignals() {
  const [signals, setSignals] = useState(getActiveSignals);

  useEffect(() => {
    const handler = () => setSignals(getActiveSignals());
    subscribe(handler);
    // 마운트 시점 최신 상태 반영
    handler();
    return () => unsubscribe(handler);
  }, []);

  return signals;
}

/** 특정 종목 시그널 */
export function useSymbolSignals(symbol) {
  const [signals, setSignals] = useState(() => getSignalsBySymbol(symbol));

  useEffect(() => {
    const handler = () => setSignals(getSignalsBySymbol(symbol));
    subscribe(handler);
    handler();
    return () => unsubscribe(handler);
  }, [symbol]);

  return signals;
}

/** 상위 N개 시그널 (홈 대시보드용) */
export function useTopSignals(n = 5) {
  const [signals, setSignals] = useState(() => getTopSignals(n));

  useEffect(() => {
    const handler = () => setSignals(getTopSignals(n));
    subscribe(handler);
    handler();
    return () => unsubscribe(handler);
  }, [n]);

  return signals;
}
