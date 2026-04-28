// deprecated: 서버 사전 계산으로 전환됨 (#213)
// 후속 사용처는 src/hooks/useServerSignals.js 참조
export function useCompositeSignals() { return { scores: {}, loading: false }; }
export function getCompositeScore() { return null; }
