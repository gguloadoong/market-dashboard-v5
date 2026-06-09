// useAfterIdle — 첫 페인트 후 idle 시점에 true (#로딩최적화 2026-06-09)
//
// 비임계 데이터 훅의 네트워크 발사를 첫 의미있는 페인트(스냅샷 hot) 뒤로 미뤄,
// 마운트 burst가 임계경로(시세 첫 렌더)와 경합하지 않게 한다.
// React Query의 enabled:false는 fetch만 막고 initialData/캐시는 즉시 표시하므로,
// 캐시 있으면 네트워크 0콜, 미스만 idle 후 1콜 → 콜드로드 체감 로딩 단축.
//
// 적용 대상(콜드로드 mount에서 느리거나 비임계): KRX-ETF(12s+500), 시장투자자(6s+500),
// 공포탐욕, 뉴스 17 RSS 등. ⚠️ 지수(useIndices)는 헤더 임계+스냅샷 미포함이라 적용 금지.
import { useState, useEffect } from 'react';

export function useAfterIdle() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') { setReady(true); return; }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(id);
  }, []);
  return ready;
}
