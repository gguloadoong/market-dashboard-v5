---
소유자: 장성민 (QA)
마지막 업데이트: 2026-03-28
---

# 마켓레이더 품질 기준선 (Quality Baseline)

> **래칫 규칙:** 이 기준선은 단조 증가/향상만 허용한다. 한번 올라간 품질은 절대 내려가지 않는다.
> 위반 감지 시 → P0 Issue 즉시 생성 → 모든 신규 작업 중단 → 복구 후 baseline 갱신.

---

## 빌드 & 코드 품질

| 항목 | 현재 기준 | 위반 시 우선순위 |
|------|----------|----------------|
| `npm run build` 에러 | 0개 | P0 즉시 수정 |
| TypeScript 에러 (`tsc --noEmit`) | 해당 없음 (JS 프로젝트) | — |
| ESLint 에러 | 0개 | P1 |
| `npm audit` critical/high | 0개 | P0 즉시 패치 |
| 번들 사이즈 (gzip 기준) | 750KB 이하 (CDS 제거 후 기준선) | P2 |
| 번들 사이즈 증가 | 전주 대비 +10% 초과 시 정당화 필요 | P2 |

---

## 데이터 정확도

| 항목 | 현재 기준 | 위반 시 우선순위 |
|------|----------|----------------|
| 미장 가격 changePct | ≠ 0 (장 중 기준) | P0 |
| 미장 sparkline | 10개 이상 | P1 |
| 국장 가격 changePct | ≠ 0 (장 중 기준) | P0 |
| 코인 change24h | ≠ 0 | P0 |
| 지수 (KOSPI/SPX/NDX/DJI) | 4개 이상 응답 | P0 |
| 환율 KRW/USD | 1200 ~ 1700 범위 | P1 |
| API 응답 시간 `/api/us-price` | 10초 이내 | P1 |
| API 응답 시간 `/api/market-indices` | 8초 이내 | P1 |

---

## UI 상태

| 항목 | 현재 기준 | 위반 시 우선순위 |
|------|----------|----------------|
| 화면 깨짐 | 0건 | P0 즉시 수정 |
| 빈 상태 UI | 모든 섹션 에러 메시지 표시 | P1 |
| 모바일 가로 스크롤 | 없음 | P1 |
| 섹터 탭 이동 | 버튼 클릭 시 정상 이동 | P1 |
| ChartSidePanel 오픈 | 종목 클릭 시 정상 오픈 | P0 |

---

## API Fallback 체인

| API | 단계 수 | fallback 순서 | 실패 기준 |
|-----|--------|--------------|---------|
| 미장 가격 | **6단계** | Yahoo v8 → Yahoo v7 → Stooq → Alpaca → 네이버 해외시세 → 캐시 | 전체 실패 시 P0 |
| 국장 가격 | **3단계** | 한투 Open API → Naver KRX → 캐시 | 전체 실패 시 P0 |
| KOSPI 지수 | 2단계 | Stooq (병렬 레이스) → Yahoo v8 | 둘 다 실패 시 P0 |
| ETF 가격 | 1단계 | 한투 / fetchEtfPricesBatch | P1 |
| 코인 | **4단계** | Upbit WebSocket → REST → Bithumb → 캐시 | P0 |
| 뉴스 | 1단계 | RSS 프록시 (`/api/rss`), 소스 10개+ | P2 |
| API 게이트웨이 | — | `/api/d` 단일 게이트웨이 (난독화) | P0 |
| 한투 토큰 | — | Upstash Redis 캐시 (TTL 자동 갱신) | P1 |

---

## 배포

| 항목 | 기준 |
|------|------|
| Production 배포 방식 | GitHub main 머지 → 자동 배포만 |
| `vercel --prod` CLI 수동 호출 | 절대 금지 |
| Vercel 플랜 | Pro (2026-03-28 전환 완료) |
| Vercel Preview 배포 | 비활성화 (2026-03-25 설정 완료) |
| Vercel ignoreCommand | 정상 (2026-03-28 PR #194 수정 완료) |
| 배포 전 빌드 검증 | `npm run build` 통과 필수 |

---

## PR 리뷰 체계

| 단계 | 방식 | 기준 |
|------|------|------|
| 1단계 — 독립 리뷰 | `code-reviewer` 에이전트 | 크리티컬/버그 수정 후 통과 필수 |
| 2단계 — Codex gate | Codex CLI 정적 분석 | 보안·타입 오류 0건 |
| 3단계 — Gemini Code Assist | 자동 봇 리뷰 | 보안/버그 지적 시 수정 |
| 4단계 — CodeRabbit | 자동 봇 리뷰 | 보안/버그 지적 시 수정 |
| 5단계 — GitHub Copilot | 자동 봇 리뷰 | 참고 |
| 채택/기각 근거 | PR 본문 "리뷰 종합" 섹션 | 봇 제안 최소 1건 채택/기각 근거 필수 |

---

## 기준선 이력

| 날짜 | 변경 내용 | 담당 |
|------|----------|------|
| 2026-03-25 | 초기 기준선 수립 | 장성민 |
| 2026-03-25 | 미장 Yahoo v8 전환으로 sparkline 기준 추가 | 장성민 |
| 2026-03-25 | Vercel Preview 배포 비활성화 기준 추가 | 장성민 |
| 2026-03-25 | ESLint 에러 104개 → 0개 달성 (eslint.config.js api/src 분리 + 16파일 수정) | 장성민 |
| 2026-03-28 | 번들 기준선 750KB 설정 (CDS 361KB 제거 후, PR #186) | 장성민 |
| 2026-03-28 | 미장 fallback 6단계로 상향 (네이버 해외시세 추가, PR #193) | 장성민 |
| 2026-03-28 | API 게이트웨이 /api/d 난독화 + 한투 토큰 Redis 캐시 기준 추가 (PR #193) | 장성민 |
| 2026-03-28 | Vercel Pro 전환 + ignoreCommand 정상화 기준 추가 (PR #194) | 장성민 |
| 2026-03-28 | PR 리뷰 체계 5중 구조 수립 (code-reviewer + Codex + Gemini + CodeRabbit + Copilot) | 장성민 |

---

## 인프라 헬스

| 항목 | 기준 | 위반 시 우선순위 |
|------|------|----------------|
| Redis 연결 상태 | ping 응답 정상 | P0 |
| 크론 데이터 freshness | coins < 3분, kr < 10분, us < 5분 | P0 |
| 배포 후 smoke test | snapshot API 200 + 비어있지 않은 배열 | P0 |
| API 5xx 에러율 | < 1% (24시간 기준) | P1 |
| 환경변수 필수 목록 | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN 존재 | P1 |
