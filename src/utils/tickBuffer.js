// WS 틱 코얼레싱 버퍼 — 심볼별 최신 틱만 유지, 주기 플러시로 setState 횟수 제한
// 렉 근본 수정(#394): 틱당 전체 배열 재생성 → 배치 1회로 리렌더 폭풍 차단
// #404: 1s→2s — 라이브 세션 실측에서 플러시당 전체 트리 렌더가 4x 스로틀 기준 500-800ms.
// 시세 대시보드에서 2초 신선도는 체감 무손실, 렌더 횟수는 절반.
export const TICK_FLUSH_MS = 2000;

export function createTickBuffer(onFlush, flushMs = TICK_FLUSH_MS) {
  let buf = new Map();
  let timer = null;

  function flush() {
    timer = null;
    if (!buf.size) return;
    const batch = [...buf.values()];
    buf = new Map();
    onFlush(batch);
  }

  return {
    push(tick) {
      if (!tick?.symbol) return;
      buf.set(tick.symbol, tick); // 같은 심볼은 최신 틱으로 덮어씀
      if (!timer) timer = setTimeout(flush, flushMs);
    },
    destroy() {
      if (timer) { clearTimeout(timer); timer = null; }
      buf = new Map();
    },
  };
}
