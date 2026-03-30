# Phase 8 평가 보고서 (R2)

## 평가 대상
- 브랜치: `fix/eslint-cleanup` (Phase 8 P0 수정 4건 반영 후)
- 기획서: `.project/strategy-plan-v1.md` Phase 8 (영역 1: 투자 시그널 시스템, 7개 항목)
- Round 1 점수: 173/240 (72.1%, B/REWORK)

## 평가자
- 장성민 (QA 리드) -- 코드 레벨 검증 + 정량 평가

---

## Round 1 대비 변경사항 검증

### P0-1: 외국인/기관 연속 매수매도 시그널 실제 발화
**상태: 해소됨**

`src/hooks/useInvestorSignals.js` (신규) 확인 결과:
- `scanInvestorTrends()` 함수가 KR_TOP_SYMBOLS 5종목(삼성전자, SK하이닉스, LG에너지솔루션, 삼성바이오로직스, 현대차)에 대해 `fetchInvestorTrendGateway(symbol, 10)` 호출
- 응답 데이터를 `calcConsecutive(data, 'foreign')` / `calcConsecutive(data, 'institution')`으로 연속일수 계산
- 3일 이상 연속 시 `createInvestorSignal()` 호출하여 시그널 엔진에 등록
- 외국인 순매수/순매도 + 기관 순매수/순매도 4가지 경로 모두 구현

검증 포인트:
- `calcConsecutive` 로직이 최신일부터 역순으로 연속 체크하며 totalAmt 누적 -- 정확
- `CONSECUTIVE_THRESHOLD = 3` -- 기획서 "3일+ 연속" 조건 일치
- `strength = Math.min(consecutiveDays, 5)` -- 기획서 "연속일수 비례" 일치
- `fetchInvestorTrendGateway`는 `_gateway.js` L157에 `{ t: 'it', s: symbol, d: days }`로 정의되어 있어 실제 API 연결 확인됨

잔여 이슈:
- KR_TOP_SYMBOLS가 하드코딩 5종목으로 제한. 기획서는 종목 범위를 명시하지 않았으나, 시총 상위 5개만 커버하면 코스피 전체 대비 커버리지가 낮음. 다만 API 부하 최소화를 위한 합리적 트레이드오프로 판단 (P2 수준)

### P0-2: 거래량 이상치 시그널 실제 발화
**상태: 해소됨**

`src/hooks/useInvestorSignals.js`의 `scanVolumeAnomalies(allItems)` 확인:
- 마켓별(KR/US/COIN) 중앙값 계산 후, 개별 종목 거래량이 중앙값 x 3배 이상 시 `createVolumeSignal()` 호출
- `allItems` 파라미터는 `HomeDashboard`에서 `useInvestorSignals(allItems)`로 전달 (index.jsx L138)

검증 포인트:
- `calcMedianVolume(items, market)` -- 중앙값 계산 정확 (홀수/짝수 분기 처리)
- 기획서는 "20일 평균 대비 3배+"이나 구현은 "마켓 전체 중앙값 대비 3배" -- **기획서와 기준이 다름**. 개별 종목의 20일 이동평균이 아닌 마켓 전체 중앙값을 사용. 이는 종목별 평소 거래량을 반영하지 못해 대형주는 항상 시그널 발화하고 소형주는 거의 발화하지 않는 편향이 있음. 그러나 20일 히스토리 데이터가 클라이언트에 없는 상황에서의 현실적 대안으로 인정 가능 (P1 수준)

### P0-3: createWhaleSignal USD 단위 명확화
**상태: 해소됨**

`signalEngine.js` L216-281 확인:
- `event` 객체에서 `tradeAmt`(원화), `tradeUsd`(달러), `amount`(기존 호환) 3가지 경로로 금액 수신
- `_formatUsd(usd)` 함수 추가 ($1.2M / $3.5B 형태)
- 금액 표시: USD+KRW 동시 존재 시 `"$3.5M (50억원)"` 형태로 병기
- USD만 있을 때 `_formatUsd`, KRW만 있을 때 `_formatAmount` 단독 사용
- strength 계산도 USD 우선, 없으면 KRW 기준으로 분기

Round 1의 "amount 단위 불명확" 문제가 완전히 해소됨. 병기 방식은 사용자가 직관적으로 금액 규모를 파악할 수 있어 우수.

### P0-4: 시그널 UI 연결 (SignalSummaryWidget)
**상태: 해소됨**

