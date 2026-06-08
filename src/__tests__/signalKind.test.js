// #343 — 시그널 도메인(kind) 분리 회귀 테스트
// 모든 시그널 타입이 'stock'|'market'으로 분류되고, createSignal/loadSignals가
// type 기준으로 kind를 자동 주입하며, isMarketIndicatorSignal이 kind를 우선 사용하는지 검증.
// #366: 죽은 시그널 26종 제거로 잔존 타입은 4종(volume_anomaly/composite_score/
//       support_resistance_break/double_bottom) — 전부 stock kind, market kind 0종.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SIGNAL_TYPES,
  SIGNAL_KIND,
  MARKET_INDICATOR_TYPES,
  getSignalKind,
  isMarketIndicatorSignal,
} from '../engine/signalTypes.js';
import { createSignal, loadSignals, getActiveSignals, _resetStore } from '../engine/signalEngine.js';

describe('SIGNAL_KIND 완전성 (#343)', () => {
  it('모든 SIGNAL_TYPES가 stock|market으로 분류됨 (누락 0)', () => {
    const types = Object.values(SIGNAL_TYPES);
    // #366: 잔존 4종(stock 4 + market 0) — 신규 타입 추가 시 IIFE가 로드 단계에서 throw
    expect(types.length).toBe(4);
    const missing = types.filter(type => !['stock', 'market'].includes(SIGNAL_KIND[type]));
    expect(missing).toEqual([]);
  });

  it('SIGNAL_KIND에 SIGNAL_TYPES 외 잉여 키 없음', () => {
    const validTypes = new Set(Object.values(SIGNAL_TYPES));
    const extra = Object.keys(SIGNAL_KIND).filter(t => !validTypes.has(t));
    expect(extra).toEqual([]);
  });
});

describe('getSignalKind (#343)', () => {
  it('종목 타입은 stock', () => {
    expect(getSignalKind(SIGNAL_TYPES.VOLUME_ANOMALY)).toBe('stock');
    expect(getSignalKind(SIGNAL_TYPES.COMPOSITE_SCORE)).toBe('stock');
    expect(getSignalKind(SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK)).toBe('stock');
    expect(getSignalKind(SIGNAL_TYPES.DOUBLE_BOTTOM)).toBe('stock');
  });

  it('미등록 타입은 stock 기본', () => {
    expect(getSignalKind('unknown_type_xyz')).toBe('stock');
    expect(getSignalKind(undefined)).toBe('stock');
  });
});

describe('createSignal kind 자동 주입 (#343)', () => {
  it('VOLUME_ANOMALY → kind:stock 자동 주입', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'AAPL', market: 'us' });
    expect(sig.kind).toBe('stock');
  });

  it('COMPOSITE_SCORE → kind:stock 자동 주입', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.COMPOSITE_SCORE, symbol: '005930', market: 'kr' });
    expect(sig.kind).toBe('stock');
  });
});

describe('loadSignals kind 주입 (#343)', () => {
  beforeEach(() => _resetStore()); // 전역 _signals 초기화 — signalEngine.test.js:16 패턴

  it('서버 시그널(COMPOSITE_SCORE)에 kind:stock 주입 — 서버가 틀린 kind 보내도 type 기준 덮어쓰기', () => {
    loadSignals([
      {
        id: 'srv_comp_1',
        type: SIGNAL_TYPES.COMPOSITE_SCORE,
        symbol: '005930',
        market: 'kr',
        direction: 'bullish',
        strength: 4,
        kind: 'market', // 서버가 의도적으로 틀린 kind 전송
      },
    ]);
    const loaded = getActiveSignals().find(s => s.id === 'srv_comp_1');
    expect(loaded).toBeDefined();
    expect(loaded.kind).toBe('stock'); // type 기준으로 덮어써짐
  });
});

describe('isMarketIndicatorSignal kind 우선 + 레거시 fallback (#343)', () => {
  it('kind:market이면 type 무관하게 true', () => {
    expect(isMarketIndicatorSignal({ kind: 'market', type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'AAPL' })).toBe(true);
  });

  it('kind:stock이면 type 무관하게 false', () => {
    expect(isMarketIndicatorSignal({ kind: 'stock', type: SIGNAL_TYPES.COMPOSITE_SCORE, symbol: 'crypto' })).toBe(false);
  });

  it('kind 없고 잔존 타입은 전부 stock → false', () => {
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY })).toBe(false);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.DOUBLE_BOTTOM })).toBe(false);
  });
});

describe('MARKET_INDICATOR_TYPES 파생 일치 (#343, #366)', () => {
  it('잔존 4종은 전부 stock → market 타입 0종', () => {
    // #366: 죽은 시그널 제거로 market kind 타입이 모두 사라짐.
    expect(MARKET_INDICATOR_TYPES.size).toBe(0);
  });
});
