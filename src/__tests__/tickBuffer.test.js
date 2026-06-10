// WS 틱 코얼레싱 버퍼 단위 테스트 (#394)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTickBuffer, TICK_FLUSH_MS } from '../utils/tickBuffer';

describe('createTickBuffer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('flushMs 이전에는 플러시하지 않는다', () => {
    const onFlush = vi.fn();
    const buf = createTickBuffer(onFlush, 1000);
    buf.push({ symbol: 'AAPL', price: 100 });
    vi.advanceTimersByTime(999);
    expect(onFlush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('같은 심볼의 연속 틱은 최신 틱만 배치에 남는다', () => {
    const onFlush = vi.fn();
    const buf = createTickBuffer(onFlush, 1000);
    buf.push({ symbol: 'AAPL', price: 100 });
    buf.push({ symbol: 'AAPL', price: 101 });
    buf.push({ symbol: 'AAPL', price: 102 });
    vi.advanceTimersByTime(1000);
    expect(onFlush).toHaveBeenCalledWith([{ symbol: 'AAPL', price: 102 }]);
  });

  it('서로 다른 심볼은 한 배치에 함께 전달된다', () => {
    const onFlush = vi.fn();
    const buf = createTickBuffer(onFlush, 1000);
    buf.push({ symbol: 'AAPL', price: 100 });
    buf.push({ symbol: 'NVDA', price: 900 });
    vi.advanceTimersByTime(1000);
    const batch = onFlush.mock.calls[0][0];
    expect(batch).toHaveLength(2);
    expect(batch.map(t => t.symbol).sort()).toEqual(['AAPL', 'NVDA']);
  });

  it('플러시 후 새 틱은 새 배치로 다시 스케줄된다', () => {
    const onFlush = vi.fn();
    const buf = createTickBuffer(onFlush, 1000);
    buf.push({ symbol: 'AAPL', price: 100 });
    vi.advanceTimersByTime(1000);
    buf.push({ symbol: 'AAPL', price: 101 });
    vi.advanceTimersByTime(1000);
    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(onFlush.mock.calls[1][0]).toEqual([{ symbol: 'AAPL', price: 101 }]);
  });

  it('symbol 없는 틱은 무시한다', () => {
    const onFlush = vi.fn();
    const buf = createTickBuffer(onFlush, 1000);
    buf.push({ price: 100 });
    buf.push(null);
    vi.advanceTimersByTime(1000);
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('destroy는 대기 중인 플러시를 취소하고 버퍼를 비운다', () => {
    const onFlush = vi.fn();
    const buf = createTickBuffer(onFlush, 1000);
    buf.push({ symbol: 'AAPL', price: 100 });
    buf.destroy();
    vi.advanceTimersByTime(2000);
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('기본 플러시 주기는 TICK_FLUSH_MS(1000ms)다', () => {
    expect(TICK_FLUSH_MS).toBe(1000);
    const onFlush = vi.fn();
    const buf = createTickBuffer(onFlush);
    buf.push({ symbol: 'BTC', price: 1 });
    vi.advanceTimersByTime(TICK_FLUSH_MS);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });
});
