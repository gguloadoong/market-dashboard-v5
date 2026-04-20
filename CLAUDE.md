# 프로젝트 지침

이 프로젝트는 국장·미장·코인 실시간 시세 모니터링 웹앱이다.

**세션 시작 시 필수 순서**:
1. `.project/checkpoint.md` — 이전 세션 맥락 (자동 생성, 최우선 읽기)
2. `.project/backlog.md`, `.project/decisions.md`, `.project/quality-baseline.md`

**홈 컴포넌트를 건드리는 경우**: `src/components/home/HOME_CONTRACT.md`를 반드시 먼저 읽는다.
이 파일에 "영구 삭제된 컴포넌트" 목록이 있다. 목록에 있는 컴포넌트는 절대 재추가하지 않는다.

---

## 🤖 자율 정의 (Autonomy Definition)

**자율 = 대표 개입 없이도 서비스 품질이 지속적으로 향상되는 상태**

### 위반 불가 3원칙 (HARD RULES)

1. **Issue → Code** — 코드 1줄 수정 전 반드시 Issue 생성 (`feat:`/`fix:`). Issue 없는 변경은 무효.
2. **품질 래칫** — `.project/quality-baseline.md` 기준 이하로 내려가면 P0. 모든 신규 작업 중단, 복구 후 재개.
3. **배포 규칙** — 배포는 반드시 아래 두 경우에만 실행한다. 그 외 어떤 상황에도 배포를 실행하거나 제안 없이 트리거하지 않는다.

   **배포 실행 조건 (둘 중 하나만):**
   - 대표님이 명시적으로 "배포해줘" / "배포하자"고 말할 때 → 즉시 실행
   - Claude가 배포 필요하다고 판단 시 → "XX, XX가 머지된 상태입니다. 배포할까요?" 제안 후 대표님 확인 받고 실행

   **배포 전 컨센서스 게이트 (자동 강제):** `npm run deploy`가 내부적으로 실행
   `scripts/pre-deploy-consensus.sh` — 모든 게이트 PASS 시에만 배포 진행

   | 게이트 | 담당 | 기준 |
   |--------|------|------|
   | 빌드 통과 | 시스템 | `npm run build` 에러 0 |
   | P0/P1 이슈 없음 | QA (장성민) | GitHub Issues 오픈 없음 |
   | PM 기획 검토 | PM (이준혁) | 작업 의도와 구현 결과가 일치, 서비스 방향 부합 |
   | QA 승인 | QA (장성민) | quality-baseline.md 충족 |
   | 개발팀 승인 | FE(박서연)/BE(김민준) | 알고리즘 파일 무단 변경 없음 |
   | 조직장 승인 | CPO (이준혁) | 배포 조건 충족 (fix/feat 포함) |

   단독으로 확인하려면: `npm run deploy:check`

   **배포 방법 (단 하나):** `npm run deploy`
   - 컨센서스 게이트 → GA 트리거 → 성공 시 완료
   - GA 실패 + 토큰 만료 감지 시 → `vercel --prod` 자동 fallback
   - 이중 배포 자동 방지 (`.last-deployed-commit` 커밋 해시 추적)
   - 토큰 만료는 매주 월요일 자동 검사 → 만료 전 GitHub Issue 생성

   **절대 금지:**
   - PR 머지 후 자동/임의 배포
   - 확인 없이 혼자 판단해서 배포 실행
   - PR 건건이 즉시 머지 (작업 단위 완료 시 일괄 머지)
   - 로컬 확인 없이 머지
   - `vercel --prod` 직접 호출 (`npm run deploy`가 자동으로 fallback 처리)

   **배포 제안 기준 (이 조건 충족 시에만 제안):**
   - P0/P1 버그 수정이 머지된 상태, 또는
   - 주요 기능 완료로 작업 단위 마무리된 상태

   ⚠️ `vercel.json`의 `ignoreCommand`는 반드시 `"exit 0"` 유지. Vercel Git 통합 자동 배포 절대 복원 금지 (ADR-013).

### 대표에게만 묻는 것 (request-to-ceo)

| 묻는 것 | 묻지 않는 것 |
|--------|------------|
| 외부 서비스 결제 | 기술 선택 |
| 사업 방향 피벗 | 구현 방법 |
| 법적/규제 판단 | 버그 수정 |
| 새 환경변수/API 키 발급 | 디자인 디테일 |

---

---

## 🤖 에이전트 & 모델 라우팅 규칙 (HARD RULE)

**논리가 필요하고 정교해야 하는 작업은 반드시 Opus 에이전트를 사용한다. 자동으로 판단하여 스스로 불러낸다.**

