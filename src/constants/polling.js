// 폴링 간격 상수 (밀리초)
// [최적화] WS가 실시간 가격을 주므로 REST 주기를 늘려 데이터 절감
export const POLLING = {
  FAST:      10_000,   // 10초 — Upbit 빠른 갱신 (WS 끊김 시만 사용)
  NORMAL:    30_000,   // 30초 — 주식 가격 갱신
  SLOW:      60_000,   // 60초 — 코인 전체 갱신 (WS가 실시간 커버하므로 REST는 보조)
  SPARKLINE: 300_000,  // 5분  — CoinGecko 스파크라인
};
