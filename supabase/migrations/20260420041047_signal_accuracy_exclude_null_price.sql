-- signal_accuracy 뷰 — price_at_fire IS NULL 레코드 제외
--
-- 배경 (#152, 2026-04-20):
-- 진단 결과 signal_history 13,383건 중 10,294건(77%)이 price_at_fire NULL 상태로
-- RPC list_pending_signals가 영영 평가 대상에서 제외. 그러나 signal_accuracy 뷰는
-- 이 레코드들을 그대로 total_signals 분모에 포함시켜 적중률 수치를 심하게 왜곡.
--
-- 주요 누락 타입(price_at_fire=NULL 100%):
--   news_sentiment_cluster  10,036건
--   volume_price_divergence    211건
--   social_sentiment             22건
--   order_flow_imbalance         15건
--   stealth_activity             11건
--   put_call_ratio                9건
--
-- 본 마이그레이션은 기존 데이터는 건드리지 않고, 뷰 정의의 3개 CTE에 모두
-- `AND price_at_fire IS NOT NULL` 조건을 추가해 집계에서만 제외.
-- 데이터 정리(삭제) 정책은 별도 이슈에서 결정.

CREATE OR REPLACE VIEW signal_accuracy AS
WITH base AS (
  SELECT signal_history.signal_type,
         count(*) AS total_signals,
         count(signal_history.hit_1h) AS checked_1h,
         count(*) FILTER (WHERE (signal_history.hit_1h = true)) AS hits_1h,
         round(((100.0 * (count(*) FILTER (WHERE (signal_history.hit_1h = true)))::numeric) / (NULLIF(count(signal_history.hit_1h), 0))::numeric), 1) AS accuracy_1h,
         count(signal_history.hit_4h) AS checked_4h,
         count(*) FILTER (WHERE (signal_history.hit_4h = true)) AS hits_4h,
         round(((100.0 * (count(*) FILTER (WHERE (signal_history.hit_4h = true)))::numeric) / (NULLIF(count(signal_history.hit_4h), 0))::numeric), 1) AS accuracy_4h,
         count(signal_history.hit_24h) AS checked_24h,
         count(*) FILTER (WHERE (signal_history.hit_24h = true)) AS hits_24h,
         round(((100.0 * (count(*) FILTER (WHERE (signal_history.hit_24h = true)))::numeric) / (NULLIF(count(signal_history.hit_24h), 0))::numeric), 1) AS accuracy_24h,
         max(signal_history.fired_at) AS last_fired
    FROM signal_history
   WHERE signal_history.fired_at > (now() - '30 days'::interval)
     AND signal_history.price_at_fire IS NOT NULL
   GROUP BY signal_history.signal_type
), trend AS (
  SELECT signal_history.signal_type,
         round(((100.0 * (count(*) FILTER (WHERE ((signal_history.hit_1h = true) AND (signal_history.fired_at > (now() - '7 days'::interval)))))::numeric) / (NULLIF(count(signal_history.hit_1h) FILTER (WHERE (signal_history.fired_at > (now() - '7 days'::interval))), 0))::numeric), 1) AS acc_recent,
         round(((100.0 * (count(*) FILTER (WHERE ((signal_history.hit_1h = true) AND (signal_history.fired_at <= (now() - '7 days'::interval)) AND (signal_history.fired_at > (now() - '14 days'::interval)))))::numeric) / (NULLIF(count(signal_history.hit_1h) FILTER (WHERE ((signal_history.fired_at <= (now() - '7 days'::interval)) AND (signal_history.fired_at > (now() - '14 days'::interval)))), 0))::numeric), 1) AS acc_prev
    FROM signal_history
   WHERE signal_history.fired_at > (now() - '14 days'::interval)
     AND signal_history.price_at_fire IS NOT NULL
   GROUP BY signal_history.signal_type
), recent_arr AS (
  SELECT signal_history.signal_type,
         jsonb_agg(signal_history.hit_1h ORDER BY signal_history.fired_at DESC) AS recent_results_all,
         jsonb_agg(jsonb_build_object('symbol', signal_history.symbol, 'direction', signal_history.direction, 'hit', signal_history.hit_1h, 'resultPct', signal_history.change_1h, 'firedAt', signal_history.fired_at) ORDER BY signal_history.fired_at DESC) AS recent_signals_all
    FROM signal_history
   WHERE signal_history.fired_at > (now() - '30 days'::interval)
     AND signal_history.hit_1h IS NOT NULL
     AND signal_history.price_at_fire IS NOT NULL
   GROUP BY signal_history.signal_type
)
SELECT b.signal_type,
       b.total_signals,
       COALESCE(b.checked_1h, (0)::bigint) AS total_fired,
       COALESCE(b.hits_1h, (0)::bigint) AS hit_count,
       COALESCE(b.accuracy_1h, (0)::numeric) AS accuracy,
       b.checked_1h,
       b.hits_1h,
       b.accuracy_1h,
       b.checked_4h,
       b.hits_4h,
       b.accuracy_4h,
       b.checked_24h,
       b.hits_24h,
       b.accuracy_24h,
       COALESCE((t.acc_recent - t.acc_prev), (0)::numeric) AS trend,
       COALESCE(( SELECT jsonb_agg(e.val) AS jsonb_agg
                    FROM jsonb_array_elements(r.recent_results_all) WITH ORDINALITY e(val, ord)
                   WHERE (e.ord <= 10)), '[]'::jsonb) AS recent_results,
       COALESCE(( SELECT jsonb_agg(e.val) AS jsonb_agg
                    FROM jsonb_array_elements(r.recent_signals_all) WITH ORDINALITY e(val, ord)
                   WHERE (e.ord <= 5)), '[]'::jsonb) AS recent_signals,
       b.last_fired
  FROM ((base b
    LEFT JOIN trend t USING (signal_type))
    LEFT JOIN recent_arr r USING (signal_type))
 ORDER BY b.total_signals DESC;

-- 권한은 기존 유지 (REVOKE ALL + GRANT SELECT TO anon은 이전 마이그레이션에서
-- 동일하게 설정됨; CREATE OR REPLACE는 권한을 보존함).
