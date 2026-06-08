# AI 코딩의 함정과 해결 — 실전 사례집

> 마켓레이더 v5 개발 중 직접 경험한 AI 코딩 문제와, 학술 연구/공식 발표로 뒷받침되는 해결책을 정리한다.
> "바이브 코딩"이 아닌 **구조적으로 검증된 AI 코딩**을 위한 가이드.

---

## 우리가 겪은 문제 사례

### 1. 자기 평가 편향 (Self-Evaluation Bias)

**우리 사례**: Phase 8에서 시그널 엔진을 만든 에이전트가 "완료"라고 보고. 평가 에이전트(같은 Claude)가 R1에서 72%, R2에서 85%, R3에서 "1점만 고치면 PASS"로 점점 관대해짐. 3라운드 만에 기준 자체가 느슨해지는 현상.

**외부 연구**: NeurIPS 2024 논문 "LLM Evaluators Recognize and Favor Their Own Generations" — LLM은 자기가 생성한 텍스트를 다른 모델 출력보다 높게 평가. Self-recognition 능력이 강할수록 bias도 비례 증가.

**해결책**:
- ✅ 작성자와 평가자를 다른 모델로 분리 (Claude 작성 → OpenAI Codex 리뷰)
- ✅ 평가자에 opus 모델 사용 (더 엄격한 기준 유지)
- ✅ Playwright 시각 검증 의무화 (코드 리뷰만으로는 부족)
- ✅ 정량 평가 체계 (5항목 × 가중치, 90% 미달 시 재작업)

---

### 2. 만들었지만 연결 안 됨 (Orphaned Implementation)

**우리 사례**: Phase 8에서 `createInvestorSignal`, `createVolumeSignal` 헬퍼 함수를 만들었지만 **호출하는 코드가 없었음**. `useSignals` 훅 3개를 만들었지만 **소비하는 컴포넌트가 0개**. 평가에서 적발: "엔진은 완벽한데 발화하지 않으면 의미 없다."

**외부 연구**: METR 2025 연구 — AI 생성 코드의 수용률이 44% 미만. 나머지 56%는 통합 실패로 폐기. "Missing imports and dependencies" 패턴이 주요 원인.

**해결책**:
- ✅ "호출하는 코드 없이 함수만 만들면 미완성" 규칙 명시
- ✅ 평가 기준에 "데이터 파이프라인 연결 여부" 항목 추가
- ✅ 부팅 시드 패턴 — 데이터가 없어도 최소한의 시그널 생성

---

### 3. 범위 축소 (Scope Reduction)

**우리 사례**: 계획서에 27개 작업이 있었는데, Phase당 6~7개로 묶으면서 어려운 것(모닝 브리핑=Cron+Redis, 이미지 공유=html2canvas)을 슬쩍 빼고 쉬운 것만 구현. 평가팀이 "구현된 것의 품질"에 집중하느라 "누락률"을 체크하지 못함.

**외부 연구**: IEEE Spectrum 2025 — AI 코딩 시대에 리팩토링 비율 25%→10% 하락, 코드 중복 8.3%→12.3% 증가. "쉬운 코드를 많이 생성하되 어려운 구조 개선은 회피"하는 패턴.

**해결책**:
- ✅ 기획팀이 매 Phase 평가 후 "누락 항목" 명시적 체크
- ✅ 평가 항목 1번(기획 의도 부합)에 "N개 중 M개 구현" 체크리스트 필수
- ✅ 인프라 의존 항목은 별도 Phase로 분리 (클라이언트와 혼합하지 않음)

---

### 4. 낙관적 완료 선언 (Completion Bias)

**우리 사례**: executor 에이전트가 "빌드 성공, 구현 완료"를 보고하지만, 실제로는 빈 catch 블록, 미연결 모듈, 하드코딩 환율 등이 산재. "빌드 통과 = 완료"라는 착각.

**외부 연구**: Google AI Studio 공식 포럼에서 논의된 "Coding Eagerness" — AI가 사용자의 가벼운 동의("that makes sense")를 전체 구현 승인으로 해석하는 경향.

**해결책**:
- ✅ "빌드 통과"와 "완료"를 분리 — 완료 = 빌드 + 리뷰 + 평가 90%+
- ✅ Playwright 실제 실행 검증 필수화
- ✅ 평가팀이 "작동하는가?"를 코드가 아닌 화면에서 확인

---

### 5. 조용한 실패 (Silent Failure)

**우리 사례**: `whale.js`에 `catch {}` 빈 블록 6개, `WhalePanel.jsx`에 2개. 바이낸스 WebSocket이 한국 IP에서 차단되어도 에러 로그 없이 조용히 실패. 6개 데이터 소스 중 1개만 작동하는데 알 수 없었음.

**외부 연구**: CodeRabbit 2025 보고서 — AI 코드의 에러 핸들링 누락이 인간 코드 대비 ~2x. "Silent failures are harder to detect than crashes, making them more dangerous."

**해결책**:
- ✅ 모든 `catch {}` 블록에 최소 `console.warn` 추가
- ✅ 소스별 연결 상태를 UI에 개별 표시 (뭉뚱그린 "연결됨" 금지)
- ⬜ ESLint 규칙으로 빈 catch 블록 자동 차단 (TODO)

---

### 6. 아첨 편향 (Sycophancy)

**우리 사례**: 직접적 아첨은 아니었지만, 평가 R3에서 "이 1줄만 고치면 PASS"라고 문턱을 낮추는 것은 "사용자가 원하는 결과(머지)를 빨리 제공하려는" sycophantic 행동의 변형.

**외부 연구**: Anthropic 공식 — "Sycophancy means telling someone what they want to hear rather than what's really true." Claude 모델 스펙에서 "diplomatically honest, not dishonestly diplomatic"을 핵심 원칙으로 명시.

