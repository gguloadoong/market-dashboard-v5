// src/api/snapshot.js — 서버 가격 스냅샷 조회
// /api/snapshot (Edge → Redis) 캐시된 전체 시세를 한 번에 가져옴
// [최적화] ETag/304 + 델타 merge 지원

const SNAPSHOT_TTL = 25 * 1000; // 25초 (서버 s-maxage=30보다 짧게)
let _cache = null;
let _cacheTs = 0;
let _inflight = null;
let _lastETag = null;
let _hasFullSnapshot = false;

export async function fetchSnapshot() {
  const now = Date.now();
  if (_cache && now - _cacheTs < SNAPSHOT_TTL) return _cache;

  // 이미 진행 중인 요청이 있으면 재사용 (useCoins + usePrices 동시 호출 방지)
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const headers = {};
      if (_lastETag) headers['If-None-Match'] = _lastETag;

      // 전체 스냅샷 있으면 delta 모드로 변경분만 요청
      const url = _hasFullSnapshot ? '/api/snapshot?mode=delta' : '/api/snapshot';

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(5000),
      });

      // 304 Not Modified → 캐시 그대로, TTL만 리셋
      if (res.status === 304) {
        _cacheTs = Date.now();
        return _cache;
      }

      if (!res.ok) return null;

      // ETag 저장
      const etag = res.headers.get('etag');
      if (etag) _lastETag = etag;

      const data = await res.json();

      // 델타 응답 → 기존 캐시에 merge
      if (data._delta && _cache) {
        if (data._noChange) {
          _cacheTs = Date.now();
          return _cache;
        }
        const merged = {
          kr: mergeItems(_cache.kr, data.kr, 'symbol'),
          us: mergeItems(_cache.us, data.us, 'symbol'),
          coins: mergeItems(_cache.coins, data.coins, 'symbol'),
          ts: data.ts,
          _fromCache: true,
        };
        _cache = merged;
        _cacheTs = Date.now();
        return merged;
      }

      // 전체 응답
      if (data?.ts) {
        _cache = data;
        _cacheTs = Date.now();
        _hasFullSnapshot = true;
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

// 델타 merge: 변경된 항목만 교체, 나머지는 유지
function mergeItems(existing, updates, key) {
  if (!updates?.length) return existing || [];
  if (!existing?.length) return updates;
  const map = new Map(existing.map(item => [item[key], item]));
  for (const u of updates) {
    map.set(u[key], { ...map.get(u[key]), ...u });
  }
  return [...map.values()];
}

export function invalidateSnapshot() {
  _cache = null;
  _cacheTs = 0;
  _hasFullSnapshot = false;
}
