// #343 — 시그널 도메인(kind) 분리 회귀 테스트
// 모든 시그널 타입이 'stock'|'market'으로 분류되고, createSignal/loadSignals가
// type 기준으로 kind를 자동 주입하며, isMarketIndicatorSignal이 kind를 우선 사용하는지 검증.
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
    // 현 시점 30종(stock 22 + market 8) — 신규 타입 추가 시 IIFE가 로드 단계에서 throw
    expect(types.length).toBe(30);
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
    expect(getSignalKind(SIGNAL_TYPES.FOREIGN_CONSECUTIVE_BUY)).toBe('stock');
    expect(getSignalKind(SIGNAL_TYPES.COMPOSITE_SCORE)).toBe('stock');
    expect(getSignalKind(SIGNAL_TYPES.SECTOR_OUTLIER)).toBe('stock');
  });

  it('시장 지표 타입은 market', () => {
    expect(getSignalKind(SIGNAL_TYPES.FEAR_GREED_SHIFT)).toBe('market');
    expect(getSignalKind(SIGNAL_TYPES.SECTOR_ROTATION)).toBe('market');
    expect(getSignalKind(SIGNAL_TYPES.REBALANCING_ALERT)).toBe('market');
    expect(getSignalKind(SIGNAL_TYPES.FX_IMPACT)).toBe('market');
  });

  it('미등록 타입은 stock 기본', () => {
    expect(getSignalKind('unknown_type_xyz')).toBe('stock');
    expect(getSignalKind(undefined)).toBe('stock');
  });
});

describe('createSignal kind 자동 주입 (#343)', () => {
  it('FEAR_GREED_SHIFT → kind:market 자동 주입', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.FEAR_GREED_SHIFT, symbol: 'crypto', market: 'crypto' });
    expect(sig.kind).toBe('market');
  });

  it('VOLUME_ANOMALY → kind:stock 자동 주입', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'AAPL', market: 'us' });
    expect(sig.kind).toBe('stock');
  });
});

describe('useFearGreed 간접 — FEAR_GREED_SHIFT createSignal kind (#343)', () => {
  // useFearGreed.js는 createSignal({ type: FEAR_GREED_SHIFT, ... })로 시그널 생성 → A안 자동 주입
  it('공포탐욕 시그널은 createSignal 경유 시 kind:market', () => {
    const fg = createSignal({
      type: SIGNAL_TYPES.FEAR_GREED_SHIFT,
      symbol: 'us',
      name: 'us 공포탐욕',
      market: 'us',
      direction: 'bullish',
      strength: 5,
    });
    expect(fg.kind).toBe('market');
    expect(isMarketIndicatorSignal(fg)).toBe(true);
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

  it('kind:stock이면 type 무관하게 false (FEAR_GREED_SHIFT여도)', () => {
    expect(isMarketIndicatorSignal({ kind: 'stock', type: SIGNAL_TYPES.FEAR_GREED_SHIFT, symbol: 'crypto' })).toBe(false);
  });

  it('kind 없으면 type 기반 레거시 fallback', () => {
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.FEAR_GREED_SHIFT })).toBe(true);
    expect(isMarketIndicatorSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY })).toBe(false);
  });
});

describe('MARKET_INDICATOR_TYPES 파생 일치 (#343)', () => {
  it('기존 8종 market 타입 전부 포함', () => {
    const expected = [
      SIGNAL_TYPES.FEAR_GREED_SHIFT,
      SIGNAL_TYPES.MARKET_MOOD_SHIFT,
      SIGNAL_TYPES.SECTOR_ROTATION,
      SIGNAL_TYPES.PUT_CALL_RATIO,
      SIGNAL_TYPES.FUNDING_RATE_EXTREME,
      SIGNAL_TYPES.FX_IMPACT,
      SIGNAL_TYPES.CROSS_MARKET_CORRELATION,
      SIGNAL_TYPES.REBALANCING_ALERT,
    ];
    expect(MARKET_INDICATOR_TYPES.size).toBe(8);
    for (const type of expected) {
      expect(MARKET_INDICATOR_TYPES.has(type)).toBe(true);
    }
  });
});
