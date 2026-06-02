# Tier2 설계서 -- 크론이 엣지에 직접 굽기

> 소유자: architect (opus)
> 작성일: 2026-06-02
> 상태: DRAFT -- 대표 확인 전

---

## 1. 현재 구조 (AS-IS)

```
[CF Worker 크론 (mdv5-cron)]
  |
  | setSnap() via @upstash/redis REST
  v
[Upstash Redis]  <---  mget()  ---  [Vercel Edge Function /api/snapshot]
                                          |
                                          | JSON response (~400KB full, ~60KB hot)
                                          v
                                    [프론트 src/api/snapshot.js]
                                          |
                                          v
                                    [usePrices.js / useCoins.js]
```

### 현재 읽기 경로의 비용 구조

| 구간 | 비용 드라이버 | 현재 수치 |
|------|-------------|----------|
| Vercel Edge Function | invocation 당 과금 (Pro: 100만/월 포함) | DAU 비례 증가 |
| Upstash Redis mget | bandwidth 과금 ($10 Fixed, 50GB/월) | 실측 ~8GB/월 (2026-04-16) |
| Vercel CDN s-maxage | hot=60s, full=120s 캐시 | 히트율 미실측 |

**핵심 문제**: 유저 1명 추가 시 Vercel invocation + Upstash bandwidth가 비례 증가할 수 있음.
`cost-monitoring.md:12`의 원칙 "유저 증가가 어떤 것도 비례로 증가시키지 않아야 한다"에 위배 가능.

### 코드 근거

| 파일 | 라인 | 역할 |
|------|------|------|
| `workers/cron/src/index.js:13-14` | `initRedis(env)` 후 크론 디스패치 | 크론 진입점 |
| `workers/cron/src/price-cache.js:74-101` | `setSnap()` -- Upstash REST PUT | 크론 쓰기 경로 |
| `workers/cron/src/crons/update-coins.js:153` | `setSnap(SNAP_KEYS.COINS, items, SNAP_TTL.COINS)` | 코인 full 저장 |
| `workers/cron/src/crons/update-kr.js:427` | `setSnap(SNAP_KEYS.KR, items, SNAP_TTL.KR)` | 국장 full 저장 |
| `workers/cron/src/crons/update-us.js:268` | `setSnap(shardKey, shardItems, SNAP_TTL.US)` | 미장 샤드 저장 |
| `api/snapshot.js:6` | `import { getAllSnaps, getHotSnaps }` | Vercel 읽기 진입점 |
| `api/_price-cache.js:159-177` | `getHotSnaps()` -- mget 5키 병렬 | hot tier 읽기 |
| `api/_price-cache.js:183-201` | `getAllSnaps()` -- mget + 샤드 merge | full tier 읽기 |
| `src/api/snapshot.js:34` | `fetch('/api/snapshot?tier=hot')` | 프론트 fetch |
| `src/api/snapshot.js:41` | `fetch(urlPath, { headers })` | ETag 재검증 |

---

## 2. 목표 구조 (TO-BE)

```
[CF Worker 크론 (mdv5-cron)]
  |
  | 1. setSnap() → Upstash (기존 유지, 원본/백업)
  | 2. R2.put() → snapshot-hot.json, snapshot-full.json (신규)
  | 3. caches.default.delete(edgeUrl) → CF Cache purge (신규)
  v
[Upstash Redis]          [R2 Bucket: mdv5-snapshots]
  (원본/백업 강등)              |
                               | R2.get() + Cache API
                               v
                         [CF Worker (mdv5-edge)]  ← 별도 경량 worker
                               |
                               | JSON response + CORS + ETag + Cache-Control
                               v
                         [프론트 src/api/snapshot.js]
                               |  (CF 우선, Vercel 폴백)
                               v
                         [usePrices.js / useCoins.js]
```

### 비용 구조 변화

