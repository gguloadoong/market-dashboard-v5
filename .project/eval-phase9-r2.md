---
평가자: 장성민 (QA Lead)
대상: PR #6 — feat: Phase 9 탐색 루프 연결 + 뉴스 클러스터링
라운드: R2
날짜: 2026-03-31
R1 점수: 197/240 (82.1%) — FAIL
---

# Phase 9 평가 — R2

## R1 P1 수정 사항 검증

### [P1-BUG] F&G 시그널 3시장 중복 제거 충돌

**R1 지적**: `createSignal({type: FEAR_GREED_SHIFT, symbol: null})` — 3시장 모두 `symbol: null`이므로 `addSignal`의 `type + symbol` 중복 제거에서 1개만 생존.

**R2 검증**:
- `src/hooks/useFearGreed.js` line 92: `symbol: market`
- `market` 값은 line 136-138에서 `'crypto'`, `'us'`, `'kr'`로 각각 전달
- `signalEngine.js` line 48-49: `s.type === signal.type && s.symbol === signal.symbol` — 이제 `FEAR_GREED_SHIFT + 'crypto'`, `FEAR_GREED_SHIFT + 'us'`, `FEAR_GREED_SHIFT + 'kr'`로 각각 다른 키
- 3시장 동시 구간 전환 시 3개 시그널 독립 저장 확인

**판정: 수정 완료. 버그 해소.**

참고: `signalEngine.js` line 338에 `createFearGreedSignal()` 헬퍼가 별도 존재하며 여전히 `symbol: null`이지만, 이 함수는 어디에서도 호출되지 않는 dead code다. 기능에 영향 없음. (P3 — 정리 권장)

### [P1-UX] StockBadge 터치 타겟 44px 미만

**R1 지적**: `px-1.5 py-0.5 text-[9px]` — 실측 높이 약 20px, 모바일 터치 타겟 미달.

**R2 검증**:
- `src/components/home/TopNewsSection.jsx` line 74: `className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1.5 min-h-[44px] rounded-full ..."`
- 변경점: `px-1.5` → `px-2`, `py-0.5` → `py-1.5`, `min-h-[44px]` 추가
- `min-h-[44px]`: CSS `min-height: 44px` — Apple HIG / WCAG 2.5.5 터치 타겟 최소 기준 충족
- `py-1.5` (6px x 2 = 12px 패딩) + `text-[9px]` (line-height ~14px) + `min-h-[44px]` 강제 — 실제 렌더 높이 44px 이상 보장
- `inline-flex items-center`: 세로 중앙 정렬로 텍스트가 44px 높이 내 중앙 배치

**판정: 수정 완료. 터치 타겟 44px 확보.**

시각적 부작용 검토: 뱃지 높이가 20px → 44px로 2배 이상 증가. 뉴스 카드 내 종목 뱃지 영역이 시각적으로 커짐. `text-[9px]`의 작은 글자 대비 높은 뱃지가 다소 불균형할 수 있으나, 터치 정확도가 디자인 균형보다 우선. 기능적 문제 없음.

---

## 5개 항목 전체 재채점

### 1. 기획 충실도 (가중 x3)

R1 점수: 19/20. 감점 사유: 클러스터 리드 선택 전략 (입력 순서 의존).

R2 변경 없음. 이 항목은 P2로 분류되어 R2 수정 대상이 아니었음.

**R2 점수: 19/20 (유지)**
**가중: 19 x 3 = 57 / 60**

---

### 2. 코드 품질 (가중 x2)

R1 점수: 17/20. 감점: `_tokens` 잔류(-1), 리드 선택 전략(-1), 의도 주석 부재(-1).

R2 변경 검증:
- `useFearGreed.js` line 92: `symbol: market` — 간결한 1줄 수정. 시그널 생성 인터페이스(`createSignal`)의 `symbol` 파라미터를 정확히 활용. 추가 필드나 해키한 우회 없음.
- `TopNewsSection.jsx` line 74: Tailwind 클래스 수정만으로 터치 타겟 확보. 별도 wrapper/overlay 없이 기존 요소에 직접 적용. 클린.
- line 92 주석 `// 시장별 고유 키 — null이면 3시장 중복 제거됨`: 버그 원인과 수정 의도를 한 줄로 명시. R1에서 지적한 "의도 주석 부재" 패턴 개선.

P2 항목(`_tokens`, 리드 선택)은 미수정이나 R2 스코프 외.

코드 품질 관점에서 R2 수정 자체의 품질이 우수하므로 +1 회복 (의도 주석 추가).

**R2 점수: 18/20 (+1)**
**가중: 18 x 2 = 36 / 40**

---

### 3. UX 완성도 (가중 x2)

R1 점수: 15/20. 감점: StockBadge 터치 타겟(-3), 클러스터 펼침 부재(-1), F&G 노티 없음(-1).

R2 변경 검증:
- StockBadge 터치 타겟: `min-h-[44px]` + `py-1.5` → 44px 확보. P0 체크리스트 충족. **+3 회복.**
- 클러스터 펼침: 미수정 (P2). -1 유지.
- F&G 즉각 노티: 미수정 (P2). -1 유지.

