// #341 — 시장 지표 시그널 가짜 종목 카드 차단 회귀 테스트
// #366: 죽은 시그널 26종 제거로 모든 market-kind 시그널 타입이 사라짐(잔존 4종 전부 stock).
//   따라서 타입 기반 market 식별 케이스는 합성 kind 객체(kind:'market')로 대체하고,
//   잔존 KEEP 타입은 stock으로 클릭 가능함을 검증한다.
import { describe, it, expect } from 'vitest';
import {
  SIGNAL_TYPES,
  MARKET_INDICATOR_TYPES,
  isMarketIndicatorSignal,
} from '../engine/signalTypes.js';
import { isStockClickable, shouldRenderStockCard } from '../utils/signalStockResolver.js';

describe('isMarketIndicatorSignal (#341, #366)', () => {
  it('잔존 KEEP 타입(VOLUME_ANOMALY/COMPOSITE_SCORE/SRB/DOUBLE_BOTTOM)은 시장 지표 아님', () => {
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'AAPL' })).toBe(false);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.COMPOSITE_SCORE, symbol: 'BTC' })).toBe(false);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK, symbol: '005930' })).toBe(false);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.DOUBLE_BOTTOM, symbol: 'TSLA' })).toBe(false);
  });

  it('kind:market 합성 객체는 type 무관하게 시장 지표로 식별', () => {
    expect(isMarketIndicatorSignal({ kind: 'market', type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'MARKET' })).toBe(true);
  });

  it('MARKET_INDICATOR_TYPES Set은 비어 있음 (#366 — market 타입 0종)', () => {
    expect(MARKET_INDICATOR_TYPES.size).toBe(0);
  });

  it('null/undefined/타입 누락 시 false 반환 (안전)', () => {
    expect(isMarketIndicatorSignal(null)).toBe(false);
    expect(isMarketIndicatorSignal(undefined)).toBe(false);
    expect(isMarketIndicatorSignal({})).toBe(false);
    expect(isMarketIndicatorSignal({ symbol: 'crypto' })).toBe(false);
  });
});

describe('시그널 클릭 가드 시뮬레이션 (#341)', () => {
  // 종목 카드 렌더 컴포넌트의 클릭 가능 여부 판정 — `signal.symbol && !isMarketIndicatorSignal(signal)`
  function isClickableAsStock(signal) {
    return !!signal?.symbol && !isMarketIndicatorSignal(signal);
  }

  it('kind:market 합성 시그널은 종목 클릭 불가 (symbol 있어도 차단)', () => {
    const marketSignal = {
      id: 'sig_test_mkt',
      kind: 'market',
      type: SIGNAL_TYPES.VOLUME_ANOMALY,
      symbol: 'MARKET',
      name: '시장 지표',
      direction: 'bullish',
      strength: 5,
    };
    expect(isClickableAsStock(marketSignal)).toBe(false);
  });

  it('실제 종목 시그널은 클릭 가능', () => {
    const realStockSignal = {
      id: 'sig_test_aapl',
      type: SIGNAL_TYPES.VOLUME_ANOMALY,
      symbol: 'AAPL',
      name: 'Apple',
      market: 'us',
      direction: 'bullish',
      strength: 3,
    };
    expect(isClickableAsStock(realStockSignal)).toBe(true);
  });

  it('symbol 없는 시그널은 클릭 불가 (기존 동작 유지)', () => {
    const noSymbolSignal = {
      id: 'sig_test_nosym',
      type: SIGNAL_TYPES.VOLUME_ANOMALY,
      direction: 'neutral',
      strength: 2,
    };
    expect(isClickableAsStock(noSymbolSignal)).toBe(false);
  });
});

describe('signalStockResolver 가드 — 잔존 KEEP 타입 (#343, #366)', () => {
  it('VOLUME_ANOMALY는 종목 풀에 있으면 클릭 가능', () => {
    const sig = { type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'BTC', market: 'crypto' };
    expect(isStockClickable(sig, [{ symbol: 'BTC', _market: 'COIN' }])).toBe(true);
  });

  it('VOLUME_ANOMALY는 종목 풀 비면 클릭 불가 (lookup 실패)', () => {
    const sig = { type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'BTC', market: 'crypto' };
    expect(isStockClickable(sig, [])).toBe(false);
  });

  it('kind:market 합성 시그널은 종목 풀 있어도 카드 렌더 차단', () => {
    const sig = { kind: 'market', type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'MARKET', market: 'kr' };
    expect(shouldRenderStockCard(sig, [{ symbol: 'MARKET', _market: 'KR' }])).toBe(false);
  });
});
