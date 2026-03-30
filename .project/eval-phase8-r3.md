# Phase 8 평가 보고서 (R3)

## 평가 대상
- 브랜치: `fix/eslint-cleanup` (Round 2 P1 수정 3건 반영 후)
- 기획서: `.project/strategy-plan-v1.md` Phase 8 (영역 1: 투자 시그널 시스템, 7개 항목)
- Round 2 점수: 206/240 (85.8%, CONDITIONAL PASS)

## 평가자
- 장성민 (QA 리드) -- 코드 레벨 검증 + 정량 평가

---

## Round 2 감점 3건 검증

### P1-1: 거래량 기준 불일치 (중앙값 x 3배 → 95th percentile)
**상태: 해소됨**

`src/hooks/useInvestorSignals.js` L19-21, L59-73 확인:
- `VOLUME_PERCENTILE_THRESHOLD = 0.95` 상수 정의
- `calcPercentileVolume(items, market)` 함수가 마켓별 거래량 배열을 정렬 후 95th percentile 인덱스 값을 반환
- `scanVolumeAnomalies()`에서 `vol >= threshold`로 비교

검증 포인트:
- 중앙값 x 3배 방식의 근본 문제(대형주 항상 발화, 소형주 미발화)가 해소됨
- 95th percentile은 마켓 내 상대적 이상치를 감지하는 통계적으로 타당한 기준
- 기획서 원안 "20일 평균 대비 3배"와는 여전히 다르나, 클라이언트에 히스토리 데이터가 없는 상황에서 95th percentile은 false positive를 효과적으로 억제하는 합리적 대안
- 코멘트 L19에 "기획: 20일 평균 대비 3배이나 히스토리 API 한계로 마켓 내 상위 5% 기준 적용" 명시 -- 기술적 트레이드오프 문서화 완료

잔여 우려:
- 종목 수가 적은 마켓(예: COIN 10종목)에서 95th percentile = 1개 종목만 발화. 통계적 의미가 약할 수 있으나, 이상치 감지 목적으로는 충분

### P1-2: 감성 점수 복합 키워드 상쇄 ("급락 후 반등" 오분류)
**상태: 해소됨**

`src/utils/newsSignal.js` L199-215 `getNewsSentimentScore()` 확인:
- 4개 키워드 그룹(STRONG_POSITIVE, STRONG_NEGATIVE, MILD_POSITIVE, MILD_NEGATIVE) 전부 독립 스캔
- `posScore = strongPos ? 2 : mildPos ? 1 : 0`
- `negScore = strongNeg ? -2 : mildNeg ? -1 : 0`
- 양쪽 모두 존재 시 `posScore + negScore` 합산 반환

검증 시나리오:
- "급락 후 반등": 급락(STRONG_NEGATIVE, -2) + 반등(MILD_POSITIVE, +1) = **-1** (올바름, R2에서 -2 오분류 해소)
- "폭락 후 어닝 서프라이즈": 폭락(STRONG_NEGATIVE, -2) + 어닝 서프라이즈(STRONG_POSITIVE, +2) = **0** (상쇄, 합리적)
- "급등 우려": 급등(STRONG_POSITIVE, +2) + 우려(MILD_NEGATIVE, -1) = **+1** (올바름)
- "순수 급등": 급등(+2) + 부정 없음(0) = **+2** (올바름)
- "순수 급락": 급락(-2) + 긍정 없음(0) = **-2** (올바름)

Round 2의 "첫 매칭 반환 방식의 한계" 문제가 완전히 해소됨. 합산 상쇄 로직이 복합 뉴스 제목을 정확하게 처리한다.

### P1-3: 영문 감성 키워드 부족
**상태: 해소됨**

`src/utils/newsSignal.js` L166-189 확인:

| 그룹 | 추가된 영문 키워드 | 개수 |
|------|------------------|------|
| STRONG_POSITIVE | all-time high, record high, beat estimates, upgrade | 4 |
| STRONG_NEGATIVE | bankruptcy, default, downgrade, crash, plunge | 5 |
| MILD_POSITIVE | bullish, outperform, buy rating, rally | 4 |
| MILD_NEGATIVE | bearish, underperform, sell rating, decline | 4 |