| 구간 | AS-IS | TO-BE | 효과 |
|------|-------|-------|------|
| 유저 읽기 시 Vercel 함수 | invocation/req | 0 (CF 직접 serve) | Vercel invocation 유저 비례 증가 제거 |
| 유저 읽기 시 Upstash | mget bandwidth/req | 0 (R2 정적 serve) | Upstash bandwidth 유저 비례 증가 제거 |
| CF Edge serve | 없음 | ~1ms CPU/req (Free 10ms 내) | Free 플랜 충분 |
| R2 write | 없음 | ~35,000 Class A/월 (Free 100만) | 무료 |
| R2 read | 없음 | Cache miss 시만 (Free 1000만/월) | 무료 |
| Upstash 크론 write | 유지 | 유지 (원본/백업) | 변화 없음 |

**정량 추정**: 유저당 읽기 비용 현재 ~$0.0001/req (Vercel invocation + Upstash bandwidth) -> TO-BE ~$0/req.
DAU 1000명, 5분 폴링 기준: 현재 ~288,000 req/일 -> Vercel/Upstash 부하 0으로 감소.

---

## 3. R2 vs Workers KV 선택

### 결론: **R2 선택**

| 기준 | R2 | Workers KV |
|------|-----|------------|
| **Value 크기 한계** | 최대 5GB/객체 | **25KB/값 (치명적)** |
| full tier 페이로드 | ~400KB raw JSON -> 적합 | **25KB 초과 -> 불가** |
| hot tier 페이로드 | ~60KB raw JSON -> 적합 | **25KB 초과 -> 불가** |
| Write 무료 한도 | Class A 100만/월 | 1,000/일 (초과 $5/M) |
| Read 무료 한도 | Class B 1,000만/월 | 10만/일 |
| Write 지연 | ~수십ms (S3 호환) | ~수십ms (eventually consistent) |
| Read 지연 (캐시 miss) | ~50-100ms (리전 의존) | ~10-50ms (엣지 복제) |
| Read 지연 (Cache API hit) | **~1ms** | **~1ms** |
| 일관성 | 강한 일관성 (단일 리전) | **최종 일관성 (60s 전파)** |
| 비용 (Paid) | $0.015/GB 저장 + ops | $5/M write, $0.50/M read |

### KV가 불가한 핵심 이유

`api/_price-cache.js:159-177`의 `getHotSnaps()`가 반환하는 hot tier 데이터:
- KR hot: ~200개 x ~120B/종목 = ~24KB
- US hot: ~200개 x ~130B/종목 = ~26KB
- COINS hot: ~200개 x ~100B/종목 = ~20KB

개별 마켓 hot도 KV 25KB를 간당간당 넘고, full tier는 KR ~4000종목 + US ~2700종목 + COINS ~200종목으로 확실히 초과. KV를 쓰려면 페이로드를 분할 저장 + 읽기 시 재조립해야 하는데, 이는 R2 단일 객체 저장 대비 복잡도만 증가.

### R2의 읽기 지연 우려 해소

R2 자체는 단일 리전(auto) 저장이라 엣지에서 직접 읽으면 ~50-100ms 지연. 그러나 **CF Cache API**를 앞에 두면:
- Cache hit: ~1ms (KV 엣지 복제와 동등)
- Cache miss: R2 read 1회 후 Cache에 적재
- 크론이 5분마다 쓰고 Cache purge -> 다음 첫 요청만 R2 직접 read, 이후 전부 Cache hit

실질적으로 KV 엣지 복제의 최종 일관성 60초 전파보다 **더 빠른 갱신**이 가능(크론이 즉시 purge하므로).

---

## 4. wrangler.toml 바인딩 추가안

### 4-1. mdv5-cron (기존 크론 worker)

```toml
# workers/cron/wrangler.toml 에 추가

# ── Tier2: R2 스냅샷 직접 굽기 ──
[[r2_buckets]]
binding = "SNAPSHOTS"
bucket_name = "mdv5-snapshots"
```

R2 버킷 사전 생성:
```bash
wrangler r2 bucket create mdv5-snapshots
```

### 4-2. mdv5-edge (신규 serve worker)

```toml
# workers/edge/wrangler.toml (신규 파일)

name = "mdv5-edge"
main = "src/index.js"
compatibility_date = "2024-12-01"

[[r2_buckets]]
binding = "SNAPSHOTS"
bucket_name = "mdv5-snapshots"

[triggers]
# 크론 없음 -- HTTP serve 전용
```

