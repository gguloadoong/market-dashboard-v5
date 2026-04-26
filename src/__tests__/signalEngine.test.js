import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSignal,
  addSignal,
  getActiveSignals,
  getSignalsBySymbol,
  getSignalsByMarket,
  getTopSignals,
  pruneExpired,
  subscribe,
  unsubscribe,
  _resetStore,
} from '../engine/signalEngine.js';
import { SIGNAL_TYPES, DIRECTIONS } from '../engine/signalTypes.js';

beforeEach(() => _resetStore());

describe('createSignal', () => {
  it('필수 필드 포함 시그널 객체 반환', () => {
    const sig = createSignal({
      type: SIGNAL_TYPES.VOLUME_ANOMALY,
      symbol: '005930',
      name: '삼성전자',
      market: 'kr',
      direction: DIRECTIONS.UP,
      strength: 3,
      title: '거래량 급등',
    });
    expect(sig.id).toMatch(/^sig_/);
    expect(sig.type).toBe(SIGNAL_TYPES.VOLUME_ANOMALY);
    expect(sig.symbol).toBe('005930');
    expect(sig.strength).toBe(3);
    expect(sig.expiresAt).toBeGreaterThan(sig.timestamp);
  });

  it('strength 1~5 범위 클램프 — 0 → 1', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, strength: 0 });
    expect(sig.strength).toBe(1);
  });

  it('strength 1~5 범위 클램프 — 10 → 5', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, strength: 10 });
    expect(sig.strength).toBe(5);
  });

  it('direction 미전달 시 NEUTRAL 기본값', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY });
    expect(sig.direction).toBe(DIRECTIONS.NEUTRAL);
  });

  it('meta 미전달 시 빈 객체 기본값', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY });
    expect(sig.meta).toEqual({});
  });
});

describe('addSignal / getActiveSignals', () => {
  it('시그널 추가 후 getActiveSignals에 포함', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'AAPL' });
    addSignal(sig);
    const active = getActiveSignals();
    expect(active.some(s => s.id === sig.id)).toBe(true);
  });

  it('만료된 시그널은 getActiveSignals에서 제외', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'TSLA' });
    // expiresAt을 과거로 조작
    sig.expiresAt = Date.now() - 1000;
    addSignal(sig);
    const active = getActiveSignals();
    expect(active.some(s => s.id === sig.id)).toBe(false);
  });

  it('여러 시그널 추가 시 모두 포함', () => {
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'A' }));
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'B' }));
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'C' }));
    expect(getActiveSignals().length).toBe(3);
  });
});

describe('getSignalsBySymbol', () => {
  it('해당 심볼 시그널만 반환', () => {
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: '005930' }));
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: '000660' }));
    const result = getSignalsBySymbol('005930');
    expect(result.length).toBe(1);
    expect(result[0].symbol).toBe('005930');
  });

  it('없는 심볼 → 빈 배열', () => {
    expect(getSignalsBySymbol('NONE')).toEqual([]);
  });
});

describe('getSignalsByMarket', () => {
  it('kr 마켓 시그널만 반환', () => {
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, market: 'kr' }));
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, market: 'us' }));
    const kr = getSignalsByMarket('kr');
    expect(kr.every(s => s.market === 'kr')).toBe(true);
    expect(kr.length).toBe(1);
  });
});

describe('getTopSignals', () => {
  it('strength 내림차순 정렬', () => {
    // addSignal은 type+symbol 중복 제거 → 심볼 다르게 설정
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'A', strength: 2 }));
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'B', strength: 5 }));
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'C', strength: 3 }));
    const top = getTopSignals(3);
    expect(top[0].strength).toBe(5);
    expect(top[1].strength).toBe(3);
    expect(top[2].strength).toBe(2);
  });

  it('n개 제한 적용', () => {
    for (let i = 0; i < 5; i++) {
      addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: String(i), strength: i + 1 }));
    }
    expect(getTopSignals(2).length).toBe(2);
  });
});

describe('pruneExpired', () => {
  it('만료 시그널 제거 후 getActiveSignals에서 사라짐', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY });
    sig.expiresAt = Date.now() - 1;
    addSignal(sig);
    pruneExpired();
    expect(getActiveSignals().some(s => s.id === sig.id)).toBe(false);
  });

  it('유효 시그널은 pruneExpired 후에도 유지', () => {
    const sig = createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY });
    addSignal(sig);
    pruneExpired();
    expect(getActiveSignals().some(s => s.id === sig.id)).toBe(true);
  });
});

describe('subscribe / unsubscribe', () => {
  it('addSignal 시 구독자에게 알림', () => {
    const calls = [];
    const cb = (signals) => calls.push(signals);
    subscribe(cb);
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY }));
    unsubscribe(cb);
    expect(calls.length).toBeGreaterThan(0);
  });

  it('unsubscribe 후 알림 없음', () => {
    const calls = [];
    const cb = (signals) => calls.push(signals);
    subscribe(cb);
    unsubscribe(cb);
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY }));
    expect(calls.length).toBe(0);
  });
});

describe('_resetStore', () => {
  it('리셋 후 빈 스토어', () => {
    addSignal(createSignal({ type: SIGNAL_TYPES.VOLUME_ANOMALY }));
    _resetStore();
    expect(getActiveSignals().length).toBe(0);
  });
});
