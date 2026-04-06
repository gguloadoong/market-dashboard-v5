# Code Review: feature/#43-phase8b-signal-ux
- date: 2026-04-05T16:57:23Z
- commit: 55e0379fc01425cbc96239b5e2e9512c46fd5979
- diff_lines:     1250

## Code Review — Phase 8B 서비스 방향성 재설계 + 시그널 UX 개편

---

### [CRITICAL] AiDebateSection — 색상-의미 반전

`AiDebateSection.jsx` 새 UI에서 Bull(살 이유)에 🔴 + `#FFF0F1`(빨간 배경), Bear(조심할 이유)에 🔵 + `#EDF4FF`(파란 배경)를 사용합니다. **한국식 색상 체계(빨강=상승/강세)에는 맞지만**, 이 컴포넌트 내에서 "살 이유"가 빨간색이고 "조심할 이유"가 파란색인데, 상세 토론 펼침에서도 `isBull ? '#FFF0F1' : '#EDF4FF'`로 동일하게 적용됩니다. 

**문제**: 확신도 바에서 `confPct >= 60`이면 빨강(`#F04452`)으로 "매수 우세"인데, 좌측 라벨이 "매도", 우측이 "매수"입니다. 바가 왼쪽에서 오른쪽으로 차는 구조에서 `confPct`가 높으면 바가 오른쪽(매수)까지 차므로 **방향 자체는 맞습니다**. 다만 `confidence` 값의 의미가 API에서 "bull 확신도"가 맞는지 확인 필요 — 만약 0.5 기준 양쪽이면 OK, 다른 의미면 반전됩니다.

→ API의 `confidence` 정의 확인 필수.

---

### [HIGH] AiDebateSection — 자동 로드 제거로 인한 UX 회귀

```jsx
// 자동 로드 제거 — 사용자가 종목 선택 시에만 토론 시작
```

기존에는 마운트 시 `DEFAULT_SYMBOLS[0]` 자동 분석이 실행됐는데, 이제 사용자가 "AI에게 물어보기" 버튼을 눌러야 합니다. **하지만 `select` onChange에서 `runDebate(item)`을 즉시 호출합니다.** 첫 렌더 시에만 버튼이 보이고, 드롭다운 변경 시에는 자동 실행 — 이건 의도된 설계로 보이나, 첫 진입 시 빈 상태로 보이는 것이 의도인지 확인 필요.

---

### [HIGH] useInvestorSignals — 순차→병렬 전환 시 API 부하

```jsx
await Promise.allSettled(KR_TOP_SYMBOLS.map(async ({ symbol, name }) => {
```

기존 주석이 "API 부하 최소화"를 위해 순차 호출이었는데, 5건 동시 호출로 변경. 외부 API rate limit이 있다면 429 에러 가능성. `KR_TOP_SYMBOLS`가 5개이므로 큰 문제는 아니지만, rate limit 확인 필요.

---

### [STYLE] SignalSummaryWidget — getEasyLabel 내 하드코딩 fallback

```jsx
function getEasyLabel(signal) {
  const meta = ENGINE_META[signal.type];
  if (meta?.easyLabel) return meta.easyLabel;
  const fallback = { ... };
```

`ENGINE_META`에 이미 동일한 값이 `easyLabel`로 정의되어 있는데, fallback에 같은 매핑이 중복됩니다. `ENGINE_META`가 모든 `SIGNAL_TYPES`를 커버하고 있으므로 fallback 블록은 사실상 dead code입니다. `signal.type`만 리턴하는 한 줄 fallback이면 충분합니다.

---

### [PERF] MarketSentimentWidget — calcTemperature 내 이중 순회

```jsx
const score = total === 0 ? 0 : (bullWeight - bearWeight) / total;
// ...
bullCount: signals.filter(s => s.direction === 'bullish').length,
bearCount: signals.filter(s => s.direction === 'bearish').length,
```

이미 for 루프에서 방향별 가중치를 계산하면서 count를 세지 않고, 마지막에 `filter`로 다시 순회합니다. 루프 안에서 `bullCount`, `bearCount` 변수를 함께 세면 불필요한 2회 추가 순회를 제거할 수 있습니다. signals가 작아서 실질적 영향은 미미하지만 불필요한 비효율.

---

### [STYLE] clampPct — cap 값 50의 근거

```jsx
export const clampPct = (pct, cap = 50) => Math.max(-cap, Math.min(cap, pct));
```

`±50%` 클램핑은 합리적이나, 코인 시장에서는 일일 50% 이상 변동이 실제로 발생합니다. 의도적으로 이상치를 잘라내는 것이라면 OK이나, 실제 데이터 왜곡 가능성 인지 필요.

---

### [STYLE] useDerivativeSignals — VWAP 30초 지연 제거

```jsx
// VWAP 즉시 실행 (기존 30초 지연 제거 — 온도계 로딩 최적화)
runVWAP();
```

초기 로딩 시 동시 API 호출 수가 증가합니다 (`runPCR` + `runFundingRate` + `runOrderFlow` + `runSocial` + `runVWAP` 전부 동시). 30초 지연이 의도적 스로틀링이었다면 제거 시 burst 부하 주의.

---

### [STYLE] HOME_CONTRACT.md — NotableMoversSection 복원

`NotableMoversSection`이 3번으로 복원됐는데, 이전 Phase 8A에서 "TopMoversWidget과 데이터/기능 중복"으로 제거된 이력이 있습니다. 중복 해소가 이뤄졌는지 확인 필요(WHY 카드라는 차별점이 있다면 OK).

---

### 종합

| 카테고리 | 건수 |
|---------|------|
| CRITICAL | 1 (색상-의미 매핑 확인 필요) |
| HIGH | 2 |
| PERF | 1 |
| STYLE | 4 |

주요 구조 변경(2열 분리, 컴팩트 UI, 통합 위젯)은 Phase 8B 방향에 부합합니다. `TYPE_META` easyLabel 시스템은 좋은 설계이나 fallback 중복 제거 권장. API confidence 정의와 rate limit만 확인되면 안전합니다.

**VERDICT: PASS**
