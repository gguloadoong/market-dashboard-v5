// #341 — 시장 지표 시그널(공포탐욕 등) 가짜 종목 카드 차단 회귀 테스트
// 시그널 풀에 종목이 아닌 시장 지표 시그널(symbol='crypto', type='fear_greed_shift')이
// 들어가도 종목 카드 클릭 가드(isMarketIndicatorSignal)가 차단하는지 검증.
import { describe, it, expect } from 'vitest';
import {
  SIGNAL_TYPES,
  MARKET_INDICATOR_TYPES,
  isMarketIndicatorSignal,
} from '../engine/signalTypes.js';
import { isStockClickable } from '../utils/signalStockResolver.js';

describe('isMarketIndicatorSignal (#341)', () => {
  it('FEAR_GREED_SHIFT 타입은 시장 지표로 식별', () => {
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.FEAR_GREED_SHIFT, symbol: 'crypto' })).toBe(true);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.FEAR_GREED_SHIFT, symbol: 'us' })).toBe(true);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.FEAR_GREED_SHIFT, symbol: 'kr' })).toBe(true);
  });

  it('종목 시그널(VOLUME_ANOMALY, FOREIGN_CONSECUTIVE_BUY 등)은 시장 지표 아님', () => {
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'AAPL' })).toBe(false);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.FOREIGN_CONSECUTIVE_BUY, symbol: '005930' })).toBe(false);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.COMPOSITE_SCORE, symbol: 'BTC' })).toBe(false);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.CAPITULATION, symbol: 'TSLA' })).toBe(false);
  });

  // #346 — REBALANCING_ALERT 시장지표 가드 추가
  it('REBALANCING_ALERT 타입은 시장 지표로 식별 (symbol="MARKET")', () => {
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.REBALANCING_ALERT, symbol: 'MARKET' })).toBe(true);
  });

  it('MARKET_INDICATOR_TYPES Set에 rebalancing_alert 포함 (#346)', () => {
    expect(MARKET_INDICATOR_TYPES.has('rebalancing_alert')).toBe(true);
  });

  // #346 — FX_IMPACT, PCR, MARKET_MOOD_SHIFT, CROSS_MARKET_CORRELATION도 회귀 가드
  it('FX_IMPACT 타입은 시장 지표 (symbol="USDKRW") (#346)', () => {
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.FX_IMPACT, symbol: 'USDKRW' })).toBe(true);
  });

  it('PUT_CALL_RATIO 타입은 시장 지표 (symbol="SPY") (#346)', () => {
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.PUT_CALL_RATIO, symbol: 'SPY' })).toBe(true);
  });

  it('MARKET_MOOD_SHIFT/CROSS_MARKET_CORRELATION/SECTOR_ROTATION 모두 시장 지표 (#346)', () => {
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.MARKET_MOOD_SHIFT, symbol: 'MARKET' })).toBe(true);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.CROSS_MARKET_CORRELATION, symbol: 'BTC_KOSPI' })).toBe(true);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.SECTOR_ROTATION, symbol: null })).toBe(true);
  });

  it('null/undefined/타입 누락 시 false 반환 (안전)', () => {
    expect(isMarketIndicatorSignal(null)).toBe(false);
    expect(isMarketIndicatorSignal(undefined)).toBe(false);
    expect(isMarketIndicatorSignal({})).toBe(false);
    expect(isMarketIndicatorSignal({ symbol: 'crypto' })).toBe(false);
  });

  it('MARKET_INDICATOR_TYPES Set에 fear_greed_shift 포함', () => {
    expect(MARKET_INDICATOR_TYPES.has('fear_greed_shift')).toBe(true);
  });
});

describe('시그널 클릭 가드 시뮬레이션 (#341)', () => {
  // 종목 카드 렌더 컴포넌트(SignalBoardWidget/SignalSummaryWidget/CommandCenterWidget HeroSignalCard)의
  // 클릭 가능 여부 판정 로직 — `signal.symbol && !isMarketIndicatorSignal(signal)`
  function isClickableAsStock(signal) {
    return !!signal?.symbol && !isMarketIndicatorSignal(signal);
  }

  it('공포탐욕 시그널은 종목 클릭 불가 (symbol="crypto"여도 차단)', () => {
    const fearGreedSignal = {
      id: 'sig_test_fg',
      type: SIGNAL_TYPES.FEAR_GREED_SHIFT,
      symbol: 'crypto',
      name: 'crypto 공포탐욕',
      market: 'crypto',
      direction: 'bullish',
      strength: 5,
      title: 'crypto 극단적 공포 극단값 (23) — 역발상 기회',
    };
    expect(isClickableAsStock(fearGreedSignal)).toBe(false);
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
      id: 'sig_test_mood',
      type: SIGNAL_TYPES.MARKET_MOOD_SHIFT,
      direction: 'neutral',
      strength: 2,
    };
    expect(isClickableAsStock(noSymbolSignal)).toBe(false);
  });

  // #346 — REBALANCING_ALERT는 createRebalancingSignal에서 symbol:'MARKET'으로 생성됨.
  // signalEngine.js:715-723. 종목 카드 클릭 시 'MARKET' 가짜 종목 카드 → 빈 차트 사고.
  it('REBALANCING_ALERT(symbol="MARKET")는 종목 클릭 불가 (#346)', () => {
    const rebalancingSignal = {
      id: 'sig_test_rebal',
      type: SIGNAL_TYPES.REBALANCING_ALERT,
      symbol: 'MARKET',
      name: '기관 리밸런싱',
      market: 'kr',
      direction: 'bearish',
      strength: 3,
      title: '월말 D-2 — 기관 리밸런싱 매물 출회 가능',
    };
    expect(isClickableAsStock(rebalancingSignal)).toBe(false);
  });

  // #346 — UnifiedFeedPanel 시그널 항목 가드 (이전 누락분 회귀)
  it('FX_IMPACT(symbol="USDKRW")는 종목 클릭 불가 — UnifiedFeedPanel 패턴 (#346)', () => {
    const fxSignal = {
      id: 'sig_test_fx',
      type: SIGNAL_TYPES.FX_IMPACT,
      symbol: 'USDKRW',
      name: '원/달러 환율',
      market: 'kr',
    };
    expect(isClickableAsStock(fxSignal)).toBe(false);
    // #343 — 공통 유틸 isStockClickable(lookup 미제공)도 동일 차단 (UnifiedFeedPanel 실제 사용 형태)
    expect(isStockClickable(fxSignal)).toBe(false);
  });
});
