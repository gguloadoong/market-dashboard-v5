// 시그널 type → 캐릭터 라벨/배지 매핑 (#400)
// 측정·집계는 useSignalCharacters(공정측정 v2)가 담당하고, 여기는 표시용 변환만.
// 목적: 시그널 카드와 성적표가 "같은 캐릭터·같은 적중률"로 말하게 한다 (측정 기준 단일화).
import { CHARACTER_STATUS } from '../constants/signalCharacters';

/** useSignalCharacters 집계 결과 배열 → Map<type, character> */
export function buildTypeCharacterMap(characters) {
  const m = new Map();
  for (const ch of characters || []) {
    for (const g of (ch.gates || [])) {
      if (!m.has(g.type)) m.set(g.type, ch);
    }
  }
  return m;
}

/** 시그널이 캐릭터의 측정 gate(market/direction 조건부 앙상블)에 포함되는가 (review HIGH)
 *  핵심: 측정치는 (type, market, direction) 슬라이스 한정 — 예: 흐름타기 64%는 kr·bullish 전용.
 *  미장·bearish volume_anomaly에 그 수치를 붙이면 #400이 잡으려는 부정직이 재발한다. */
function gateMatches(ch, signal) {
  if (!ch || !signal) return false;
  const m = (signal.market || '').toLowerCase(); // 시그널 표기: 'kr'|'us'|'crypto'
  return (ch.gates || []).some(g =>
    (!g.market || g.market === m) && (!g.direction || g.direction === signal.direction));
}

/** 카드 배지 데이터 — gate 매칭 슬라이스만. live면 공정 적중률, 아니면 '검증 중'.
 *  gate 비매칭(엣지 미입증 슬라이스)은 null — 측정 주장을 하지 않는다. */
export function characterBadge(ch, signal) {
  if (!ch || !gateMatches(ch, signal)) return null;
  const live = ch.status === CHARACTER_STATUS.LIVE && ch.accuracy != null;
  const acc = live ? Math.round(ch.accuracy) : null; // 배지는 정수 % (성적표는 소수 유지)
  return {
    emoji: ch.emoji,
    name: ch.name,
    accuracy: acc,
    text: live ? `${ch.emoji} ${ch.name} ${acc}%` : `${ch.emoji} ${ch.name} · 검증 중`,
  };
}
