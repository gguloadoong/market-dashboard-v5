---
세션 핸드오프
업데이트: 2026-06-01
---

# 마켓레이더 v5 — 세션 핸드오프

> **새 세션 시작 시 이 문서를 가장 먼저 읽어 현재 상황을 복원하세요.**
> 그 다음 `MEMORY.md`, `CLAUDE.md`, `.project/backlog.md`, `.project/decisions.md` 순으로 보강.

## 🔒 현재 단계 — 비공개 (Pre-launch)

**대표 결정**: "이 서비스가 완벽히 돌기 전까지 사용자에게 오픈하지 않는다."
- **현재 사용자 0명** — 즉시 배포 필요성 없음
- 배포는 **이벤트 기반 트리거**(런칭 직전, 인터뷰/시연 직전, 큰 변화 단위 완결, 대표 확인 요청) 충족 시에만
- P0/P1 머지 후 자동 "배포할까요?" 제안 **금지**. main 누적 → 트리거 충족 시 일괄 1회 배포

상세는 CLAUDE.md "위반 불가 3원칙 → 배포 규칙 → 비공개 단계 정책" 참조.

## 🎯 현재 최우선 트랙 — 데이터 신뢰 회복

대표 명시: "데이터가 올바르게 나와야 그 다음이 디자인이 맞다." **디자인 사이클은 보류**.

## ✅ 직전 사이클 main 머지 (배포는 묶음 대기)

| PR | 내용 | 상태 |
|----|------|------|
| `#336 (#333)` marketHours 세션 정상화 | 국장 NXT + 미장 데이마켓 라벨 | 배포 완료 (5-27) |
| `#337 (#335)` 주도주 알고리즘 + 모핑 포커스 UI | Phase 12 | 배포 완료 (5-27) |
| `#338 (#334)` 네이버 비공식 프록시 | 미장 프리/애프터 + NXT 참고가 | 배포 완료 (5-28) |
| `#340 (#339)` 우측 실시간 피드 패널 제거 | 대표 피로감 호소 | 배포 완료 (5-30) |
| `#342 (#341)` 공포탐욕 가짜 종목 카드 차단 | P0 신뢰 7종 필터 | 배포 완료 (5-30) |
| `#347 (#346)` 가짜 종목 잔존 2건 fix | REBALANCING_ALERT + UnifiedFeedPanel 가드 + a11y | main 머지·배포 대기 (6-01) |
| **`#348 (#343)` 시그널 kind 도메인 분리** | SIGNAL_KIND 단일소스+IIFE 완전성검증+종목풀 런타임 검증 drop | **main 머지·배포 미룸 (6-01)** |

