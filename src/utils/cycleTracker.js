// 5분 결정 사이클 측정 — 진입→시그널→차트→결정 단계별 타이밍을 Vercel Analytics로 전송
// P3-2: watchlist_add(결정) 시 사이클 리셋 → 다음 사이클의 elapsed_ms가 정확한 구간 길이
import { track } from '@vercel/analytics';

const KEY = 'cycle_start_ts';

function elapsed() {
  try {
    const ts = sessionStorage.getItem(KEY);
    if (!ts) return 0;
    const parsed = parseInt(ts, 10);
    return Number.isFinite(parsed) ? Date.now() - parsed : 0;
  } catch { return 0; }
}

export function cycleStart() {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* 프라이빗 모드/쿼터 초과 시 무시 */ }
}

export function cycleStep(step, extra = {}) {
  try {
    track('decision_cycle', { step, elapsed_ms: elapsed(), ...extra });
  } catch {
    if (import.meta.env.DEV) console.warn('[cycleTracker] track 실패', step);
  }
}
