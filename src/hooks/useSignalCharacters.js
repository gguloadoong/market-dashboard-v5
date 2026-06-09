// 시그널 캐릭터 파생 집계 훅 — signal_accuracy_v2 슬라이스를 캐릭터로 묶는다 (Issue #368)
// 발화 로직 무변경. 순수 집계 reinterpretation (v2 fair-hit 슬라이스 → 캐릭터별 적중률).
import { useQuery } from '@tanstack/react-query';
import { SIGNAL_CHARACTERS, CHARACTER_STATUS } from '../constants/signalCharacters';

async function fetchSlices() {
  const res = await fetch('/api/signal-accuracy');
  if (!res.ok) throw new Error('signal-accuracy fetch failed');
  const data = await res.json();
  return Array.isArray(data.slices) ? data.slices : [];
}

/** 슬라이스가 게이트에 매칭되는지 — type 필수, market/direction은 미지정 시 와일드카드 */
export function sliceMatchesGate(slice, gate) {
  if (!slice || !gate) return false;
  if (slice.signal_type !== gate.type) return false;
  if (gate.market && slice.market !== gate.market) return false;
  if (gate.direction && slice.direction !== gate.direction) return false;
  return true;
}

/** 캐릭터 대표 horizon의 eval/hits 컬럼키 */
function horizonKeys(horizon) {
  const hz = horizon === '24h' ? '24h' : horizon === '4h' ? '4h' : '1h';
  return { evalKey: `eval_${hz}`, hitsKey: `hits_${hz}` };
}

/**
 * 캐릭터 1개를 v2 슬라이스로 집계.
 * 적중률 = Σhits / Σeval (대표 horizon, eval 가중). measuring은 적중률 null.
 * @returns {{accuracy:number|null, sampleN:number, last30dFired:number, isLive:boolean, matchedSlices:number}} 확장 캐릭터
 */
export function aggregateCharacter(char, slices) {
  const { evalKey, hitsKey } = horizonKeys(char.horizon);
  const matched = (slices || []).filter((s) => char.gates.some((g) => sliceMatchesGate(s, g)));

  let evalSum = 0;
  let hitSum = 0;
  let fired30 = 0;
  for (const s of matched) {
    evalSum += Number(s[evalKey]) || 0;
    hitSum += Number(s[hitsKey]) || 0;
    fired30 += Number(s.last_30d_fired) || 0;
  }

  // #392 성적표 status 양방향 동적 파생(발화 로직 무변경, signal_accuracy_v2 실집계 기반):
  //   MEASURING(표본부족)은 발화와 무관하게 유지. 그 외는 실발화로 결정 —
  //   last_30d_fired>0 → LIVE, 0 → REVIVE('부활 예정').
  //   기준값(출발지) 의존 없이 양방향 보정 → "발화 중단된 LIVE 고착"과
  //   "발화 재개된 REVIVE 고착"을 모두 방지(정직 트랙레코드). 30일 무발화 시 자동 REVIVE.
  const status =
    char.status === CHARACTER_STATUS.MEASURING
      ? CHARACTER_STATUS.MEASURING
      : fired30 > 0
        ? CHARACTER_STATUS.LIVE
        : CHARACTER_STATUS.REVIVE;

  // measuring(표본부족) 또는 평가 표본 0이면 적중률 비노출
  const accuracy =
    status === CHARACTER_STATUS.MEASURING || evalSum === 0
      ? null
      : Math.round((hitSum / evalSum) * 1000) / 10; // 소수 1자리

  return {
    ...char,
    status,
    accuracy,
    sampleN: evalSum,
    last30dFired: fired30,
    isLive: fired30 > 0,
    matchedSlices: matched.length,
  };
}

/**
 * 시그널 캐릭터 적중률 조회 — GET /api/signal-accuracy 의 slices(v2) 집계
 * @returns {{characters: Array, isLoading: boolean, isError: boolean}}
 */
export function useSignalCharacters() {
  const { data: slices = [], isLoading, isError } = useQuery({
    queryKey: ['signal-characters'],
    queryFn: fetchSlices,
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    refetchIntervalInBackground: false,
    placeholderData: [],
  });

  const characters = SIGNAL_CHARACTERS.map((c) => aggregateCharacter(c, slices));
  return { characters, isLoading, isError };
}
