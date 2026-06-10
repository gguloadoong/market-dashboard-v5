// 시장 관련 공유 상수
// USD → KRW 기본 환율 fallback (실시간 환율 API 실패 시 사용, 2026-04 기준)
export const DEFAULT_KRW_RATE = 1466;

// 미장 코어 종목 — 브라우저 폴링·KIS US WS 공통 (#396 단일 소스)
// 전종목(250)은 스냅샷 크론(update-us, 2분)이 커버하므로 클라 폴링은 코어+watchlist만.
export const US_CORE_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO',
  'JPM', 'NFLX', 'AMD', 'V', 'MA', 'LLY', 'WMT', 'XOM', 'PLTR', 'ARM',
];
