// src/api/snapshot.js — 서버 가격 스냅샷 조회
// /api/snapshot (Edge → Redis) 캐시된 전체 시세를 한 번에 가져옴
// [최적화] ETag/304 지원 — 데이터 미변경 시 빈 응답으로 전송량 절감

const SNAPSHOT_TTL = 25 * 1000; // 25초 (서버 s-maxage=30보다 짧게)
let _cache = null;
let _cacheTs = 0;
let _inflight = null;
let _lastETag = null;

export async function fetchSnapshot() {
  const now = Date.now();
  if (_cache && now - _cacheTs < SNAPSHOT_TTL) return _cache;

  // 이미 진행 중인 요청이 있으면 재사용 (useCoins + usePrices 동시 호출 방지)
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const headers = {};
      if (_lastETag) headers['If-None-Match'] = _lastETag;

      const res = await fetch('/api/snapshot', {
        headers,
        signal: AbortSignal.timeout(5000),
      });

      // 304 Not Modified → 캐시 그대로, TTL만 리셋
      if (res.status === 304) {
        if (_cache) {
          _cacheTs = Date.now();
          return _cache;
        }
        // cache가 null인데 304 → ETag stale, full 즉시 재요청 (브라우저 캐시 우회)
        _lastETag = null;
        const retry = await fetch('/api/snapshot', {
          signal: AbortSignal.timeout(5000),
          cache: 'no-cache',
        });
        if (retry.ok) {
          const retryData = await retry.json();
          const retryEtag = retry.headers.get('etag');
          if (retryEtag) _lastETag = retryEtag;
          if (retryData?.ts) {
            _cache = retryData;
            _cacheTs = Date.now();
          }
          return retryData;
        }
        return null;
      }

      if (!res.ok) return null;

      // ETag 저장
      const etag = res.headers.get('etag');
      if (etag) _lastETag = etag;

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
  _lastETag = null;
}