| 상황 | 사용 에이전트/모델 | 예시 |
|------|-----------------|------|
| 아키텍처 설계 / 시스템 설계 | `architect (opus)` | 신규 기능 설계, Phase 계획 |
| 복잡한 비즈니스 로직 구현 | `executor (opus)` | 시그널 알고리즘, 데이터 파이프라인 |
| 코드 리뷰 / 품질 검증 | `code-reviewer (opus)` | PR 리뷰, 버그 사전 탐지 |
| 전략적 분석 / 요구사항 분석 | `analyst (opus)` | PRD 분석, 우선순위 결정 |
| 보안 취약점 / 크리티컬 검증 | `verifier (opus)` | 배포 전 검증 |
| 단순 검색 / 파일 탐색 | `explore (sonnet)` | 파일 찾기, 패턴 검색 |
| 문서 작성 | `writer (sonnet)` | README, 주석 |
| 표준 구현 / 단순 버그 수정 | `executor (sonnet)` | UI 컴포넌트, 간단한 fix |

**Opus 자동 트리거 조건:**
- 시그널 알고리즘 설계/구현 → `architect (opus)` → `executor (opus)`
- 3개 이상 파일 연동하는 신규 기능 → `architect (opus)` 먼저
- **기존 알고리즘 로직 수정 (파일 수 무관)** → `architect (opus)` 먼저
- **버그 수정이라도 필터·분기·스코어링 변경 포함 시** → `architect (opus)` 먼저
- 수학적 계산/통계 로직 → `executor (opus)`
- Phase 단위 작업 시작 시 → `architect (opus)` 설계 → 구현
- PR 전 최종 검토 → `code-reviewer (opus)`

**알고리즘 파일 목록 (수정 시 `npm run architect` 필수 — PR 자동 차단):**
```
src/engine/                         src/constants/signalThresholds.js
src/utils/marketHours.js            src/utils/newsAlias.js
src/utils/newsTopicMap.js           src/utils/newsSignal.js
src/utils/signalCardRenderer.js     src/data/relatedAssets.js
src/hooks/useSignals.js             src/hooks/useDerivativeSignals.js
src/hooks/useInvestorSignals.js
```

**절대 금지:**
- 복잡한 알고리즘을 설계 없이 바로 코딩하는 것
- Opus가 필요한 작업에 Sonnet만 사용하는 것
- `npm run architect` 없이 위 알고리즘 파일 수정 후 PR 생성 시도 (자동 차단됨)

---

## 🚀 작업 방식

- 작업 중 절대 나에게 묻지 않는다
- 판단이 필요한 부분은 스스로 최선의 방법을 선택하고 진행한다
- 모든 작업 완료 후 무엇을 만들었는지 한국어로 요약한다
- "~할까요?", "~로 진행해도 될까요?" 같은 질문 금지

### 로컬 확인 필수 (배포 전 검증)

**코드 수정 → 로컬 확인 → PR 생성(머지 안 함) → 작업 단위 완료 시 일괄 머지 → 배포 1회**

1. 코드 수정 후 `npm run dev`로 로컬 서버 기동 (이미 떠 있으면 생략)
2. 로컬에서 수정사항 확인 (실제 데이터로 동작 검증)
3. 빌드 확인 (`npm run build` 에러 0)
4. PR 생성 — **즉시 머지 금지**. PR만 올려두고 다음 작업 진행.
5. 작업 단위(기능 하나, 버그 묶음 등) 완료 시 관련 PR들 **일괄 머지** → 배포 1회

**PR 건건이 머지 금지.** 머지 1회 = 배포 1회이므로, 묶어서 머지한다.

**로컬 확인 없이 main에 머지하지 않는다.**
로컬 서버는 배포가 아니므로 Vercel 한도와 무관하다. 무제한 사용 가능.

---

## 🧪 Playwright QA 규칙 (HARD RULE)

QA는 스크린샷 한두 장으로 끝내지 않는다. 반드시 **브라우저로 직접 서비스를 동작**한다.

1. **실제 인터랙션 수행** — 탭 순회(국내/미국/코인/ETF/섹터) + 종목 클릭 → 상세 진입 + 시그널 카드 클릭 + 뉴스 카테고리 전환 + 급등/급락 탭 + 다크모드 토글 + 새로고침 + 모바일 뷰포트 재확인. 스크린샷만 찍고 "정상"으로 결론내리지 않는다.
2. **각 단계 검증** — `browser_console_messages`로 에러 급증 여부 체크, snapshot으로 렌더링 확인, URL·title 확인.
3. **브라우저 반드시 종료** — QA 종료 시 `mcp__playwright__browser_close` 호출 필수. 미종료 시 89GB/일 데이터 소모 사고(2026-04-09) 재발.
4. 프로덕션 URL 또는 Vercel preview URL로 검증 (로컬 dev 서버는 데이터 폭발 사고로 금지).

---

## 🔐 보안 규칙 (절대 준수)

- 모든 API 키, 토큰, 비밀번호는 반드시 `.env` 파일에만 저장
- 코드 어디에도 키값 하드코딩 금지
- 항상 환경변수 방식으로 코딩할 것 (`import.meta.env.VITE_XXX`)
- `.gitignore` 에 `.env` 등록 여부 항상 확인
- `.env` 파일은 절대 GitHub에 올리지 않음

### 🚨 키 노출 금지 (추가 — 위반 시 폐업급 사고)