Production HEAD: `8515985` (5-30) · main HEAD: `803dd56` (#347+#343+#344 누적·미배포)

## 🟡 진행 중·대기 트랙

### 트랙 1 — 데이터 신뢰 (P0/P1 묶음 배포 대상)
- ✅ `#346/#347` P0 가짜 종목 잔존 fix (main 머지, 배포 대기)
- ✅ `#343/#348` P1 시그널 kind 도메인 분리 (main 머지 `9b73c00`, 배포 대기) — `SIGNAL_KIND`(type→stock|market) 단일소스 + 로드타임 IIFE 완전성검증 + `resolveStockItem` 종목풀 런타임검증(crypto→coin 정규화). 봇리뷰 5건(Copilot 채택1/기각4) + 자체 review:code HIGH 3건(crypto정규화·매칭이중화·거짓로딩) 수정. test 232 passed
- ✅ `#344/#349` US marketCap 폴링 머지 가드 (main 머지 `803dd56`, 배포 대기) — **진단 정정**: 원인은 us-price가 아니라 usePrices 머지가 스냅샷 marketCap(update-us NASDAQ 수집)을 0으로 덮음. 1줄 가드. **P1→P3 강등**(내부 스코어링 입력, 화면 비노출, Phase 12 주도주 본질은 디자인 트랙)
- 🔄 **`#345` P2 묶음 6건** (다음 작업 — NaN/null 처리, news boundary, FUNDING_RATE 코인 클릭 차단 등)
- 🟠 신규 부채 (2026-06-01 발견): ① Codex pre-push 훅 잔존(ADR-020 위반, `SKIP_CODEX_REVIEW=1` 우회 중) ② UnifiedFeedPanel(비활성) 재활성 시 풀검증+type 전달 ③ pre-deploy-consensus.sh가 test 실패를 경고만(게이트화 필요) — 별도 정리 이슈 후보

### 트랙 2 — 디자인 방향 (보류)
영감 4개 보존 위치: `.project/inspirations-discovery-2026-05.md`
| 메타포 | 본질 | 공수(FE+BE) | 위험 |
|--------|------|------------|------|
| 🎙️ 라디오 DJ | 보여주지 마라, 말해줘라 | 6~8주 | DJ 멘트 신뢰성 |
| 🚨 응급실 트리아지 | 정보→명령, 어제의 처치 결과 | 4~5주 | RED 인플레이션 |
| 📖 매거진 1면 | VOL.142, 57% 여백 | 3~4주 | 표지 다양성 |
| 🗺️ 게임 미니맵 | 사진→동영상, 시장 간 전염 | 8~10주 | 학습 비용 |

데이터 신뢰 트랙 완료 + 대표가 디자인 사이클 재개 지시 받으면 진행. 4개 단독 또는 다른 비금융 도메인 영감 추가 가능.

## ⚠️ Phase 12 사후평가 — 절대 잊지 말 것

**대표 평가 (직전 사이클 배포 결과)**: "본질 모르겠다, UI/UX 최악"

4직군 + Gemini 합의:
1. **"5섹션화" = 거짓 회계** — production은 사실상 8섹션
2. **"흡수/통합/모핑/결합/포함" 단어 게임 = 함정** — 등장 시 즉시 회의 중단
3. **첫 1뷰포트(375×667)는 100% 커맨드센터 단독 점유** — 본질 0%
4. **6개 카드 동일 클래스** `bg-white rounded-2xl p-5` — 시각 위계 0
5. **"이건 리디자인이 아니다" 문장 = 함정 신호**

## 🚫 절대 금지 (이번 단계 가드)

| 금지 | 출처 |
|------|------|
| **P0/P1 머지만으로 "배포할까요?" 자동 제안** | 비공개 단계 정책 (2026-06-01) |
| **자동/임의 배포 실행** | CLAUDE.md 배포 규칙 |
| 관심종목 중심 시안 (Watchlist-First) | 대표 명시: "AI들이 자꾸 빠지는 함정" |
| "흡수/통합/모핑/결합/포함" 단어 게임 | Phase 12 함정 재현 |
| 토스·Robinhood·Coinbase·Bloomberg referent 기생 | Gemini 외부 비판 |
| 카드 동질화 6개 양산 | FE 측정: 위계 무력화 원인 |
| "이건 리디자인이 아니다" 자기최면 | Phase 12 거짓 회계 신호 |
| Codex CLI / Codex Gate | 메모리 `feedback_no_codex` |
| `npm run dev` 로컬 dev 서버 | 메모리 `feedback_no_local_dev_server` |
| `git add -A` | 메모리 `feedback_no_git_add_all` (정크 73개 사고) |
| Playwright 브라우저 미종료 | 메모리 `feedback_playwright_cleanup` (89GB/일 사고) |

## 🤝 합의된 본질 (보존)

> **"이 앱을 켜면, 시장 이상 신호 + 그게 내게 의미하는 것이 3초 안에 보인다."**

- 4직군 + Gemini 일치
- 단일 정답 X · 시각화된 시장 심박수 O
- "3시장 통합"이 진짜 무기 — 지금은 병렬 배치, 통합 아님

## 📋 다음 세션 권고 시작 순서

1. **이 핸드오프 정독** (지금)
2. `MEMORY.md` 인덱스 + 관련 메모리 (특히 `feedback_watchlist_secondary`, `project_phase12_situational_focus`, `project_pre_launch_deploy_policy`)
3. `.project/backlog.md`, `.project/decisions.md`, `.project/quality-baseline.md`
4. 디자인 트랙은 대표 재개 지시 시까지 보류
5. **다음 권고 작업**: `#345` P2 정합성 6건 묶음 (데이터 신뢰 트랙 마지막). #343·#344 완료됨
6. #345 완료 → 데이터 신뢰 트랙(#343+#344+#345) 완결 → 배포 제안(트리거+대표 확인). 현재 미배포 8커밋 누적

## 🔎 데이터 정합성 점검 결과 (2026-06-01)

executor 정밀 점검으로 9개 결함 발견·분류:

| 분류 | 코드 | 결함 | 상태 |
|------|------|------|------|
| P0 | 1-A | REBALANCING_ALERT 'MARKET' 가짜 종목 | ✅ #346/#347 fix |
| P0 | 1-B | UnifiedFeedPanel 가드 누락 (FX_IMPACT 'USDKRW' 등) | ✅ #346/#347 fix |
| P1 | 2-D | us-price marketCap=0 (실제 원인: usePrices 머지가 스냅샷값 덮음) | ✅ #344/#349 |
| P2 | 2-A | App.jsx 탭 정렬 `?? 0` | 🟡 #345 |
| P2 | 2-B | MarketSummaryBar/NewsSidePanel ₩0/$0 노출 | 🟡 #345 |
| P2 | 2-C | priceAlert ₩0 발화 | 🟡 #345 |
| P2 | 3-A | newsAlias getMatchConfidence substring | 🟡 #345 |
| P2 | 3-C | FUNDING_RATE_EXTREME 코인 클릭 차단(#341 부작용) | 🟡 #345 |
| P2 | 3-D | useServerSignals stale 노출 | 🟡 #345 |

세부는 #344, #345 GitHub Issue 본문 참조.

## 🔄 작업 진행 워크플로 (B 경량화 적용 — 2026-06-01, 상세는 CLAUDE.md PR 절차)

1. 이슈 → 브랜치(`feature/#N-설명` or `fix/#N-설명`) → 커밋 (push 불필요 — `npm run pr`이 자동 push)
2. `npm run review:code` (Opus 1회) — BLOCK 시 HIGH/CRITICAL만 수정, STYLE·논쟁·사전검토 항목은 1회 기록 후 진행(비결정성 무한루프 방지)
3. 알고리즘 파일(`.algo-files`) 변경 시**만** `npm run architect` 필수 (그 외 스킵)
4. `npm run pr "제목"` — 자동 push + 빌드 + 게이트 + Gemini gate + PR 생성 (비공개 단계: **봇 폴링 생략**, 봇은 사후 참고)
5. 사전 게이트(architect+review:code+Gemini) PASS면 **머지**(자율). 봇 안 기다림 — 런칭 시 `WAIT_BOTS=1 npm run pr`
6. 사소 수정(주석/문서, 코드 로직 무변경)은 게이트 재실행 **스킵**
7. **배포는 트리거 충족 + 대표 확인 시에만** (P0/P1 머지만으로 자동 제안 금지)
