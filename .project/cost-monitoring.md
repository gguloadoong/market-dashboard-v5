---
담당: 김민준 (Staff BE) + 박서연 (Staff FE)
마지막 업데이트: 2026-04-23
목적: DAU 수천 명 공개 후 "유저 1명 추가 시 비용 0 증가" 목표 상태를 실측·검증
---

# 운영비 관측 가이드

## 원칙

> **"크론이 채우고 유저는 캐시만 읽는다"**
> 유저 증가가 Function invocation, Redis bandwidth, 외부 API 호출 중 어떤 것도 비례로 증가시키지 않아야 한다.

## 핵심 지표

### 1. Vercel Edge Cache 히트율 (가장 중요)
- 목표: `/api/snapshot`, `/api/rss`, `/api/fear-greed`, `/api/pcr`, `/api/social`, `/api/order-flow`, `/api/funding-rate` 전부 **히트율 ≥ 90%**
- 측정: 응답 헤더 `x-vercel-cache` 값 집계 (`HIT`, `STALE`, `MISS`)
- 경보 임계: 히트율 < 70% 지속 시 해당 엔드포인트 즉시 점검

### 2. `/api/snapshot` tier 분리 효과 (#187)
- hot tier 호출 비율 vs full tier 호출 비율 측정
- 기대: 홈 첫 로딩은 hot(Top 200)이 대부분, 관심종목 추가/탭 전환 시에만 full 호출
- 실패 시그널: full/hot > 1.0 — 클라이언트 페이로드 최적화 실패 의미

### 3. Upstash Redis bandwidth (월 기준)
- 현재: Fixed $10 플랜, 월 50GB 한도, 최근 실측 ~8GB/월 (2026-04-16)
- 공개 후 모니터링: 매일 Upstash 대시보드 bandwidth 확인
- 경보: 일일 사용량 × 30 ≥ 30GB 추세 시 캐시 전략 재설계

### 4. Vercel Function Invocations
- 공개 전 baseline 확보: 주간 호출 수 집계
- 공개 후 목표: Function invocation 증가폭이 DAU 증가율의 20% 이하
  - 예: DAU 2배 증가 시 invocation 1.2배 이하면 캐시 구조가 제대로 동작
  - DAU와 1:1로 비례 증가 시 캐시 실패 → 재조사

---

## 측정 방법

### A. curl로 응답 헤더 실측

```bash
# Edge 캐시 활성화 확인 (x-vercel-cache 헤더)
curl -I "https://<prod>/api/snapshot?tier=hot"
curl -I "https://<prod>/api/rss?url=https%3A%2F%2Fnews.google.com%2Frss"
curl -I "https://<prod>/api/pcr"
curl -I "https://<prod>/api/fear-greed"

# 첫 호출: MISS, 연속 호출: HIT 확인
# cache-control 헤더에 s-maxage=N 포함 필수
```

### B. Vercel Analytics 대시보드
- Functions 탭 → 엔드포인트별 invocation 수 / 응답시간 p95
- Edge Network 탭 → 캐시 히트율 (가능한 경우)

### C. 주기적 샘플링 (필요 시 추가 작업)
- `/api/ops/cron-status` (#174) 이미 구축됨 — 크론 실패 관측
- 추후: `/api/ops/cache-stats` 추가해 5분 캐시 히트 카운터 노출 (단, 구현 시 Redis increment 비용 주의)

---

## snapshot tier (#187) 실측 체크리스트

배포 후 24시간 관측:

- [ ] hot tier 응답 페이로드 크기 측정 (기대: < 30KB gzip)
- [ ] full tier 응답 페이로드 크기 측정 (기대: 100~200KB gzip)
- [ ] 클라이언트 실제 호출 패턴 (Chrome DevTools Network) — 홈 진입 시 hot만 호출되는지
- [ ] Edge Cache 히트율 hot vs full 각각 확인
- [ ] Redis bandwidth 일일 소비량 변화 (tier 분리 전 대비)

## 캐시 헤더 통일 (#192 후속)

`s-maxage` 미설정 4개 파일 보강 완료 (PR #193):
- `api/funding-rate.js` → 60s
- `api/pcr.js` → 300s
- `api/social.js` → 300s
- `api/order-flow.js` → 30s

추가 감사 필요 대상 (ai-debate는 max-age=1800로 의도 확인 필요):
- `api/ai-debate.js` — AI 응답 30분 캐시, `s-maxage` 미설정. 유저 쿼리별 unique하면 캐시 의미 없음 → 기획 의도 재검토

---

## DAU 공개 전 체크리스트 (종합)

| 항목 | 상태 | 담당 |
|------|------|------|
| 주요 엔드포인트 s-maxage 설정 | ✅ PR #193 | FE/BE |
| snapshot tier 분리 | ✅ PR #187 | BE |
| Redis fixed $10 플랜 + bandwidth 관측 | ✅ 2026-04-16 | BE |
| CF Workers 크론 이전 | ✅ 2026-04-15~18 | BE |
| Vercel 자동 배포 봉인 (ADR-013) | ✅ | CPO |
| Edge Cache 히트율 실측 | ⏳ 본 문서 항목 A | FE/BE |
| DAU baseline 설정 | ⏳ 공개 직전 | PM |

---

## 과거 사고 기록 (학습용)

| 날짜 | 내용 | 재발 방지 |
|------|------|----------|
| 2026-04-09 | Playwright QA 후 브라우저 미종료 → **89GB/일 데이터 소모** | QA 종료 시 `browser_close` HARD RULE 추가 (CLAUDE.md) |
| 2026-04-15 | Upstash 한도 초과 | Fixed $10 + CF Workers 이전으로 해소 (2026-04-16) |
| 2026-03-29 | Vercel 빌드 한도 소진 우려 | ADR-013 — Git 자동 배포 봉인, workflow_dispatch 전용 |
