---
평가자: 장성민 (QA Lead)
날짜: 2026-03-31
대상: Phase 10 PR #8
라운드: R1
---

# Phase 10 QA 평가 — R1

## 평가 대상 파일

| 파일 | 역할 |
|------|------|
| `src/engine/whalePattern.js` (NEW) | 고래 연속 패턴 감지 엔진 |
| `src/components/home/SignalSummaryWidget.jsx` | 시그널 대시보드 위젯 (더보기+아이콘+클릭+공유) |
| `src/components/ChartSidePanel.jsx` | 종목별 시그널 통합 뷰 + 감성 트렌드 |
| `src/components/home/index.jsx` | 섹터 drill-down (SectorMiniWidget) |
| `src/components/WhalePanel.jsx` | 패턴 감지 엔진 연결 |

---

## 기획 범위 대조

| # | 기획 항목 | 구현 여부 | 구현 위치 |
|---|----------|----------|----------|
| 1 | 시그널 대시보드 위젯 (더보기+아이콘+클릭) | O | SignalSummaryWidget — TYPE_ICON 맵, expanded 토글, onItemClick 콜백 |
| 2 | 종목별 시그널 통합 뷰 (ChartSidePanel) | O | ChartSidePanel L972-988 — useSymbolSignals 훅으로 종목 시그널 렌더 |
| 3 | 시그널 카드 공유 (Web Share API) | O | SignalSummaryWidget L22-39 — navigator.share + clipboard 폴백 |
| 4 | 고래 연속 패턴 감지 엔진 | O | whalePattern.js — 4개 규칙 (연속입금/출금/양방향/대형단건) |
| 5 | 섹터 drill-down | O | index.jsx SectorMiniWidget — expandedSector 상태 + 종목 인라인 펼침 |
| 6 | 종목별 감성 누적 트렌드 | O | ChartSidePanel L724-731, L990-1012 — sentimentSummary + 미니 바 |

**6/6 항목 구현 확인.**

---

## 항목별 평가

### 1. 기능 완성도 (20점 만점, 가중치 x3 = 60점 만점)

| 세부 항목 | 점수 | 근거 |
|----------|------|------|
| 시그널 위젯 더보기 | 5/5 | allSignals > 3일 때 토글 버튼 표시, expanded 상태로 전체/3건 전환 |
| 시그널 타입별 아이콘 | 5/5 | TYPE_ICON 12개 타입 매핑, 미등록 타입은 방향별 이모지 폴백 |
| 시그널 클릭 → 종목 이동 | 4/5 | symbol 있는 시그널만 클릭 가능, cursor-pointer 조건 적용. 단 symbol 없는 시그널(공포탐욕 등)에 대한 대체 동작 없음 — minor |
| Web Share API 공유 | 5/5 | navigator.share 우선 + clipboard 폴백, e.stopPropagation으로 버블링 방지, 사용자 취소 catch 처리 |
| 종목별 시그널 통합 뷰 | 4/5 | useSymbolSignals 훅으로 해당 종목 시그널 필터 + 방향별 아이콘 + title/detail 표시. 시그널 0건일 때 섹션 숨김 처리 정상. 다만 시그널 강도 바(strength)가 여기서는 미표시 — 위젯에는 있는데 통합 뷰에는 없음 |
| 고래 연속 패턴 엔진 | 5/5 | 4개 규칙 모두 구현, windowMs 파라미터화, 코인별 그룹핑, strength cap(5), 빈 배열/null 방어 |
| 패턴 → 시그널 파이프라인 | 5/5 | WhalePanel L503-534 — 60초 인터벌, detectWhalePatterns 호출 → typeMap → createSignal → addSignal. 중복 제거는 signalEngine이 처리 |
| 섹터 drill-down | 5/5 | HOT/COLD 칩 클릭 토글, 종목 10개 인라인 렌더, 접기 버튼, onItemClick 연결 |
| 감성 누적 트렌드 | 4/5 | getNewsSentimentScore 5단계 점수 합산 → avg/count/label. 프로그레스 바 시각화 + 수치 표시. "누적" 트렌드라 하기엔 현재 뉴스 스냅샷의 평균일 뿐 — 시간축 변화 추적(예: 어제 vs 오늘) 없음 |

**소계: 42/45 → 20점 환산: 18.7/20**
**가중 점수: 18.7 x 3 = 56.1 / 60**

---

### 2. 코드 품질 (20점 만점, 가중치 x2 = 40점 만점)

