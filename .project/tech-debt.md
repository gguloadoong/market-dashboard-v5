---
담당: 박서연 (Staff FE)
마지막 업데이트: 2026-04-18
---

# 기술 부채 목록

## 🔴 P0 — 즉시 처리 필요

현재 없음 ✅

---

## 🟡 P1 — 다음 스프린트

| 파일 | 내용 | 등록일 |
|------|------|--------|
| `api/cron/update-kr.js` | 한투/Naver 개별 fallback 61종목 제한 — KRX+Naver 전종목 모두 실패 시 `HANTOO_NAME_MAP` 61종목(KOSPI 50+KOSDAQ 10+ETF 1)만 스냅샷 저장. 1~2순위 정상 시 ~4000종목 커버되므로 P1 유지 | 2026-04-04 |
| `scripts/pre-deploy-consensus.sh` | Reviewer Loop Deadlock — Opus PASS + Codex BLOCK 충돌 시 중재 규칙 없음 (Issue #38) | 2026-04-04 |
| `scripts/review-summary.sh` | Codex gate 재실행 시 스테일 artifact 잔존 가능 (Issue #39) | 2026-04-04 |
| `.git/hooks/pre-push` | v5에 pre-push hook 없음 — `npm run pr` 우회 시 Codex gate/code-review 검증 전부 스킵 가능. v2에는 있었으나 v5 마이그레이션 시 누락. PR #42가 Codex gate 없이 머지된 원인 | 2026-04-06 |
| `api/krx-etf.js` | 2s 타임아웃 공격성 모니터링 — Codex P2 재지적 (Issue #143 기각). 설계 근거: 5영업일 × 2s = 10s ≤ gateway 12s (#115 15s hang 방지). 실패 시 Edge cache(s-maxage=3600) + 빈 ETF graceful fallback. 프로덕션 KRX p95 응답시간 확인 후 3s 상향 여부 재판단 | 2026-04-18 |

---

## 🟢 P2 — 백로그

현재 없음 ✅

---

## ✅ 해결 완료

| 날짜 | 파일 | 내용 |
|------|------|------|
| 2026-03-17 | `src/components/` | 죽은 파일 13개 삭제 (HomeTab, StockModal, StockRow, StockCard, SortFilter, IndexSummary, NewsSection, KoreanTab, UsTab, CoinTab, EtfTab, AllTab, NewsTab) |
| 2026-03-17 | `WatchlistTable.jsx` | `key={activeTab}` — 탭 전환 시 filter/search/sector 상태 초기화 |
| 2026-03-17 | `WatchlistTable.jsx` | `Math.abs()` 제거 — changePct 방향성 정렬 복구 |
| 2026-03-17 | `hooks/useNewsQuery.js` | `useStockNews` 반환 타입 배열 → `{news, isLoading}` 객체 |
| 2026-03-17 | `api/stocks.js` | `fetchStooqKospi` Prev_Close 필드 기반 전일 종가 대비 등락 계산 |
| 2026-03-17 | `App.jsx` | `allData={{ krStocks, usStocks, coins, etfs }}` — etfs 포함 |
| 2026-03-17 | `api/whale.js` | USD→KRW 환율 1300 하드코딩 제거 → setWhaleKrwRate() 동적 주입 |
| 2026-03-17 | `api/coins.js` | fetchCoins() sector + market='coin' 필드 추가 |
| 2026-03-17 | `data/mock.js` | COINS_INITIAL change24h 모두 0으로 초기화 — 초기 가짜 급등 신호 방지 |
| 2026-03-18 | `SurgeBanner.jsx` | `key={i}` → `key={i}-${symbol}` — React reconcile 오류 수정 |
| 2026-03-18 | `src/utils/priceAlert.js` | checkAndAlertBatch 관심종목 필터 추가 — 전체 종목 알림 스팸 방지 |
| 2026-03-26 | `NewsSidePanel.jsx` 등 | CDS 번들 361KB 전체 제거 — TabbedChips/Button/Table 직접 구현으로 교체 |
| 2026-03-27 | `api/cron/update-us.js` | Yahoo v7 → v8 chart API 교체 — Vercel Edge(icn1) 차단 해소 |
| 2026-03-28 | `api/_price-cache.js` | Upstash Redis 스냅샷 캐시 도입 — 첫 로딩 mock 0% → 실시간 <100ms |
| 2026-03-28 | `src/data/mock.js` | 전체 [] 빈 배열 — mock 완전 제거, 실시간 데이터 전환 완료 |
| 2026-03-28 | `vercel.json` | ignoreCommand "exit 0" 확정 — 수동 배포 게이트 운영 (ADR-013) |
| 2026-04-04 | `api/kr-fear-greed.js` | fetchForeignNetNaver dead code 제거, 14일 윈도우 확장, VKOSPI fallback 경고 로그 추가 (PR #37) |
| 2026-04-04 | `scripts/pre-deploy-consensus.sh` | PM nonce 인젝션 차단, Gate5 ancestor 검색, gh set-e 방지 (PR #37) |
| 2026-04-08 | `src/data/relatedAssets.js` + `NewsSidePanel.jsx` | Stage 3 섹터 확장 `Object.entries` 전수 순회 → `SECTOR_SYMBOL_INDEX` 역인덱스 Map O(1) 조회로 교체 |
| 2026-04-08 | `api/cron/update-us.js` | Yahoo v8 per-symbol 병렬화 — `CONCURRENCY=30` 배치 + `Promise.allSettled`로 이미 구현 완료 확인. 추가 작업 불필요 |
