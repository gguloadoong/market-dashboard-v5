// src/api/snapshot.js — 서버 가격 스냅샷 조회
// /api/snapshot (Edge → Redis) 캐시된 시세를 한 번에 가져옴
// [최적화] ETag/304 지원 — 데이터 미변경 시 빈 응답으로 전송량 절감
// #185: tier 이중 상태 — hot(Top 200, 첫 로드용) / full(전종목, lazy)
//   - 기본 tier='full' 유지 → 기존 호출 사이트 회귀 방지
//   - 캐시/TTL/ETag/inflight 모두 tier 단위 독립

const SNAPSHOT_TTL = 60 * 1000; // 60초 (서버 s-maxage=60/30 과 유사 동기화)

// tier 별 독립 상태 — 교차 오염 없음.
const state = {
  hot: { cache: null, ts: 0, etag: null, inflight: null },
  full: { cache: null, ts: 0, etag: null, inflight: null },
};

function getState(tier) {
  return tier === 'hot' ? state.hot : state.full;
}

export async function fetchSnapshot({ tier = 'full' } = {}) {
  const t = tier === 'hot' ? 'hot' : 'full';
  const st = getState(t);
  const now = Date.now();
  if (st.cache && now - st.ts < SNAPSHOT_TTL) return st.cache;

  // 동일 tier 중복 호출 dedupe (useCoins + usePrices 동시 호출 대비)
  if (st.inflight) return st.inflight;

  const urlPath = t === 'hot' ? '/api/snapshot?tier=hot' : '/api/snapshot?tier=full';

  st.inflight = (async () => {
    try {
      const headers = {};
      if (st.etag) headers['If-None-Match'] = st.etag;

      const res = await fetch(urlPath, {
        headers,
        signal: AbortSignal.timeout(5000),
      });

      // 304 Not Modified → 캐시 그대로, TTL만 리셋
      if (res.status === 304) {
        if (st.cache) {
          st.ts = Date.now();
          return st.cache;
        }
        // cache가 null인데 304 → ETag stale, 즉시 재요청 (브라우저 캐시 우회)
        st.etag = null;
        const retry = await fetch(urlPath, {
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        });
        if (retry.ok) {
          const retryData = await retry.json();
          const retryEtag = retry.headers.get('etag');
          if (retryEtag) st.etag = retryEtag;
          if (retryData?.ts) {
            st.cache = retryData;
            st.ts = Date.now();
          }
          return retryData;
        }
        return null;
      }

      if (!res.ok) return null;

      // ETag 저장 — tier 프리픽스(hot-*/full-*)가 있으므로 교차 오염 불가
      const etag = res.headers.get('etag');
      if (etag) st.etag = etag;

      const data = await res.json();
      if (data?.ts) {
        st.cache = data;
        st.ts = Date.now();
      }
      return data;
    } catch {
      return null;
    } finally {
      st.inflight = null;
    }
  })();

  return st.inflight;
}

// #185: tier 별 무효화. 인자 없으면 양쪽 모두.
export function invalidateSnapshot(tier) {
  const reset = (s) => { s.cache = null; s.ts = 0; s.etag = null; };
  if (tier === 'hot' || tier === 'full') {
    reset(getState(tier));
  } else {
    reset(state.hot);
    reset(state.full);
  }
}
