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

## 🚀 현재 최우선 트랙 — 시그널 시스템 전면 개편 (대표 /goal 2026-06-08)

대표 /goal: "죽은 시그널 봇·알고리즘 다 제거, 적중률 50%+ 시스템 전면개편, 캐릭터 <5, 성적표 노출, 단순 지표조합 금지, 우리만의 노하우." **workflow 활용.**

**📄 전체 분석·설계·단계: `.project/signal-overhaul-2026-06-08.md` 필독.**

데이터 포렌식 결론: **신뢰도 38%는 대부분 측정 artifact.** 공정측정 시 엣지 실재(but 거품 빼면 55~66%):
- volume_anomaly **1h fair ~62~64%**(kr상승·us 양방향, ALIVE, 대표본) = 인프라 재건 없이 출시 가능한 유일 견고 캐릭터(흐름타기)
- double_bottom 24h **66%(us)~94%(kr)** 강하나 **`last_30d_fired=0` 사망**(서버 미발화·미기록) → 인프라 재건 필요
- tsb 5봇(별도 프로젝트)도 50% 미만 → 도입 안 함

| Phase | 내용 | 상태 |
|-------|------|------|
| **1 측정 교정** | `signal_accuracy_v2` fair-hit 노이즈밴드 + (type,market,direction) 슬라이스 + 30일창제거 + last_30d_fired | ✅ **완료·머지** (#364/PR#365 `282394a`, Supabase 뷰 적용·검증) |
| **2 사망 제거** | 26종 6-슬롯 원자 제거(−2474줄, KEEP4+공유 THRESHOLDS·taCalculator 보존). composite는 라이브 브릿지로 보류 | ✅ **완료·머지** (#366/PR#367 `a4c37b8`, test 246·build 0·architect/review/gemini 3게이트 PASS, SIGNAL_TYPES 30→4) |
| **5 성적표 UI** | SignalScorecardTab in-place 교체 — 4캐릭터 카드(공정적중률+표본+status배지, measuring 적중률숨김, revive '30일미발화'). 카테고리칩/전체평균바 제거 | ✅ **완료·머지** (#370/PR#371 `4e6b85e`, 시안 디스코드 선공유, test256·build0·review/gemini PASS). **미배포** — 배포는 대표 확인 시 |
| **4 캐릭터 레이어** | signalCharacters.js(4캐릭터+5개미만가드) + api `slices`(v2) 노출 + useSignalCharacters 파생집계(eval가중 fair_acc, status별 처리) | ✅ **완료·머지** (#368/PR#369 `d392821`, test 256·build 0·review PASS, 발화 무변경) |
| **0/3 인프라 재건** | ⚠️핵심·최대공수(수주) — 서버 double_bottom·SRB 발화 + Supabase 직접 기록(loadSignals _recordForAccuracy 스킵 TODO #215, CF Workers 50 subrequest 한도). LIVE 패턴 성적표 전제 | ⬜ |

**캐릭터 확정(v2 실측 근거)**: 🌊흐름타기=volume_anomaly kr-bullish 1h **64%(n997, 라이브)** / ⛏️바닥다지기=double_bottom 24h us66%·kr94%(사망·부활) / 🧱벽뚫기=SRB 24h us64%·kr74%(사망·부활) / 🎯종합=composite(라이브·미측정). us volume 1h는 표본부족(n13)이라 비노출. fader(국장 하락 fade 56%)는 모뎀이라 보류.

**제거맵·측정스펙·캐릭터설계·critique 전문**: 워크플로우 산출 `/private/tmp/.../tasks/wfsm3bfxg.output` 또는 설계문서 참조.
**critique must_fix(반영)**: ①패턴 사망=인프라재건 ②서버시그널 미기록 ③뷰 슬라이스(Phase1 흡수) ④역전수학 비엄밀(재측정 완료, fade는 56% 모뎀).
**가드**: 적중률 주장은 정직하게(예비추정 표기), 50% 못넘으면 probation/phase2. coin double_bottom 100%는 단위버그(>500% 제외 후 n=11).

## 🎯 직전 트랙 — 데이터 신뢰 회복 (완결)

대표 명시: "데이터가 올바르게 나와야 그 다음이 디자인이 맞다." **디자인 사이클은 보류**.

## ✅ 2026-06-08 사이클 — 대표 보고 버그 3건 수정·배포 완료 (`ddfaf13`)

대표 보고: ① 데스크톱 뉴스 안 나옴 ② PC가 모바일뷰처럼 보임 ③ 하락장 미반영. 원인규명→수정→배포→프로덕션 검증 완료.

| PR | 이슈 | 내용 |
|----|------|------|
| #354 | #353 | **뉴스 증발 + PC 단일컬럼 회귀** — #340이 App.jsx 2단 grid 제거 + NewsFeedWidget lg:hidden 잔존. 2단 grid 복원 + 우측 정적 뉴스 레일(스트리밍 패널 아님 — #339 피로감 결정 존중) |
| #356 | #355 | **하락장 데이터 정합성** — (A)미장 워런트 도배 name 필터 (B)투자자동향 Naver `/investors`→`/trend` 404 복구(수급 bearish 시그널 부활, 수량×종가=금액 근사) |
| #359 | #358 | **시장 레짐 배지(C-1)** — 주식지수 평균으로 하락장/혼조/상승장 배지(커맨드센터+모핑포커스). 대표 시안 승인. ADR-002 색(하락=파랑). 알고리즘 무변경 |
| #361 | #360 | **워런트 필터 보강** — #355 name필터 불완전(CORZW name="Core Scientific, Inc." 기초기업명과 동일) → 티커 규약 `/^[A-Z]{4}[WZ]$/`(Nasdaq 5번째 글자) |
| #363 | #362 | **탭 타이틀 워런트 누수** — 타이틀 useEffect가 미필터 usStocks 사용 → usStocksVisible로 교체 |

프로덕션 검증(`ddfaf13`): 2단 레이아웃✓·뉴스레일✓·레짐배지[▼하락장-3.8%]✓·투자자동향 200(외인 -1.4조 순매도)✓·워런트 DOM 0건✓·탭타이틀 정상(알트+30%)✓.

**열린 후속**: `#357` worker(compute-signals.js/update-us.js 동일 404 URL + 워런트 universe — **CF Workers 별도 배포 필요**). C-2(하락장 시 급락 기본뷰)는 대표 보류. 워런트 티커 필터에 화이트리스트 탈출구 부재(저위험, FP 시 추가 검토).
architect 설계 보존: `.tmp/issue3-design.md`.

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

Production HEAD: `ddfaf13` (6-08 **배포 완료** — #353·#355·#358·#360·#362 / 뉴스·레이아웃 회귀 + 데이터정합성 + 레짐배지) · main HEAD: `ddfaf13` (동기화)
(이전: `096691b` 6-02 데이터 신뢰 트랙)

## 🟡 진행 중·대기 트랙

### 트랙 1 — 데이터 신뢰 ✅ **완결 · 배포 완료** (2026-06-02 `096691b`)
- ✅ `#346/#347` P0 가짜 종목 잔존 fix — **배포 완료**
- ✅ `#343/#348` 시그널 kind 도메인 분리 (SIGNAL_KIND 단일소스 + IIFE 완전성검증 + 종목풀 런타임검증, crypto→coin 정규화) — **배포 완료**
- ✅ `#344/#349` US marketCap 폴링 머지 가드 (진단정정: usePrices 머지가 스냅샷값을 0으로 덮음, 1줄 가드, P3 강등) — **배포 완료**
- ✅ `#345/#352` 정합성 P2 6건 (finite 4건 + newsAlias boundary + FUNDING 클릭예외, test 243) — **배포 완료**
- 🟠 잔여 부채 (정리 이슈 후보): ① Codex pre-push 훅 잔존(ADR-020 위반, `SKIP_CODEX_REVIEW=1` 우회) ② UnifiedFeedPanel(비활성) 재활성 시 풀검증+type ③ pre-deploy-consensus.sh test 실패 경고만(게이트화) ④ usePrices marketCap는 스냅샷 의존(스냅샷 장애 시 0)
- **➡️ 다음 작업 = 트랙 2 디자인 시작** (대표 지시 받음 2026-06-05) — 아래 "다음 세션 권고 시작 순서" 참조. 잔여 부채는 디자인 사이클 사이에

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
4. 데이터 신뢰 트랙(#343·#344·#345) ✅ **완결·배포 완료** (`096691b`, 2026-06-02). 프로덕션 QA 통과(데이터 신뢰 검증 OK, UI 인터랙션은 MCP 1s timeout으로 미검증 — 다음 기회에)
5. **다음 권고 작업 = 트랙 2 디자인 시작** (대표 지시 받음 2026-06-05). 진행 순서:
   - ① `.project/inspirations-discovery-2026-05.md` 정독 (영감 4개: 🎙️라디오DJ / 🚨응급실 / 📖매거진 / 🗺️게임미니맵)
   - ② `designer`(opus) 에이전트로 영감 4개 평가 → 방향 1개 선택
   - ③ **텍스트 시안 먼저 대표 확인** (`feedback_ui_mockup_before_impl` — UI 변경 전 시안 필수)
   - ④ 확인 후 구현
6. ⚠️ 디자인 가드 (위 "Phase 12 사후평가" 정독 필수): 단어게임(흡수/통합/모핑)·카드 동질화 6개·referent 기생(토스/Robinhood/Coinbase)·watchlist-first **금지**. `.project/wireframes/`는 Phase 8 **기각안**이니 참고만, 재사용 금지

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
