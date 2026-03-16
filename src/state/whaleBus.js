// 고래 이벤트 공유 버스 — 싱글턴 패턴
// WhalePanel이 이벤트 수신 시 pushWhaleEvent() 호출
// BreakingNewsPanel의 고래 미리보기 핀이 subscribeLatestWhale()로 구독

let _latest = null;
let _subs   = [];

/** WhalePanel → 이벤트 발행 */
export function pushWhaleEvent(evt) {
  _latest = evt;
  _subs.forEach(fn => fn(evt));
}

/** 현재 최신 이벤트 (구독 전 초기값용) */
export function getLatestWhale() {
  return _latest;
}

/**
 * BreakingNewsPanel → 구독
 * @returns {Function} unsubscribe 함수
 */
export function subscribeLatestWhale(fn) {
  _subs.push(fn);
  // 이미 이벤트 있으면 즉시 전달
  if (_latest) fn(_latest);
  return () => { _subs = _subs.filter(f => f !== fn); };
}
