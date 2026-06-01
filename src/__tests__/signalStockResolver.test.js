// #343 — 시그널 → 종목 카드 렌더 판정 유틸 회귀 테스트
import { describe, it, expect } from 'vitest';
import { SIGNAL_TYPES } from '../engine/signalTypes.js';
import {
  resolveStockItem,
  isStockClickable,
  shouldRenderStockCard,
} from '../utils/signalStockResolver.js';

const ALL_ITEMS = [
  { symbol: 'AAPL', name: 'Apple', _market: 'US', price: 200 },
  { symbol: '005930', name: '삼성전자', _market: 'KR', price: 70000 },
  { id: 'BTC', symbol: 'BTC', name: '비트코인', _market: 'COIN', priceKrw: 90000000 },
];

// crypto market 정규화 검증용 — 동일 ticker가 코인/주식 둘 다 존재하는 경우 (#343 HIGH-1)
const APE_ITEMS = [
  { symbol: 'APE', name: 'APE (Stocks)', _market: 'US', price: 1.2 },  // 주식 먼저
  { id: 'APE', symbol: 'APE', name: 'ApeCoin', _market: 'COIN', priceKrw: 1500 }, // 코인 나중
];

describe('resolveStockItem (#343)', () => {
  it('symbol + market 일치 종목 반환', () => {
    const sig = { type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'AAPL', market: 'us' };
    expect(resolveStockItem(sig, ALL_ITEMS)?.symbol).toBe('AAPL');
  });

  it('코인 id 매칭 반환 — crypto→coin 정규화로 1차 정확매칭', () => {
    const sig = { type: SIGNAL_TYPES.BTC_LEADING, symbol: 'BTC', market: 'crypto' };
    // crypto→coin 정규화 후 1차 매칭: (i._market||'').toLowerCase()==='coin' 통과
    expect(resolveStockItem(sig, ALL_ITEMS)?.id).toBe('BTC');
  });

  it('crypto 정규화 — 동일 ticker 코인/주식 둘 다 존재 시 _market:COIN 종목을 정확히 집음 (#343)', () => {
    // market:'crypto' 시그널 → 정규화 없으면 배열 앞 US주식 APE를 잘못 집음
    const sig = { type: SIGNAL_TYPES.BTC_LEADING, symbol: 'APE', market: 'crypto' };
    const found = resolveStockItem(sig, APE_ITEMS);
    expect(found?._market).toBe('COIN');  // 코인을 정확히 집어야 함
    expect(found?.id).toBe('APE');
  });

  it('종목 풀에 없으면 null', () => {
    const sig = { type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'NVDA', market: 'us' };
    expect(resolveStockItem(sig, ALL_ITEMS)).toBeNull();
  });

  it('symbol 없거나 빈 배열이면 null', () => {
    expect(resolveStockItem({ type: SIGNAL_TYPES.VOLUME_ANOMALY }, ALL_ITEMS)).toBeNull();
    expect(resolveStockItem({ symbol: 'AAPL' }, [])).toBeNull();
  });
});

describe('isStockClickable (#343)', () => {
  it('market 시그널은 allItems 무관하게 false', () => {
    const fg = { type: SIGNAL_TYPES.FEAR_GREED_SHIFT, symbol: 'crypto', market: 'crypto', kind: 'market' };
    expect(isStockClickable(fg, ALL_ITEMS)).toBe(false);
    expect(isStockClickable(fg, [])).toBe(false);
    expect(isStockClickable(fg)).toBe(false);
  });

  it('stock + 종목 존재 → true', () => {
    const sig = { type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'AAPL', market: 'us', kind: 'stock' };
    expect(isStockClickable(sig, ALL_ITEMS)).toBe(true);
  });

  it('stock + 빈 배열 → false (drop)', () => {
    const sig = { type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'AAPL', market: 'us', kind: 'stock' };
    expect(isStockClickable(sig, [])).toBe(false);
  });

  it('lookup 미제공(undefined) → true (기존 동작 호환)', () => {
    const sig = { type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'AAPL', market: 'us', kind: 'stock' };
    expect(isStockClickable(sig)).toBe(true);
  });

  it('symbol 없으면 false', () => {
    expect(isStockClickable({ type: SIGNAL_TYPES.MARKET_MOOD_SHIFT })).toBe(false);
  });
});

describe('shouldRenderStockCard (#343)', () => {
  it('market 시그널은 false', () => {
    const fg = { type: SIGNAL_TYPES.FEAR_GREED_SHIFT, symbol: 'crypto', market: 'crypto', kind: 'market' };
    expect(shouldRenderStockCard(fg, ALL_ITEMS)).toBe(false);
  });

  it('stock + 종목 없음 → false', () => {
    const sig = { type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'NVDA', market: 'us', kind: 'stock' };
    expect(shouldRenderStockCard(sig, ALL_ITEMS)).toBe(false);
  });

  it('stock + 종목 있음 → true', () => {
    const sig = { type: SIGNAL_TYPES.VOLUME_ANOMALY, symbol: 'AAPL', market: 'us', kind: 'stock' };
    expect(shouldRenderStockCard(sig, ALL_ITEMS)).toBe(true);
  });
});