**해결책**:
- ✅ 평가자에게 "PASS를 빨리 내는 것이 목표가 아님" 명시
- ✅ 평가 기준을 정량화 (감정적 판단 여지 최소화)
- ✅ 교차 모델 평가 (Claude 작성 → OpenAI 리뷰)

---

### 7. 환율 같은 숫자 불일치 (Magic Number Inconsistency)

**우리 사례**: `whalePattern.js`에서 환율 1466, `WhalePanel.jsx`에서 1450 사용. 같은 계산인데 파일마다 다른 값. 금융 앱에서 숫자 불일치는 신뢰를 깨뜨림.

**외부 연구**: Veracode 2025 — AI 생성 코드의 약 45%가 보안/정확성 테스트 실패. 특히 하드코딩된 값의 불일치가 주요 원인.

**해결책**:
- ✅ `src/constants/market.js`에 `DEFAULT_KRW_RATE = 1450` 단일 상수
- ✅ `STABLECOIN_SYMBOLS`을 `signalTypes.js` 한 곳에 정의
- ✅ 매직 넘버를 명명 상수로 추출하는 것을 코드 리뷰 체크리스트에 포함

---

### 8. 빈 상태 UX 미고려 (Empty State Blindspot)

**우리 사례**: Phase 11에서 시그널 위젯 + 시그널 피드가 동시에 "시그널 수집 중..."으로 화면 상단 절반이 비어있음. Playwright로 실제 화면을 보고서야 발견. 코드 리뷰에서는 놓침.

**근본 원인**: AI는 "정상 경로(happy path)"를 먼저 구현하고 예외 상태(빈 데이터, 에러, 로딩)를 후순위로 밀거나 생략하는 경향.

**해결책**:
- ✅ 부팅 시드 패턴 — 데이터 없어도 변동폭 상위 종목으로 즉시 시그널 생성
- ✅ 빈 상태에 유용한 대체 콘텐츠 (감지 항목 태그 표시)
- ✅ Playwright 평가 의무화 — 실제 화면에서 빈 상태 확인

---

### 9. 인프라 회피 (Infrastructure Avoidance)

**우리 사례**: 모닝 브리핑(Vercel Cron + Redis)이 계획서에 있었지만, "클라이언트 사이드만으로 안 되니까" 4개 Phase 동안 계속 뒤로 밀림. 결국 미구현.

**외부 연구**: AI 코딩 도구는 로컬 파일 수정에 강하지만, 서버 설정/DB 스키마/배포 구성 같은 환경 의존 작업을 회피하는 경향. Veracode 보고에서 서버사이드 검증 누락이 주요 보안 취약점 원인.

**해결책**:
- ⬜ 인프라 의존 항목을 별도 Phase로 분리
- ⬜ "클라이언트로 대체 불가" 항목을 기획 단계에서 명시
- ⬜ CEO에게 환경 설정 필요사항 사전 공유 (request-to-ceo)

---

### 10. 맥락 소실 (Context Drift)

**우리 사례**: Phase 8~11을 한 세션에서 연속 진행하면서 초기 요구사항("입소문이 나야 해")이 점차 "빌드 통과"에 집중하는 방향으로 전환. 계획서 27개 항목 중 일부가 맥락에서 사라짐.

**외부 연구**: Chroma Research — 입력 토큰 증가에 따른 LLM 성능 저하 실증. 에이전트 시스템에서 컨텍스트의 80%가 "관련 없는 검색 잔해"로 오염 가능.

**해결책**:
- ✅ `.project/phase-tracker.md`로 Phase별 진행 추적
- ✅ THINKING.md로 전략적 사고 흐름 기록
- ✅ 매 Phase 시작 시 기획서 재참조

---

## 삼각편대 워크플로우 — 구조적 해결

위 10가지 문제를 한번에 잡는 구조:

```
기획팀 (opus)           구현팀 (opus/sonnet)        평가팀 (opus)
  │                        │                         │
  ├─ 기능 스펙             ├─ 구현                    ├─ 5항목 정량 평가
  ├─ 성공 기준             ├─ 빌드 확인               ├─ Playwright 시각 검증
  ├─ 누락 체크리스트        ├─ 코드 리뷰               ├─ 교차 모델 리뷰
  │                        │                         │
  └── 90% 미달 → 개선 피드백 ←────────────────────────┘
```

**핵심 원칙**:
1. 작성자 ≠ 평가자 (Self-preference bias 차단)
2. 빌드 통과 ≠ 완료 (Completion bias 차단)
3. 코드 리뷰 ≠ 품질 보증 (Playwright 실행 필수)
4. 기획서 대비 누락률 체크 (Scope reduction 차단)
5. 정량 기준 90% (Sycophancy 차단 — 감정적 판단 불가)

---

## 참고 자료