`src/components/home/SignalSummaryWidget.jsx` (신규) 확인:
- `useTopSignals(3)` 훅으로 상위 3개 시그널 구독
- 방향별 이모지(bullish 초록/bearish 빨강/neutral 노랑)
- 강도 바 1~5 (방향별 색상 차별화)
- title + detail/meta 표시
- 빈 상태 "시그널 수집 중..." 처리

`index.jsx` L149에서 `MarketPulseWidget` 바로 아래에 배치 -- 기획서 S2의 "Market Pulse 아래 오늘의 시그널 요약" 의도에 정확히 부합.

`HOME_CONTRACT.md`에도 3번 항목으로 등록 확인.

---

## 기획 항목 최종 대조표

| # | 기획 항목 | R1 상태 | R2 상태 | 구현 파일 | 비고 |
|---|----------|---------|---------|----------|------|
| 1 | 시그널 엔진 코어 + 스키마 | 완료 | 완료 | signalEngine.js, signalTypes.js, useSignals.js | 12타입, CRUD, 구독, TTL, 중복 제거 |
| 2 | 뉴스 감성 5단계 확장 | 완료 | 완료 | newsSignal.js | 4그룹 키워드, getNewsSentimentScore, getSentimentStyle |
| 3 | 외국인/기관 연속 매수매도 시그널 | 부분(헬퍼만) | **완료** | useInvestorSignals.js | 5종목 5분 폴링, 연속일수 계산, 4경로 시그널 발화 |
| 4 | 거래량 이상치 감지 시그널 | 부분(헬퍼만) | **완료** | useInvestorSignals.js | 마켓별 중앙값 기준 3배 이상 시 발화 |
| 5 | 고래 시그널 강도 시각화 | 완료 | 완료 | WhalePanel.jsx | 3단계 등급(normal/notable/major) |
| 6 | 스테이블코인 특수 로직 | 완료 | 완료 | signalEngine.js, WhalePanel.jsx | 방향성 반전, USD/KRW 병기 |
| 7 | WHY 카드 이유 추론 확장 | 완료 | 완료 | NotableMoversSection.jsx | 뉴스->거래량->변동폭 3단계 fallback |

**7/7 항목 완료. Round 1의 부분 구현 2건 모두 해소.**

---

## 채점

### 1. 기획 의도 부합 (가중치 x3)

**점수: 18/20**

