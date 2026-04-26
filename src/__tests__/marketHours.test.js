import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isKoreanMarketOpen,
  isUsMarketOpen,
  isUsPreMarket,
  isUsAfterMarket,
  getKoreanMarketStatus,
  getUsMarketStatus,
} from '../utils/marketHours.js';

// KST 시각 → UTC Date (KST = UTC+9)
const kst = (y, mo, d, h, m = 0) =>
  new Date(Date.UTC(y, mo - 1, d, h - 9, m));

// EDT 시각 → UTC Date (EDT = UTC-4, 4월 기준)
const edt = (y, mo, d, h, m = 0) =>
  new Date(Date.UTC(y, mo - 1, d, h + 4, m));

// EST 시각 → UTC Date (EST = UTC-5, 1월 기준)
const estTime = (y, mo, d, h, m = 0) =>
  new Date(Date.UTC(y, mo - 1, d, h + 5, m));

describe('marketHours', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // ── isKoreanMarketOpen ──────────────────────────────────────────
  describe('isKoreanMarketOpen', () => {
    it('09:00 KST 장 시작 → true', () => {
      vi.setSystemTime(kst(2026, 4, 27, 9, 0));
      expect(isKoreanMarketOpen()).toBe(true);
    });

    it('08:59 KST 장 시작 전 → false', () => {
      vi.setSystemTime(kst(2026, 4, 27, 8, 59));
      expect(isKoreanMarketOpen()).toBe(false);
    });

    it('15:29 KST 마감 직전 → true', () => {
      vi.setSystemTime(kst(2026, 4, 27, 15, 29));
      expect(isKoreanMarketOpen()).toBe(true);
    });

    it('15:30 KST 마감 → false', () => {
      vi.setSystemTime(kst(2026, 4, 27, 15, 30));
      expect(isKoreanMarketOpen()).toBe(false);
    });

    it('토요일 장중 시간대 → false', () => {
      vi.setSystemTime(kst(2026, 4, 25, 12, 0));
      expect(isKoreanMarketOpen()).toBe(false);
    });

    it('일요일 → false', () => {
      vi.setSystemTime(kst(2026, 4, 26, 12, 0));
      expect(isKoreanMarketOpen()).toBe(false);
    });

    it('KRX 공휴일 어린이날 2026-05-05 (화요일) → false', () => {
      vi.setSystemTime(kst(2026, 5, 5, 10, 0));
      expect(isKoreanMarketOpen()).toBe(false);
    });

    it('KRX 공휴일 광복절 2026-08-17 (월, 대체) → false', () => {
      vi.setSystemTime(kst(2026, 8, 17, 11, 0));
      expect(isKoreanMarketOpen()).toBe(false);
    });
  });

  // ── isUsMarketOpen ──────────────────────────────────────────────
  describe('isUsMarketOpen', () => {
    it('10:00 EDT 장중 → true', () => {
      vi.setSystemTime(edt(2026, 4, 27, 10, 0));
      expect(isUsMarketOpen()).toBe(true);
    });

    it('09:29 EDT 장 시작 전 → false', () => {
      vi.setSystemTime(edt(2026, 4, 27, 9, 29));
      expect(isUsMarketOpen()).toBe(false);
    });

    it('09:30 EDT 장 시작 → true', () => {
      vi.setSystemTime(edt(2026, 4, 27, 9, 30));
      expect(isUsMarketOpen()).toBe(true);
    });

    it('16:00 EDT 마감 → false', () => {
      vi.setSystemTime(edt(2026, 4, 27, 16, 0));
      expect(isUsMarketOpen()).toBe(false);
    });

    it('NYSE 공휴일 2026-01-01 → false', () => {
      vi.setSystemTime(estTime(2026, 1, 1, 11, 0));
      expect(isUsMarketOpen()).toBe(false);
    });

    it('주말 토요일 → false', () => {
      vi.setSystemTime(edt(2026, 4, 25, 12, 0));
      expect(isUsMarketOpen()).toBe(false);
    });
  });

  // ── isUsPreMarket ───────────────────────────────────────────────
  describe('isUsPreMarket', () => {
    it('06:00 EDT 프리마켓 중 → true', () => {
      vi.setSystemTime(edt(2026, 4, 27, 6, 0));
      expect(isUsPreMarket()).toBe(true);
    });

    it('04:00 EDT 프리마켓 시작 → true', () => {
      vi.setSystemTime(edt(2026, 4, 27, 4, 0));
      expect(isUsPreMarket()).toBe(true);
    });

    it('03:59 EDT 프리마켓 전 → false', () => {
      vi.setSystemTime(edt(2026, 4, 27, 3, 59));
      expect(isUsPreMarket()).toBe(false);
    });

    it('09:30 EDT 정규장 시작 시 프리마켓 종료 → false', () => {
      vi.setSystemTime(edt(2026, 4, 27, 9, 30));
      expect(isUsPreMarket()).toBe(false);
    });

    it('NYSE 공휴일 프리마켓 → false', () => {
      vi.setSystemTime(estTime(2026, 1, 1, 6, 0));
      expect(isUsPreMarket()).toBe(false);
    });
  });

  // ── isUsAfterMarket ─────────────────────────────────────────────
  describe('isUsAfterMarket', () => {
    it('17:00 EDT 애프터마켓 → true', () => {
      vi.setSystemTime(edt(2026, 4, 27, 17, 0));
      expect(isUsAfterMarket()).toBe(true);
    });

    it('16:00 EDT 애프터마켓 시작 → true', () => {
      vi.setSystemTime(edt(2026, 4, 27, 16, 0));
      expect(isUsAfterMarket()).toBe(true);
    });

    it('20:00 EDT 애프터마켓 종료 → false', () => {
      vi.setSystemTime(edt(2026, 4, 27, 20, 0));
      expect(isUsAfterMarket()).toBe(false);
    });

    it('14:00 EDT 정규장 중 → false', () => {
      vi.setSystemTime(edt(2026, 4, 27, 14, 0));
      expect(isUsAfterMarket()).toBe(false);
    });
  });

  // ── getKoreanMarketStatus ───────────────────────────────────────
  describe('getKoreanMarketStatus', () => {
    it('장중 → { status: open, label: 거래중 }', () => {
      vi.setSystemTime(kst(2026, 4, 27, 12, 0));
      const s = getKoreanMarketStatus();
      expect(s.status).toBe('open');
      expect(s.label).toBe('거래중');
    });

    it('장 마감 후 → { status: closed }', () => {
      vi.setSystemTime(kst(2026, 4, 27, 18, 0));
      expect(getKoreanMarketStatus().status).toBe('closed');
    });

    it('주말 → { status: closed }', () => {
      vi.setSystemTime(kst(2026, 4, 25, 12, 0));
      expect(getKoreanMarketStatus().status).toBe('closed');
    });
  });

  // ── getUsMarketStatus ───────────────────────────────────────────
  describe('getUsMarketStatus', () => {
    it('정규장 → { status: open }', () => {
      vi.setSystemTime(edt(2026, 4, 27, 12, 0));
      expect(getUsMarketStatus().status).toBe('open');
    });

    it('프리마켓 → { status: pre }', () => {
      vi.setSystemTime(edt(2026, 4, 27, 7, 0));
      expect(getUsMarketStatus().status).toBe('pre');
    });

    it('애프터마켓 → { status: after }', () => {
      vi.setSystemTime(edt(2026, 4, 27, 18, 0));
      expect(getUsMarketStatus().status).toBe('after');
    });

    it('완전 마감 (22:00 EDT) → { status: closed }', () => {
      vi.setSystemTime(edt(2026, 4, 27, 22, 0));
      expect(getUsMarketStatus().status).toBe('closed');
    });

    it('NYSE 공휴일 → { status: closed }', () => {
      vi.setSystemTime(estTime(2026, 1, 1, 12, 0));
      expect(getUsMarketStatus().status).toBe('closed');
    });
  });
});
