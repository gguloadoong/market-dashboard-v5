---
제목: 시그널 시스템 전면 개편 — 포렌식 + 설계
날짜: 2026-06-08
소유자: (대표 /goal 지시) — "죽은 시그널 다 제거, 적중률 50%+ 시스템, 캐릭터 <5, 우리만의 노하우"
상태: 포렌식 완료 → 설계 진행 중
---

# 시그널 전면 개편 — 포렌식 결과 (데이터 기반)

> 출처: Supabase `signal_history`(18,122행) + `signal_accuracy` 뷰 + `tsb_*`(별도 프로젝트, 참고용) 실측.
> 2026-06-08 분석. 모든 수치는 프로덕션 실데이터.

## 0. 한 줄 결론

**엣지가 없는 게 아니다 — 있던 엣지를 꺼놓고, 측정을 망가뜨려, 망가진 것만 노출 중이었다.**
헤드라인 신뢰도 38%는 대부분 **측정 artifact**. 공정하게 재면 50~70% 엣지가 실재한다.

## 1. 측정 파이프라인의 3대 결함 (이것부터 고쳐야 함)

`workers/cron/src/crons/check-signal-accuracy.js` + `signal_accuracy` 뷰:

1. **노이즈 밴드 없음** — `isHit()`이 방향만 맞으면 (+0.01%도) 적중. 비용·노이즈 무시.
2. **stale 가격을 오답 처리** — 1h 시점 스냅샷이 거의 무변동(`|change_1h|<0.1%`)인 비율(`nearzero1h_pct`)이 타입별 **47~100%**. 이걸 전부 "오답"으로 카운트 → 저변동 대형주·저유동 종목 점수 폭락.
3. **헤드라인 = raw 1h** — 뷰가 `accuracy_1h`(가장 deflation 심한 horizon)를 대표값으로 노출. 게다가 **최근 30일만 집계** → 발화 멈춘 우량 시그널(double_bottom 등)은 성적표에서 **소멸**.

## 2. 엣지 채굴 결과 (공정 측정 = |move| 노이즈 제외)

| 시그널 | 방향 | n | raw 1h | **공정 1h** | 24h | 비고 |
|---|---|---|---|---|---|---|
| volume_anomaly | 상승 | 4152 | 29% | **63.5%** | 46% | 단기 지속 엣지 |
| volume_anomaly | 하락 | 2356 | 13% | 39% | 36% | **역전 64%** (분출=반등) |
| double_bottom | 상승 | 852 | 43% | 52.8% | **68.4%** | 24h 강함 |
| support_resistance_break | 상승 | 363 | 46% | 45% | **70.9%** | 24h 강함 |
| vwap_deviation | — | 516 | 0% | 0% | 0% | 완전 사망(이미 비활성) |
| news_sentiment_cluster | — | 10036 | — | — | **측정불가** | 가격 타깃 없음 → 성적표 불가 |
| foreign/inst 연속매매 | — | 18~42 | 0~57% | — | null | 24h 평가 안 됨, 표본 빈약 |

**시장별 구조 (volume_anomaly 24h 공정):**
- US 하락신호 **60.6%**(n193), US 상승 55%(n143) → 미장은 **정방향**
- KR 중립 29% → **역전 70.6%**(n1355), KR 하락 42% → 역전 58%
- 코인 하락 30% → **역전 69.8%**(n117), 코인 중립 → 역전 66.7% → 코인은 **역방향(분출=반등)**

**패턴 시장별 (24h 공정):**
- double_bottom: 코인 **86.6%**(n289), 국장 **84.9%**(n184), 미장 62.7%(n379)
- support_resistance_break: 국장 **73.8%**, 코인 57.3%, 미장 53.9%

## 3. 생사 판정 (liveness)

