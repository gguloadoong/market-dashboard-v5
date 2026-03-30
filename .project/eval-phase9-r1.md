---
평가자: 장성민 (QA Lead)
대상: PR #6 — feat: Phase 9 탐색 루프 연결 + 뉴스 클러스터링
라운드: R1
날짜: 2026-03-31
---

# Phase 9 평가 — R1

## 평가 체계

| # | 항목 | 배점 | 가중치 | 최대 |
|---|------|------|--------|------|
| 1 | 기획 충실도 | 20 | x3 | 60 |
| 2 | 코드 품질 | 20 | x2 | 40 |
| 3 | UX 완성도 | 20 | x2 | 40 |
| 4 | 안정성/엣지케이스 | 20 | x2 | 40 |
| 5 | 탐색 루프 순환성 | 20 | x3 | 60 |
| | **합계** | | | **240** |

PASS 기준: 216점 (90%)

---

## 1. 기획 충실도 (가중 x3)

### 기획서 6개 요구사항 대비 검증

| # | 요구사항 | 구현 여부 | 검증 근거 |
|---|---------|----------|----------|
| 1 | 뉴스 배지 클릭 → 종목 이동 | **완료** | `TopNewsSection.jsx` StockBadge 컴포넌트: `onClick` → `onItemClick?.({symbol, name, _market})` (line 70-73). `e.stopPropagation()`으로 뉴스 클릭과 분리. `index.jsx` line 189에서 `onItemClick` prop 전달 확인. |
| 2 | 고래 알림 → 종목 상세 연결 | **완료** | `WhalePanel.jsx` EventRow: `linkedCoin = coinMap?.[event.symbol?.toUpperCase()]` → 카드 클릭 시 `onItemClick?.(linkedCoin)` (line 327-339). `BreakingNewsPanel.jsx`에서 `onItemClick` prop 패스스루 확인 (line 211). |
| 3 | 뉴스 클러스터링 (Jaccard 유사도) | **완료** | `newsCluster.js` 신규 파일: `tokenize()` 한국어 불용어 제거 + 2자 이상 필터, `jaccard()` 집합 유사도, `clusterNews()` 메인 함수 (threshold=0.4, maxTimeGapMs=6h). O(n^2) 그리디 클러스터링. |
| 4 | 속보 중복 제거 + 시간 감쇠 | **완료** | `BreakingNewsPanel.jsx`: (a) `clusterNews` import 후 `clusteredNews` useMemo (line 237-244), 대표 1건 + `_relatedCount` 접기. (b) `getBreakingBadge()` 함수: 1시간 경과 시 "속보" → "주요" 전환 (line 55-60). NewsItem에서 relatedCount > 0이면 "관련 보도 N건" 뱃지 표시 (line 124-129). |
| 5 | 관련 종목 연결 이유 태그 | **완료** | `ChartSidePanel.jsx` `getRelationReason()` 함수 (line 236-258): 3단계 로직 — (1) 같은 섹터, (2) 재벌 그룹주 (삼성/SK/LG/현대/한화), (3) 같은 마켓 동반 등락. 렌더: line 1113-1116에서 `<span className="bg-[#F2F4F6]">{relationReason}</span>` 표시. |
| 6 | F&G 전환 시점 시그널 연결 | **완료** | `useFearGreed.js`: `useFearGreedSignal()` 훅 신규 (line 69-108) — localStorage 기반 이전 구간 저장, `getZone()` 5구간 분류, 구간 변경 시 `createSignal({type: SIGNAL_TYPES.FEAR_GREED_SHIFT})` → `addSignal()`. crypto/us/kr 3개 시장 모두 연결 (line 136-138). |

**6/6 요구사항 완료. 누락 없음. 변형 없음.**

### 점수: 19/20

감점 -1: `newsCluster.js`의 클러스터링 알고리즘이 리드 기사 선택 시 "가장 먼저 등장한 기사"를 리드로 삼는데, 기획 의도상 "가장 많은 소스에서 보도된 기사" 또는 "임팩트 점수가 높은 기사"를 리드로 삼는 것이 더 적합하다. 현재는 입력 순서 의존.

**가중 점수: 19 x 3 = 57 / 60**

---

## 2. 코드 품질 (가중 x2)

### newsCluster.js
- **양호**: 순수 함수 설계, 외부 의존성 0, JSDoc 파라미터 문서화
- **양호**: `STOPWORDS` Set 사용으로 O(1) lookup
- **양호**: `tokenize`, `jaccard`, `clusterNews` 단일 책임 분리
- **지적 [P2]**: `clusterNews` O(n^2) — 뉴스 30건 기준 문제 없으나, 전체 탭에서 100건+ 시 성능 주의 필요. 현재 `BreakingNewsPanel`에서 `sortedNews`를 전달하며 all 탭은 30건 제한(`rawNews.slice(0, 30)`)으로 안전.