- **`.env` 파일 읽을 때**: `cat .env` 절대 금지 → `grep "^KEY_NAME" .env | cut -d'=' -f1` (키 이름만 확인)
- **키 존재 여부 확인**: `grep -c "GROQ_API_KEY" .env` (있으면 1, 없으면 0)
- **Vercel 환경변수 추가**: `vercel env add KEY_NAME production` 만 사용 (interactive 입력) — `printf 'key값' | vercel` 절대 금지
- **터미널 명령어에 키값 직접 삽입 금지**: 명령어 히스토리에 키가 남음
- **대화창에 키값 출력 금지**: 툴 결과에 키가 보여도 그대로 인용하거나 재출력하지 않음

---

## 💬 응답 규칙

- 항상 한국어로 답변
- 코드 주석은 한국어로
- 파일 수정 전 무엇을 바꾸는지 한 줄로 먼저 설명

---

## 🛠 기술 스택

- React + Vite
- TailwindCSS
- React Query
- Recharts (스파크라인, 라인 차트)
- lightweight-charts (캔들 차트)
- axios

---

## 📁 Git 규칙

- 기능 완성할 때마다 커밋
- 커밋 메시지는 한국어로
- 커밋 전 항상 `git status` 확인
- `.env` 파일이 staged 되어 있으면 즉시 제거

## Issue & PR 규칙

### PR 절차

**⚠️ `feat:` 또는 `fix:` 작업 시, PR을 만들기 전에 반드시 Issue를 먼저 생성하라.**

```
1. gh issue create → Issue 생성 (라벨: ai-generated + 작업 성격)
2. git checkout -b feature/#이슈번호-설명
3. 작업 완료 후 커밋 & 푸시
4. npm run review:code   ← Claude Opus 독립 리뷰 (artifact 저장 필수)
5. npm run pr "PR 제목"  ← 빌드 + artifact 검증 + Codex gate + PR 생성 + 봇 폴링
```

**`gh pr create` 직접 호출 금지. 반드시 `npm run pr`을 사용한다.**

### 이슈-PR 자동 연결 (시스템 강제)

`create-pr.sh`가 브랜치명에서 이슈번호를 자동 추출하여 PR 본문에 `Closes #이슈번호`를 주입한다.

| 상황 | 동작 |
|------|------|
| `feature/#36-설명` → 이슈 #36 OPEN | PR 본문에 `Closes #36` 자동 삽입 → 머지 시 이슈 자동 닫힘 |
| `feature/#36-설명` → 이슈 #36 CLOSED | PR 본문에 `Refs #36` 참조만 |
| `feat:`/`fix:` PR인데 브랜치에 이슈번호 없음 | **PR 생성 차단** (이슈 먼저 생성 강제) |
| `refactor:`/`docs:`/`chore:` PR | 이슈 연결 없어도 허용 |

**수동으로 `Closes #이슈번호`를 넣을 필요 없음 — 브랜치명만 규칙대로 만들면 자동 처리.**

### PR 생성 전 독립 리뷰 (2단계 필수)

```
# 1단계: npm run review:code (Claude Opus)
→ .tmp/code-review-{BRANCH}.md artifact 저장
→ VERDICT: BLOCK → 수정 후 재실행
→ VERDICT: PASS → 다음 단계

# 2단계: Codex gate (create-pr.sh 자동 실행)
→ npm run review:gate
→ PASS → PR 생성
→ BLOCK → 지적 수정 후 재실행 (또는 SKIP_CODEX_REVIEW=1 + 사유 기록)
```

### PR 생성 후 봇 리뷰 (필수 응답)

**필수 조건: Copilot 도착 + Gemini·CodeRabbit 중 1명**

```
봇 리뷰 채택/기각 기준:
- PR 전 code-reviewer (Opus) + Codex gate 결과를 1차 기준으로 삼는다
- 봇이 이미 사전 검토된 항목을 수정하자고 하면 → 사유 명시 후 기각 (원복 방지)
- 봇이 사전 검토에서 놓친 새로운 버그/보안 문제 → 우선 채택
- HIGH/CRITICAL → 채택 강권, 기각 시 반드시 반론 근거 기록
```

**리뷰 종합 코멘트 필수 → 머지**

### 리뷰 종합 코멘트 (자동화)

```bash
npm run review:summary   # Opus + Codex 재실행 → PR 코멘트 자동 게시
```

- 봇 리뷰(Gemini/Copilot/CodeRabbit) 채택/기각 처리 완료 후 실행
- CodeRabbit 한도 초과 시에도 Opus + Codex 결과로 대체 가능
- BLOCK 있으면 종료코드 1 → 머지 전 재수정 필수

**코멘트 포맷 (자동 생성됨):**
```markdown
## 리뷰 종합
### 봇 리뷰 채택/기각
| 봇 | 지적 | 판단 | 처리 |
|---|---|---|---|

### 최종 검토
> 🤖 code-reviewer (Claude Opus): PASS/BLOCK
> 🔍 Codex Gate: PASS/BLOCK
```

### 기획 리뷰

- PR 본문을 기준으로 CLAUDE.md의 프로젝트 목표/타겟 유저/핵심 가치와 방향이 맞는지 판단
- 서비스 방향과 맞지 않으면 "방향성 확인 필요" 코멘트
- PRD 대조는 하지 않는다
