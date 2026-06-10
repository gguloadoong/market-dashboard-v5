// 뷰포트 모바일 여부 — Tailwind lg(1024px) 미만 기준
// CSS hidden 이중 마운트 제거용 (#394): lg:hidden/hidden lg:block으로 숨겨도
// 컴포넌트는 마운트되어 연산(뉴스 매칭 등)을 계속하므로, 렌더 자체를 분기한다.
import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 1023px)';

function subscribe(onChange) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