Custom domain 또는 route 설정:
```toml
# 옵션 A: workers.dev 서브도메인 (즉시 사용 가능)
# mdv5-edge.{account}.workers.dev

# 옵션 B: 커스텀 도메인 (DNS 설정 필요)
# routes = [{ pattern = "edge.marketradar.app/snapshot/*", zone_name = "marketradar.app" }]
```

---

## 5. 크론 Write 경로 변경

### 5-1. 변경 위치

`workers/cron/src/price-cache.js`의 `setSnap()` 함수 (라인 74-101)에 R2 PUT 로직 추가.

### 5-2. 변경 설계

```
setSnap(key, data, ex)
  |
  | 1. 기존: _redis.set(key, data, { ex })  -- Upstash 유지 (원본/백업)
  |
  | 2. 신규: if (env.SNAPSHOTS && isSnapshotKey(key))
  |            buildAndPutR2(env.SNAPSHOTS, key, data)
  |
  v
  완료
```

**R2에 저장할 키 매핑:**

| Redis 키 | R2 object key | 설명 |
|----------|---------------|------|
| `snap:kr:hot` + `snap:us:hot` + `snap:coins:hot` | `snapshot-hot.json` | hot tier 통합 JSON |
| `snap:kr` + `snap:us:0..2` (merged) + `snap:coins` | `snapshot-full.json` | full tier 통합 JSON |
| `snap:kr:ext` + `snap:us:ext` | ext dict 는 hot/full 내 merge | 별도 R2 키 불필요 |

**중요 설계 결정**: R2에는 개별 마켓 키가 아닌 **프론트가 소비하는 최종 형태**를 저장.
이유: api/snapshot.js:102-107의 stripStocks/stripCoins + merge + ext 머지를 크론 시점에 수행하여
serve worker가 R2.get 한 번으로 즉시 응답 가능 (추가 가공 CPU 0).

### 5-3. hot tier R2 PUT 타이밍

현재 hot 저장은 각 마켓 크론에서 개별 수행:
- `update-coins.js:161-168` -- coins hot
- `update-kr.js:430-438` -- kr hot
- `update-us.js:275-298` -- us hot (샤드 0에서만)

**문제**: 3개 마켓 크론이 서로 다른 시각에 실행 (offset 0, 1, 2-4분).
R2의 `snapshot-hot.json`은 3개 마켓 통합이므로, 한 마켓만 갱신될 때마다 전체를 재조립해야 함.

**해결**: 각 마켓 크론의 hot 저장 직후에 R2 hot 재조립:
1. 자기 마켓 hot을 Upstash에 저장 (기존)
2. mget으로 3개 hot 키 읽기 (이미 update-us.js:276-278에서 유사 패턴 사용)
3. stripStocks/stripCoins 적용
4. ext dict merge
5. `{ kr, us, coins, ts, tier: 'hot' }` JSON으로 R2 PUT
6. Cache purge

추가 Upstash mget 1회/크론 실행 발생하지만, 이는 크론 내부(고정 비용)이므로 유저 비례 증가 아님.

### 5-4. full tier R2 PUT 타이밍

full tier는 현재 api/_price-cache.js의 `getAllSnaps()`가 읽기 시점에 조립.
크론에서 R2에 사전 조립하려면:

- **KR 크론 완료 시** (offset 1): KR full + 기존 US/COINS 조합 -> R2 PUT
- **US 샤드 0 완료 시** (offset 2): US 3샤드 merge + 기존 KR/COINS 조합 -> R2 PUT
- **COINS 크론 완료 시** (offset 0): COINS full + 기존 KR/US 조합 -> R2 PUT

각 크론이 "자기 데이터 갱신 + 나머지 기존 데이터 mget + 통합 R2 PUT".
이렇게 하면 어느 마켓이 갱신되든 즉시 R2가 최신 상태로 반영.

**CPU 예산 영향**: mget(3-5키) + JSON.stringify(~400KB) 추가.
stringify 400KB는 ~2-5ms CPU. 기존 크론 CPU 사용량에 누적되므로
Free 10ms 한도 영향 주의 -- **크론은 이미 Paid 플랜 사용 중**이므로 문제 없음.
(wrangler.toml에 `[triggers] crons` 10개 등록 -- Free 플랜에서는 불가능한 규모.)