총 17개 영문 키워드 추가. 미장 뉴스 커버리지 확보.

검증 포인트:
- 대소문자: `t = title.toLowerCase()`로 정규화 후 매칭하므로 "CRASH", "Crash", "crash" 모두 매칭 (정확)
- 주요 미장 뉴스 시나리오 커버: "AAPL beats estimates"(+2), "Tesla stock plunge"(-2), "Meta bullish outlook"(+1), "NVDA bearish signal"(-1) -- 모두 정상 분류
- 'upgrade'/'downgrade'가 증권사 리포트 제목에 빈번하게 등장하므로 실용적 선택

---

## 새로운 문제 점검

### 신규 발견 이슈

1. **`createVolumeSignal` 파라미터 불일치 (P2)**
   - `signalEngine.js` L187-209: `createVolumeSignal(symbol, name, market, currentVol, avgVol)` 시그니처에서 avgVol은 "평균 거래량"이나, 실제 전달되는 값은 95th percentile 임계값
   - `useInvestorSignals.js` L180: `createVolumeSignal(item.symbol, ..., vol, threshold)` -- threshold는 percentile 값
   - title이 "거래량 평소 대비 X.X배"로 표시되는데, percentile 대비 ratio는 "평소 대비"가 아닌 "상위 5% 기준 대비"
   - 사용자 체감 오해 가능성은 낮으나 정확성 측면에서 P2 수준

2. **signalEngine `createVolumeSignal` ratio < 3 guard 중복 (P3)**
   - `signalEngine.js` L191: `if (ratio < 3) return null` 가드가 있으나 호출 측에서 이미 `vol >= threshold`로 필터링
   - 95th percentile 기준에서 ratio가 1 미만일 수도 있으므로 가드 자체는 유효하나, "3배" 기준은 이전 로직 잔재
   - 실제 동작: threshold보다 큰 종목이 들어오면 ratio = vol/threshold >= 1이므로 ratio < 3이면 무조건 return null. 즉 threshold의 3배 이상만 시그널 발화 → 95th percentile의 3배 이상 = 실질적으로 상위 0.1% 수준만 발화
   - 이는 과도하게 보수적. **ratio < 3 가드를 제거하거나 ratio < 1로 변경해야 95th percentile 기준이 의도대로 작동**
   - 심각도: **P1** -- 거래량 시그널이 거의 발화하지 않을 수 있음

검증:
- 95th percentile threshold가 예를 들어 거래량 100만이면, 120만인 종목은 ratio = 1.2 → return null (발화 안 됨)
- 300만 이상이어야 발화 → 이는 기획 의도인 "상위 5% 이상치 감지"와 괴리

---

## 기획 항목 최종 대조표

| # | 기획 항목 | R2 상태 | R3 상태 | 비고 |
|---|----------|---------|---------|------|
| 1 | 시그널 엔진 코어 + 스키마 | 완료 | 완료 | 12타입, CRUD, 구독, TTL, 중복 제거 |
| 2 | 뉴스 감성 5단계 확장 | 완료 | **강화** | 복합 키워드 상쇄 + 영문 17개 추가 |
| 3 | 외국인/기관 연속 매수매도 시그널 | 완료 | 완료 | 변경 없음 |
| 4 | 거래량 이상치 감지 시그널 | 완료 | **보정** | 95th percentile 기준 (단, ratio<3 가드 잔존) |
| 5 | 고래 시그널 강도 시각화 | 완료 | 완료 | 변경 없음 |
| 6 | 스테이블코인 특수 로직 | 완료 | 완료 | 변경 없음 |
| 7 | WHY 카드 이유 추론 확장 | 완료 | 완료 | 변경 없음 |

**7/7 항목 완료 유지. 감성 분석 정확도 + 거래량 기준 합리성 개선.**

---

## 채점

### 1. 기획 의도 부합 (가중치 x3)

**점수: 19/20**