**R2 점수: 18/20 (+3)**
**가중: 18 x 2 = 36 / 40**

---

### 4. 안정성/엣지케이스 (가중 x2)

R1 점수: 14/20. 감점: F&G symbol:null 중복 제거(-3), pubDate 무효(-2), 빈 뱃지(-1).

R2 변경 검증:
- F&G `symbol: market` 수정 → 3시장 독립 시그널 보장. **+3 회복.**
  - 검증: `addSignal` dedup 키 = `type + symbol`. `FEAR_GREED_SHIFT + 'crypto'` / `FEAR_GREED_SHIFT + 'us'` / `FEAR_GREED_SHIFT + 'kr'` — 모두 고유. 동시 전환 시 3개 모두 생존.
  - `strength` 비교: 같은 시장 내 연속 전환(예: crypto가 공포→중립→탐욕) 시 기존 crypto 시그널 대비 strength 높은 것만 유지 — 이는 정상 동작 (최신 전환이 이전 전환보다 의미 있음).
- pubDate 무효: 미수정 (P2). -2 유지.
- 빈 뱃지: 미수정 (P2). -1 유지.

**R2 점수: 17/20 (+3)**
**가중: 17 x 2 = 34 / 40**

---

### 5. 탐색 루프 순환성 (가중 x3)

R1 점수: 16/20. 감점: 클러스터 펼침 경로 단절(-2), F&G→종목 직접 연결 없음(-1), 고래 단방향(-1).

R2 변경 검증:
- F&G 시그널이 이제 `symbol: 'crypto'`/`'us'`/`'kr'`로 저장됨. `getSignalsByMarket(market)` (signalEngine.js line 82-84)에서 시장별 필터 가능. 그러나 `symbol` 값이 시장명이지 종목 코드가 아니므로, `getSignalsBySymbol('crypto')`로 접근은 가능하지만 이것이 특정 종목 ChartSidePanel로 직접 연결되지는 않음.
- F&G는 시장 수준 지표이므로 종목 직접 연결이 본질적으로 불가능. 이 점은 R1과 동일.
- 클러스터 펼침, 고래 역방향: 미수정 (P2/스코프 외).

다만 F&G 시그널이 3시장 독립으로 정상 표시됨으로써, `SignalSummaryWidget`에서 사용자가 시장별 구간 전환을 구분하여 인지할 수 있게 되었음. 탐색 진입점으로서의 시그널 품질 향상. 미세 가점 +1.

**R2 점수: 17/20 (+1)**
**가중: 17 x 3 = 51 / 60**

---

## 종합

| # | 항목 | R1 원점수 | R2 원점수 | 변동 | 가중치 | R2 가중점수 |
|---|------|----------|----------|------|--------|-----------|
| 1 | 기획 충실도 | 19 | 19 | 0 | x3 | 57 |
| 2 | 코드 품질 | 17 | 18 | +1 | x2 | 36 |
| 3 | UX 완성도 | 15 | 18 | +3 | x2 | 36 |
| 4 | 안정성/엣지케이스 | 14 | 17 | +3 | x2 | 34 |
| 5 | 탐색 루프 순환성 | 16 | 17 | +1 | x3 | 51 |
| | **합계** | **197** | | **+8** | | **214 / 240** |

**달성률: 89.2% — FAIL (기준 90% = 216점, 2점 부족)**

---

## FAIL 사유 분석

216점까지 2점 부족. 잔여 감점 요인:

| 감점 | 항목 | 사유 | 분류 |
|------|------|------|------|
| -1 | 기획 충실도 | 클러스터 리드 선택이 입력 순서 의존 | P2 |
| -2 | 코드 품질 | `_tokens` 잔류 + 리드 선택 전략 부재 | P2/P3 |
| -2 | UX 완성도 | 클러스터 펼침 부재 + F&G 즉각 노티 없음 | P2 |
| -3 | 안정성 | pubDate null 방어(-2) + 빈 뱃지(-1) | P2 |
| -3 | 탐색 루프 | 클러스터 펼침 경로(-2) + 고래 단방향(-1) | P2/스코프외 |

2점을 회복하기 가장 현실적인 경로:
1. **pubDate null 방어** (안정성 +1~2): `newsCluster.js`에서 `timeA`/`timeB`가 NaN일 때 `continue` 추가 — 1줄 수정
2. **`_tokens` 클린업** (코드 품질 +1): `clusterNews` 반환 시 `delete lead._tokens` — 1줄 수정

이 두 가지만 수정하면 216점(90%) 도달 가능.

---

## P1 블로커

R2에서 P1 블로커 0건. R1의 P1 2건 모두 해소.

## R3 통과 조건

1. `newsCluster.js` pubDate 파싱 실패 방어 (NaN 체크)
2. `newsCluster.js` `_tokens` 필드 반환 시 제거
3. 수정 후 재평가 시 216점(90%) 이상

---

*89.2%. 2점 차이. pubDate NaN 방어 1줄, _tokens delete 1줄. 합치면 2줄이다. Apple Card QA 때도 마지막 2점은 항상 이런 방어 코드였다.*