근거:
- 7/7 항목 완료. Round 1에서 미완이었던 외국인/기관 시그널(#3)과 거래량 이상치(#4) 모두 실제 데이터 파이프라인 연결 완료
- useInvestorSignals 훅이 HomeDashboard에서 호출되어 앱 로딩 시 자동 스캔 시작
- SignalSummaryWidget이 기획서 S2 "시그널 대시보드 위젯"의 최소 구현으로 시그널을 사용자에게 노출
- 기획서의 "데이터를 시그널로 변환하는 해석 레이어" 목표에 부합

감점 사유 (-2):
- 거래량 이상치 기준이 기획서(20일 평균 대비)와 다름(마켓 중앙값 대비). 대안 구현으로 인정하나 정확한 기획 반영은 아님
- KR_TOP_SYMBOLS 5종목 하드코딩. 동적 확장 가능한 구조가 아님

### 2. 투자 인사이트 제공 (가중치 x2)

**점수: 18/20**

근거:
- 외국인/기관 연속 매수매도 시그널이 실제 발화되어 "삼성전자 외국인 5일 연속 순매수 (3200억원)" 같은 인사이트 제공
- 거래량 이상치 감지로 "SK하이닉스 거래량 평소 대비 4.2배" 같은 이상 징후 알림
- SignalSummaryWidget에서 상위 3개 시그널을 홈 최상단에 표시하여 즉시 체감 가능
- 고래 시그널의 USD/KRW 병기로 글로벌 투자자 관점 금액 규모 파악 용이
- WHY 카드 3단계 fallback은 "왜 이 종목이 움직이는가"에 대한 실질적 답변

감점 사유 (-2):
- 시그널 상세 드릴다운 없음. 시그널 클릭 시 해당 종목 상세로 이동하는 인터랙션 미구현
- 시그널 히스토리/트렌드 표시 없음 (현재 활성 시그널만 표시)

### 3. 차별화 시그널 경험 (가중치 x2)

**점수: 17/20**

근거:
- Round 1 대비 극적 개선: 시그널 엔진이 실제로 시그널을 생산하고 UI에서 소비
- useTopSignals(3)으로 상위 시그널 자동 선별, 강도 바(1~5) 시각화
- 방향별 색상 코딩(bullish/bearish/neutral)이 직관적
- 스테이블코인 방향성 반전 해석은 국내 타 서비스에서 보기 어려운 차별점
- 5분 간격 자동 폴링으로 실시간성 확보

감점 사유 (-3):
- 시그널 위젯이 단순 리스트 형태. 기획서 S2의 "오늘의 시그널 (3건)" 예시처럼 시그널 수 뱃지나 시간 경과 표시가 없음
- 종목별 시그널 통합 뷰(기획서 S3: ChartSidePanel 확장)는 Phase 8 범위 외이나, 시그널을 소비하는 경로가 홈 위젯 1개뿐이라 경험의 깊이가 얕음
- 시그널 간 우선순위/긴급도 시각 차별화 부족 (strength 5짜리와 2짜리의 차이가 바 개수뿐)

### 4. 디자인/UX 직관성 (가중치 x2)

**점수: 17/20**

근거:
- SignalSummaryWidget 디자인이 기존 위젯들과 일관됨 (bg-white, rounded-2xl, shadow-sm, 13px bold 헤더)
- 강도 바 5개가 방향별 색상(초록/빨강/주황)으로 구분되어 직관적
- 빈 상태 "시그널 수집 중..." 처리로 초기 로딩 시 빈 화면 방지
- 모바일 터치 타겟: 각 시그널 행이 py-2.5 + px-4로 충분한 터치 영역 (약 40px 높이)

감점 사유 (-3):
- 모바일 터치 타겟이 44px 미만일 가능성. py-2.5(10px) + 12px 텍스트 + 11px 서브텍스트 + mt-0.5 = 약 38px. P0 체크리스트 44px 기준 미달 가능성
- "실시간" 라벨이 오해 소지. WebSocket 실시간이 아니라 5분 폴링. "5분마다 갱신" 또는 마지막 갱신 시간 표시가 더 정확
- 시그널 0건일 때 "시그널 수집 중..." 이 계속 표시되면 데이터가 없는 건지 로딩 중인 건지 구분 불가

### 5. 정확도/커버리지 (가중치 x3)

**점수: 16/20**

근거:
- createWhaleSignal의 USD/KRW 단위 문제 완전 해소. 병기 방식으로 오해 여지 제거
- 외국인/기관 연속일수 계산 로직(calcConsecutive)이 정확. 최신일부터 역순 체크, 부호 전환 시 즉시 중단
- strength 계산: 투자자 시그널은 consecutiveDays(최대 5), 거래량은 ratio 기반(3/4/5), 고래는 USD/KRW 금액 기반 -- 모두 기획서 "비례" 조건 충족
- signalTypes.js의 TTL이 기획서 스키마와 정확히 일치 (투자자 24h, 고래 30min, 뉴스 2h)

감점 사유 (-4):
- 거래량 이상치 기준 불일치: 기획서 "20일 평균 대비 3배"인데 구현은 "마켓 전체 중앙값 대비 3배". 대형주(삼성전자)는 항상 시장 중앙값 이상이므로 거래량이 평소와 같아도 시그널 발화할 수 있음 -- false positive 위험
- Round 1 P1 미해소: 감성 점수 복합 키워드 처리("급락 후 반등" = -2 반환). 첫 매칭 반환 방식의 한계가 여전히 존재
- Round 1 P1 미해소: 영문 감성 키워드 부족. STRONG_POSITIVE에 'all-time high', 'surge' 등 없음. 미장 뉴스 커버리지 미흡
- scanInvestorTrends에서 API 실패 시 개별 catch로 다음 종목 계속하는 것은 좋으나, 연속 실패에 대한 backoff 로직 없음

---

## 점수 집계

| # | 항목 | R1 점수 | R2 점수 | 가중치 | R2 가중점 |
|---|------|---------|---------|--------|-----------|
| 1 | 기획 의도 부합 | 14/20 | **18/20** | x3 | 54/60 |
| 2 | 투자 인사이트 제공 | 15/20 | **18/20** | x2 | 36/40 |
| 3 | 차별화 시그널 경험 | 14/20 | **17/20** | x2 | 34/40 |
| 4 | 디자인/UX 직관성 | 17/20 | **17/20** | x2 | 34/40 |
| 5 | 정확도/커버리지 | 13/20 | **16/20** | x3 | 48/60 |

**총 가중 점수: 206/240 (85.8%)**
**판정: B+ (CONDITIONAL PASS -- 소폭 미달, P1 수정 후 재평가 없이 진행 가능)**

---

## 90% 미달 근거 및 잔여 항목

### PASS 기준(216/240, 90%)까지 10점 부족

주요 감점 요인 3가지:
1. **거래량 이상치 기준 불일치** (항목 1, 5에 걸쳐 -3점 상당): 기획서 "20일 평균 대비"와 구현 "마켓 중앙값 대비"의 차이. false positive 위험
2. **감성 점수 복합 키워드 미처리** (항목 5에서 -2점 상당): Round 1 P1 미해소
3. **모바일 터치 타겟 44px 미달 가능성** (항목 4에서 -1점 상당): SignalSummaryWidget 행 높이 검증 필요

### P1 잔여 항목 (Phase 9 착수 전 권장)

- [ ] **거래량 이상치 기준 보정**: 마켓 중앙값이 아닌 종목별 평소 거래량(최근 N일 평균) 기준으로 변경. 클라이언트에 히스토리 없으면 최소한 시가총액/거래량 비율로 정규화
- [ ] **감성 점수 상쇄 로직**: positive/negative 키워드 동시 매칭 시 양쪽 점수 합산하여 상쇄. 예: "급락(-2) 후 반등(+1)" = -1
- [ ] **영문 감성 키워드 추가**: STRONG_POSITIVE에 'all-time high', 'surge', 'rally', 'beat expectations', STRONG_NEGATIVE에 'crash', 'plunge', 'miss expectations', 'bankruptcy' 등

### P2 잔여 항목 (Phase 10 이전 해소 권장)

- [ ] **SignalSummaryWidget 터치 타겟 보정**: 행 높이 최소 44px 보장 (py-3 이상)
- [ ] **"실시간" 라벨 정정**: "5분 갱신" 또는 마지막 갱신 타임스탬프로 교체
- [ ] **시그널 0건 상태 분기**: 로딩 중 vs 실제로 시그널 없음 구분 (초기 3초 대기 중엔 스피너, 이후 "현재 활성 시그널 없음")
- [ ] **KR_TOP_SYMBOLS 동적 확장**: allItems에서 거래량/시가총액 상위 N개를 자동 선별하는 방식 검토

---

## 잘된 점 (Round 2 추가)

- **useInvestorSignals 훅 설계가 견고**: useEffect 클린업(clearTimeout + clearInterval), runningRef로 중복 실행 방지, document.hidden 체크로 비활성 탭 불필요 호출 방지
- **calcConsecutive 로직이 간결하고 정확**: 최신일부터 연속 체크, 부호 전환 즉시 중단, totalAmt 누적
- **SignalSummaryWidget이 기존 디자인 시스템과 완벽 일치**: 색상 팔레트(#191F28, #B0B8C1, #F2F4F6), 라운딩(rounded-2xl), 타이포(13px bold 헤더, 12px 본문, 11px 서브)
- **강도 바 시각화가 효과적**: 5칸 바 + 방향별 색상으로 시그널 강도를 한 눈에 파악
- **HomeDashboard 통합이 자연스러움**: MarketPulse 바로 아래 배치, useInvestorSignals(allItems) 호출 1줄로 스캔 활성화
- **HOME_CONTRACT.md 동기화 완료**: 새 위젯이 계약 문서에 등록됨

## Round 1 대비 개선 요약

| 항목 | R1 | R2 | 변화 |
|------|-----|-----|------|
| 기획 의도 부합 | 14 | 18 | +4 (시그널 실제 발화) |
| 투자 인사이트 | 15 | 18 | +3 (위젯으로 체감) |
| 차별화 경험 | 14 | 17 | +3 (UI 연결) |
| 디자인/UX | 17 | 17 | +0 (유지) |
| 정확도/커버리지 | 13 | 16 | +3 (USD 병기) |
| **총점** | **173 (72.1%)** | **206 (85.8%)** | **+33 (+13.7%p)** |

---

## 최종 판정

**85.8% -- CONDITIONAL PASS**

90% 기준에 4.2%p 미달이나, Round 1 대비 +13.7%p 개선되었고 P0 항목 4건이 모두 해소되었다.
잔여 P1 3건은 Phase 9 착수 전에 별도 fix PR로 해소할 것을 권장한다.
Phase 9 진행을 차단하지는 않으나, 거래량 이상치 기준 보정은 false positive를 유발할 수 있으므로 우선 처리 필요.