---

## 6. Serve 경로 설계 (mdv5-edge worker)

### 6-1. 라우트 구조

```
GET /snapshot?tier=hot   -> R2 key: snapshot-hot.json
GET /snapshot?tier=full  -> R2 key: snapshot-full.json
GET /snapshot             -> R2 key: snapshot-full.json (기본)
OPTIONS /snapshot         -> CORS preflight
```

### 6-2. 핵심 로직 (의사 코드)

```javascript
export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsPreflightResponse();
    }

    const url = new URL(request.url);
    const tier = url.searchParams.get('tier') === 'hot' ? 'hot' : 'full';
    const r2Key = `snapshot-${tier}.json`;

    // 1. CF Cache API 확인 (에지 캐시)
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;
    let response = await cache.match(cacheKey);
    if (response) {
      // Cache hit -- CORS 헤더 추가 후 반환
      return addCorsHeaders(response);
    }

    // 2. Cache miss -- R2에서 읽기
    const object = await env.SNAPSHOTS.get(r2Key);
    if (!object) {
      return new Response('{"error":"snapshot not found"}', {
        status: 404,
        headers: corsJsonHeaders(),
      });
    }

    // 3. ETag 기반 304 처리
    const etag = object.httpEtag;
    const clientETag = request.headers.get('if-none-match');
    if (clientETag && clientETag === etag) {
      return new Response(null, {
        status: 304,
        headers: { 'Access-Control-Allow-Origin': '*', 'ETag': etag },
      });
    }

    // 4. 응답 구성 + Cache에 적재
    response = new Response(object.body, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': tier === 'hot'
          ? 'public, s-maxage=60, stale-while-revalidate=300'
          : 'public, s-maxage=120, stale-while-revalidate=300',
        'ETag': etag,
      },
    });

    // Cache에 적재 (비동기, 응답 지연 없음)
    // ctx.waitUntil(cache.put(cacheKey, response.clone()));
    // -- fetch handler에서는 waitUntil 불가, event.waitUntil 패턴 사용

    return response;
  }
};
```

### 6-3. Cache-Control 설계

| tier | s-maxage | stale-while-revalidate | max-age | 근거 |
|------|----------|----------------------|---------|------|
| hot | 60s | 300s | 0 | 크론 5분 주기 대비 1분 stale 안전. SWR 5분은 R2 장애 시 보호. 현재 api/snapshot.js:121과 동일. |
| full | 120s | 300s | 0 | 크론 5분 주기 대비 2분 stale 안전. 현재 api/snapshot.js:172와 동일. SWR 추가는 R2 경로이므로 Upstash bandwidth 우려 없음. |

**현재와의 차이**: api/snapshot.js:163-167에서 SWR을 의도적으로 미사용했던 이유는
"백그라운드 갱신 중 stale 반환 시 서비스 본질 훼손" 우려. 그러나 R2 경로에서는:
- stale 상태에서도 **크론이 R2에 직접 최신 JSON을 넣으므로** 다음 cache miss 시 즉시 최신 반환
- SWR은 R2 자체 장애(극히 드뭄) 시에만 작동하는 안전망
- Upstash bandwidth 우려가 없으므로 SWR 부작용 없음

### 6-4. 캐시 무효화

크론이 R2 PUT 직후 Cache API로 무효화:

```javascript
// workers/cron/src/price-cache.js 의 R2 PUT 직후
async function purgeEdgeCache(tier) {
  const edgeUrl = `https://mdv5-edge.{account}.workers.dev/snapshot?tier=${tier}`;
  try {
    await caches.default.delete(new Request(edgeUrl));
  } catch (e) {
    console.warn('[price-cache] Cache purge 실패:', e.message);
    // best-effort -- s-maxage TTL이 자연 만료 백업
  }
}
```

**주의**: `caches.default.delete()`는 **같은 데이터센터의 캐시만 삭제**.
글로벌 purge는 불가능하지만, 크론이 실행되는 데이터센터(auto region)의 캐시는 즉시 삭제.
다른 POP의 캐시는 s-maxage TTL 자연 만료로 갱신 -- 이는 현재 Vercel CDN 동작과 동일.

대안: Cloudflare API `purge_cache` 호출 (zone 필요, custom domain 사용 시).

---

## 7. CORS 처리

### 현재 상태
`api/snapshot.js:9-11`: `Access-Control-Allow-Origin: '*'` 전면 허용.

### TO-BE
mdv5-edge worker에서 동일하게 `'*'` 적용. 이유:
- 프론트가 Vercel 도메인 (e.g., `market-dashboard-v5.vercel.app`)에서 CF workers.dev 도메인으로 cross-origin fetch
- 로컬 개발 (`localhost:5173`)도 접근 필요
- 비공개 단계이므로 Origin 제한의 보안 이득 미미

### Preflight 대응

```javascript
function corsPreflightResponse() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
      'Access-Control-Max-Age': '86400',  // preflight 캐시 24시간
    },
  });
}
```

`Access-Control-Max-Age: 86400` 추가 -- 현재 api/snapshot.js:52-57에는 없음.
스냅샷 URL이 고정이므로 preflight 캐시로 불필요한 OPTIONS 요청 제거.

---

## 8. 프론트 fetch 변경

### 변경 파일: `src/api/snapshot.js`

### 변경 설계

```javascript
// 현재 (라인 34)
const urlPath = t === 'hot' ? '/api/snapshot?tier=hot' : '/api/snapshot?tier=full';

// TO-BE: CF 엣지 URL 우선 + Vercel 폴백
const CF_EDGE_BASE = import.meta.env.VITE_EDGE_SNAPSHOT_URL
  || 'https://mdv5-edge.{account}.workers.dev';

const edgeUrl = `${CF_EDGE_BASE}/snapshot?tier=${t}`;
const fallbackUrl = `/api/snapshot?tier=${t}`;

st.inflight = (async () => {
  try {
    // 1차: CF 엣지
    const res = await fetchWithETag(edgeUrl, st, t);
    if (res !== null) return res;
  } catch {
    // CF 실패 -> Vercel 폴백
  }

  try {
    // 2차: 기존 Vercel 경로
    return await fetchWithETag(fallbackUrl, st, t);
  } catch {
    return st.cache; // 최종 폴백: 로컬 캐시
  }
})();
```

### ETag 네임스페이스

현재 ETag는 `"hot-{hash}"` / `"full-{hash}"` 형태 (api/snapshot.js:106, 148).
R2의 httpEtag는 MD5 기반으로 형식이 다름.

**해결**: mdv5-edge worker에서 R2 ETag을 그대로 사용하되, 프론트에서 ETag 비교는
URL별로 독립 저장 (현재 `st.etag`이 tier별 독립이므로 자연스럽게 분리됨).

### 폴백 타임아웃

```javascript
// CF 엣지 타임아웃: 3초 (정적 serve이므로 빨라야 함)
const edgeRes = await fetch(edgeUrl, {
  headers,
  signal: AbortSignal.timeout(3000),
});