| 세부 항목 | 점수 | 근거 |
|----------|------|------|
| 단일 책임 | 5/5 | whalePattern.js는 순수 감지만, signalEngine은 저장/구독만, hooks는 React 바인딩만 — 계층 분리 깔끔 |
| 함수 길이 | 4/5 | detectWhalePatterns 94줄 — 50줄 기준 초과하나 4개 규칙이 선형 나열이라 가독성 문제 없음. SectorMiniWidget 140줄 — 컴포넌트 자체로는 적정 |
| 타입 안전성 | 3/5 | 전체 JS 프로젝트라 TS 미적용은 프로젝트 제약이나, whalePattern.js에서 `e.tradeUsd || (e.tradeAmt || 0) / 1466` — 하드코딩 환율(1466)이 2곳(여기 + WhalePanel L557의 1450)에 서로 다른 값으로 존재. 상수 추출 필요 |
| 에러 핸들링 | 4/5 | shareSignal의 catch 블록, signalEngine 빈 입력 방어, whalePattern null/빈배열 방어 모두 양호. 다만 WhalePanel의 detectAndPush에서 패턴 감지 실패 시 catch 없음 — try-catch 감싸는 것 권장 |
| 매직 넘버 | 3/5 | `30 * 60 * 1000` (windowMs 기본값), `10_000_000` ($10M 임계값), `60_000` (감지 주기), `1466`/`1450` (환율) — 상수 추출 안 됨. 특히 환율 하드코딩은 P0 체크리스트 "가격 데이터 정확성" 위반 소지 |
| 코드 중복 | 4/5 | STABLECOIN_SYMBOLS가 whalePattern 외부(WhalePanel, signalEngine)에도 각각 정의. 3곳 중복 — 공통 상수로 추출 필요 |

**소계: 23/30 → 20점 환산: 15.3/20**
**가중 점수: 15.3 x 2 = 30.6 / 40**

---

### 3. UX/접근성 (20점 만점, 가중치 x2 = 40점 만점)

| 세부 항목 | 점수 | 근거 |
|----------|------|------|
| 터치 타겟 | 4/5 | 섹터 칩 `px-2 py-1`(대략 32x28px), 공유 버튼 `p-1`(대략 24x24px) — P0 기준 44px 미달 항목 있음. 시그널 카드 행 `py-2.5`는 충분 |
| 시각적 피드백 | 5/5 | 클릭 가능 항목에 cursor-pointer + hover:bg + active:bg + transition-colors 일관 적용 |
| 빈 상태 처리 | 5/5 | 시그널 0건 → "시그널 수집 중..." 표시, symbolSignals 0건 → 섹션 숨김, 섹터 데이터 없음 → null 반환 |
| 정보 밀도 | 4/5 | 시그널 위젯은 3건 요약 + 더보기 패턴으로 정보 과부하 방지. 감성 미니 바는 컴팩트. 다만 drill-down 종목 리스트 10개가 모바일에서 길어질 수 있음 |
| 공유 UX | 5/5 | Web Share API 네이티브 시트 → 미지원 시 클립보드 자동 폴백. 공유 텍스트에 방향 이모지 + 제목 + 앱 URL 포함 |
| 접근성 (a11y) | 3/5 | title 속성으로 시그널 타입 표시는 양호. 그러나 강도 바(5개 dot)에 aria-label 없음 — 스크린리더 사용자에게 정보 전달 불가. 공유 버튼에 aria-label 없음 |

**소계: 26/30 → 20점 환산: 17.3/20**
**가중 점수: 17.3 x 2 = 34.6 / 40**

---

### 4. 성능/안정성 (20점 만점, 가중치 x2 = 40점 만점)

| 세부 항목 | 점수 | 근거 |
|----------|------|------|
| 메모리 관리 | 5/5 | signalEngine MAX_SIGNALS=100 캡, WhalePanel MAX_EVENTS=30, seenChainIds 200개 초과 시 100개 정리 |
| 리렌더 최적화 | 4/5 | SectorMiniWidget의 sectors/expandedItems useMemo 적용. useCallback for handleClick. 다만 SignalSummaryWidget의 visibleSignals는 매 렌더마다 slice — 시그널 20개 수준이라 실질 영향 미미하나 useMemo 감싸면 더 깔끔 |
| 타이머 정리 | 5/5 | WhalePanel 패턴 감지 setInterval → cleanup clearInterval 확인. useEffect 의존성 배열 [isVisible, exchangeEvents, onchainEvents] 정확 |
| 레이스 컨디션 | 4/5 | signalEngine의 addSignal 중복 제거 로직이 같은 type+symbol 시 strength 비교 후 교체 — 동시 호출 시 이론적 경합 가능하나 JS 싱글스레드 특성상 실질 문제 없음. 다만 detectAndPush가 60초마다 전체 이벤트 재스캔하므로 동일 패턴 반복 생성 → addSignal 중복 제거에 의존. 이 설계는 의도적이나 불필요한 연산 |
| WebSocket 안정성 | 5/5 | 기존 WhalePanel WS 구독/해제 로직 유지, 패턴 감지는 이벤트 버퍼만 읽으므로 WS 안정성에 영향 없음 |

**소계: 23/25 → 20점 환산: 18.4/20**
**가중 점수: 18.4 x 2 = 36.8 / 40**

