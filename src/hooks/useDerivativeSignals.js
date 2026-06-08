// 파생/소셜 시그널 폴링 훅 — [전면 비활성, #366]
// PCR / 펀딩비 / 주문장 불균형 / VWAP / 소셜 감성 / 모멘텀 괴리 시그널은
// 데이터 포렌식 결과 적중률 50% 미만·측정불가로 확정되어 제거됨 (signal-overhaul-2026-06-08).
// 호출부(home/index.jsx) 시그니처 유지를 위해 no-op 훅으로 남긴다.
// eslint-disable-next-line no-unused-vars
export function useDerivativeSignals(_args = {}) {
  // 발화 경로 제거됨 — 의도적 no-op
}