// Vercel 폴백 타임아웃: 5초 (기존 유지, src/api/snapshot.js:42)
```

CF 엣지가 3초 내 응답 못 하면 장애 상태로 간주, 즉시 Vercel 폴백.

---

## 9. hot/full tier 유지 + Tier1 페이로드 다이어트 결합

### 9-1. Tier2에서의 tier 구조

R2에 2개 파일로 분리 저장:
- `snapshot-hot.json`: `{ kr: [...200], us: [...200], coins: [...200], ts, tier: 'hot' }`
- `snapshot-full.json`: `{ kr: [...4000], us: [...2700], coins: [...200], ts, tier: 'full' }`

기존 hot/full 2단계 로딩 패턴 (`usePrices.js:207-214`, `useCoins.js:74-80`) 그대로 유지.

### 9-2. Tier1 페이로드 다이어트와의 관계

Tier1(튜플/컬럼나 포맷)은 R2 저장 시점에 적용하면 자연스러움:

```javascript
// 예시: 컬럼나 포맷
{
  columns: ['symbol','name','price','change','changePct','volume','marketCap','market','exchange'],
  kr: [
    ['005930','삼성전자',58000,1500,2.65,12345678,346000000000000,'kr','kospi'],
    ...
  ],
  ...
}
```

그러나 **Tier2와 Tier1은 Phase 분리 권장**:
1. Tier2 (읽기 경로 전환)는 프론트 파서 변경 없이 가능 -- JSON 구조 동일
2. Tier1 (페이로드 다이어트)는 프론트에 컬럼나 파서 추가 필요
3. 두 변경을 동시에 하면 롤백 시 "어느 변경이 문제인지" 분리 불가

**권장 순서**: Tier2 cutover 안정화 (1-2주) -> Tier1 적용

### 9-3. R2 저장 시 gzip 압축

R2는 Content-Encoding을 메타데이터로 저장 가능:

```javascript
await env.SNAPSHOTS.put(r2Key, gzipBody, {
  httpMetadata: {
    contentType: 'application/json',
    contentEncoding: 'gzip',
  },
});
```

full tier ~400KB raw -> ~80-100KB gzip. R2 저장 비용 및 edge-to-client 전송량 감소.
단, CF Worker에서 gzip은 `CompressionStream` API 사용 (compatibility_date 2024-01-01 이상).

---

## 10. 단계적 롤아웃

### Phase A: Shadow Write (1-2일)

**목적**: R2 쓰기가 정상 작동하는지 검증. 읽기 경로 변경 없음.

1. wrangler.toml에 R2 바인딩 추가 + `wrangler r2 bucket create`
2. `price-cache.js` setSnap에 R2 PUT 추가 (try-catch, best-effort)
3. 배포 후 R2 대시보드에서 객체 생성 확인
4. `wrangler r2 object get mdv5-snapshots/snapshot-hot.json | jq .ts` 로 갱신 주기 확인
5. JSON 구조가 api/snapshot.js 응답과 동일한지 비교 검증

**롤백**: wrangler.toml에서 R2 바인딩 제거 + 재배포. 읽기 경로 무관.

### Phase B: Edge Worker 배포 + Canary (3-5일)

**목적**: mdv5-edge worker 기능 검증. 프론트 변경 최소.

1. `workers/edge/` 디렉토리 생성 + mdv5-edge worker 배포
2. curl로 `mdv5-edge.{account}.workers.dev/snapshot?tier=hot` 응답 확인
3. 프론트에 `VITE_EDGE_SNAPSHOT_URL` 환경변수 추가 (Vercel env)
4. **canary**: `src/api/snapshot.js`에서 `Math.random() < 0.1` (10%)만 CF 엣지, 나머지 Vercel
5. 브라우저 DevTools Network에서 CF 응답 확인 (cf-ray 헤더)
6. Vercel Analytics에서 /api/snapshot invocation 감소 추세 확인

**롤백**: `VITE_EDGE_SNAPSHOT_URL` 환경변수 제거 -> 프론트 100% Vercel 폴백.

### Phase C: Cutover (1일)

**목적**: 전체 트래픽을 CF 엣지로 전환.

1. canary 비율 100%로 올리기 (또는 분기 로직 제거, CF 우선)
2. 24시간 관측:
   - CF edge 응답 시간 p95
   - Vercel /api/snapshot invocation -> ~0 확인
   - Upstash bandwidth 일일 소비량 감소 확인
3. 안정 확인 후 Vercel api/snapshot.js에 deprecation 주석 추가 (삭제는 하지 않음 -- 폴백 유지)

**롤백**: `VITE_EDGE_SNAPSHOT_URL` 제거. 프론트가 자동으로 Vercel 폴백.

### Phase D: 정리 (안정화 2주 후)

1. Vercel api/snapshot.js의 Upstash 읽기 경로 제거 가능 (폴백 불필요 판단 시)
2. Upstash bandwidth 모니터링 -> 크론 쓰기만 남으므로 $10 Fixed -> Free 다운그레이드 검토
3. Tier1 (페이로드 다이어트) 착수

---

## 11. 롤백 전략

### 즉시 롤백 (< 1분)

**방법**: Vercel 환경변수 `VITE_EDGE_SNAPSHOT_URL` 삭제 또는 빈 문자열 설정.
프론트 `src/api/snapshot.js`의 폴백 로직이 자동으로 기존 `/api/snapshot` Vercel 경로 사용.

**전제**: Vercel api/snapshot.js + Upstash 읽기 경로를 삭제하지 않고 유지.

### 크론 쓰기 롤백 (< 5분)

R2 PUT이 크론 성능에 영향 줄 경우:
1. wrangler.toml에서 R2 바인딩 제거
2. `wrangler deploy` (< 1분)
3. R2 PUT 코드는 `env.SNAPSHOTS` 존재 체크로 자동 비활성화

### 데이터 정합성 롤백

R2 데이터가 손상된 경우:
- Upstash에 원본이 항상 존재 (크론이 Upstash를 먼저 쓰므로)
- 프론트 폴백이 Vercel -> Upstash 경로를 사용하므로 데이터 복구 불필요

---

## 12. 리스크 분석

### 12-1. CF Workers Free 10ms CPU 한계

| worker | 역할 | CPU 사용량 | Free 한계 영향 |
|--------|------|-----------|---------------|
| mdv5-cron | 크론 (시세 수집 + Upstash 쓰기 + R2 PUT) | ~10-30ms | **Paid 플랜 필수 (이미 사용 중)** |
| mdv5-edge (신규) | 정적 JSON serve | **~1ms** | **Free 충분** |

크론은 이미 10개 cron trigger + 900 subrequest/invocation으로 Paid Workers Standard 플랜.
R2 PUT 추가는 ~2-5ms CPU 증가이나 Paid 30s maxDuration 내 여유 충분.

serve worker(mdv5-edge)는 R2.get() + Response 구성만 수행. Cache hit 시 R2.get() 자체도 불필요.
Free 플랜 10ms CPU / 10만 req/일 한도 내 안전.

### 12-2. R2 리전 지연

R2 auto 리전은 쓰기 패턴 기반 자동 선택 (크론이 CF 엣지에서 실행 -> 보통 US).
한국 사용자(vercel.json:regions=icn1)가 R2 read 시 US 왕복 ~100ms 발생 가능.

**완화**: Cache API가 ICN POP에 캐시하므로 첫 요청만 100ms, 이후 ~1ms.
크론 5분 주기이므로 5분에 1회만 cold read 발생.

### 12-3. R2 쓰기 실패

크론에서 R2 PUT이 실패해도 Upstash 쓰기는 이미 완료된 상태 (순서: Upstash -> R2).
프론트 폴백이 Vercel -> Upstash 경로를 사용하므로 서비스 중단 없음.

### 12-4. Cache API 정합성

`caches.default.delete()`는 로컬 POP만 purge. 글로벌 POP의 stale 캐시는 s-maxage 만료까지 유지.
최악 케이스: 특정 POP에서 s-maxage(120s) + stale-while-revalidate(300s) = 최대 7분 stale.
현재 Vercel CDN도 동일한 s-maxage 기반이므로 실질적 차이 없음.

### 12-5. 이중 쓰기 비용

| 항목 | 추가 비용 |
|------|----------|
| R2 Class A (PUT) | ~35,000/월 (Free 100만 내) = $0 |
| R2 저장 | ~1MB (hot+full JSON) x $0.015/GB = ~$0 |
| Upstash mget (R2 조립용) | 크론당 1회 추가 = ~8,640/월 = ~0.5GB bandwidth |
| 총 추가 비용 | **~$0** |

---

## 13. 비용/퍼포먼스 정량 비교

### 비용 (월간, DAU 1000명 가정, 5분 폴링)

| 항목 | AS-IS | TO-BE | 절감 |
|------|-------|-------|------|
| Vercel Function invocations | ~288,000/월 (DAU 비례) | ~0 (폴백만) | -100% |
| Upstash bandwidth (유저 읽기) | ~4-6GB/월 (DAU 비례) | ~0 | -100% |
| Upstash bandwidth (크론 쓰기) | ~2GB/월 (고정) | ~2.5GB/월 (mget 추가) | +25% (고정) |
| CF R2 ops | 0 | ~35,000 write + ~300,000 read/월 | Free 한도 내 |
| CF Workers (edge serve) | 0 | ~288,000 req/월 | Free 한도 내 |
| **월 총 추가 비용** | - | **$0** | - |

### 퍼포먼스 (한국 사용자 기준, p50)

| 지표 | AS-IS | TO-BE | 개선 |
|------|-------|-------|------|
| TTFB (hot tier) | ~80-150ms (Vercel ICN edge -> Upstash) | ~5-20ms (CF Cache hit) | **4-8x 개선** |
| TTFB (full tier) | ~150-300ms (Vercel ICN edge -> Upstash mget merge) | ~10-30ms (CF Cache hit) | **5-10x 개선** |
| Cache miss TTFB | - | ~100-150ms (R2 read) | Vercel과 동등 |
| 전송 크기 | ~60KB hot / ~400KB full (raw) | 동일 (Tier1에서 별도 최적화) | 변화 없음 |

### 확장성

| DAU | AS-IS 월 비용 증가 | TO-BE 월 비용 증가 |
|-----|-------------------|-------------------|
| 100 | baseline | $0 |
| 1,000 | +Vercel invocations, +Upstash BW | $0 |
| 10,000 | Upstash $10 Fixed 초과 우려 | $0 (R2/CF Free 한도 내) |
| 100,000 | Vercel Pro 한도 + Upstash 유료 스케일업 | CF Workers Paid ($5/월) 전환 가능 |

---

## 14. 파일 변경 목록 (구현 시 참고)

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `workers/cron/wrangler.toml` | 수정 | `[[r2_buckets]]` 바인딩 추가 |
| `workers/cron/src/price-cache.js` | 수정 | setSnap에 R2 PUT + Cache purge 로직 추가 |
| `workers/cron/src/index.js` | 수정 | env를 price-cache에 전달하는 방식 변경 (R2 바인딩 접근) |
| `workers/edge/` (신규) | 생성 | mdv5-edge worker 전체 (wrangler.toml, src/index.js, package.json) |
| `src/api/snapshot.js` | 수정 | CF 엣지 URL 우선 fetch + Vercel 폴백 |
| `.env` / Vercel env | 추가 | `VITE_EDGE_SNAPSHOT_URL` |
| `api/snapshot.js` | **유지** | 삭제하지 않음 (폴백 경로) |
| `api/_price-cache.js` | **유지** | 삭제하지 않음 (폴백 경로) |

---

## 15. 선행 조건 체크리스트

- [ ] CF Workers Paid 플랜 확인 (크론이 이미 사용 중이면 OK)
- [ ] `wrangler r2 bucket create mdv5-snapshots` 실행
- [ ] CF 계정의 workers.dev 서브도메인 확인 (mdv5-edge.{account}.workers.dev)
- [ ] Vercel 환경변수 `VITE_EDGE_SNAPSHOT_URL` 추가 준비
- [ ] 현재 크론 CPU 사용량 확인 (wrangler tail로 실측)

---

## 16. 참조 파일 (분석 근거)

| 파일 | 핵심 내용 |
|------|----------|
| `workers/cron/wrangler.toml` | 크론 10개, R2/KV 바인딩 없음 |
| `workers/cron/src/index.js:13-14` | initRedis(env) + 크론 디스패치 |
| `workers/cron/src/price-cache.js:74-101` | setSnap() -- Upstash REST PUT, 백업 로직 |
| `workers/cron/src/crons/update-coins.js:153` | setSnap(SNAP_KEYS.COINS) |
| `workers/cron/src/crons/update-kr.js:427-438` | setSnap(SNAP_KEYS.KR) + hot 계산 |
| `workers/cron/src/crons/update-us.js:268-298` | setSnap(shardKey) + 샤드 merge hot |
| `api/snapshot.js:1-182` | Vercel Edge Function, stripStocks/stripCoins, ETag, Cache-Control |
| `api/_price-cache.js:159-201` | getHotSnaps/getAllSnaps -- Upstash mget 읽기 |
| `src/api/snapshot.js:25-91` | 프론트 fetchSnapshot, ETag/304, tier별 TTL/inflight |
| `src/hooks/usePrices.js:207-214` | hot -> full 2단계 로딩 |
| `.project/cost-monitoring.md:12` | "유저 증가가 비례 증가시키지 않아야" 원칙 |
| `.project/cost-monitoring.md:27` | Upstash $10 Fixed, 50GB/월, 실측 ~8GB/월 |
| `.project/decisions.md:198-201` | ADR-019: Upstash -> CF KV 부분 이전 선례 |
