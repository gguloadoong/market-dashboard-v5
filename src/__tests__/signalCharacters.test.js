// 시그널 캐릭터 집계 로직 테스트 (Issue #368)
import { describe, it, expect } from 'vitest';
import { aggregateCharacter, sliceMatchesGate } from '../hooks/useSignalCharacters';
import { SIGNAL_CHARACTERS } from '../constants/signalCharacters';

const byId = (id) => SIGNAL_CHARACTERS.find((c) => c.id === id);

describe('signalCharacters', () => {
  it('캐릭터는 5개 미만 (대표 지시)', () => {
    expect(SIGNAL_CHARACTERS.length).toBeLessThan(5);
    expect(SIGNAL_CHARACTERS.length).toBeGreaterThan(0);
  });

  describe('sliceMatchesGate', () => {
    const slice = { signal_type: 'volume_anomaly', market: 'kr', direction: 'bullish' };
    it('type+market+direction 일치', () => {
      expect(sliceMatchesGate(slice, { type: 'volume_anomaly', market: 'kr', direction: 'bullish' })).toBe(true);
    });
    it('market 미지정 = 와일드카드', () => {
      expect(sliceMatchesGate(slice, { type: 'volume_anomaly' })).toBe(true);
    });
    it('market 불일치 → false', () => {
      expect(sliceMatchesGate(slice, { type: 'volume_anomaly', market: 'us' })).toBe(false);
    });
    it('direction 불일치 → false', () => {
      expect(sliceMatchesGate(slice, { type: 'volume_anomaly', market: 'kr', direction: 'bearish' })).toBe(false);
    });
    it('type 불일치 → false', () => {
      expect(sliceMatchesGate(slice, { type: 'double_bottom' })).toBe(false);
    });
  });

  describe('aggregateCharacter', () => {
    it('흐름타기(live, 1h): kr·bullish만 집계, 다른 슬라이스 제외 (시장조건부 라우팅)', () => {
      const slices = [
        { signal_type: 'volume_anomaly', market: 'kr', direction: 'bullish', eval_1h: 1000, hits_1h: 640, last_30d_fired: 1491 },
        { signal_type: 'volume_anomaly', market: 'kr', direction: 'bearish', eval_1h: 500, hits_1h: 100, last_30d_fired: 700 }, // 제외
      ];
      const r = aggregateCharacter(byId('flow'), slices);
      expect(r.accuracy).toBe(64); // 640/1000 — 하락 슬라이스 미포함
      expect(r.sampleN).toBe(1000);
      expect(r.last30dFired).toBe(1491);
      expect(r.isLive).toBe(true);
      expect(r.status).toBe('live'); // fired30>0 → LIVE 유지
      expect(r.matchedSlices).toBe(1);
    });

    it('흐름타기 양방향 강등(#392): 발화 중단(fired30=0)이면 LIVE→REVIVE', () => {
      const slices = [
        { signal_type: 'volume_anomaly', market: 'kr', direction: 'bullish', eval_1h: 1000, hits_1h: 640, last_30d_fired: 0 },
      ];
      const r = aggregateCharacter(byId('flow'), slices);
      expect(r.status).toBe('revive'); // 기준값 live지만 미발화 → REVIVE 강등(거짓 live 방지)
      expect(r.isLive).toBe(false);
      expect(r.accuracy).toBe(64); // 역사적 적중률은 유지 노출
    });

    it('바닥다지기(revive, 24h): us+kr eval 가중평균, 미발화→isLive false·status revive 유지', () => {
      const slices = [
        { signal_type: 'double_bottom', market: 'us', direction: 'bullish', eval_24h: 200, hits_24h: 132, last_30d_fired: 0 },
        { signal_type: 'double_bottom', market: 'kr', direction: 'bullish', eval_24h: 100, hits_24h: 94, last_30d_fired: 0 },
      ];
      const r = aggregateCharacter(byId('bottom'), slices);
      expect(r.accuracy).toBe(75.3); // (132+94)/(200+100)
      expect(r.sampleN).toBe(300);
      expect(r.isLive).toBe(false);
      expect(r.status).toBe('revive'); // fired30=0 → 전환 안 함
      expect(r.matchedSlices).toBe(2);
    });

    it('바닥다지기 동적 live 전환(#392): fired30>0이면 REVIVE→LIVE + 적중률 노출', () => {
      const slices = [
        { signal_type: 'double_bottom', market: 'us', direction: 'bullish', eval_24h: 200, hits_24h: 132, last_30d_fired: 8 },
        { signal_type: 'double_bottom', market: 'kr', direction: 'bullish', eval_24h: 100, hits_24h: 94, last_30d_fired: 6 },
      ];
      const r = aggregateCharacter(byId('bottom'), slices);
      expect(r.status).toBe('live'); // 기준값 revive → 발화 재개로 LIVE 전환
      expect(r.isLive).toBe(true);
      expect(r.last30dFired).toBe(14);
      expect(r.accuracy).toBe(75.3); // 적중률은 전환과 무관하게 정상 노출
    });

    it('종합신호(measuring): fired30>0이어도 MEASURING 유지(전환 대상 아님)', () => {
      const slices = [
        { signal_type: 'composite_score', market: 'us', direction: 'bullish', eval_1h: 50, hits_1h: 40, last_30d_fired: 99 },
      ];
      const r = aggregateCharacter(byId('composite'), slices);
      expect(r.status).toBe('measuring');
      expect(r.accuracy).toBeNull();
    });

    it('종합신호(measuring): eval 있어도 적중률 숨김(null)', () => {
      const slices = [
        { signal_type: 'composite_score', market: 'us', direction: 'bullish', eval_1h: 50, hits_1h: 40, last_30d_fired: 10 },
      ];
      const r = aggregateCharacter(byId('composite'), slices);
      expect(r.accuracy).toBeNull();
      expect(r.sampleN).toBe(50); // 표본 수는 노출
    });

    it('매칭 슬라이스 0 → accuracy null, sampleN 0, isLive false', () => {
      const r = aggregateCharacter(byId('flow'), []);
      expect(r.accuracy).toBeNull();
      expect(r.sampleN).toBe(0);
      expect(r.isLive).toBe(false);
    });
  });
});
