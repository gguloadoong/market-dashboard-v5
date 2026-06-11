---
세션 핸드오프
업데이트: 2026-06-11
---

# 마켓레이더 v5 — 세션 핸드오프

> **새 세션 시작 시 이 문서를 가장 먼저 읽어 현재 상황을 복원하세요.**
> 그 다음 `MEMORY.md`, `CLAUDE.md`, `.project/backlog.md`, `.project/decisions.md` 순으로 보강.

## 🆕 새 세션 즉시 시작 (2026-06-11 인계)

**main = `59b0546`+ (서비스 정상화 5트랙 전부 머지). Production = `fb9b97c` (6-09) — ⚠️ 5트랙 미배포, 배포 제안 디스코드 발신 후 대표 승인 대기 중.**

## ⚡ 현재 최우선 트랙 — 서비스 정상화 (대표 /goal 2026-06-10)

대표 /goal 10개 기준: ①진입 렉 ②죽은 시그널 ③서비스 본질 ④타이틀vs지금주목 ⑤시그널보드·성적표 명확화 ⑥과거시그널흐름 정리 ⑦'미국 시세 일부 지연' ⑧데드코드 제거 ⑨레이더 본질(잡주 제외) ⑩Fable5 활용.

**5트랙 전부 main 머지 완료 (2026-06-10~11):**

