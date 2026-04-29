// 폴링 간격 상수 (밀리초)
// "5분 결정 앱" — WS가 실시간 커버하므로 REST는 최소한으로

// 로컬 dev 시 폴링 간격 확장 (데이터 절약) — .env.development에 VITE_DEV_POLLING_MULTIPLIER=10 설정
const DEV_MULTIPLIER = Number(import.meta.env.VITE_DEV_POLLING_MULTIPLIER) || 1;

export const POLLING = {
  FAST:       10_000  * DEV_MULTIPLIER,  // 10초  — Upbit WS 끊김 시 fallback
  NORMAL:     30_000  * DEV_MULTIPLIER,  // 30초  — (사용 중단 예정, 환율→CLOSED 이동)
  BACKGROUND: 120_000 * DEV_MULTIPLIER,  // 2분   — WS가 실시간 커버하는 REST 보조 (지수/ETF/코인)
  CLOSED:     300_000 * DEV_MULTIPLIER,  // 5분   — 환율·장 마감·주말 (Upstash 절감)
  SLOW:        60_000 * DEV_MULTIPLIER,  // 60초  — 하위호환 유지 (직접 참조 파일 없앤 후 제거 예정)
  SPARKLINE:  600_000 * DEV_MULTIPLIER,  // 10분  — CoinGecko sparkline (분봉 delta)
};