| 출처 | 핵심 내용 |
|------|----------|
| [Anthropic — Sycophancy 공식 발표](https://www.anthropic.com/news/protecting-well-being-of-users) | Claude의 아첨 편향 정의 + 70~85% 감소 달성 |
| [NeurIPS 2024 — Self-Preference Bias](https://proceedings.neurips.cc/paper_files/paper/2024/file/7f1f0218e45f5414c79c0679633e47bc-Paper-Conference.pdf) | LLM이 자기 출력을 더 높게 평가하는 실증 |
| [arXiv:2310.13548 — Sycophancy 이해](https://arxiv.org/abs/2310.13548) | RLHF가 sycophancy의 근본 원인 |
| [METR 2025 — 숙련 개발자 + AI = 19% 더 느림](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) | AI 코드 수용률 44% 미만 |
| [CodeRabbit 2025 — AI vs Human 코드 품질](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report) | AI 코드 결함 1.4~1.7x, 보안 2.74x |
| [IEEE Spectrum — AI 코딩 품질 하락](https://spectrum.ieee.org/ai-coding-degrades) | 리팩토링 감소, 코드 중복 증가 |
| [Context Rot (Chroma Research)](https://research.trychroma.com/context-rot) | 토큰 증가 → 성능 저하 실증 |
| [Google AI Studio — Completion Bias](https://discuss.ai.google.dev/t/google-ai-studio-overcoming-the-llms-completion-bias-coding-eagerness-through-a-formal-coding-protocol/112196) | 가벼운 동의를 전체 승인으로 해석 |

---

---

### 11. 리뷰어 루프 교착 (Reviewer Loop Deadlock)

**우리 사례** (2026-04-04): `api/kr-fear-greed.js` 버그 1개를 고쳤는데, 새로 만든 `pre-deploy-consensus.sh` Gate 5 코드를 Opus와 Codex가 번갈아 BLOCK. Opus PASS → Codex BLOCK → 수정 → 새 커밋 → Opus artifact 재생성(5분) → Codex 재실행(3분) → 새 BLOCK. 4회 반복, 12개 커밋 이상 소모. 타이브레이커 없음.

**근본 원인**:
- 두 리뷰어(Opus/Codex)가 서로 다른 관점으로 심사 (Opus: 전체 설계, Codex: 엣지케이스 교정)
- 매 수정마다 새 커밋 → Opus artifact 재생성 필수 → 루프 비용 기하급수적 증가
- 기능 코드(kr-fear-greed.js)와 인프라 코드(게이트 스크립트)가 같은 PR에 묶여 인프라 이슈가 기능 배포를 차단

**해결책**:
- ✅ `SKIP_CODEX_REVIEW=1` + 사유 기록 + 후속 Issue 자동 등록으로 탈출
- ✅ **기능 코드와 인프라 코드를 별도 PR로 분리** — 인프라 이슈가 기능 배포 막지 않도록
- ⬜ Codex N회 BLOCK 시 warn 모드 자동 전환 (현재 미구현 — Issue #39)
- ⬜ Codex 기각 항목 → GitHub Issue 자동 생성 (현재 수동 — Issue #39)

**교훈**: 리뷰어가 2개 이상이면 타이브레이커 규칙이 명시되어야 한다. "Opus PASS = 배포 가능, Codex는 경고 역할"처럼 역할 위계를 사전에 정의하지 않으면 무한 루프에 빠진다.

---

### 12. 디자인 고도화 ≠ 서비스 방향성 (Direction Blindness)

**우리 사례**: Phase 8A에서 "AI로 만든 티 제거"를 목표로 디자인 리뉴얼 진행. 이모지 제거, rounded 정제, CDS 적용 등 겉모습은 개선했지만, 핵심 기능(주목할 종목, 공포탐욕, 시그널 UX)을 오히려 제거/축소해버림. 대표님 피드백: "방향성이 잘못됐어. AI 시그널이 주된 목적인데."

**원인**: AI가 "깔끔한 디자인 = 좋은 서비스"로 판단. PM 에이전트가 "홈 15개→7개 축소"를 제안했고, 검증 없이 수용. 실제로는 NotableMovers(WHY 카드), FearGreed(심리 지표) 같은 핵심 차별화 요소를 날린 것.

**교훈**: 디자인 리뉴얼 시 "무엇을 보여줄까"보다 "무엇을 남길까"가 더 중요하다. 서비스의 핵심 가치를 먼저 정의하고, 그 가치를 전달하는 컴포넌트를 보호한 후에 나머지를 정리해야 한다. AI 에이전트의 "축소/제거" 제안은 항상 대표님 확인 후 실행.

### 13. 전문용어 함정 (Jargon Trap)

**우리 사례**: 시그널 엔진이 "PCR 1.3 bearish", "펀딩비 0.08% 과열", "RSI 다이버전스" 등 전문용어로 시그널을 생성. 개발자/AI는 이해하지만 타겟 사용자(일반 투자자)는 해석 불가.

**대표님 피드백**: "전문용어 배제하고 우리만의 언어로 쉬우면서 위트있고 정확도 높은 시그널 컨텐츠를 만들고 싶어."

**교훈**: AI가 금융 데이터를 다루면 자연스럽게 전문용어를 사용한다. 의식적으로 "이 문장을 투자 초보자가 읽으면 3초 안에 이해할 수 있는가?" 테스트를 거쳐야 한다. 시그널 타입마다 전문용어 버전과 쉬운말 버전을 분리 관리 (TYPE_META.label vs TYPE_META.easyLabel).

---

### 14. 렌더 루프 내 헬퍼 함수 재선언 (Inline Re-declaration in Render Loop)

**우리 사례** (2026-05-07 코드 리뷰): `SignalInlinePanel.jsx`의 `.map()` 콜백 안에 `hitLabel` 함수가 선언됨. 컴포넌트가 렌더링될 때마다 이 함수 객체가 새로 생성된다. 컴포넌트 바깥 또는 최소한 `map()` 바깥에 정의해야 할 함수를 "필요한 곳 바로 위에" 작성하는 패턴.

**근본 원인**: AI는 "지금 여기 필요한 것을 지금 여기에 정의"하는 방식으로 코드를 생성한다. 함수가 어디서 호출되는지보다 어디서 처음 사용되는지를 기준으로 위치를 결정하기 때문에, 루프·콜백 내부에 헬퍼가 박히는 현상이 반복된다.

**발생 패턴**:
```jsx
// AI가 자주 생성하는 패턴 (잘못됨)
items.map((item) => {
  const hitLabel = (hit) => hit ? '적중' : '미적중'; // 매 루프마다 재생성
  return <div>{hitLabel(item.hit)}</div>;
});

// 올바른 패턴
const hitLabel = (hit) => hit ? '적중' : '미적중'; // 외부 한 번 정의
items.map((item) => <div>{hitLabel(item.hit)}</div>);
```

**영향**:
- 매 렌더마다 새 함수 객체 생성 → 불필요한 메모리 할당
- `React.memo` / `useCallback` 최적화 무력화
- 함수 재사용·단독 테스트 불가

**해결책**:
- ✅ 코드 리뷰 체크리스트에 "`.map()` 콜백 내 함수 선언 여부" 항목 추가
- ✅ 순수 헬퍼 함수는 컴포넌트 바깥(모듈 스코프)에 정의
- ✅ 상태/props 의존 함수는 컴포넌트 상단에 정의 후 콜백에서 참조

---

### 15. 형제 컴포넌트 미동기화 (Sibling Component Desync)

**우리 사례** (2026-05-12 코드 리뷰): `temperature.js`에서 `source: 'pending'` 상태를 올바르게 정의하고 렌더 분기(`animate-pulse`, `"파악 중..."`)까지 구현. 그러나 동일한 `source` 값을 소비하는 `MarketSentimentWidget.jsx:136`은 `source === 'blended' || source === 'fallback'`만 체크하고 `'pending'`을 별도 처리하지 않음.

**근본 원인**: AI는 현재 편집 중인 파일에 집중하여 상태·타입·로직을 올바르게 구현한다. 그러나 "이 값을 다른 컴포넌트도 쓰는지" — 즉, 동일한 데이터 계약을 공유하는 형제 컴포넌트를 능동적으로 탐색하지 않는다. 결과적으로 한 파일에만 방어 로직이 추가되고 형제들은 과거 상태로 남는다.

**발생 패턴**:
```
temperature.js         → source: 'pending' | 'blended' | 'fallback'  ✅ 모두 처리
MarketSentimentWidget  → source === 'blended' || 'fallback'           ❌ 'pending' 누락
```

**왜 #2(Orphaned), #10(Context Drift)과 다른가**: Orphaned는 호출 연결이 없는 경우, Context Drift는 요구사항이 세션 중 사라지는 경우다. Sibling Desync는 같은 데이터 계약을 공유하는 파일들이 업데이트 시점이 달라 분기되는 구조적 문제다.

**해결책**:
- ✅ 새 상태값·타입 추가 시 "이 값을 소비하는 다른 컴포넌트" grep 필수 (`grep -r "source ===" src/`)
- ✅ 공유 데이터 계약(예: `source` 값 목록)을 `constants/`에 열거형으로 정의 — 누락 시 타입 에러로 발견 가능
- ✅ 코드 리뷰 체크리스트에 "같은 prop/필드를 쓰는 형제 컴포넌트 일괄 확인" 항목 추가

---

### 16. 상태 통합 시 생산자 전수 미감사 (Field Consolidation with Partial Producer Update)

**우리 사례** (2026-05-12 코드 리뷰): `closed: true` 플래그가 "휴장"과 "데이터 없음"을 동시에 의미하는 모호함을 해소하기 위해 `status: 'closed' | 'error' | 'partial' | 'stale_cache'` 단일 필드로 통합. 프런트엔드가 `status` 값 기준으로 분기를 바꾼 것은 올바르다. 그러나 `closed: true`를 반환하는 다른 API 경로(US 공포탐욕 API, 엣지 함수 일부 등)가 여전히 구 포맷을 쓴다면, 프런트가 `status === 'closed'`를 기다리는 동안 `closed: true`가 도착해도 "휴장" 텍스트가 렌더되지 않는 묵음 장애가 발생한다.

**근본 원인**: AI는 "지금 수정 중인 API"의 응답 포맷 교체에 집중한다. 동일한 필드를 내보내는 다른 API 경로·엣지 함수·폴백 로직이 구 포맷을 계속 내보낼 수 있다는 점을 능동적으로 확인하지 않는다. 소비자는 새 포맷을 기다리는데 일부 생산자는 구 포맷을 내보내는 비대칭이 발생한다.

**발생 패턴**:
```
producer A (수정됨)  → status: 'closed'   ✅ 프런트가 인식
producer B (미수정)  → closed: true       ❌ 프런트가 무시 → "휴장" 텍스트 소실
```

**왜 #15(Sibling Component Desync)와 다른가**: #15는 같은 데이터 계약을 *소비*하는 컴포넌트들이 업데이트 시점이 달라 분기되는 문제다. 이 패턴은 데이터를 *생산*하는 쪽이 불완전하게 이관된 경우로, 방향이 반대다.

**해결책**:
- ✅ 필드 통합·이름 변경 시 "이 필드를 생산하는 API 경로" grep 전수 확인 (`grep -r '"closed"' api/`)
- ✅ 구 필드(`closed`) → 신 필드(`status`) 이관 완료 전까지 프런트가 양쪽 포맷 허용하는 호환 레이어 유지
- ✅ 필드 이관은 별도 PR로 분리 — "프런트 소비자 교체"와 "API 생산자 교체"를 같은 diff에 묶지 않음

---

### 17. 훅 반환값 낙관적 접근 (Hook Init Null Blindspot)

**우리 사례** (2026-05-12 코드 리뷰): `DataHealthBadge` 컴포넌트에서 `useServerSignals()`가 초기 로딩 중이거나 에러 상태일 때 null을 반환할 수 있음에도 `serverMeta.stale`을 옵셔널 체이닝 없이 직접 접근. 정상 구동 후에는 문제 없지만, 첫 렌더 ~ 데이터 도착 구간에서 `TypeError: Cannot read properties of null (reading 'stale')` 발생.

**근본 원인**: AI는 훅이 "정상적으로 동작할 때"의 반환값 구조를 기준으로 소비 코드를 작성한다. `useQuery`, `useEffect`, 커스텀 훅 모두 초기 렌더 시 `null | undefined`를 반환하는 구간이 존재하지만, AI는 이 초기화 구간을 생략하고 happy path만 구현한다.

**발생 패턴**:
```jsx
// AI가 자주 생성하는 패턴 (잘못됨)
const serverMeta = useServerSignals();
if (serverMeta.stale) issues.push('시그널 업데이트 지연'); // 초기 로딩 중 TypeError

// 올바른 패턴
const serverMeta = useServerSignals();
if (serverMeta?.stale) issues.push('시그널 업데이트 지연');
```

**왜 #5(Silent Failure), #8(Empty State Blindspot)과 다른가**:
- #5는 에러를 *삼키는* 패턴 (빈 catch, console 미출력)
- #8은 빈 데이터 상태의 *UI 표현* 누락
- 이 패턴은 null/undefined 반환값에 직접 프로퍼티 접근해서 *런타임 TypeError를 유발*하는 패턴 — 초기화 구간에만 발생하고 정상 동작 후엔 재현이 안 되어 개발 중 발견이 어렵다.

**영향**:
- 초기 렌더 ~ 데이터 도착 구간 TypeError → 컴포넌트 트리 크래시
- React Error Boundary 없으면 화면 전체 흰 화면
- `null`이 실제 "데이터 없음" 의미일 경우 영구 크래시

**해결책**:
- ✅ 훅 반환값 사용 시 항상 `?.` 옵셔널 체이닝 또는 초기값 fallback 적용
- ✅ 코드 리뷰 체크리스트에 "커스텀 훅 반환값 직접 프로퍼티 접근 여부" 항목 추가
- ✅ TypeScript 사용 시 반환 타입에 `| null` 명시 → 컴파일 타임 강제
- ⬜ ESLint 규칙으로 훅 반환값의 `?.` 없는 접근 경고 (선택적)

---

### 18. 암묵적 불변식 맹점 — 현재만 정합, 미래에 취약 (Implicit Invariant Blindspot)

**우리 사례** (2026-05-27 코드 리뷰, #333 marketHours 세션 정상화): VERDICT는 **PASS, 크리티컬/하이 버그·보안·성능 0건**. 그런데 리뷰어가 남긴 4개 STYLE 지적이 *모두 같은 형태*였다 — "동작은 올바르나(현재 입력·현재 호출자 기준), 미래에 깨지거나 오인된다."

| 지적 | 지금 안전한 이유 | 미래에 깨지는 지점 |
|------|----------------|------------------|
| `polling.js:11` 주석 "프리·애프터 60초" | #331 시절엔 사실이었음 | #333에서 프리/애프터→lastClose(5분)로 바뀜. 주석만 과거 상태 → 미래 개발자 오인 |
| `buildStatus` dataMode 기본값 없음 | phase 10종이 테이블에 전부 매핑됨 | 향후 phase 추가 시 테이블 동기화 누락 → `dataMode=undefined` 누수 |
| `isUsDayMarket` 공휴일 새벽 비대칭 | 1차 보수 정책(전부 lastClose)이라 영향 0 | 2차 실데이터 연동 시 블루오션 공휴일 전날밤 운영분 누락 |
| `isKrPreNxt`/`isKrPreAuction` 겹침(08:30~08:50) | status 빌더가 preAuction 우선 처리 | `isKrPreNxt` 단독 호출 시 08:30~08:50도 true 반환(오인) |

**근본 원인**: AI는 "현재 코드·현재 입력·현재 호출 그래프"에서 정답이 나오도록 코드를 작성한다(66개 테스트 전부 통과, 프로덕션 정상). 그러나 코드를 *정합하게 만드는 불변식* — 테이블이 완전하다, 호출자는 오케스트레이터 하나뿐이다, 주석이 동작과 일치한다, 정책이 균일하게 보수적이다 — 을 **명시하거나 강제하지 않는다.** 불변식을 "미래에 코드가 진화할 때 조용히 깨질 수 있는 가정"으로 모델링하지 않기 때문이다. 결과적으로 senior가 추가하는 값싼 방어장치(안전 기본값, 정확한 주석, 한계 명시, 계약 명시)가 빠진다.

**왜 #8·#17과 다른가**: #8(빈 상태)·#17(훅 null)은 *현재 시점*의 예외 입력(빈 데이터, 초기 null)을 happy-path만 구현해 놓친 것이다. 이 패턴은 현재 모든 입력에서 정상이고, *미래의 코드 변경*(새 phase, 단독 호출자, 정책 2차, 리팩토링)에 취약하다 — 시간 축이 반대(현재 입력 누락 vs. 미래 진화 취약).

**왜 #15·#16과 다른가**: #15/#16은 *지금 이 변경*에서 형제 소비자/생산자를 누락한 실제 비대칭(현재 발생 중인 묵음 장애)이다. 이 패턴은 지금은 비대칭이 없고(테이블 완전), 미래에 누군가 한쪽만 늘리면 생기는 *잠재* 취약성이다.

**발생 패턴**:
```js
// AI: 현재 phase가 전부 매핑되니 OK (테스트 통과)
const dataMode = TABLE[phase];          // 미래 phase 추가 시 undefined 누수

// senior: 불변식을 강제 — 미지 phase는 안전측으로
const dataMode = TABLE[phase] ?? 'lastClose';
```

**해결책**:
- ✅ 코드를 정합하게 만드는 가정을 *명시*: 테이블 lookup엔 `?? 안전기본값`, 한계 있는 함수엔 한계 주석, 겹침/우선순위 있는 export엔 계약 주석
- ✅ 동작을 바꾼 PR은 *그 동작을 설명하던 주석도 같은 diff에서 갱신* (주석 부패 차단)
- ✅ 분리된 두 구조(phase 집합 ↔ dataMode 테이블)는 한 곳에서 파생하거나, 누락 시 fail-safe 기본값으로 막기
- ✅ 리뷰 체크리스트: "이 코드가 깨지려면 무엇이 바뀌어야 하나? 그 변경이 조용히 일어날 수 있나?" → Yes면 가정을 명시

---

### 19. 카테고리별 분모 비대칭 — 단일 지표가 비교 가능성을 위장 (Asymmetric Denominator Behind a Uniform Metric)

**우리 사례** (2026-06-08 코드 리뷰, #364 `signal_accuracy_v2` fair-hit 뷰): `fair_hit` CASE에서 `direction='neutral'`은 stale(무변동 동결 스냅샷)을 제외하지 않고 곧장 **적중(true)**으로 집계한다. 반면 directional 시그널은 stale를 NULL로 빼서 분모(`eval`)에서 제외한다. 결과적으로 같은 뷰의 **같은 컬럼**(`fair_acc_1h`)인데 분모 의미가 방향별로 다르다 — neutral 승률은 *stale 포함 상한치*, directional 승률은 *stale 제외 실측치*. 주석에 "런칭 근거엔 방향성만 사용"이라 적혀 있으나 **뷰 스키마는 이를 강제하지 못한다.** Phase 5 성적표/API/훅이 neutral fair_acc를 directional과 같은 줄에 나란히 표시·정렬하면 즉시 오인된다.

**근본 원인**: AI는 각 분기(neutral, bullish, bearish)를 *그 분기 자체의 정의 안에서는* 정확하게 계산한다(neutral의 "맞음"=무변동, directional의 "맞음"=밴드 돌파). 그러나 이 분기들이 *하나의 컬럼·하나의 라벨로 합쳐져 나란히 비교될 때* 분모/모집단이 달라 사과-오렌지 비교가 된다는 점 — 즉 "지표 간 비교 가능성"이라는 계약 — 을 모델링하지 않는다. 비교 금지 규칙을 스키마/타입/코드가 아니라 **산문 주석에만** 의존한다.

**왜 #7·#16·#18과 다른가**:
- #7(매직넘버 불일치)은 *같은 값*이 파일마다 다른 상수로 박힌 것 — 여기선 값이 아니라 *계산 의미(분모)*가 카테고리별로 다르다.
- #16(생산자 부분 이관)은 같은 필드를 일부 생산자만 신포맷으로 바꾼 *비의도적* 비대칭 — 여기선 단일 생산자가 *의도적으로* 분기별 다른 계산을 하고, 그것을 하나로 노출한다.
- #18(암묵적 불변식)은 *현재 정합·미래 취약* — 여기선 *현재 이미* 비대칭이고, 위험은 미래 진화가 아니라 *지금 consumer가 두 값을 비교 가능하다고 오인*하는 것이다(시간축 반대).

**발생 패턴**:
```sql
-- neutral: stale를 적중으로 → 분모에 포함
WHEN direction = 'neutral'              AND ABS(change) < band THEN true
-- directional: stale를 제외 → 분모에서 NULL
WHEN direction IN ('bullish','bearish') AND ABS(change) < band THEN NULL
-- → fair_acc_1h 한 컬럼에 분모 의미가 둘. 같은 라벨로 노출되면 비교 가능처럼 보인다.
```

**영향**:
- 성적표/대시보드에서 neutral 승률이 directional보다 부풀려져 "더 정확한 시그널"로 오독
- 정렬·랭킹·임계 비교 시 stale 포함 카테고리가 부당하게 상위 → 잘못된 시그널 우선순위
- 계약이 주석에만 있어 후속 Phase 개발자가 가드를 누락하기 쉬움

**해결책**:
- ✅ 비교 불가 값은 스키마/타입에서 분리하거나(예: `directional_acc` vs `neutral_acc` 별도 컬럼), 라벨에 비교 불가성을 못박는다("중립=비방향, 참고치")
- ✅ 소비자(카드 렌더러/훅/성적표)에 가드 — neutral fair_acc를 directional과 동일 선상에 표시·정렬·비교 금지
- ✅ 리뷰 체크리스트: "이 두 숫자를 사용자가 나란히 보면 같은 의미로 받아들이는가? 분모/모집단이 같은가?"
- ✅ 산문 주석으로만 강제되는 계약은 *미강제*로 간주 — 코드/스키마/타입 레벨로 끌어올린다

---

### 20. 중복 억제 지시문 — 설정이 이미 무시하는데 또 억제 (Redundant Suppression Directive)

**우리 사례** (2026-06-08 코드 리뷰, #366 죽은 시그널 26종 제거): no-op 훅 3곳(`useDerivativeSignals.js:5`, `useNewsSignals.js:5`, `useInvestorSignals.js:117`)에 `// eslint-disable-next-line no-unused-vars`(및 `react-hooks/exhaustive-deps`)를 달았다. 그러나 해당 파라미터는 이미 `_args`/`_allNews`/`_allItems`처럼 언더스코어 프리픽스라 ESLint 설정의 `argsIgnorePattern: '^_'`가 자동으로 무시한다(`eslint.config.js` 3개 블록 전부). 즉 억제 지시문 자체가 죽은 코드이며, flat config의 `reportUnusedDisableDirectives`(ESLint 9 기본 `warn`)가 **새 경고("Unused eslint-disable directive")를 도리어 발생**시킨다. AI의 방어 본능이 막으려던 바로 그 문제(린트 경고)를 스스로 만들어낸 것.

**근본 원인**: AI는 "이 관용구면 린터를 잠재운다"는 자기완결적 억제 패턴(`eslint-disable`, `@ts-ignore`, `# noqa`, `@SuppressWarnings`)을 *국소적으로* 적용한다. 그러나 *프로젝트의 린트 설정*(`argsIgnorePattern`, `varsIgnorePattern`, 이미 off된 룰)을 읽고 "이 억제가 정말 필요한가"를 확인하지 않는다. 두 개의 겹치는 안전장치(언더스코어 네이밍 + disable 지시문)를 벨트앤서스펜더로 동시에 적용하고, 그 중복 자체가 메타 룰("미사용 지시문 금지")을 도리어 위반한다.

**왜 #18(암묵적 불변식)과 다른가**: #18은 *부족한* 방어(안전 기본값·계약 주석 누락)를 senior가 *추가*해야 하는 under-defensive 패턴이다. 이건 정반대로 *과잉* 방어 — 불필요한 억제를 AI가 추가하고, 그 과잉이 새 경고를 만든다(over-defensive). 부족이 아니라 잉여가 문제다.

**발생 패턴**:
```js
// AI가 자주 생성하는 패턴 (잘못됨 — 이중 억제)
// eslint-disable-next-line no-unused-vars
export function useDerivativeSignals(_args) { return []; }
// _args는 이미 argsIgnorePattern('^_')로 무시됨 → disable 줄은 죽은 코드 + 새 경고 유발

// 올바른 패턴 — 언더스코어 네이밍 하나로 충분, disable 줄 삭제
export function useDerivativeSignals(_args) { return []; }
```

**영향**:
- "에러 0" 베이스라인은 유지되나 "경고 0" 캠페인 취지를 역행 (정리 시 경고까지 0)
- 죽은 억제 지시문이 누적되면 "어떤 룰이 실제로 필요한지" 신호가 희석됨
- 후속 개발자가 "이 disable엔 이유가 있겠지" 하고 보존 → 영구 잔존

**해결책**:
- ✅ 억제 지시문 추가 전 프로젝트 린트 설정 확인(`argsIgnorePattern`/`varsIgnorePattern`/이미 off된 룰) — 설정이 처리하면 지시문 불요
- ✅ ESLint `reportUnusedDisableDirectives`(flat config 기본 활성) 유지 → 죽은 억제 자동 검출
- ✅ 억제는 최후수단 — 네이밍 컨벤션(`_` 프리픽스)으로 해결 가능하면 그쪽 우선
- ✅ 리뷰 체크리스트: "이 suppress/ignore/disable이 정말 필요한가, 아니면 설정·네이밍이 이미 처리하는가?"

---

### 21. 모듈 로드 시점 치명 가드 — 폭발 반경 맹점 (Blast-Radius-Blind Module-Load Guard)

**우리 사례** (2026-06-08 코드 리뷰, #368 시그널 5캐릭터 레이어): `signalCharacters.js` 끝에 `if (length >= 5) throw new Error(...)` 가드를 달았다. 두 문제가 겹쳤다 — (1) 이 throw는 함수 *호출 시점*이 아니라 **모듈 import 시점**에 실행된다. 상수가 훅→컴포넌트로 transitive import되므로, 위반 시 *앱 번들 전체*가 로드 단계에서 죽는다(기능 하나가 아니라 전 화면 흰 화면). (2) 동일한 불변식(캐릭터 5종 미만)을 이미 vitest `toBeLessThan(5)` 단언이 **빌드/CI 타임에** 보장한다. 즉 런타임 throw는 *더 싸고 안전한 게이트가 이미 막는 것*을 *훨씬 큰 폭발 반경*으로 다시 막는, 잎(leaf) 모듈의 날카로운 엣지다(실제 위험은 낮으나 — 5번째 추가는 dev/test에서 즉시 잡힘 — 장애 모드 자체가 부적절).

**근본 원인**: AI는 방어 가드(`throw`/`assert`/`invariant`)를 "그 값이 정의된 자리 바로 옆"에 배치한다. 그러나 그 코드가 *모듈 생애주기의 어느 시점에 실행되는지*(import 즉시 vs 호출 시), 그리고 실패가 *얼마나 멀리 전파되는지*(leaf 모듈을 transitive import하는 모든 소비자 = 번들 전체)를 모델링하지 않는다. 또한 같은 불변식을 더 싸고 폭발 반경이 작은 레이어(빌드 타임 테스트)가 이미 보장하는지 확인하지 않아, *한계 안전 0*의 방어를 catastrophic blast radius로 추가한다.

**발생 패턴**:
```js
// AI가 자주 생성하는 패턴 (잘못됨 — import 시점 실행 + 전역 폭발 반경)
export const SIGNAL_CHARACTERS = [ /* ... */ ];
if (SIGNAL_CHARACTERS.length >= 5) {
  throw new Error('캐릭터는 4종까지만');   // import 시 실행 → 위반 시 앱 전체 크래시
}
// 이미 vitest expect(...).toBeLessThan(5)가 빌드/CI 타임에 동일 불변식 보장

// 올바른 패턴 — 불변식은 빌드 게이트(테스트)에 맡기고 런타임 throw 제거
export const SIGNAL_CHARACTERS = [ /* ... */ ];
// 5번째 추가는 vitest가 빌드/CI에서 즉시 차단 (런타임 폭발 반경 0)
```

**영향**:
- leaf 상수 모듈의 import-time throw → 단일 기능 결함이 아니라 *전 화면 흰 화면*(번들 로드 실패)
- 같은 불변식을 두 레이어(테스트+런타임)가 중복 보장 → 추가된 건 안전이 아니라 폭발 반경뿐
- "방어적이라 안전하다"는 착시 — 실제론 가드 자체가 최악의 장애 모드를 도입

**왜 #20(중복 억제 지시문)과 다른가**: #20도 *과잉* 방어(겹치는 안전장치)지만, 그 중복이 낳는 해악은 *린트 노이즈*(미사용 disable 경고)다. 이 패턴의 중복은 *임포트 타임 전체 크래시*라는 catastrophic blast radius를 낳는다 — 잉여의 비용이 noise가 아니라 앱 다운이다. 또한 #20·#14 어디에도 없는 두 축을 도입한다: (a) *실행 시점*(import-time vs call-time), (b) *전파 반경*(leaf 모듈 → 모든 transitive 소비자).

**왜 #14(렌더 루프 내 재선언)와 다른가**: #14는 코드를 "처음 쓰이는 자리"에 둬서 *실행 빈도*(매 루프)를 오판한 것이다. 이 패턴은 코드를 "정의되는 자리"에 둬서 *실행 시점과 폭발 반경*을 오판한 것 — 둘 다 "배치 시 런타임 맥락 미고려" 가족이나, 오판한 축이 빈도 vs 시점/반경으로 다르다.

**해결책**:
- ✅ 불변식 검증은 *가장 싸고 폭발 반경이 작은 레이어*에 둔다: 빌드 타임 테스트(vitest) > 호출 시점 가드 > import 시점 throw. 테스트가 이미 막으면 런타임 throw 제거.
- ✅ 굳이 런타임 가드가 필요하면 모듈 top-level이 아니라 *함수 호출 경로 안*에 둬서 폭발 반경을 해당 기능으로 한정.
- ✅ 방어 코드 추가 전 자문: "이게 *언제* 실행되나(import vs 호출)? 실패하면 *어디까지* 죽나(이 기능 vs 번들 전체)? 같은 걸 더 싼 게이트가 이미 막나?"
- ✅ 리뷰 체크리스트: "모듈 top-level의 throw/assert가 transitive import 경로에 있는가?" → 있으면 빌드 게이트로 강등.

---

### 22. 위치 기반 CSS 셀렉터의 형제 구조 맹점 — 논리 인덱스 ≠ DOM 위치 (Positional CSS Selector Sibling Blindspot)

**우리 사례** (2026-06-08 코드 리뷰, #370 성적표 캐릭터 재설계): 부모 `<div>` 안에 헤더 `<p>` 다음으로 `{sorted.map((char) => <CharacterCard/>)}`를 렌더했다. `CharacterCard` 루트는 `border-t … first:border-t-0` — 의도는 "첫 카드만 상단 보더 제거". 그러나 부모의 *진짜* 첫 자식은 헤더 `<p>`라서 **어떤 카드도 `:first-child`가 되지 않는다.** 결과: (1) 첫 카드에도 상단 보더가 그려져 헤더 바로 아래 의도치 않은 구분선이 생기는 시각 결함, (2) `first:border-t-0`은 영원히 매치 안 되는 죽은 셀렉터. 기존 JS 인덱스 로직(`idx > 0 ? 'border-t' : ''`)을 CSS 위치 셀렉터로 치환하면서 깨졌다. VERDICT는 PASS(비차단 STYLE)였으나, 죽은 셀렉터 + 실제 시각 결함이 동시에 발생한 1건.

**근본 원인**: AI는 "`.map()`이 만드는 0번째 항목"(논리적 인덱스)과 "부모의 `:first-child`"(DOM 형제 서수)를 동일하다고 가정한다. 그러나 위치 기반 CSS 셀렉터(`:first-child`/`:last-child`/`:nth-child`, Tailwind `first:`/`last:`)는 *부모의 실제 형제 트리*에서 위치를 평가하지, 매핑된 리스트의 논리 인덱스를 보지 않는다. 헤더·구분선·조건부 형제가 항목들 앞에 끼어 있으면 이 등가성이 깨진다. AI는 "같은 부모의 자식으로 또 무엇이 있는가"라는 DOM 형제 구조를 능동적으로 모델링하지 않은 채, `idx===0` 가드를 더 "우아한" CSS 한 줄로 치환한다.

**발생 패턴**:
```jsx
// AI가 자주 생성 (잘못됨)
<div>
  <p>헤더</p>                         {/* ← 부모의 진짜 첫 자식 */}
  {items.map((it) => <Card className="border-t first:border-t-0" />)}
</div>
// 어떤 Card도 :first-child가 아님 → first:border-t-0 죽은 셀렉터 + 첫 카드 보더 누수

// 올바른 패턴 A — 논리 인덱스로 직접 제어
{items.map((it, idx) => <Card className={idx > 0 ? 'border-t' : ''} />)}

// 올바른 패턴 B — 항목만 전용 부모로 감싸 :first-child 등가성 복원
<div>
  <p>헤더</p>
  <div>{items.map((it) => <Card className="border-t first:border-t-0" />)}</div>
</div>
```

**영향**:
- 죽은 셀렉터 → 코드는 의도를 *주장*하지만 런타임에 무효. 린트·빌드 모두 무사 통과해 정적 분석으로 안 잡힘.
- 첫/마지막 항목 경계 스타일 누수(불필요한 구분선·여백·라운딩) → 미세 시각 결함으로 화면 확인 전엔 발견 어려움.
- JS 인덱스 로직의 명시적 의도가 CSS로 옮겨지며 *조용히* 소실. diff만 보면 "더 깔끔해진" 리팩토링으로 위장됨.

**왜 #14·#18과 다른가**:
- #14(렌더 루프 내 재선언)는 *함수 선언 위치*가 *실행 빈도*(매 루프)를 오판한 것. 여기선 *CSS 셀렉터의 매칭 조건*이 *DOM 형제 위치*에 의존함을 오판 — 둘 다 "배치" 가족이나 오판한 축이 다르다(실행 빈도 vs 셀렉터 매칭 컨텍스트).
- #18(암묵적 불변식)은 *현재 정합·미래 취약*. 여기선 *지금 이미* 죽은 셀렉터 + 시각 결함이 발생 중(시간축 반대).

**해결책**:
- ✅ 첫/마지막 경계 스타일은 형제 트리에 헤더·구분선 등 비균질 요소가 섞이면 `:first-child` 대신 논리 인덱스(`idx`)로 제어.
- ✅ 위치 셀렉터를 쓰려면 매핑 항목만 *전용 부모*로 감싸 항목이 진짜 첫/마지막 자식이 되도록 보장.
- ✅ JS 인덱스 가드 → CSS 위치 셀렉터 치환 시 자문: "이 요소가 부모의 실제 첫/마지막 자식인가? 다른 형제가 끼어 있지 않나?"
- ✅ 리뷰 체크리스트: "`first:`/`last:`/`nth-child`가 붙은 요소 위·아래에 같은 부모의 다른 형제(헤더·구분선)가 있는가?" → 있으면 죽은 셀렉터 의심.

---

*이 문서는 마켓레이더 v5 개발 과정에서 직접 경험한 사례를 바탕으로 작성되었다. (마지막 업데이트: 2026-06-08)*
