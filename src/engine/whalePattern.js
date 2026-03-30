// 고래 연속 패턴 감지 엔진
// WhalePanel의 이벤트 버퍼에서 연속 패턴을 감지하여 시그널 생성
import { DEFAULT_KRW_RATE } from '../constants/market';

// 패턴 감지 상수
const LARGE_SINGLE_USD   = 10_000_000;       // 대형 단건 기준 ($10M+)
const PATTERN_WINDOW_MS  = 30 * 60 * 1000;  // 패턴 감지 윈도우 (30분)

/**
 * 연속 패턴 감지 규칙:
 * 1. 30분 내 동일 코인 거래소 입금 2건+ → 강한 매도 압력
 * 2. 30분 내 동일 코인 거래소 출금 2건+ → HODLing 확대
 * 3. 대형 단건 $10M+ → 즉시 시그널
 * 4. 양방향 동시 (입금+출금) → 차익거래/리밸런싱
 *
 * @param {Array} events - 고래 이벤트 배열
 * @param {number} windowMs - 감지 윈도우 (기본 30분)
 * @returns {Array} 감지된 패턴 배열
 */
export function detectWhalePatterns(events, windowMs = PATTERN_WINDOW_MS) {
  if (!events || events.length === 0) return [];

  const now = Date.now();
  const recent = events.filter(e => now - (e.timestamp || 0) < windowMs);
  const patterns = [];

  // 코인별 그룹핑
  const bySymbol = {};
  for (const e of recent) {
    const sym = (e.symbol || '').toUpperCase();
    if (!sym) continue;
    if (!bySymbol[sym]) bySymbol[sym] = [];
    bySymbol[sym].push(e);
  }

  for (const [symbol, evts] of Object.entries(bySymbol)) {
    const deposits = evts.filter(
      e => e.movementType === 'exchange_deposit' || e.movementType === 'wallet_to_exchange',
    );
    const withdrawals = evts.filter(
      e => e.movementType === 'exchange_withdrawal' || e.movementType === 'exchange_to_wallet',
    );

    // 규칙 1: 연속 거래소 입금 → 매도 압력
    if (deposits.length >= 2) {
      const totalAmt = deposits.reduce((s, e) => s + (e.tradeAmt || 0), 0);
      patterns.push({
        type: 'consecutive_deposit',
        symbol,
        count: deposits.length,
        totalAmt,
        direction: 'bearish',
        strength: Math.min(deposits.length + 1, 5),
        title: `${symbol} ${deposits.length}건 연속 거래소 입금 — 매도 압력`,
      });
    }

    // 규칙 2: 연속 거래소 출금 → HODLing
    if (withdrawals.length >= 2) {
      const totalAmt = withdrawals.reduce((s, e) => s + (e.tradeAmt || 0), 0);
      patterns.push({
        type: 'consecutive_withdrawal',
        symbol,
        count: withdrawals.length,
        totalAmt,
        direction: 'bullish',
        strength: Math.min(withdrawals.length + 1, 5),
        title: `${symbol} ${withdrawals.length}건 연속 거래소 출금 — HODLing`,
      });
    }

    // 규칙 4: 양방향 동시 → 차익거래/리밸런싱
    if (deposits.length >= 1 && withdrawals.length >= 1) {
      patterns.push({
        type: 'bidirectional',
        symbol,
        direction: 'neutral',
        strength: 3,
        title: `${symbol} 거래소 양방향 이동 — 차익거래/리밸런싱`,
      });
    }

    // 규칙 3: 대형 단건 $10M+ → 즉시 시그널
    for (const e of evts) {
      const usd = e.tradeUsd || (e.tradeAmt || 0) / DEFAULT_KRW_RATE;
      if (usd >= LARGE_SINGLE_USD) {
        patterns.push({
          type: 'large_single',
          symbol,
          direction: e.movementType === 'exchange_deposit' ? 'bearish' : 'bullish',
          strength: 5,
          title: `${symbol} $${(usd / 1e6).toFixed(0)}M 대형 단건 이동`,
          totalAmt: e.tradeAmt || 0,
        });
      }
    }
  }

  return patterns;
}