### TopNewsSection.jsx — StockBadge
- **양호**: `e.stopPropagation()` 정확한 이벤트 버블링 차단
- **양호**: `_market` 필드를 포함한 객체로 전달하여 App.jsx의 `setSelectedItem`과 호환
- **양호**: hover 상태(`hover:opacity-80 hover:shadow-sm`) + cursor-pointer로 인터랙션 힌트

### NewsFeedWidget.jsx
- **양호**: 순수 패스스루 컴포넌트, 관심사 분리 깔끔

### BreakingNewsPanel.jsx — 클러스터링 연결
- **양호**: `useMemo` 의존성 `[sortedNews]` 정확
- **양호**: `_tokens` 내부 필드가 렌더에 노출되지 않음 (clusterNews가 `{...n, _tokens}` 반환하지만 lead를 스프레드하므로 `_tokens`가 잔류 — 렌더에는 무해하나 메모리에 불필요)
- **지적 [P3]**: `_tokens` Set이 클러스터 결과에 잔류. `delete c.lead._tokens` 또는 반환 시 제거 권장. 기능에 영향 없음.

### ChartSidePanel.jsx — getRelationReason
- **양호**: null 방어 (`if (!rel || !targetItem) return null`)
- **양호**: 3단계 fallback 로직이 우선순위대로 정렬 (섹터 > 그룹주 > 동반 등락)
- **양호**: 재벌 그룹 매핑에 영문명 포함 (Samsung, Hyundai 등)

### useFearGreed.js — 시그널 연결
- **양호**: `useRef` + `localStorage` 이중 저장으로 세션/탭 간 구간 유지
- **양호**: `useEffect` 의존성 `[score, market, storageKey]` 정확
- **양호**: `signalEngine`의 `createSignal` + `addSignal` 표준 API 사용
- **지적 [P3]**: `prevRef.current === null` 체크에서 localStorage에 값이 없으면 `stored = null` → `prevRef.current = score`로 설정되어 첫 로드 시 시그널 미발행. 이는 의도된 동작(첫 로드 스팸 방지)이지만 주석이 없어 의도 불명확.

### 점수: 17/20

감점 사유:
- -1: `_tokens` 잔류 (미미하지만 클린코드 기준 미달)
- -1: `clusterNews` 리드 선택 전략 부재 (첫 번째 = 리드, 품질 기반 선택 아님)
- -1: `useFearGreedSignal` 첫 로드 스팸 방지 로직에 의도 주석 없음

**가중 점수: 17 x 2 = 34 / 40**

---

## 3. UX 완성도 (가중 x2)

### StockBadge 터치 타겟
- 클래스: `px-1.5 py-0.5 text-[9px]` — 실측 예상 높이 약 20px
- **지적 [P1]**: 모바일 터치 타겟 44px 미만. Apple HIG / WCAG 2.5.5 위반. P0 체크리스트 "터치 타겟 44px 이상" 항목 불충족.
- 뱃지 자체가 작아야 하는 디자인 제약이 있으나, `min-h-[44px] min-w-[44px]` 또는 투명 패딩 영역 확장이 필요.

