// src/api/snapshot.js — 서버 가격 스냅샷 조회
// /api/snapshot (Edge → Redis) 캐시된 전체 시세를 한 번에 가져옴

const SNAPSHOT_TTL = 25 * 1000; // 25초 (서버 s-maxage=30보다 짧게)
let _cache = null;
let _cacheTs = 0;
let _inflight = null; // 동시 호출 중복 방지 — 진행 중인 요청 재사용

export async function fetchSnapshot() {
  const now = Date.now();
  if (_cache && now - _cacheTs < SNAPSHOT_TTL) return _cache;

  // 이미 진행 중인 요청이 있으면 재사용 (useCoins + usePrices 동시 호출 방지)
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const res = await fetch('/api/snapshot', {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.ts) {
        _cache = data;
        _cacheTs = Date.now();
      }
      return data;
    } catch {
      return null;
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

export function invalidateSnapshot() {
  _cache = null;
  _cacheTs = 0;
}