- **ALIVE**: volume_anomaly (마지막 2026-06-08, 계속 발화)
- **SILENCED(우량인데 꺼짐)**: double_bottom·support_resistance_break (마지막 4-26). CF Workers가 `composite_score` 1종만 남기고 우량 서버 시그널 중단 (quality-baseline 확인: "server 발화 composite_score 1종뿐").
- **DEAD**: vwap_deviation(0%), 그 외 ~20종 (마지막 발화 4-13/14, composite_score는 n=1).
- **tsb 5봇**(별도 프로젝트, 스코프 밖): MASTER 74k건 1h 12%/24h 39%, 페이퍼트레이드 PnL 음수. **더 낫지 않음 → 도입 안 함.**

## 4. 처분 결정

**KEEP & REVIVE (데이터로 50%+ 입증):**
- `volume_anomaly` — 시장/방향별 라우팅 (미장 정방향 / 코인·국장중립 역방향)
- `double_bottom` — 서버 발화 부활, 24h horizon
- `support_resistance_break` — 서버 발화 부활, 24h horizon

**CUT (~22종 — 진짜 죽었거나 측정 불가):**
vwap_deviation, news_sentiment_cluster(→성적표 제외, 컨텍스트로만), foreign/institutional_consecutive_*(4종), smart_money_flow, social_sentiment, order_flow_imbalance, put_call_ratio, sentiment_divergence, volume_price_divergence, sector_outlier, stealth_activity, momentum_divergence, market_mood_shift, fear_greed_shift, sector_rotation, funding_rate_extreme, cross_market_correlation(구버전), gap_analysis, rebalancing_alert, fx_impact, btc_leading, composite_score(n=1 고장), capitulation/recovery_detection(부활 시 반전 캐릭터로 흡수)

## 5. <5 캐릭터 시스템 (설계 방향 — 워크플로우에서 확정)

각 캐릭터 = 살아남은 raw 디텍터의 **시장·horizon 엣지게이트 앙상블**, 정직하게 측정.

1. **🌊 흐름(Continuation)** — 거래량이 추세를 밀어줌. 미장 정방향 volume_anomaly. ~60%
2. **🪤 반전(Reversal/Contrarian)** — 과열은 식는다. 코인·국장중립 분출 → 페이드 (역전 66~70%). **교과서에 없는 우리 엣지.**
3. **🧱 돌파(Breakout/Pattern)** — double_bottom + support_resistance_break 부활, 24h. ~68~75%
4. **🌐 전이(Cross-market)** — 미장→국장 overnight, BTC→알트. 구조적 해자. **검증 후 출시(Phase 2).**

"우리만의 노하우" = ①공정측정 교정 ②시장조건부 방향 라우팅(지속 vs 역전) ③우량 패턴 부활 ④교차시장 전이. 단순 지표조합(RSI+MACD) 아님.

## 5.5 ⚠️ 파이프라인 feasibility (직접 코드 검증 — 계획의 최대 리스크)

워커/엔진 코드 직접 확인 결과, 데이터 엣지는 진짜지만 **발화 파이프라인이 구조적으로 깨져 있다**:

1. **패턴(double_bottom/SRB)은 서버에 구현된 적 없음.** `workers/cron/src/crons/compute-signals.js`는 `composite_score` 한 종만 계산. 상단 주석: `Phase 2 (future): DOUBLE_BOTTOM / RECOVERY_DETECTION (히스토리 KV 적재 후 구현)`. candle_history 테이블 0행. → "부활"은 토글 아님 = **캔들 히스토리 KV 파이프라인 + taCalculator 포팅** 필요 (수일~주). 따라서 패턴 캐릭터는 **probation/phase2**.
2. **모든 기록은 클라이언트 발화 의존.** `signalEngine.js:229/247`이 `fetch('/api/signal-accuracy')`로 POST. 시그널은 브라우저에서 계산·렌더·기록됨. → **앱을 열어야만 발화**. volume_anomaly 8036건 = 수개월 QA 누적. 비공개 단계(사용자 0명)에선 "앱 오픈 이벤트"에만 발화 → 연속 트랙레코드 불가.
3. **서버 크론 composite_score는 KV에만 저장, signal_history 기록 안 함** → 성적표에 n=1.

