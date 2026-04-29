// 5분 결정 사이클 측정 — 진입→시그널→차트→결정 단계별 타이밍을 Vercel Analytics로 전송
// P3-2: 7일치 누적 후 p50/p90 분포로 사이클 길이 분석 가능
import { track } from '@vercel/analytics';

const KEY = 'cycle_start_ts';

function elapsed() {
  const ts = sessionStorage.getItem(KEY);
  return ts ? Date.now() - parseInt(ts, 10) : 0;
}

export function cycleStart() {
  sessionStorage.setItem(KEY, String(Date.now()));
}

export function cycleStep(step, extra = {}) {
  try {
    track('decision_cycle', { step, elapsed_ms: elapsed(), ...extra });
  } catch {
    // analytics 실패가 UX를 방해하지 않도록 무시
  }
}
