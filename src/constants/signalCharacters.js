// 시그널 캐릭터 — signal_accuracy_v2 슬라이스를 ≤5 캐릭터로 묶는 단일 소스 (Issue #368)
//
// 핵심 노하우: 각 캐릭터 = raw 디텍터의 *시장조건부 앙상블*이다. 엣지가 데이터로 입증된
// (type, market, direction) 슬라이스만 gate로 포함하고, 엣지 없는 슬라이스(예: 국장 중립/
// 하락 거래량, 미장 1h 표본부족)는 의도적으로 제외한다 — "같은 거래량 분출도 시장에 따라
// 다르게 해석"이 토스/업비트/키움이 못하는 차별점.
//
// 적중률은 v2 fair-hit(노이즈밴드·거래비용 제외) 기준. 대표 horizon은 캐릭터별로 다르다
// (거래량=1h 단기지속, 패턴=24h). 약한 horizon은 UI에서 숨긴다.
//
// status (여기 값은 *기준값* — aggregateCharacter가 실데이터로 동적 보정, #392):
//   'live'      — 현재 발화 중(last_30d_fired>0). 라이브 적중률 노출.
//   'revive'    — 역사적 엣지 강하나 서버 미발화. last_30d_fired>0 재개 시 aggregateCharacter가 LIVE로 전환.
//   'measuring' — 트랙레코드 표본 부족. 적중률 숨김('측정 준비 중').

export const CHARACTER_STATUS = {
  LIVE: 'live',
  REVIVE: 'revive',
  MEASURING: 'measuring',
};

// 캐릭터 정의 (v2 실측 근거 — .project/signal-overhaul-2026-06-08.md §5.7/5.9)
export const SIGNAL_CHARACTERS = [
  {
    id: 'flow',
    name: '흐름타기',
    emoji: '🌊',
    horizon: '1h',
    thesis: '국장 거래량 분출은 1시간 추세를 밀어준다',
    // 국장 강세 분출만(1h fair 64%, n997 ALIVE). 미장 1h는 표본부족(n~13)이라 제외 — 시장조건부 라우팅.
    gates: [{ type: 'volume_anomaly', market: 'kr', direction: 'bullish' }],
    status: CHARACTER_STATUS.LIVE,
  },
  {
    id: 'bottom',
    name: '바닥다지기',
    emoji: '⛏️',
    horizon: '24h',
    thesis: '이중바닥은 24시간 반등 — 미장·국장 검증',
    gates: [
      { type: 'double_bottom', market: 'us', direction: 'bullish' }, // 24h 66% n213
      { type: 'double_bottom', market: 'kr', direction: 'bullish' }, // 24h 94% n94
    ],
    status: CHARACTER_STATUS.REVIVE, // 기준값 — #390 패턴크론 복구로 발화 재개 시 aggregateCharacter가 LIVE 동적 전환(#392)
  },
  {
    id: 'breakout',
    name: '벽뚫기',
    emoji: '🧱',
    horizon: '24h',
    thesis: '지지·저항 돌파는 24시간 추세 지속 — 국장 강함',
    gates: [
      { type: 'support_resistance_break', market: 'kr', direction: 'bullish' }, // 24h 74% n88
      { type: 'support_resistance_break', market: 'us', direction: 'bullish' }, // 24h 64% n89
    ],
    status: CHARACTER_STATUS.REVIVE,
  },
  {
    id: 'composite',
    name: '종합신호',
    emoji: '🎯',
    horizon: '1h',
    thesis: '여러 지표를 묶은 종합 점수 — 트랙레코드 수집 중',
    // market/direction 미지정 → 전 composite_score 슬라이스. 라이브지만 추적 표본 부족.
    gates: [{ type: 'composite_score' }],
    status: CHARACTER_STATUS.MEASURING,
  },
];

// 캐릭터 수 가드 — 대표 지시 "캐릭터 5개 미만"
if (SIGNAL_CHARACTERS.length >= 5) {
  throw new Error(`[#368] 시그널 캐릭터는 5개 미만이어야 합니다 (현재 ${SIGNAL_CHARACTERS.length}개).`);
}