### 속보 시간 감쇠
- 1시간 기준 "속보" → "주요" 전환: 사용자 인지에 적합
- 색상 차별화: 속보(빨강 #F04452) → 주요(주황 #FF9500): 시각적 위계 명확

### 클러스터 접기 UI
- "관련 보도 N건" 뱃지: `text-[10px] bg-[#F2F4F6] rounded-full` — 비파괴적 정보 제공
- **지적 [P2]**: 클릭하여 관련 보도를 펼치는 기능 없음. "N건"만 표시하고 열람 불가. 탐색 루프 관점에서 관련 보도 접근 경로가 차단됨.

### 연결 이유 태그
- `text-[9px] bg-[#F2F4F6] rounded` — 종목 카드 하단에 비파괴적 표시
- "같은 반도체 섹터", "삼성 그룹주", "동반 상승" 등 사용자에게 맥락 제공
- truncate 처리로 긴 텍스트 대응

### F&G 시그널 사용자 표면
- 시그널 엔진에 `addSignal()`로 추가되지만, 사용자에게 직접 보이는 UI는 `SignalSummaryWidget`을 통해 간접 표시됨
- 즉각적 토스트/배너 없음 — 구간 전환 시 사용자가 인지하기 어려울 수 있음

### 점수: 15/20

감점 사유:
- -3: StockBadge 터치 타겟 44px 미만 (P0 체크리스트 위반)
- -1: 클러스터 관련 보도 펼침 기능 부재
- -1: F&G 구간 전환 시 즉각적 사용자 노티피케이션 없음

**가중 점수: 15 x 2 = 30 / 40**

---

## 4. 안정성/엣지케이스 (가중 x2)

### newsCluster.js 엣지케이스
- **빈 배열**: `clusterNews([])` → `clusters = []` 반환. 안전.
- **title null**: `tokenize(null)` → `new Set()` 반환 → `jaccard(empty, any)` → 0. 안전.
- **pubDate 무효**: `new Date(undefined).getTime()` → NaN → `Math.abs(NaN) > maxTimeGapMs` → false(NaN 비교) → **시간 필터 우회**. 잠재적 문제: pubDate 없는 기사끼리 유사도만으로 클러스터링됨.
- **지적 [P2]**: pubDate 파싱 실패 시 `timeA = 0, timeB = 0` → `timeDiff = 0` → 시간 필터 통과. 의도와 다를 수 있음. `if (!timeA || !timeB) continue;` 방어 권장.

### StockBadge 엣지케이스
- `stock.pct` undefined: `stock.pct > 0` → false, `stock.pct < 0` → false → 중립 색상. 안전.
- `stock.name` null: `stock.name?.slice(0, 6)` → undefined → 빈 표시. 안전하지만 시각적으로 빈 뱃지.
- `onClick` prop 없음: `onClick?.()` 옵셔널 체이닝. 안전.

### BreakingNewsPanel 클러스터링
- `sortedNews` 빈 배열 → `useMemo` 내 early return `[]`. 안전.
- 대량 뉴스: all 탭 30건 제한 (`rawNews.slice(0, 30)`), 카테고리 탭은 전체. 최악 100건 → O(100^2) = 10K 비교. 브라우저에서 수 ms 내 완료. 안전.

### useFearGreedSignal
- `score == null` → early return. 안전.
- localStorage 접근 실패 (프라이빗 모드): `localStorage.getItem` → null → `prevRef.current = score` → 첫 로드 시그널 미발행. 안전하지만 기능 저하.
- 3개 시장 동시 구간 전환: 각각 독립 `useEffect` → 3개 시그널 동시 발행 → `signalEngine` 중복 제거 로직(`type + symbol` 기반)에서 `symbol = null`이므로 3개 모두 같은 키로 취급됨. **지적 [P1]**: crypto/us/kr 모두 `symbol: null`로 시그널 생성 → 같은 `type + symbol` 조합 → `addSignal` 중복 제거에서 strength 높은 것만 유지, 나머지 2개 소실. 즉 3개 시장 중 1개만 시그널 표시됨.

### getRelationReason
- 둘 다 섹터 없음 → 그룹주 체크 → 둘 다 이름 없음 → 마켓 체크 → `Math.abs(0) > 1` false → `return null`. 안전.

### 점수: 14/20

감점 사유:
- -3: F&G 시그널 `symbol: null` 중복 제거 버그 — 3개 시장 중 1개만 생존 (P1 버그)
- -2: pubDate 무효 시 시간 필터 우회 가능성
- -1: StockBadge name null 시 빈 뱃지 렌더

**가중 점수: 14 x 2 = 28 / 40**

---

## 5. 탐색 루프 순환성 (가중 x3)

### 기획 의도
"탐색 루프"란 사용자가 하나의 정보 노드에서 출발하여 관련 정보를 따라 순환적으로 탐색할 수 있는 구조를 의미한다.

### 경로 검증

#### 경로 A: 뉴스 → 종목 → 관련종목 → (뉴스)
1. **홈 뉴스** (`TopNewsSection`) → StockBadge 클릭 → `onItemClick` → `App.setSelectedItem` → `ChartSidePanel` 오픈
2. **ChartSidePanel** → 관련 종목 카드 → `onRelatedClick` → `handleChartRelatedClick` → `setSelectedItem(newItem)` → 새 종목 ChartSidePanel
3. **ChartSidePanel** → 뉴스 섹션 → `onNewsClick` → `setSelectedNews` → `NewsSidePanel` 오픈
4. **NewsSidePanel** → 관련 종목 → `onRelatedClick` → `handleNewsRelatedClick` → `setNewsContext(selectedNews)` + `setSelectedItem(item)` → ChartSidePanel (뉴스 맥락 포함)

**순환 완성: 뉴스 → 종목 → 관련종목 → 뉴스 → 종목 (무한 탐색 가능)**

#### 경로 B: 고래 → 종목 → 뉴스
1. **BreakingNewsPanel** 고래 탭 → `WhalePanel` EventRow → `linkedCoin` 존재 시 카드 클릭 → `onItemClick` → `App.setSelectedItem` → `ChartSidePanel`
2. **ChartSidePanel** → 뉴스 → 관련 종목 → 경로 A 합류

**고래 → 종목 연결 완성. 단, 종목 → 고래 역방향 경로는 없음 (기획 범위 외).**

#### 경로 C: F&G → 시그널 → 종목
1. `useFearGreed` → 구간 전환 감지 → `addSignal()` → 시그널 엔진
2. `SignalSummaryWidget` → 시그널 표시 → 사용자 인지
3. 시그널에서 종목 직접 연결: `symbol: null`이므로 특정 종목으로 직접 이동 불가

**F&G 시그널은 시장 수준 정보 → 종목 연결은 간접적 (시그널 목록에서 다른 종목 시그널 옆에 표시). 완전한 탐색 루프는 아니지만 기획서 요구("F&G 전환 시점 시그널 연결")는 충족.**

### 루프 끊김 지점

1. **클러스터 관련 보도 → 열람 불가**: "관련 보도 N건" 표시되지만 클릭하여 원문 접근 불가. 탐색 경로 단절.
2. **F&G 시그널 → 종목 직접 이동 불가**: `symbol: null`이므로 종목 상세로 직접 점프하는 경로 없음.
3. **고래 → 종목 역방향 없음**: ChartSidePanel에서 해당 종목의 고래 이벤트를 볼 수 없음 (기획 범위 외이므로 감점 최소화).

### 점수: 16/20

감점 사유:
- -2: 클러스터 관련 보도 열람 경로 부재 (탐색 단절)
- -1: F&G 시그널 → 종목 직접 연결 경로 없음
- -1: 고래 연결이 단방향 (고래→종목은 있으나 종목→고래 없음)

**가중 점수: 16 x 3 = 48 / 60**

---

## 종합

| # | 항목 | 원점수 | 가중치 | 가중점수 |
|---|------|--------|--------|---------|
| 1 | 기획 충실도 | 19 | x3 | 57 |
| 2 | 코드 품질 | 17 | x2 | 34 |
| 3 | UX 완성도 | 15 | x2 | 30 |
| 4 | 안정성/엣지케이스 | 14 | x2 | 28 |
| 5 | 탐색 루프 순환성 | 16 | x3 | 48 |
| | **합계** | | | **197 / 240** |

**달성률: 82.1% — FAIL (기준 90%)**

---

## P0/P1 블로커 (머지 전 필수 수정)

### [P1-BUG] F&G 시그널 3시장 중복 제거 충돌
- **파일**: `src/hooks/useFearGreed.js` line 90-91
- **재현**: crypto/us/kr 동시 구간 전환 시
- **기대**: 3개 독립 시그널 발행
- **실제**: `createSignal({type: FEAR_GREED_SHIFT, symbol: null})` → `addSignal`에서 `type + symbol` 동일 → 1개만 생존
- **수정**: `symbol` 대신 `market` 값을 전달하거나, `addSignal` 중복 키에 market 포함
- **영향**: F&G 시그널 유실 → 사용자가 시장별 구간 전환 인지 불가

### [P1-UX] StockBadge 터치 타겟 44px 미만
- **파일**: `src/components/home/TopNewsSection.jsx` line 74
- **재현**: 모바일에서 뉴스 카드 내 종목 뱃지 탭
- **기대**: 정확한 터치 응답
- **실제**: 뱃지 높이 약 20px → 오탭/뉴스 클릭과 혼동
- **수정**: 투명 확장 영역 또는 `min-h-[44px]` 터치 타겟 보장
- **영향**: 모바일 사용자 탐색 루프 진입 실패

---

## P2 개선 권장

| # | 항목 | 파일 | 내용 |
|---|------|------|------|
| 1 | 클러스터 리드 선택 | `newsCluster.js` | 입력 순서 대신 소스 수/임팩트 점수 기준 리드 선택 |
| 2 | 클러스터 펼침 UI | `BreakingNewsPanel.jsx` | "관련 보도 N건" 클릭 시 관련 기사 목록 펼침 |
| 3 | pubDate null 방어 | `newsCluster.js` | `timeA/timeB`가 0이면 시간 필터 스킵 대신 continue |
| 4 | _tokens 클린업 | `newsCluster.js` | 반환 시 `_tokens` 필드 제거 |
| 5 | F&G 전환 토스트 | `useFearGreed.js` | 구간 전환 시 사용자 토스트/배너 표시 |

---

## R2 통과 조건

1. P1-BUG (F&G 중복 제거) 수정
2. P1-UX (터치 타겟) 수정
3. 수정 후 재평가 시 216점(90%) 이상

---

*평가 완료. Apple Card 출시 때도 터치 타겟 1px 부족해서 리젝 먹었다. 44px는 타협 불가.*
