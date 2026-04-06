# Code Review: feature/#41-pc-design-overhaul
- date: 2026-04-05T03:41:10Z
- commit: 14d9f8f43a6ccbb5926d089467403f74c502fdb7
- diff_lines:     4171

## 코드 리뷰 결과

### Backend / API 변경

**[HIGH] `api/_price-cache.js` — `recordCronFailure` 레이스 컨디션**

`get → +1 → set` 패턴은 주석에서 "원자적 TTL 보장"이라 했지만, 두 개의 cron이 동시에 실패하면 카운터가 유실된다. `INCR` 명령이 Upstash에서 지원되므로 `redis.incr(countKey)` + `redis.expire(countKey, 3600)`이 더 정확하다. 현재 모니터링 용도이므로 데이터 손실이 크리티컬하진 않지만, 주석이 코드 동작과 불일치한다.

```js
// 주석: "incr+expire 분리 시 TTL 누락 위험" → 실제로 get→set도 동일한 문제
const prev = parseInt(await redis.get(countKey) || '0', 10);
await Promise.all([
  redis.set(countKey, prev + 1, { ex: 3600 }),
```

**[HIGH] `api/cron/update-us.js` — 재시도 타임아웃이 원본보다 짧음**

1차 시도 8초, 2차 재시도 5초. 타임아웃으로 실패한 심볼을 더 짧은 타임아웃으로 재시도하면 성공 확률이 낮다. 재시도는 같거나 더 긴 타임아웃이어야 의미 있다.

```js
// 8초에 실패한 것을 5초로 재시도 → 대부분 또 실패
const { results: retried } = await fetchYahooBatch(failedSymbols, 5000);
```

**[PERF] `api/_price-cache.js` — `setSnap` 백업 시 추가 Redis 왕복**

모든 `setSnap` 호출에서 기존 데이터를 먼저 `GET`한 뒤 `SET`(백업) + `SET`(본 데이터)로 3개 Redis 호출이 발생한다. Cron이 3개 마켓을 저장할 때마다 9개 Redis 호출. Upstash의 REST API 특성상 latency가 누적될 수 있다. `GETSET` 또는 Lua 스크립트(Upstash 미지원 시 현상 유지)를 고려할 수 있다.

**[STYLE] `api/snapshot.js` — health 엔드포인트 인증 우회 가능**

`CRON_SECRET` 환경변수가 미설정이면 인증 없이 health 정보 노출. 의도적일 수 있지만 명시적 주석이 필요하다.

```js
const secret = process.env.CRON_SECRET;
if (secret) { /* 인증 체크 */ }
// secret 미설정 시 → 인증 없이 통과
```

**[SEC] `api/binance-whale.js`, `api/fear-greed.js` 등 — `Access-Control-Allow-Origin: '*'`**

모든 API에 와일드카드 CORS 추가. 공개 데이터 프록시이므로 기능적 문제는 없으나, 향후 인증이 필요한 엔드포인트가 추가될 때 습관적으로 `*`를 복사하면 보안 문제가 된다. `CORS_HEADERS` 상수를 공통 모듈로 추출하면 변경 시 일괄 관리 가능.

### Frontend 변경

**[CRITICAL] `src/components/WatchlistTable.jsx` — 가상 스크롤 높이 하드코딩**

```js
style={{ height: 'calc(100vh - 200px)' }}
```

`200px`은 헤더·필터·배너 높이를 대략 잡은 값이다. 배너가 표시되거나, 필터가 2줄로 줄바꿈되면 테이블이 잘리거나 스크롤이 이중으로 생긴다. 반응형으로 동적 계산하거나, `flex-1 min-h-0`으로 남은 공간을 채우는 패턴이 안전하다.

**[HIGH] `src/components/WatchlistTable.jsx` — `hot5` 필터 탭 제거**

기존 필터 `hot5` (5%+ 급등)가 탭 UI에서 제거됐지만, 필터 로직(`useMemo` 내 `hot5` case)이 남아있는지 확인 필요. 탭에서 제거만 하고 로직을 남기면 dead code.

**[PERF] `src/components/WatchlistTable.jsx` — 가상 스크롤 내 `paddingTop`/`paddingBottom` `<tr>` 사용**

`<tr><td colSpan={12}>` 패딩 행은 브라우저에 따라 height 계산이 부정확할 수 있다. `<div>` 래핑 또는 `<tbody>` 레벨에서 `paddingTop`을 적용하는 패턴이 더 안정적이다(tanstack 공식 문서 권장).

**[STYLE] `src/components/Header.jsx` — `MOBILE_TABS` export 미사용 확인**

`export { MOBILE_TABS }` 추가됐는데, 실제로 `MobileBottomNav`에서 import해서 쓰는지 diff에 보이지 않는다. 미사용이면 dead export.

**[STYLE] `src/styles/tokens.css` — 다크모드 오버라이드 대량 삭제**

tailwind 색상을 CSS 변수 참조로 전환한 것은 좋은 방향이지만, `bg-[#F8F9FA]` 같은 arbitrary value 클래스에 대한 다크모드 오버라이드가 전부 삭제됐다. 이 클래스들이 컴포넌트에서 여전히 사용 중이면 다크모드에서 밝은 배경이 그대로 노출된다. `bg-[#F2F4F6]`, `text-[#191F28]` 등 arbitrary value 사용처 전수 조사 필요.

**[HIGH] `tailwind.config.js` — CSS 변수 참조 시 opacity 유틸리티 작동 불가**

```js
up: 'var(--fg-positive)',
```

Tailwind의 `bg-up/50` (opacity modifier) 문법이 CSS 변수 직접 참조 시 작동하지 않는다. `rgb()` 또는 `hsl()` 값 + Tailwind의 `<alpha-value>` 패턴이 필요하다. 현재 코드에서 opacity modifier를 쓰지 않으면 문제없지만, 향후 사용 시 깨진다.

### 인프라 / 스크립트

**[STYLE] `scripts/deploy.sh` — smoke test 중복 코드**

GA 성공 경로와 fallback 경로에서 smoke test 로직이 거의 동일하게 복사됐다. 함수로 추출하면 유지보수성 향상.

**[STYLE] `scripts/pre-deploy-consensus.sh` — 테스트 실패 시 경고만**

의도적이라면 괜찮지만, 테스트가 존재하는데 실패해도 배포되는 것은 품질 래칫과 충돌할 수 있다. `quality-baseline.md`에 테스트 관련 기준이 없으므로 현재는 허용.

### package.json

**[PERF] `@coinbase/cds-web` 의존성 추가 — 번들 크기 영향**

CDS는 `lodash`, `d3-*`, `lottie-web`, `zustand`, `@react-spring/*`, `fuse.js` 등 대량의 transitive 의존성을 가져온다. 프로덕션 번들에서 tree-shaking이 제대로 되는지, 번들 크기 증가량을 확인해야 한다. `npm run build` 후 번들 분석 권장.

---

**VERDICT: BLOCK**

CRITICAL 1건(가상 스크롤 높이 하드코딩 — 레이아웃 깨짐 가능), HIGH 3건(재시도 타임아웃 역전, 다크모드 arbitrary value 오버라이드 삭제 후 미전환 클래스 잔존, tailwind opacity modifier 호환성) 수정 후 재리뷰 필요.
