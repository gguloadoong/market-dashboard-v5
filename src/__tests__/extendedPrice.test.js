// #334: 연장세션 참고가 헬퍼 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  hasLiveExtended,
  extendedBadgeLabel,
} from '../utils/extendedPrice.js';

describe('extendedPrice', () => {
  describe('hasLiveExtended', () => {
    it('dataMode=delayed + OPEN + 가격 유효 + extendedAt 최근 → true', () => {
      const item = {
        extendedPrice: 309.07,
        extendedChangePct: 0.24,
        extendedStatus: 'OPEN',
        extendedSessionType: 'PRE_MARKET',
        extendedAt: new Date().toISOString(),
      };
      const status = { phase: 'pre', dataMode: 'delayed' };
      expect(hasLiveExtended(item, status)).toBe(true);
    });

    // Gemini gate P1 회귀 방지: 네이버 차단/타임아웃으로 stale 데이터가 흘러올 위험 차단
    it('extendedAt 10분 초과 stale → false (다중 방어 — 백엔드 evict 우회 시에도 차단)', () => {
      const item = {
        extendedPrice: 309,
        extendedStatus: 'OPEN',
        extendedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),  // 11분 전
      };
      const status = { phase: 'pre', dataMode: 'delayed' };
      expect(hasLiveExtended(item, status)).toBe(false);
    });

    it('extendedAt 누락 → false (최근성 미확인 — 안전측)', () => {
      const item = { extendedPrice: 309, extendedStatus: 'OPEN' };
      const status = { phase: 'pre', dataMode: 'delayed' };
      expect(hasLiveExtended(item, status)).toBe(false);
    });

    it('dataMode=live(정규장) → false (정규장은 메인 시세 우선)', () => {
      const item = {
        extendedPrice: 309,
        extendedStatus: 'OPEN',
      };
      const status = { phase: 'open', dataMode: 'live' };
      expect(hasLiveExtended(item, status)).toBe(false);
    });

    it('dataMode=lastClose → false', () => {
      const item = { extendedPrice: 309, extendedStatus: 'OPEN' };
      const status = { phase: 'dayMarket', dataMode: 'lastClose' };
      expect(hasLiveExtended(item, status)).toBe(false);
    });

    it('extendedStatus=CLOSE → false', () => {
      const item = { extendedPrice: 309, extendedStatus: 'CLOSE' };
      const status = { phase: 'after', dataMode: 'delayed' };
      expect(hasLiveExtended(item, status)).toBe(false);
    });

    it('extendedPrice 없음 → false', () => {
      const item = {};
      const status = { phase: 'pre', dataMode: 'delayed' };
      expect(hasLiveExtended(item, status)).toBe(false);
    });

    it('extendedPrice 0 또는 NaN → false', () => {
      const status = { phase: 'pre', dataMode: 'delayed' };
      expect(hasLiveExtended({ extendedPrice: 0, extendedStatus: 'OPEN' }, status)).toBe(false);
      expect(hasLiveExtended({ extendedPrice: 'abc', extendedStatus: 'OPEN' }, status)).toBe(false);
    });

    it('정규장 phase=open + dataMode=delayed (미장 정규장) → false', () => {
      // 미장 정규장도 dataMode='delayed' 지만 phase='open' 이라 ext 무시
      const item = { extendedPrice: 100, extendedStatus: 'OPEN' };
      const status = { phase: 'open', dataMode: 'delayed' };
      expect(hasLiveExtended(item, status)).toBe(false);
    });
  });

  describe('extendedBadgeLabel', () => {
    it('PRE_MARKET → "프리 참고가"', () => {
      expect(extendedBadgeLabel({ extendedSessionType: 'PRE_MARKET' })).toBe('프리 참고가');
    });
    it('AFTER_MARKET → "애프터 참고가"', () => {
      expect(extendedBadgeLabel({ extendedSessionType: 'AFTER_MARKET' })).toBe('애프터 참고가');
    });
    it('NXT_PRE → "NXT 프리"', () => {
      expect(extendedBadgeLabel({ extendedSessionType: 'NXT_PRE' })).toBe('NXT 프리');
    });
    it('NXT_AFTER → "NXT 시간외"', () => {
      expect(extendedBadgeLabel({ extendedSessionType: 'NXT_AFTER' })).toBe('NXT 시간외');
    });
    it('알 수 없는 타입 → "참고가" fallback', () => {
      expect(extendedBadgeLabel({})).toBe('참고가');
    });
  });
});