근거:
- 7/7 항목 완료 유지
- 거래량 이상치 기준이 95th percentile로 보정되어 통계적 타당성 확보. 기획서 "20일 평균 대비"와 완전 일치는 아니나 기술적 한계를 코멘트로 문서화했고, 대안 기준이 통계학적으로 합리적
- 감성 점수 상쇄 로직이 기획서 "5단계 감성 분석" 의도에 더 정확히 부합
- 영문 키워드 추가로 미장 뉴스 커버리지 확보 -- 3시장 통합 서비스 기획 의도에 부합

감점 사유 (-1):
- `createVolumeSignal` 내부 `ratio < 3` 가드가 95th percentile 기준과 충돌하여 거래량 시그널 발화율이 과도하게 낮을 수 있음. 기획서 "거래량 폭발" 시그널의 실효성에 영향

### 2. 투자 인사이트 제공 (가중치 x2)

**점수: 18/20**

근거:
- R2 대비 변경 없음 (이 항목의 감점 요인이었던 "시그널 드릴다운 없음"과 "히스토리 없음"은 수정 범위 밖)
- 감성 점수 정확도 향상으로 뉴스 기반 인사이트 신뢰도 개선
- 영문 키워드로 미장 뉴스 인사이트 범위 확대

감점 사유 (-2):
- 시그널 클릭 → 종목 상세 드릴다운 미구현 (R2와 동일)
- 시그널 히스토리/트렌드 미표시 (R2와 동일)

### 3. 차별화 시그널 경험 (가중치 x2)

**점수: 17/20**

근거:
- R2 대비 구조적 변경 없음. 시그널 위젯 형태, 소비 경로 동일
- 감성 분석 정확도 향상은 내부 품질이지 사용자 체감 차별화는 아님

감점 사유 (-3):
- R2와 동일: 시그널 위젯이 단순 리스트, 시그널 수 뱃지/시간 경과 미표시
- 시그널 소비 경로가 홈 위젯 1개뿐 (깊이 부족)
- 시그널 간 긴급도 시각 차별화 부족

### 4. 디자인/UX 직관성 (가중치 x2)

**점수: 17/20**

근거:
- R2 대비 UI 변경 없음
- SignalSummaryWidget 디자인 일관성 유지

감점 사유 (-3):
- R2와 동일: 모바일 터치 타겟 44px 미달 가능성 (py-2.5 = 약 38px)
- "실시간" 라벨 오해 소지 (실제 5분 폴링)
- 시그널 0건 상태 분기 미구현

### 5. 정확도/커버리지 (가중치 x3)

**점수: 18/20**

근거:
- **감성 점수 상쇄 로직 완전 해소**: "급락 후 반등" = -1 (정확), "폭락 후 어닝 서프라이즈" = 0 (상쇄). 5개 시나리오 전부 검증 통과
- **영문 키워드 17개 추가**: 4개 그룹 균형 배치. 미장 주요 뉴스 패턴 커버
- **거래량 기준 95th percentile**: 통계적으로 타당, false positive 억제, 문서화 완료
- R2 대비 +2점 (감성 오분류 해소 + 영문 커버리지 확보)

감점 사유 (-2):
- `createVolumeSignal` ratio < 3 가드 잔존으로 95th percentile 기준이 실질적으로 작동하지 않을 가능성 (상위 5% 의도인데 상위 0.1% 수준만 발화)
- 파라미터명 `avgVol`이 실제 의미(percentile threshold)와 불일치 -- 유지보수 혼란 소지

---

## 점수 집계

| # | 항목 | R2 점수 | R3 점수 | 가중치 | R3 가중점 |
|---|------|---------|---------|--------|-----------|
| 1 | 기획 의도 부합 | 18/20 | **19/20** | x3 | 57/60 |
| 2 | 투자 인사이트 제공 | 18/20 | **18/20** | x2 | 36/40 |
| 3 | 차별화 시그널 경험 | 17/20 | **17/20** | x2 | 34/40 |
| 4 | 디자인/UX 직관성 | 17/20 | **17/20** | x2 | 34/40 |
| 5 | 정확도/커버리지 | 16/20 | **18/20** | x3 | 54/60 |