| 트랙 | PR | 내용 | 검증 |
|------|----|------|------|
| A 렉 (#394/PR#395) | 머지 | WS 틱 1초 코얼레싱(tickBuffer 유틸+테스트7) + 뉴스 매칭/시세 분리(TopNewsSection itemsKey/pctMap) + useIsMobile 렌더분기(이중 마운트 제거) + narrativeMap ref 분리. **근거: 프로덕션 실측(CPU4x) 메인스레드 ~85% 점유(20s 중 17.5s 롱태스크), CPU 프로파일 상위3함수=뉴스 키워드 매칭** | build/test PASS, **배포 후 재측정 필요(완료기준: 17.5s→2s 이하)** |
| D 지연배지 (#396/PR#397) | 머지 | us 폴링 250종→US_CORE_SYMBOLS(18)+watchlist(스냅샷 크론이 전종목 커버, fan-out 90%↓) + dataErrors 히스테리시스(연속2회 실패만 ON) | 〃 |
| B 시그널 (#398/PR#399) | 머지 | /api/signals가 signals:latest+signals:patterns **머지 서빙**(패턴이 보드에 표시되게) + 패턴크론이 composite 발화 기록(24h 쿨다운, firedAt meta, price>0 가드) + 크론 4h→**1h** + Hero n<30 적중률 게이트. review 3차(CRITICAL 이중기록/HIGH 중복카드/HIGH 가드회귀 반영) | **배포 후: /api/signals에 패턴 포함 + signal_history composite 유입 + `cron:summary:pattern-cron`의 compositeCandidates/recorded 확인** |
| C 정보구조 (#400/PR#401) | 머지 | SignalLabWidget(과거 시그널 흐름) **삭제**(구측정 23.3% vs 공정측정 64.1% 모순) + 적중률 표시 전면 **캐릭터(공정측정 v2) 단일화**(signalCharacterMap 유틸+테스트6, gate market/direction 매칭 — 비매칭 슬라이스 배지 없음) + 섹션 역할 1줄 라벨 + 잡주컷(CVR [WZRU]+contingent, SurgeBanner/탭타이틀 passesTurnoverFloor) + 헤더 freshness 최신마켓 기준 | 시안 디스코드 선공유 완료 |
| E 데드코드 (#402/PR#403) | 머지 | 고아 19파일(구 HomeDashboard 모놀리스, UnifiedFeedPanel, widgets 5종, no-op 훅 등) + CDS ThemeProvider(마지막 잔재) + 의존성 4종(@coinbase/cds-web·framer-motion·recharts·gh-pages, -185pkg) + 루트 정크. 번들 707→632KB. home-layout BANNED 9종 추가 | 정적+동적 import 전수 스캔 근거 |

**▶ 다음 작업 우선순위:**
1. **배포 (대표 승인 대기)** — 트리거 ③(큰 변화 단위 완결) 충족, 디스코드 제안 발신(2026-06-11). 승인 시 `npm run deploy` (PM게이트 행 시 PATH 가드 — 아래 참조)
2. **배포 후 검증 (필수)**: ① 렉 재측정 — Playwright CPU 4x 스로틀 20s 롱태스크 합 (전 17.5s → 목표 ≤2s) ② '미국 시세 일부 지연' 배지 미노출 + /api/d 502 감소 ③ /api/signals 응답에 double_bottom/SRB 포함 여부(패턴 형성 시) ④ 매시 20분 크론 후 `GET /api/ops/pattern-cron-status` → compositeCandidates>0·recorded 증가·postError:null ⑤ signal_accuracy_v2에 composite 표본 누적 시작 ⑥ 홈 전체 Playwright QA(탭·클릭·다크모드·모바일+browser_close)
3. **잔여(P2, 후속)**: fk Edge화 판단(Phase4 CDN), api/hantoo-market-investor.js 서버 표면 정리 판단(클라 소비자 0 — health-check 연동 확인 후), composite 표본 30건 도달 시 성적표 자동 라이브 전환 관찰(약 한 달)

**가드(반복)**: 배포는 컨센서스 PM게이트가 중첩 `claude --print` 행 → `export PATH="$(echo "$PATH"|tr ':' '\n'|grep -v '/Users/bong/.local/bin'|paste -sd: -)"` 후 `npm run deploy`. git add 명시 경로만. Playwright QA 후 browser_close 필수. 진단 에이전트 git 난동 주의(`feedback_agent_git_guard`).

## 🔒 현재 단계 — 비공개 (Pre-launch)

**대표 결정**: "이 서비스가 완벽히 돌기 전까지 사용자에게 오픈하지 않는다."
- 사용자 0명 — 머지는 자율, 배포는 이벤트 트리거+대표 확인 시 일괄 1회
- P0/P1 머지 후 자동 "배포할까요?" 제안 금지 (이번 배포 제안은 트리거 ③ 충족에 따른 것)

상세는 CLAUDE.md "위반 불가 3원칙 → 배포 규칙 → 비공개 단계 정책" 참조.

## 📌 직전 트랙 이력 (압축)

- **시그널 전면 개편 (6-08, 배포완료)**: 38%는 측정버그 → fair-hit v2, 26종 제거(KEEP4), 4캐릭터 성적표. `.project/signal-overhaul-2026-06-08.md`
- **패턴크론 무기록 수정 (6-09, 배포완료)**: self-POST 인증벽+이름충돌 → #390 직접 RPC, recorded:28 검증, #392 성적표 동적 live. `pattern-cron` 키 분리.
- **로딩 최적화 (6-09, 배포완료)**: 마운트 burst 제거+afterPaint+asOf+GET/CDN. 첫 페인트 0.32s. `.project/loading-optimization-2026-06-09.md`
- ⚠️ **위 "로딩 최적화"는 첫 페인트만 고침** — 대표 체감 렉의 진짜 원인은 steady-state 리렌더 폭풍이었고 이번 Track A가 해결 (배포 후 검증).

## 🚫 절대 금지 (이번 단계 가드)

| 금지 | 출처 |
|------|------|
| 자동/임의 배포 실행 | CLAUDE.md 배포 규칙 |
| 관심종목 중심 시안 (Watchlist-First) | 대표: "AI들이 자꾸 빠지는 함정" |
| "흡수/통합/모핑/결합/포함" 단어 게임 | Phase 12 함정 |
| 카드 동질화 6개 양산 / referent 기생(토스 등) | Phase 12 사후평가 |
| n<30 표본 적중률 노출 / raw 측정 부활 | #400 측정 단일화 (quality-baseline) |
| 영구삭제 컴포넌트 재추가 | HOME_CONTRACT.md + home-layout.test (BANNED 14종) |
| Codex CLI / `npm run dev` / `git add -A` / Playwright 미종료 | 메모리 |

## 🤝 합의된 본질 (보존)

> **"이 앱을 켜면, 시장 이상 신호 + 그게 내게 의미하는 것이 3초 안에 보인다."**
> 마켓레이더 = 시장을 탐색하며 신호를 잡아 제공하는 **레이더** (대표 /goal 기준 9).
- 단일 정답 X · 시각화된 시장 심박수 O · "3시장 통합"이 진짜 무기
- 측정 주장은 공정측정(v2) 단일 기준 — 못 넘는 신호는 띄우지 않는다