**결론 — 진짜 전면 개편의 본질**: 단순 가지치기가 아니라 **<5 캐릭터 시그널 생성을 서버 크론으로 이전**(volume_anomaly 시장라우팅은 워커가 이미 로드하는 Hot200으로 즉시 가능, 패턴은 캔들파이프라인 후행)해서 사용자와 무관하게 연속 발화·정직 평가·서버스냅 렌더. 그래야 성적표가 실재한다.
   - 가능(빠름): volume_anomaly 서버 이전 — 워커가 이미 kr/us/coins Hot200 보유. 시장조건부 방향 라우팅만 추가.
   - 후행(무거움): 패턴 — 캔들 히스토리 KV 적재 선행 필요.

## 5.7 ⚖️ 엄밀 재측정 (노이즈밴드 적용 — critique must_fix #4 해소)

워크플로우 critique가 "역전=1−정방향" 수학을 비엄밀로 지적. 실제 노이즈밴드(kr24h 1.5%·us 1.0%·coin 3.0%)를 적용해 **밴드 초과 이동만으로 forward/fade 승률 재측정** → 거품이 빠짐:

**volume_anomaly 24h (밴드 적용, stale 제외):**
| 시장·방향 | n_eval | 정방향↑ | fade(반대) | 판정 |
|---|---|---|---|---|
| kr 하락 | 550 | — | **56.0%**(fade=up) | 모뎀 엣지, 표본 견고 |
| us 상승 | 97 | **54.6%** | — | 얇음(<100) |
| us 하락 | 108 | 49.1% | 50.9% | **코인플립**(과거 60.6%는 거품) |
| kr 상승 | 1716 | 46.9% | 53.1% | 무엣지 |
| kr 중립 | 261 | 44.4 | 55.6 | **방향성 없음 → 무효** (과거 70.6% artifact) |
| coin | <25 | — | — | 밴드 통과 표본 부족 → **70% 주장 미입증** |

**패턴 24h forward (밴드 적용):**
| 패턴 | 시장 | n_eval | 승률 | 비고 |
|---|---|---|---|---|
| double_bottom | **us** | 213 | **65.7%** | 가장 견고 |
| double_bottom | kr | 94 | 93.6% | 강하나 regime 의심 |
| double_bottom | coin | 42 | 100% | **단위버그**(avg_move 109127) 신뢰불가 |
| SRB | us | 89 | 64.0% | avg_move 음수 → 비용후 의심 |
| SRB | kr | 42 | 92.9% | 표본 작음 |

**🧊 냉정한 진실**: 견고히 입증된 엣지는 **55~66%**(70~87% 아님). 가장 확실한 **double_bottom US 66%(n=213)는 죽은 인프라**(미발화·미기록). 살아있는 건 kr하락 fade 56%·us상승 55% 등 **모뎀**뿐. → "LIVE 50%+ 성적표"는 **패턴 인프라 재건**(서버 발화+기록)이 있어야 성립.

## 5.8 critique 판정 = REVISE — must_fix 4건 (전부 타당, 반영)

