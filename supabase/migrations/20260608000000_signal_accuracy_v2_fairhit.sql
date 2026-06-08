-- signal_accuracy_v2 — fair-hit 노이즈밴드 + 시장/방향 슬라이스 뷰 (Issue #364)
--
-- 배경 (2026-06-08 데이터 포렌식, .project/signal-overhaul-2026-06-08.md):
-- 기존 signal_accuracy 뷰의 "적중률"은 대부분 측정 artifact다.
--   1. isHit이 방향만 맞으면 +0.01%도 적중 (노이즈밴드/거래비용 없음)
--   2. stale 스냅샷(|change|<0.1%)을 오답 처리 → nearzero 47~100% 부당 감점
--   3. 헤드라인=raw accuracy_1h(deflation 최심) + 최근 30일창 → 우량 시그널 소멸
--   4. signal_type별로만 GROUP BY → market/direction 슬라이스 없음(캐릭터 라우팅 불가)
--
-- 본 마이그레이션은 *추가적·비파괴*다. 기존 signal_accuracy 뷰와 라이브 앱은 무변경.
-- 신규 뷰 signal_accuracy_v2가:
--   · fair-hit를 change_Xh·market·horizon 노이즈밴드로 *실시간 재계산* (스키마/RPC/백필 불필요)
--   · (signal_type, market, direction) 슬라이스 — 시장조건부 캐릭터 라우팅 기반
--   · 30일창 제거(전체이력 누적) + last_30d_fired (미발화 배지용)
--
-- 노이즈밴드 (시장·horizon별 ATR 기반, 거래비용 흡수):
--   kr   1h 0.30 / 4h 0.80 / 24h 1.50
--   us   1h 0.20 / 4h 0.60 / 24h 1.00
--   coin 1h 0.50 / 4h 1.50 / 24h 3.00  (crypto 동일 정규화)
-- 판정: |change|>500 → NULL(#158 단위방어). 방향성(bullish/bearish): |change|<band → NULL(stale 제외),
--       동방향 강이동 → 적중, 역이동 → 오답.
--       neutral → |change|<band 면 적중(무변동=중립 예측 정답). band 이상 이동 → 오답.
-- ⚠️ 표준 isHit(neutral 고정 1%, 방향성 밴드 없음) 대비 *시장·horizon 밴드로 강화*(의도적 불일치 = 본 교정의 핵심).
-- ⚠️ neutral은 staleness 제외를 안 하므로(동결 스냅샷이 '무변동 적중'으로 잡힐 수 있음) 중립 승률은 stale 포함 *상한치* — 런칭 등급 판단엔 방향성 슬라이스만 사용.
--
-- 검증(적용 후): double_bottom us 24h ~66%(n=213), volume_anomaly kr 상승 1h ~62% 로 조회되면 정상.
--
-- 리뷰 반영(#364 review:code):
--  [PERF] 30일창 제거로 전체스캔 — 18k행은 무시 가능. 수십만 행 성장 시 MATERIALIZED VIEW +
--         30분 REFRESH(check-signal-accuracy 크론 합류)로 전환 (백로그).
--  [STYLE] market CASE ELSE는 us 밴드로 폴백 — 스키마상 kr/us/coin(crypto)만 유입. 신규 시장
--          추가 시 밴드를 반드시 같이 갱신할 것(조용한 오집계 방지).

BEGIN;

CREATE OR REPLACE VIEW public.signal_accuracy_v2 AS
WITH banded AS (
  SELECT
    sh.signal_type,
    CASE WHEN sh.market IN ('coin', 'crypto') THEN 'coin' ELSE sh.market END AS market,
    sh.direction,
    sh.fired_at,
    sh.change_1h, sh.change_4h, sh.change_24h,
    CASE WHEN sh.market IN ('coin','crypto') THEN 0.50 WHEN sh.market='kr' THEN 0.30 WHEN sh.market='us' THEN 0.20 ELSE 0.20 END AS band_1h,
    CASE WHEN sh.market IN ('coin','crypto') THEN 1.50 WHEN sh.market='kr' THEN 0.80 WHEN sh.market='us' THEN 0.60 ELSE 0.60 END AS band_4h,
    CASE WHEN sh.market IN ('coin','crypto') THEN 3.00 WHEN sh.market='kr' THEN 1.50 WHEN sh.market='us' THEN 1.00 ELSE 1.00 END AS band_24h
  FROM public.signal_history sh
  WHERE sh.price_at_fire IS NOT NULL
    -- tsb(trading-signal-bot) 타입 제외 — exclude_tsb 마이그레이션과 동일 집합
    AND sh.signal_type <> ALL (ARRAY['DNA','QUANT','SENSE','WALL_ST','SHARK','CONSENSUS'])
),
fair AS (
  -- fair_hit: NULL=미평가/판정보류(분모 제외), true=적중, false=오답
  -- · |change|>500 → NULL: 시스템 전역 #158 단위불일치(USD/KRW 혼합) 방어.
  --   check-signal-accuracy.js의 CHANGE_PCT_SANITY_LIMIT(=500)와 *동기화 필수* — v2는 raw
  --   change_*에서 직접 재계산하므로 기록 단계 reject를 거치지 않은 legacy 거대값을 여기서 걸러야 함.
  -- · neutral: |change|<band → 적중(무변동=중립 예측 정답). band 이상 이동 → 오답.
  --   ※ 표준 isHit(neutral 고정 1%, 방향성 밴드 없음) 대비 시장·horizon 밴드로 *강화*(의도적 불일치 = 본 교정 핵심).
  --   ※ neutral은 stale 미제외 → 동결 스냅샷이 적중으로 잡혀 승률이 부풀 수 있음(stale 포함 상한치, 런칭 근거엔 방향성만 사용).
  -- · 방향성(bullish/bearish): |change|<band → 판정보류(stale, 방향 미확인), 동방향 강이동 → 적중, 역이동 → 오답.
  SELECT
    signal_type, market, direction, fired_at,
    CASE
      WHEN change_1h IS NULL OR ABS(change_1h) > 500 THEN NULL
      WHEN direction = 'neutral' THEN ABS(change_1h) < band_1h
      WHEN ABS(change_1h) < band_1h THEN NULL
      WHEN direction = 'bullish' THEN change_1h >=  band_1h
      WHEN direction = 'bearish' THEN change_1h <= -band_1h
      ELSE false
    END AS fair_hit_1h,
    CASE
      WHEN change_4h IS NULL OR ABS(change_4h) > 500 THEN NULL
      WHEN direction = 'neutral' THEN ABS(change_4h) < band_4h
      WHEN ABS(change_4h) < band_4h THEN NULL
      WHEN direction = 'bullish' THEN change_4h >=  band_4h
      WHEN direction = 'bearish' THEN change_4h <= -band_4h
      ELSE false
    END AS fair_hit_4h,
    CASE
      WHEN change_24h IS NULL OR ABS(change_24h) > 500 THEN NULL
      WHEN direction = 'neutral' THEN ABS(change_24h) < band_24h
      WHEN ABS(change_24h) < band_24h THEN NULL
      WHEN direction = 'bullish' THEN change_24h >=  band_24h
      WHEN direction = 'bearish' THEN change_24h <= -band_24h
      ELSE false
    END AS fair_hit_24h
  FROM banded
)
SELECT
  signal_type,
  market,
  direction,
  COUNT(*)                                                                   AS total_signals,
  COUNT(fair_hit_1h)                                                         AS eval_1h,
  COUNT(*) FILTER (WHERE fair_hit_1h)                                        AS hits_1h,
  ROUND(100.0 * COUNT(*) FILTER (WHERE fair_hit_1h) / NULLIF(COUNT(fair_hit_1h), 0), 1)   AS fair_acc_1h,
  COUNT(fair_hit_4h)                                                         AS eval_4h,
  COUNT(*) FILTER (WHERE fair_hit_4h)                                        AS hits_4h,
  ROUND(100.0 * COUNT(*) FILTER (WHERE fair_hit_4h) / NULLIF(COUNT(fair_hit_4h), 0), 1)   AS fair_acc_4h,
  COUNT(fair_hit_24h)                                                        AS eval_24h,
  COUNT(*) FILTER (WHERE fair_hit_24h)                                       AS hits_24h,
  ROUND(100.0 * COUNT(*) FILTER (WHERE fair_hit_24h) / NULLIF(COUNT(fair_hit_24h), 0), 1) AS fair_acc_24h,
  MAX(fired_at)                                                             AS last_fired,
  COUNT(*) FILTER (WHERE fired_at > NOW() - INTERVAL '30 days')             AS last_30d_fired
FROM fair
GROUP BY signal_type, market, direction;

-- anon 키로 GET /api/signal-accuracy 조회 (기존 signal_accuracy와 동일 권한 모델)
REVOKE ALL ON public.signal_accuracy_v2 FROM PUBLIC;
GRANT SELECT ON public.signal_accuracy_v2 TO anon;

COMMENT ON VIEW public.signal_accuracy_v2 IS
  'fair-hit 노이즈밴드 + (type,market,direction) 슬라이스 + 전체이력. Issue #364. 기존 signal_accuracy는 역호환 유지.';

COMMIT;
