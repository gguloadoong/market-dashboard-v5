import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isKoreanMarketOpen,
  isUsMarketOpen,
  isUsPreMarket,
  isUsAfterMarket,
  isKrPreNxt,
  isKrPreAuction,
  isKrAfterNxt,
  isUsDayMarket,
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

    // #333: 18:00 KST는 NXT 시간외(15:30~20:00) 구간 — phase=afterNxt, status는 'after'로 다운캐스트
    it('NXT 시간외 (18:00 KST) → { phase: afterNxt, status: after }', () => {
      vi.setSystemTime(kst(2026, 4, 27, 18, 0));
      const s = getKoreanMarketStatus();
      expect(s.phase).toBe('afterNxt');
      expect(s.status).toBe('after');
    });

    it('완전 마감 20:30 KST → { status: closed }', () => {
      vi.setSystemTime(kst(2026, 4, 27, 20, 30));
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

    // #333: 22:00 EDT(월 저녁)는 데이마켓 진입 — phase=dayMarket, status는 'after'로 다운캐스트
    it('데이마켓 (22:00 EDT 월) → { phase: dayMarket, status: after }', () => {
      vi.setSystemTime(edt(2026, 4, 27, 22, 0));
      const s = getUsMarketStatus();
      expect(s.phase).toBe('dayMarket');
      expect(s.status).toBe('after');
    });

    it('NYSE 공휴일 → { status: closed }', () => {
      vi.setSystemTime(estTime(2026, 1, 1, 12, 0));
      expect(getUsMarketStatus().status).toBe('closed');
    });
  });

  // ── 국장 NXT / 동시호가 (#333) ──────────────────────────────────
  // 2026-04-27 = 월요일 평일, KRX 휴장 아님
  describe('국장 NXT / 동시호가', () => {
    it('08:00 KST → preNxt (NXT 프리)', () => {
      vi.setSystemTime(kst(2026, 4, 27, 8, 0));
      expect(isKrPreNxt()).toBe(true);
      expect(getKoreanMarketStatus().phase).toBe('preNxt');
    });

    it('08:29 KST → preNxt (동시호가 직전)', () => {
      vi.setSystemTime(kst(2026, 4, 27, 8, 29));
      expect(getKoreanMarketStatus().phase).toBe('preNxt');
    });

    it('08:30 KST → preAuction (동시호가 우선)', () => {
      vi.setSystemTime(kst(2026, 4, 27, 8, 30));
      expect(isKrPreAuction()).toBe(true);
      expect(getKoreanMarketStatus().phase).toBe('preAuction');
    });

    it('08:50 KST → isKrPreNxt false (NXT 프리 종료)', () => {
      vi.setSystemTime(kst(2026, 4, 27, 8, 50));
      expect(isKrPreNxt()).toBe(false);
    });

    it('15:30 KST → afterNxt (NXT 시간외 시작)', () => {
      vi.setSystemTime(kst(2026, 4, 27, 15, 30));
      expect(isKrAfterNxt()).toBe(true);
      expect(getKoreanMarketStatus().phase).toBe('afterNxt');
    });

    it('19:59 KST → afterNxt (NXT 시간외 종료 직전)', () => {
      vi.setSystemTime(kst(2026, 4, 27, 19, 59));
      expect(getKoreanMarketStatus().phase).toBe('afterNxt');
    });

    it('20:00 KST → closed (NXT 시간외 종료)', () => {
      vi.setSystemTime(kst(2026, 4, 27, 20, 0));
      expect(isKrAfterNxt()).toBe(false);
      expect(getKoreanMarketStatus().phase).toBe('closed');
    });

    it('공휴일 어린이날 2026-05-05 08:00 → 모든 NXT/동시호가 false', () => {
      vi.setSystemTime(kst(2026, 5, 5, 8, 0));
      expect(isKrPreNxt()).toBe(false);
      expect(isKrPreAuction()).toBe(false);
    });

    it('토요일 16:00 → afterNxt false', () => {
      vi.setSystemTime(kst(2026, 4, 25, 16, 0));
      expect(isKrAfterNxt()).toBe(false);
    });
  });

  // ── 미장 데이마켓 (#333) ────────────────────────────────────────
  // ET 20:00~익일 04:00. 블루오션 거래시간: 일 저녁~금 저녁(금 밤·토·일 새벽 제외)
  describe('미장 데이마켓', () => {
    it('화 20:00 EDT → dayMarket', () => {
      vi.setSystemTime(edt(2026, 4, 28, 20, 0));
      expect(isUsDayMarket()).toBe(true);
      expect(getUsMarketStatus().phase).toBe('dayMarket');
    });

    it('화 19:59 EDT → after (데이마켓 직전)', () => {
      vi.setSystemTime(edt(2026, 4, 28, 19, 59));
      expect(isUsDayMarket()).toBe(false);
      expect(getUsMarketStatus().phase).toBe('after');
    });

    it('화 23:59 EDT → dayMarket', () => {
      vi.setSystemTime(edt(2026, 4, 28, 23, 59));
      expect(isUsDayMarket()).toBe(true);
    });

    it('수 00:00 EDT → dayMarket (자정 넘김)', () => {
      vi.setSystemTime(edt(2026, 4, 29, 0, 0));
      expect(isUsDayMarket()).toBe(true);
    });

    it('수 03:59 EDT → dayMarket (새벽 종료 직전)', () => {
      vi.setSystemTime(edt(2026, 4, 29, 3, 59));
      expect(isUsDayMarket()).toBe(true);
    });

    it('수 04:00 EDT → pre (프리마켓 경계, 데이마켓 종료)', () => {
      vi.setSystemTime(edt(2026, 4, 29, 4, 0));
      expect(isUsDayMarket()).toBe(false);
      expect(getUsMarketStatus().phase).toBe('pre');
    });

    it('금 20:00 EDT → false (금 밤은 주말 진입, 데이마켓 차단)', () => {
      vi.setSystemTime(edt(2026, 5, 1, 20, 0));
      expect(isUsDayMarket()).toBe(false);
    });

    it('토 02:00 EDT → false (토 새벽 차단)', () => {
      vi.setSystemTime(edt(2026, 5, 2, 2, 0));
      expect(isUsDayMarket()).toBe(false);
    });

    it('일 20:00 EDT → dayMarket (일요일 저녁 진입)', () => {
      vi.setSystemTime(edt(2026, 5, 3, 20, 0));
      expect(isUsDayMarket()).toBe(true);
    });

    it('일 02:00 EDT → false (일 새벽은 주말 연장, 차단)', () => {
      vi.setSystemTime(edt(2026, 5, 3, 2, 0));
      expect(isUsDayMarket()).toBe(false);
    });

    // 회귀 방지(architect BLOCK): 일요일 저녁 세션은 월요일 새벽까지 연속 — 월 새벽 누락 버그 차단
    it('월 02:00 EDT → dayMarket (일요일밤→월새벽 연속, day=1 하한)', () => {
      vi.setSystemTime(edt(2026, 5, 4, 2, 0));
      expect(isUsDayMarket()).toBe(true);
    });

    it('금 02:00 EDT → dayMarket (목요일밤→금새벽 연속, day=5 상한)', () => {
      vi.setSystemTime(edt(2026, 5, 8, 2, 0));
      expect(isUsDayMarket()).toBe(true);
    });

    it('NYSE 공휴일 22:00 → closed (데이마켓 차단)', () => {
      // 2026-01-01(목) 신년 휴장
      vi.setSystemTime(estTime(2026, 1, 1, 22, 0));
      expect(isUsDayMarket()).toBe(false);
      expect(getUsMarketStatus().phase).toBe('closed');
    });

    // 회귀 방지(Gemini gate): 주말 정규시간대 거짓 'open' 방지 — 명시 weekday 가드
    it('토 12:00 EDT → closed (주말 정규시간 거짓 open/라이브 방지)', () => {
      vi.setSystemTime(edt(2026, 5, 2, 12, 0));   // 토요일
      const s = getUsMarketStatus();
      expect(s.phase).toBe('closed');
      expect(s.isLive).toBe(false);
    });

    it('일 12:00 EDT → closed (주말 정규시간, 저녁 데이마켓 진입 전)', () => {
      vi.setSystemTime(edt(2026, 5, 3, 12, 0));   // 일요일 낮
      expect(getUsMarketStatus().phase).toBe('closed');
    });
  });

  // ── 3축 통합: phase / status / isLive / dataMode (#333) ──────────
  describe('3축 통합 (phase/status/isLive/dataMode)', () => {
    it('미장 데이마켓 → phase=dayMarket, status=after, isLive=false, dataMode=lastClose', () => {
      vi.setSystemTime(edt(2026, 4, 28, 22, 0)); // 화 22:00 ET
      const s = getUsMarketStatus();
      expect(s.phase).toBe('dayMarket');
      expect(s.status).toBe('after');     // 거짓 라이브 금지 — 'open' 아님
      expect(s.isLive).toBe(false);
      expect(s.dataMode).toBe('lastClose');
    });

    it('미장 정규장 12:00 ET → open, isLive=true, dataMode=delayed', () => {
      vi.setSystemTime(edt(2026, 4, 27, 12, 0));
      const s = getUsMarketStatus();
      expect(s.phase).toBe('open');
      expect(s.status).toBe('open');
      expect(s.isLive).toBe(true);
      expect(s.dataMode).toBe('delayed');
    });

    it('국장 정규장 12:00 KST → open, isLive=true, dataMode=live', () => {
      vi.setSystemTime(kst(2026, 4, 27, 12, 0));
      const s = getKoreanMarketStatus();
      expect(s.phase).toBe('open');
      expect(s.status).toBe('open');
      expect(s.isLive).toBe(true);
      expect(s.dataMode).toBe('live');
    });
  });

  // ── dataMode 매핑 검증 (#333) ───────────────────────────────────
  describe('dataMode 매핑', () => {
    it('미장 정규장 = delayed', () => {
      vi.setSystemTime(edt(2026, 4, 27, 12, 0));
      expect(getUsMarketStatus().dataMode).toBe('delayed');
    });

    it('미장 데이마켓 = lastClose', () => {
      vi.setSystemTime(edt(2026, 4, 28, 22, 0));
      expect(getUsMarketStatus().dataMode).toBe('lastClose');
    });

    it('미장 프리마켓 = lastClose', () => {
      vi.setSystemTime(edt(2026, 4, 27, 7, 0));
      expect(getUsMarketStatus().dataMode).toBe('lastClose');
    });

    it('미장 애프터마켓 = lastClose', () => {
      vi.setSystemTime(edt(2026, 4, 27, 18, 0));
      expect(getUsMarketStatus().dataMode).toBe('lastClose');
    });

    it('국장 정규장 = live', () => {
      vi.setSystemTime(kst(2026, 4, 27, 12, 0));
      expect(getKoreanMarketStatus().dataMode).toBe('live');
    });

    it('국장 NXT 프리 = lastClose', () => {
      vi.setSystemTime(kst(2026, 4, 27, 8, 0));
      expect(getKoreanMarketStatus().dataMode).toBe('lastClose');
    });

    it('국장 동시호가 = lastClose', () => {
      vi.setSystemTime(kst(2026, 4, 27, 8, 30));
      expect(getKoreanMarketStatus().dataMode).toBe('lastClose');
    });
  });
});