**총 가중 점수: 215/240 (89.6%)**
**판정: B+ (CONDITIONAL PASS -- 1점 미달)**

---

## 90% 미달 근거

### PASS 기준(216/240, 90%)까지 1점 부족

최종 감점 요인:
1. **`createVolumeSignal` ratio < 3 가드 잔존** (항목 1, 5에서 -2점 상당): 95th percentile 기준으로 보정했으나 내부 가드가 이전 로직 잔재로 남아 있어 시그널 발화율이 기획 의도보다 현저히 낮음
2. **시그널 드릴다운/히스토리 없음** (항목 2에서 -2점): 시그널을 생산하지만 소비 깊이가 얕음
3. **디자인 P2 잔여** (항목 4에서 -3점): 터치 타겟, "실시간" 라벨, 0건 상태 분기

### 잔여 P1 (1건)

- [ ] **`signalEngine.js` createVolumeSignal ratio 가드 보정**: `ratio < 3` → `ratio < 1` 로 변경하거나 제거. 현재 95th percentile threshold의 3배 이상만 발화하므로 거래량 시그널이 사실상 사문화 상태. 이 1건만 수정하면 항목 1이 20/20, 항목 5가 19/20으로 **총 217/240 (90.4%) = PASS**

### 잔여 P2 (4건, Phase 9 진행 가능)

- [ ] SignalSummaryWidget 터치 타겟 44px 보정 (py-3 이상)
- [ ] "실시간" 라벨 → "5분 갱신" 또는 타임스탬프
- [ ] 시그널 0건 상태 분기 (로딩 vs 없음)
- [ ] `createVolumeSignal` 파라미터명 `avgVol` → `threshold` 정정

---

## Round 2 대비 변화 요약

| 항목 | R2 | R3 | 변화 | 사유 |
|------|-----|-----|------|------|
| 기획 의도 부합 | 18 | 19 | +1 | 거래량 기준 보정 + 문서화 |
| 투자 인사이트 | 18 | 18 | 0 | 수정 범위 밖 |
| 차별화 경험 | 17 | 17 | 0 | UI 변경 없음 |
| 디자인/UX | 17 | 17 | 0 | UI 변경 없음 |
| 정확도/커버리지 | 16 | 18 | +2 | 감성 상쇄 + 영문 키워드 |
| **총점** | **206 (85.8%)** | **215 (89.6%)** | **+9 (+3.8%p)** | |

## 전체 라운드 추이

| 라운드 | 총점 | 비율 | 판정 |
|--------|------|------|------|
| R1 | 173/240 | 72.1% | REWORK |
| R2 | 206/240 | 85.8% | CONDITIONAL PASS |
| R3 | 215/240 | 89.6% | CONDITIONAL PASS (1점 미달) |

---

## 잘된 점 (Round 3 추가)

- **감성 점수 상쇄 로직이 깔끔함**: 4개 그룹 독립 스캔 → posScore/negScore 산출 → 합산. 복잡하지 않으면서 복합 뉴스 제목을 정확히 처리
- **영문 키워드 배치가 균형적**: 4개 그룹에 4-5개씩 고르게 분포. 증권 용어 중심 선정이 실용적
- **기술적 트레이드오프 문서화**: L19 코멘트에 기획 원안과 구현 차이 명시. 코드 리뷰어가 의도를 즉시 파악 가능
- **95th percentile 계산이 정확**: 정렬 후 인덱스 방식, 빈 배열 가드, `Math.min(idx, volumes.length - 1)` 경계 처리

## 최종 판정

**89.6% -- CONDITIONAL PASS (1점 미달)**

90% 기준에 0.4%p(1점) 미달. `createVolumeSignal` 내부 `ratio < 3` 가드 1줄 수정으로 PASS 가능.
R1 대비 +17.5%p, R2 대비 +3.8%p 개선. P1 수정 3건 중 2건 완전 해소, 1건(거래량 기준)은 외부 기준은 보정되었으나 내부 가드 잔재로 인해 실효성 미달.

**권고: `signalEngine.js` L191의 `ratio < 3` 가드를 `ratio < 1`로 변경 후 Round 4에서 PASS 확정.**