---

### 5. 테스트 가능성/유지보수성 (20점 만점, 가중치 x3 = 60점 만점)

| 세부 항목 | 점수 | 근거 |
|----------|------|------|
| 순수 함수 분리 | 5/5 | whalePattern.js는 순수 함수 — 입력 events + windowMs → 출력 patterns. 외부 의존성 0. 단위 테스트 즉시 가능 |
| signalEngine 테스트 인터페이스 | 5/5 | _resetStore() 노출, createSignal/addSignal 개별 export — 테스트 격리 용이 |
| 모듈 경계 | 4/5 | engine/ → hooks/ → components/ 3계층 분리 양호. 다만 WhalePanel이 직접 signalEngine import — 중간 hook 계층(useWhalePatterns) 없이 컴포넌트에서 엔진 직접 조작 |
| 설정 외부화 | 3/5 | 감지 윈도우(30분), 감지 주기(60초), $10M 임계값, 환율 등 비즈니스 파라미터가 코드 내 하드코딩. config 파일로 추출하면 운영 변경 시 코드 수정 불필요 |
| 관심사 분리 | 4/5 | 시그널 타입(signalTypes.js), 엔진(signalEngine.js), 훅(useSignals.js), 감지(whalePattern.js) 4파일 분리 — 구조 양호. newsSignal.js는 감성 점수 + 속보 판단 + 임팩트 분류가 한 파일에 혼재 — 250줄이지만 역할 3개 |

**소계: 21/25 → 20점 환산: 16.8/20**
**가중 점수: 16.8 x 3 = 50.4 / 60**

---

## 최종 점수

| 항목 | 원점수 (/20) | 가중치 | 가중 점수 |
|------|-------------|--------|----------|
| 1. 기능 완성도 | 18.7 | x3 | 56.1 |
| 2. 코드 품질 | 15.3 | x2 | 30.6 |
| 3. UX/접근성 | 17.3 | x2 | 34.6 |
| 4. 성능/안정성 | 18.4 | x2 | 36.8 |
| 5. 테스트/유지보수 | 16.8 | x3 | 50.4 |
| **합계** | | | **208.5 / 240** |

**비율: 86.9% — FAIL (90% 미달)**

---

## PASS 조건 미달 사유 (3.1% 부족)

### 반드시 수정 (PASS 차단)

1. **환율 하드코딩 불일치** — `whalePattern.js:80`의 `1466`과 `WhalePanel.jsx:557`의 `1450`이 서로 다름. 금융 앱에서 같은 계산에 다른 환율을 쓰는 것은 데이터 정확성 P0 위반. `KRW_RATE` 상수를 한 곳에서 import하거나, props로 전달해야 함.
2. **매직 넘버 상수 추출** — `$10,000,000` 임계값, `30 * 60 * 1000` 윈도우, `60_000` 감지 주기를 whalePattern.js 상단 또는 config에 명명 상수로 추출.
3. **STABLECOIN_SYMBOLS 3중 복제** — `WhalePanel.jsx:94`, `signalEngine.js:123`, (whalePattern에는 미사용이나 WhalePanel에서 사용). 공통 상수 파일로 통합.

### 강하게 권장 (점수 개선)

4. **공유 버튼 + 강도 바 aria-label** — 스크린리더 접근성. `aria-label="시그널 공유"`, 강도 바에 `aria-label="강도 3/5"`.
5. **모바일 터치 타겟** — 섹터 칩과 공유 버튼 최소 44x44px 확보 (`min-w-[44px] min-h-[44px]`).
6. **감성 트렌드 시간축 추적** — 현재는 스냅샷 평균. 최소한 "24시간 전 대비 변화" 한 줄이라도 추가하면 "누적 트렌드" 기획 의도에 부합.
7. **detectAndPush try-catch** — 패턴 감지 함수 호출부에 에러 핸들링 추가.

---

## 종합 소견

Phase 10의 6개 기획 항목이 모두 구현되었고, 시그널 엔진 아키텍처(타입 → 엔진 → 훅 → 컴포넌트)는 깔끔한 계층 분리를 보여준다. whalePattern.js가 순수 함수로 설계되어 단위 테스트 즉시 가능한 점, signalEngine의 중복 제거/만료/구독자 패턴이 견고한 점은 높이 평가한다.

그러나 **환율 하드코딩 불일치(1466 vs 1450)**는 금융 앱의 숫자 정확성 관점에서 수용 불가능하다. 같은 코드베이스에서 동일한 계산에 다른 상수를 쓰는 것은 Apple Card 시절이었으면 런칭 블로커였을 것이다. 매직 넘버 추출과 상수 통합이 완료되면 코드 품질 점수가 올라가 PASS 기준을 충족할 수 있다.

**R2에서 위 1~3번 수정 후 재평가 요청.**
