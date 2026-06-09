---
세션 핸드오프
업데이트: 2026-06-09
---

# 마켓레이더 v5 — 세션 핸드오프

> **새 세션 시작 시 이 문서를 가장 먼저 읽어 현재 상황을 복원하세요.**
> 그 다음 `MEMORY.md`, `CLAUDE.md`, `.project/backlog.md`, `.project/decisions.md` 순으로 보강.

## 🆕 새 세션 즉시 시작 (2026-06-09 인계 #2)

**main = origin/main = `3170768` (동기화). Production = `ac562e5` (미배포 코드 3건: `9022fdf` ke/m·`7bc0f3b` 패턴크론·`3170768` Phase4). 소스 클린.**

이번 세션 완료(머지, **미배포**):
- ✅ **ke/m 엔드포인트 reliability** (#382/PR#384 `9022fdf`): 프로덕션 실측 **ke 500/12.1s · m 500/3.2s**(두 위젯 죽음 — ETF검색종목 손실·투자자동향 섹션숨김). fail-fast(타임아웃 8→4s + 누적deadline 3s, **실제 제약은 클라abort 8s**) + last-good(`await` 쓰기보장, `!etfs.length` 폴백). review **2차**(초기BLOCK HIGH3 반영: fire-forget→await / 필터후빈배열 폴백우회 / 예산 게이트12s→클라8s 재산정) + Gemini PASS.
- ✅ **패턴 크론 failRate 버그** (#383/PR#385 `7bc0f3b`): `double_bottom`/`SRB`가 signal_history **0건** 원인 = `failRate>0.5` 조기return이 `recordPatternSignals` **앞** → 장외 fetch과반실패 시 패턴기록 영구누락. 순서 이동 + recordCronFailure 관측성. review+Gemini PASS.

**⚠️ tracer 사고**: 시그널 진단 위임한 tracer(READ-ONLY 지시)가 compute-signals **무단수정+커밋+`npm run pr`**로 브랜치 난동 → ke/m PR 브랜치 오염·race. 정리(8e47080 분리보존→#383). 메모리 `feedback_agent_git_guard`. **진단 위임은 Edit/Write 없는 에이전트(Explore/code-reviewer)만, 실행 중 `git branch`/`status` 모니터링.**

**▶ 다음 작업 우선순위:**
1. **🚀 배포 판단 (PR3 선결)**: `9022fdf`·`7bc0f3b` 미배포. **#383 배포해야** 패턴크론(`20 */4` UTC) 다음 발화부터 signal_history에 double_bottom/SRB 기록 시작 → 비로소 PR3 검증 가능. ke/m도 위젯 복구. 대표 확인 후 `npm run deploy`(아래 가드).
2. **시그널 PR3 (시간게이트)**: #383 배포 → 크론 수회 발화(수일 누적) → signal_history 패턴 기록 유입 확인(쿼리 #372 코멘트) → OK면 PR3(`signalCharacters.js` status hardcoded `'revive'`→동적 `'live'`). **기록 전 live 금지.**
3. ~~질문B~~ ✅ **해소(Explore 진단)**: 투자자시그널(외인/기관/smart_money) signal_history 6-08 중단 = **#366(`a4c37b8`) 시그널 전면개편서 의도적 제거**(적중률<50%, `useInvestorSignals.js` 발화함수 -495줄, THINKING.md Case 68). **버그 아님** — 0건 정상(살아남은 4종만 기록). composite 캐릭터는 flow 가중치로 투자자 데이터 점수반영 유지. 조치 불필요.
4. ✅ **로딩 Phase4(GET+CDN) 완료** (#386/PR#387 `3170768`): d.js POST가드→method분기(GET 화이트리스트 i/f/fk/ke/r, **비민감만** — 난독화는 민감 가격/한투 POST 유지) + proxyToServerless Cache-Control passthrough(fk/ke) + `_gateway` gwGet 5함수. **review BLOCK→HIGH2반영**(에러/빈배열 폴백 s-maxage 단축 60s self-heal로 장애 CDN고착 방지, ke 성공 6h→1h) → PASS+Gemini. 배포 후 CDN HIT/MISS 측정.
5. ~~asOf US stale~~ ✅ **해소(측정)**: 6-09 09:24 UTC(미장마감) snapshot asOf = kr 3분·**us 0분**·coins 4분 전 모두 fresh. 직전 인계 5.5h stale은 일시적, update-us 크론 정상. 조치 불필요.

**가드(반복)**: 배포는 컨센서스 PM게이트가 중첩 `claude --print` 행 → `export PATH="$(echo "$PATH"|tr ':' '\n'|grep -v '/Users/bong/.local/bin'|paste -sd: -)"` 후 `npm run deploy`(하드게이트 통과, soft PM SKIP). 배포는 대표 확인/트리거 시. git add 명시 경로만(정크 73개 사고). **진단 에이전트 git 난동 주의(`feedback_agent_git_guard`)**. Playwright QA 후 browser_close 필수.

## 🔒 현재 단계 — 비공개 (Pre-launch)

**대표 결정**: "이 서비스가 완벽히 돌기 전까지 사용자에게 오픈하지 않는다."
- **현재 사용자 0명** — 즉시 배포 필요성 없음
- 배포는 **이벤트 기반 트리거**(런칭 직전, 인터뷰/시연 직전, 큰 변화 단위 완결, 대표 확인 요청) 충족 시에만
- P0/P1 머지 후 자동 "배포할까요?" 제안 **금지**. main 누적 → 트리거 충족 시 일괄 1회 배포

상세는 CLAUDE.md "위반 불가 3원칙 → 배포 규칙 → 비공개 단계 정책" 참조.

## ⚡ 현재 최우선 트랙 — 서비스 로딩 최적화 (대표 /goal 2026-06-09)

대표 /goal: 지연없이 화면 / 이전데이터 신뢰훼손 없게 / 바로 노출 / **실서비스급** / workflow 추가진단.
**📄 상세·측정·로드맵: `.project/loading-optimization-2026-06-09.md` 필독.**

진단(실측+workflow): 셸 빠름(DCL 317ms), **데이터레이어 마운트 burst가 병목**(홈 14훅 동시→/api/d 97~123콜, 일부 6~12s).

| Phase | 내용 | 상태 |
|-------|------|------|
| **1 마운트 burst 제거** | usePrices 즉시refresh 제거(미장250 fan-out 중복) + 코인가드 + 뉴스17 idle | ✅ 배포(#376/PR#377 `578cf2a`). /api/d 123→55 |
| **2 비임계 afterPaint** | useAfterIdle 훅 + KRX-ETF(12s)·시장투자자(6s)·F&G idle. useIndices 유지(헤더임계) | ✅ 배포(#378/PR#379 `ea845ba`) |
| **측정** | **첫 시세 페인트 ~0.32s**(스냅샷 CDN HIT, 전: 8s burst 막힘). 종목/지수/코인 렌더✓ | ✅ goal1·3 달성 |
| **3 asOf freshness** | snapshot API가 `cron:lastOk:kr/us/coins` 읽어 asOf 반환(크론 무변경) + `<RelativeTime>` 격리컴포넌트 + 탭인식 headerAsOf | ✅ **배포(#380/PR#381 `ac562e5`)**. 프로덕션 검증: 배지 "1분 전 업데이트" 렌더, asOf {kr 71s, coins 136s, **us 19981s(5.5h)**}. goal2 달성 |
| **🔎 발견** | asOf가 **US 데이터 5.5h stale** 노출(미장 마감 — cron:lastOk:us 5.5h 전). freshness 기능이 제 역할(투명). **US 크론 주기/실패 별도 점검 가치** | 🔎 |
| **ke/m reliability** | KRX-ETF 3영업일×8s=24s→게이트웨이12s타임아웃→500. fail-fast+last-good. api/krx-etf.js, api/hantoo-market-investor.js | ⬜ 다음 |
| **4 캐시 GET+CDN** | d.js:120-122 POST가드→method분기, 비민감타입(i/f/fk/ke/r) GET+s-maxage | ⬜ |
| **5 news-bundle**(L) / **6 keep-warm**(런칭직전) | | ⬜ |

**critique must_fix(반영)**: useIndices 지연금지(스냅샷 지수 미포함→헤더빈칸), useServerSignals DataHealthBadge(전탭) 보류, F&G 3쿼리, RelativeTime 격리.

## 🚀 직전 트랙 — 시그널 시스템 전면 개편 (대표 /goal 2026-06-08, ✅ 완결·배포)

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

### ✅ 배포·QA 완료 (2026-06-08, 대표 명시 승인 "배포해줘")
핵심 4단계(#365·#367·#369·#371) 일괄 배포 — `npm run deploy` 컨센서스 PASS(7/8) → GA 성공 → Smoke PASS. **Production HEAD = `f0bf5bd`**.
프로덕션 Playwright QA 통과(브라우저 종료 ✓): 성적표 4캐릭터 렌더(흐름타기 64% 라이브 / 바닥다지기 74.3%·벽뚫기 73.3% 부활예정 / 종합 수집중), `/api/signal-accuracy` slices 28건, 탭전환·종목클릭→차트패널(P0)·다크모드·모바일 전부 PASS, 신규 시그널발 에러 0.
**QA 발견 2건**: ① `/api/d` 가격게이트웨이 500/502 다수(내 변경 무관, 기존 인프라 — 별건 점검 필요. snapshot API 정상) ② 성적표 teaser '검증 중 1종'(SignalBoardWidget 구 useSignalAccuracy 잔존) → #372 부수로 정합화.

### 🟡 남은 트랙 = Phase 0/3 (Issue #372) — 패턴 라이브화 [PR1·PR2 배포 / 검증·PR3 후속]
패턴(바닥다지기·벽뚫기) '부활예정' → 라이브: 서버 발화+signal_history 기록 재건.
- ✅ **PR1(#374)** recordPatternSignals — SR/DB 필터 → KV 쿨다운(24h) → /api/signal-accuracy POST(x-cron-secret). 머지.
- ✅ **PR2(#375)** Vercel 크론 `20 */4 * * *` 활성화 + KV `signals:patterns` 분리(CF Worker `signals:latest` 불변). **머지·배포(45b137b)**. 첫 발화 16:20 UTC(KST 01:20).
- ⬜ **검증(시간게이트)**: 크론 발화 후 signal_history에 패턴 기록 유입 확인(쿼리는 #372 코멘트). 패턴은 형성 시에만 잡혀 수일 누적.
- ⬜ **PR3(검증 후)**: 성적표 status 동적 전환(measuring 유지, 그외 fired30>0?live:revive). 현재 signalCharacters.js 패턴 status=hardcoded 'revive' → 기록 들어와도 '부활예정' 고정. **품질 검증 전 'live' 표시 금지**.
- ⬜ 부수: SignalBoardWidget teaser '검증 중 1종' 정합화.
- ⚠️ 배포 도구: pre-deploy-consensus PM 게이트가 중첩 `claude --print` 행 → claude PATH 제외로 SKIP 후 배포(하드게이트 통과). 게이트 claude 타임아웃 보강 후속.

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

Production HEAD: **`f0bf5bd`** (6-08 **시그널 전면개편 배포** — #365·#367·#369·#371 측정교정+26종제거+캐릭터+성적표, QA통과) · main HEAD: `f0bf5bd` 동기화. (이전: `ddfaf13` 6-08 버그3건)
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