1. **[CRITICAL] 패턴은 사망(미발화)** — Vercel 크론 compute-signals.js가 vercel.json에 없음, CF Workers는 composite만. "부활"=인프라 재건(CF Workers 포팅 or Vercel 크론 부활). **신규 Phase 0 필요**.
2. **[CRITICAL] 서버 시그널 미기록** — loadSignals가 _recordForAccuracy 스킵(TODO #215, signalEngine.js:944). 크론은 KV만 기록. 부활해도 신규 적중데이터 0 → **크론에서 Supabase 직접 INSERT 경로 신설**.
3. **[MAJOR] 뷰에 market/direction 슬라이스 없음** — signal_accuracy가 signal_type별로만 GROUP BY. 캐릭터 라우팅 불가 → **뷰에 (type,market,direction) 슬라이스 추가 + API/훅 갱신**.
4. **[MAJOR] 역전 수학 비엔밀** — §5.7에서 재측정 완료. fader 주장은 **밴드적용 후 56%**(모뎀)로 정정. 성적표엔 "예비추정" 명시.

**critique 종합**: 방향(시장조건부 라우팅·fair측정·죽은것 제거)은 타당·차별적. 단 실행계획에 **인프라 갭(생성+기록)**이 치명적 → Phase 0(서버 발화/기록 재건) 선행 없으면 Phase 3~5는 죽은 인프라 위에 빌드. 캐릭터 주장은 정직하게 하향(launch 후보는 패턴 부활 시 double_bottom + kr-fade 56%).

## 5.9 ✅ Phase 1 측정 인프라 적용 완료 (signal_accuracy_v2, Issue #364)

신규 뷰 `signal_accuracy_v2` prod 적용·검증 완료 (추가적·비파괴, 기존 뷰/앱 무영향).
fair-hit 노이즈밴드 + (type,market,direction) 슬라이스 + 30일창 제거 + last_30d_fired. must_fix #3·#4 흡수.

**뷰가 드러낸 결정적 사실 — 살아있는 launch 엣지 확정:**
| 시그널 슬라이스 | fair 1h | fair 24h | last_30d_fired | 판정 |
|---|---|---|---|---|
| volume_anomaly kr 상승 | **64.0%** | 46.9% | 1491 | ALIVE, 1h 연속엣지 |
| volume_anomaly us 하락 | **64.3%** | 50.9% | 172 | ALIVE |
| volume_anomaly us 상승 | **61.5%** | 54.6% | 127 | ALIVE |
| volume_anomaly kr 중립 | 62.7% | 69.3% | 178 | ALIVE(중립=비방향) |
| double_bottom us | 27.4% | **65.7%** | **0** | 강하나 사망(미발화) |
| double_bottom kr | 72.4% | **93.6%** | **0** | 사망 |
| support_resistance_break us | 21.7% | 64.0% | **0** | 사망 |

→ **흐름타기(volume_anomaly 1h 연속, ~62%)가 인프라 재건 없이 오늘 출시 가능한 유일한 견고·대표본 캐릭터.** 대표 horizon=**1h**(24h엔 평균회귀). 패턴은 fair 24h 강하나 `last_30d_fired=0`로 사망 확정 → Phase 0(인프라 재건) 후 launch.

## 6. 구현 단계 (Issue 단위 — critique 반영 개정판)

- **Phase 1 [측정 교정]** fair-hit 노이즈밴드 + 뷰 (type,market,direction) 슬라이스 + 30일창 제거 + last_30d_fired. (must_fix #3·#4 흡수) — 추가적·비파괴, 우선.
- **Phase 2 [사망 제거]** 27종 6-슬롯 원자 제거. 공유 THRESHOLDS(PCR/FUNDING/ORDER_FLOW)·KEEP3·taCalculator 보존. IIFE/test 가드 확인.
- **Phase 0/3 [인프라 재건]** ⚠️핵심·최대공수 — 서버(CF Workers/Vercel 크론) double_bottom·SRB 발화 + Supabase 직접 기록. 이게 있어야 LIVE 성적표 성립.
- **Phase 4 [캐릭터 레이어]** 시장조건부 라우팅(파생집계, 발화 무변경). 정직한 하향 주장.
- **Phase 5 [성적표 재설계]** 5캐릭터 카드 + 정직성 가드. UI라 **텍스트 시안 선확인**(feedback_ui_mockup_before_impl).

원래 단계 상세 ↓

1. 측정 교정 (노이즈밴드 fair-hit + horizon별 대표값 + 30일창 완화)
2. 죽은 시그널 ~22종 코드 완전 제거 (제너레이터/훅/UI/테스트/상수)
3. 우량 패턴(double_bottom·SRB) 서버 발화 부활
4. <5 캐릭터 레이어 + 시장조건부 라우팅
5. 성적표 재설계 (캐릭터별 정직한 트랙레코드)

→ 모든 변경: Issue 선행 + architect 게이트(알고리즘 파일) + review:code. **배포는 트리거+대표 확인 시에만.**
