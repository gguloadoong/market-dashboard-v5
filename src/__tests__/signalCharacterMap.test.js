// 시그널 카드 캐릭터 배지 매핑 테스트 (#400)
// 핵심 계약: 측정치는 (type, market, direction) gate 슬라이스 한정 —
// 엣지 미입증 슬라이스(미장 bearish 거래량 등)에 적중률을 절대 붙이지 않는다.
import { describe, it, expect } from 'vitest';
import { buildTypeCharacterMap, characterBadge } from '../utils/signalCharacterMap';
import { SIGNAL_CHARACTERS, CHARACTER_STATUS } from '../constants/signalCharacters';

// aggregateCharacter 출력 형태 모사 — flow를 live 64.1%로
const characters = SIGNAL_CHARACTERS.map(c => ({
  ...c,
  status: c.id === 'flow' ? CHARACTER_STATUS.LIVE : c.status,
  accuracy: c.id === 'flow' ? 64.1 : null,
  sampleN: c.id === 'flow' ? 1052 : 0,
}));
const charByType = buildTypeCharacterMap(characters);

describe('buildTypeCharacterMap', () => {
  it('4개 KEEP 타입 모두 캐릭터에 매핑된다', () => {
    expect(charByType.get('volume_anomaly')?.id).toBe('flow');
    expect(charByType.get('double_bottom')?.id).toBe('bottom');
    expect(charByType.get('support_resistance_break')?.id).toBe('breakout');
    expect(charByType.get('composite_score')?.id).toBe('composite');
  });
});

describe('characterBadge — gate 매칭 정직성', () => {
  it('kr·bullish 거래량(측정 슬라이스)에는 공정 적중률 64%가 붙는다', () => {
    const sig = { type: 'volume_anomaly', market: 'kr', direction: 'bullish' };
    const b = characterBadge(charByType.get(sig.type), sig);
    expect(b).not.toBeNull();
    expect(b.accuracy).toBe(64); // 배지는 정수 %
    expect(b.text).toContain('흐름타기');
  });

  it('us·bearish 거래량(엣지 미입증 슬라이스)에는 배지가 없다', () => {
    const sig = { type: 'volume_anomaly', market: 'us', direction: 'bearish' };
    expect(characterBadge(charByType.get(sig.type), sig)).toBeNull();
  });

  it('kr·bearish 거래량도 배지 없음 — 측정은 bullish 전용', () => {
    const sig = { type: 'volume_anomaly', market: 'kr', direction: 'bearish' };
    expect(characterBadge(charByType.get(sig.type), sig)).toBeNull();
  });

  it('composite는 market/direction 무관 gate — measuring이라 "검증 중" 표기', () => {
    const sig = { type: 'composite_score', market: 'crypto', direction: 'bullish' };
    const b = characterBadge(charByType.get(sig.type), sig);
    expect(b).not.toBeNull();
    expect(b.accuracy).toBeNull();
    expect(b.text).toContain('검증 중');
  });

  it('미지정 타입/시그널 없음은 null', () => {
    expect(characterBadge(undefined, { type: 'x' })).toBeNull();
    expect(characterBadge(charByType.get('volume_anomaly'), null)).toBeNull();
  });
});
