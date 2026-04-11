-- signal_accuracy 뷰 확장 — 프론트 useSignalAccuracy 훅이 읽는 컬럼 전부 제공 (#102)
--
-- 초기 create_signal_history 의 뷰는 signal_type / accuracy_{1h,4h,24h} 수준만
-- 노출했는데, src/hooks/useSignalAccuracy.js 는 total_fired / hit_count / accuracy /
-- trend / recent_results / recent_signals 를 읽으므로 성적표 UI 가 항상 "0% / 0회"
-- 로 표시되는 문제가 있었다. 뷰를 확장해 UI 와 1:1 로 맞춘다.

DROP VIEW IF EXISTS public.signal_accuracy;

CREATE VIEW public.signal_accuracy AS
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
  GROUP BY signal_type
),
trend AS (
  -- 최근 7일 accuracy_1h - 이전 7일 accuracy_1h
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
  GROUP BY signal_type
),
recent_arr AS (
  -- 최신순 전체 집계 후 바깥에서 상위 10/5 만 선택
  SELECT
    signal_type,
    jsonb_agg(hit_1h ORDER BY fired_at DESC)
      FILTER (WHERE hit_1h IS NOT NULL) AS recent_results_all,
    jsonb_agg(
      jsonb_build_object(
        'symbol',    symbol,
        'direction', direction,
        'hit',       hit_1h,
        'resultPct', change_1h,
        'firedAt',   fired_at
      ) ORDER BY fired_at DESC
    ) AS recent_signals_all
  FROM public.signal_history
  WHERE fired_at > NOW() - INTERVAL '30 days'
  GROUP BY signal_type
)
SELECT
  b.signal_type,
  b.total_signals,
  b.total_signals                                                        AS total_fired,
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

-- anon 권한 재부여 (뷰 재생성으로 권한 초기화됨)
REVOKE ALL ON public.signal_accuracy FROM anon;
GRANT SELECT ON public.signal_accuracy TO anon;
