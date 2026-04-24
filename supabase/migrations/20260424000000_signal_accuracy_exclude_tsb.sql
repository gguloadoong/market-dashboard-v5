-- signal_accuracy 뷰 — tsb(trading-signal-bot) 레코드 완전 분리
--
-- 배경 (2026-04-24):
-- trading-signal-bot이 2026-04-18 이전까지 market-dashboard-v5와 동일한
-- signal_history 테이블을 공용으로 사용. 해당 기간 tsb 모델 타입
-- (DNA / QUANT / SENSE / WALL_ST / SHARK / CONSENSUS) 레코드가 signal_history에 잔존,
-- signal_accuracy 뷰를 통해 v5 성적표에 노출됨.
--
-- 2026-04-18 이후 tsb는 tsb_signal_history(별도 테이블)로 완전 분리됨.
-- 본 마이그레이션은 두 가지 작업을 수행:
--   1. signal_history에서 tsb 레코드 물리 삭제 (근본 정리)
--   2. signal_accuracy 뷰에 tsb 타입 제외 필터 추가 (방어적 이중 차단)
--
-- tsb 영향: 없음 — tsb는 tsb_signal_history / tsb_model_stats_* 뷰만 읽음.

BEGIN;

-- [1] tsb 레코드 물리 삭제
DELETE FROM public.signal_history
WHERE signal_type IN ('DNA', 'QUANT', 'SENSE', 'WALL_ST', 'SHARK', 'CONSENSUS');

-- [2] signal_accuracy 뷰 재정의 — tsb 타입 제외 + price_at_fire IS NOT NULL 유지
CREATE OR REPLACE VIEW public.signal_accuracy AS
WITH base AS (
  SELECT
    signal_type,
    COUNT(*)                                                            AS total_signals,
    COUNT(hit_1h)                                                       AS checked_1h,
    COUNT(*) FILTER (WHERE hit_1h = true)                               AS hits_1h,
    ROUND(100.0 * COUNT(*) FILTER (WHERE hit_1h = true)
          / NULLIF(COUNT(hit_1h), 0), 1)                                AS accuracy_1h,
    COUNT(hit_4h)                                                       AS checked_4h,
    COUNT(*) FILTER (WHERE hit_4h = true)                               AS hits_4h,
    ROUND(100.0 * COUNT(*) FILTER (WHERE hit_4h = true)
          / NULLIF(COUNT(hit_4h), 0), 1)                                AS accuracy_4h,
    COUNT(hit_24h)                                                      AS checked_24h,
    COUNT(*) FILTER (WHERE hit_24h = true)                              AS hits_24h,
    ROUND(100.0 * COUNT(*) FILTER (WHERE hit_24h = true)
          / NULLIF(COUNT(hit_24h), 0), 1)                               AS accuracy_24h,
    MAX(fired_at)                                                       AS last_fired
  FROM public.signal_history
  WHERE fired_at > NOW() - INTERVAL '30 days'
    AND price_at_fire IS NOT NULL
    AND signal_type NOT IN ('DNA', 'QUANT', 'SENSE', 'WALL_ST', 'SHARK', 'CONSENSUS')
  GROUP BY signal_type
),
trend AS (
  SELECT
    signal_type,
    ROUND(100.0
      * COUNT(*) FILTER (WHERE hit_1h = true AND fired_at > NOW() - INTERVAL '7 days')
      / NULLIF(COUNT(hit_1h) FILTER (WHERE fired_at > NOW() - INTERVAL '7 days'), 0), 1)
      AS acc_recent,
    ROUND(100.0
      * COUNT(*) FILTER (WHERE hit_1h = true
                         AND fired_at <= NOW() - INTERVAL '7 days'
                         AND fired_at >  NOW() - INTERVAL '14 days')
      / NULLIF(COUNT(hit_1h) FILTER (WHERE fired_at <= NOW() - INTERVAL '7 days'
                                       AND fired_at >  NOW() - INTERVAL '14 days'), 0), 1)
      AS acc_prev
  FROM public.signal_history
  WHERE fired_at > NOW() - INTERVAL '14 days'
    AND price_at_fire IS NOT NULL
    AND signal_type NOT IN ('DNA', 'QUANT', 'SENSE', 'WALL_ST', 'SHARK', 'CONSENSUS')
  GROUP BY signal_type
),
recent_arr AS (
  SELECT
    signal_type,
    jsonb_agg(hit_1h ORDER BY fired_at DESC)                            AS recent_results_all,
    jsonb_agg(
      jsonb_build_object(
        'symbol',    symbol,
        'direction', direction,
        'hit',       hit_1h,
        'resultPct', change_1h,
        'firedAt',   fired_at
      ) ORDER BY fired_at DESC
    )                                                                   AS recent_signals_all
  FROM public.signal_history
  WHERE fired_at > NOW() - INTERVAL '30 days'
    AND hit_1h IS NOT NULL
    AND price_at_fire IS NOT NULL
    AND signal_type NOT IN ('DNA', 'QUANT', 'SENSE', 'WALL_ST', 'SHARK', 'CONSENSUS')
  GROUP BY signal_type
)
SELECT
  b.signal_type,
  b.total_signals,
  COALESCE(b.checked_1h, 0)                                              AS total_fired,
  COALESCE(b.hits_1h, 0)                                                 AS hit_count,
  COALESCE(b.accuracy_1h, 0)                                             AS accuracy,
  b.checked_1h, b.hits_1h, b.accuracy_1h,
  b.checked_4h, b.hits_4h, b.accuracy_4h,
  b.checked_24h, b.hits_24h, b.accuracy_24h,
  COALESCE(t.acc_recent - t.acc_prev, 0)                                 AS trend,
  COALESCE(
    (SELECT jsonb_agg(val)
       FROM jsonb_array_elements(r.recent_results_all) WITH ORDINALITY AS e(val, ord)
      WHERE ord <= 10),
    '[]'::jsonb
  )                                                                      AS recent_results,
  COALESCE(
    (SELECT jsonb_agg(val)
       FROM jsonb_array_elements(r.recent_signals_all) WITH ORDINALITY AS e(val, ord)
      WHERE ord <= 5),
    '[]'::jsonb
  )                                                                      AS recent_signals,
  b.last_fired
FROM base b
LEFT JOIN trend t      USING (signal_type)
LEFT JOIN recent_arr r USING (signal_type)
ORDER BY b.total_signals DESC;

-- 권한 재부여 (DROP → CREATE 방식이 아니라 CREATE OR REPLACE이므로 권한 보존됨.
-- 하지만 명시적으로 재확인.)
GRANT SELECT ON public.signal_accuracy TO anon;

COMMIT;
