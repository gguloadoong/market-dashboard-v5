// 뉴스 클러스터 / 심리 괴리 시그널 훅 — [전면 비활성, #366]
// news_sentiment_cluster(가격 타깃 없어 성적표 측정불가) + sentiment_divergence(적중률 미입증)는
// 데이터 포렌식 결과 제거됨 (signal-overhaul-2026-06-08).
// 호출부 시그니처 유지를 위해 no-op 훅으로 남긴다.
// eslint-disable-next-line no-unused-vars
export function useNewsSignals(_allNews = [], _allItems = []) {
  // 발화 경로 제거됨 — 의도적 no-op
}
