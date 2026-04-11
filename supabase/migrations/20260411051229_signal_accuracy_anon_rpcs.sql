-- 시그널 적중률 기록/평가용 SECURITY DEFINER RPC + anon 권한 (#102)
-- 목적: Vercel 프로덕션에 service_role 키 없이도 /api/signal-accuracy가
--       동작하도록 anon 키 + SECURITY DEFINER RPC로 RLS 우회.
--       페이로드 검증은 함수 내부에서 강제.

-- 1) 배치 INSERT RPC
--    반환: {inserted, skipped} — 호출자가 drop된 행을 감지할 수 있도록
CREATE OR REPLACE FUNCTION public.record_signal_batch(signals jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count    int;
  inserted_count int;
BEGIN
  IF signals IS NULL OR jsonb_typeof(signals) <> 'array' THEN
    RAISE EXCEPTION 'signals must be a JSON array';
  END IF;
  total_count := jsonb_array_length(signals);
  IF total_count = 0 THEN
    RETURN jsonb_build_object('inserted', 0, 'skipped', 0);
  END IF;
  IF total_count > 50 THEN
    RAISE EXCEPTION 'batch too large: max 50';
  END IF;

  INSERT INTO public.signal_history (
    signal_type, symbol, market, direction, strength, title, price_at_fire, meta
  )
  SELECT
    s->>'signal_type',
    s->>'symbol',
    s->>'market',
    s->>'direction',
    GREATEST(1, LEAST(5, COALESCE(NULLIF(s->>'strength','')::int, 1))),
    COALESCE(s->>'title', ''),
    NULLIF(s->>'price_at_fire','')::numeric,
    COALESCE(s->'meta', '{}'::jsonb)
  FROM jsonb_array_elements(signals) AS s
  WHERE s->>'signal_type' IS NOT NULL
    AND s->>'symbol'      IS NOT NULL
    AND s->>'market'      IS NOT NULL
    AND s->>'direction'   IS NOT NULL;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN jsonb_build_object(
    'inserted', inserted_count,
    'skipped',  total_count - inserted_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_signal_batch(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_signal_batch(jsonb) TO anon, authenticated;

-- 2) 배치 UPDATE RPC (적중률 평가 크론 용)
--    페이로드: {horizon, items: [{id, price, change, hit}, ...]}
--    반환: 실제로 UPDATE된 행 수 (int)
CREATE OR REPLACE FUNCTION public.update_signal_evaluation_batch(
  p_horizon text,
  p_items   jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int := 0;
BEGIN
  IF p_horizon NOT IN ('1h','4h','24h') THEN
    RAISE EXCEPTION 'invalid horizon: %', p_horizon;
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RETURN 0;
  END IF;
  IF jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'batch too large: max 200';
  END IF;

  IF p_horizon = '1h' THEN
    WITH src AS (
      SELECT (e->>'id')::bigint        AS id,
             (e->>'price')::numeric    AS price,
             (e->>'change')::numeric   AS change,
             (e->>'hit')::boolean      AS hit
        FROM jsonb_array_elements(p_items) e
    )
    UPDATE public.signal_history sh
       SET price_1h = src.price,
           change_1h = src.change,
           hit_1h = src.hit,
           checked_1h_at = now()
      FROM src
     WHERE sh.id = src.id AND sh.hit_1h IS NULL;
  ELSIF p_horizon = '4h' THEN
    WITH src AS (
      SELECT (e->>'id')::bigint        AS id,
             (e->>'price')::numeric    AS price,
             (e->>'change')::numeric   AS change,
             (e->>'hit')::boolean      AS hit
        FROM jsonb_array_elements(p_items) e
    )
    UPDATE public.signal_history sh
       SET price_4h = src.price,
           change_4h = src.change,
           hit_4h = src.hit,
           checked_4h_at = now()
      FROM src
     WHERE sh.id = src.id AND sh.hit_4h IS NULL;
  ELSE
    WITH src AS (
      SELECT (e->>'id')::bigint        AS id,
             (e->>'price')::numeric    AS price,
             (e->>'change')::numeric   AS change,
             (e->>'hit')::boolean      AS hit
        FROM jsonb_array_elements(p_items) e
    )
    UPDATE public.signal_history sh
       SET price_24h = src.price,
           change_24h = src.change,
           hit_24h = src.hit,
           checked_24h_at = now()
      FROM src
     WHERE sh.id = src.id AND sh.hit_24h IS NULL;
  END IF;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.update_signal_evaluation_batch(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_signal_evaluation_batch(text, jsonb) TO anon, authenticated;

-- 3) 평가 대상 신호 조회 RPC
--    각 horizon마다 상·하한을 둬서 오래된 신호를 "현재가 기준"으로 잘못 평가하지 않도록 한다.
--    1h:  fired_at ∈ [now-3h,  now-1h]
--    4h:  fired_at ∈ [now-12h, now-4h]
--    24h: fired_at ∈ [now-48h, now-24h]
CREATE OR REPLACE FUNCTION public.list_pending_signals(p_horizon text, p_limit int DEFAULT 100)
RETURNS TABLE (
  id bigint,
  signal_type text,
  symbol text,
  market text,
  direction text,
  fired_at timestamptz,
  price_at_fire numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_horizon NOT IN ('1h','4h','24h') THEN
    RAISE EXCEPTION 'invalid horizon: %', p_horizon;
  END IF;

  IF p_horizon = '1h' THEN
    RETURN QUERY
      SELECT sh.id, sh.signal_type, sh.symbol, sh.market, sh.direction, sh.fired_at, sh.price_at_fire
        FROM public.signal_history sh
       WHERE sh.hit_1h IS NULL
         AND sh.fired_at <= now() - interval '1 hour'
         AND sh.fired_at >  now() - interval '3 hours'
         AND sh.price_at_fire IS NOT NULL
       ORDER BY sh.fired_at ASC
       LIMIT p_limit;
  ELSIF p_horizon = '4h' THEN
    RETURN QUERY
      SELECT sh.id, sh.signal_type, sh.symbol, sh.market, sh.direction, sh.fired_at, sh.price_at_fire
        FROM public.signal_history sh
       WHERE sh.hit_4h IS NULL
         AND sh.fired_at <= now() - interval '4 hours'
         AND sh.fired_at >  now() - interval '12 hours'
         AND sh.price_at_fire IS NOT NULL
       ORDER BY sh.fired_at ASC
       LIMIT p_limit;
  ELSE
    RETURN QUERY
      SELECT sh.id, sh.signal_type, sh.symbol, sh.market, sh.direction, sh.fired_at, sh.price_at_fire
        FROM public.signal_history sh
       WHERE sh.hit_24h IS NULL
         AND sh.fired_at <= now() - interval '24 hours'
         AND sh.fired_at >  now() - interval '48 hours'
         AND sh.price_at_fire IS NOT NULL
       ORDER BY sh.fired_at ASC
       LIMIT p_limit;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.list_pending_signals(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_pending_signals(text, int) TO anon, authenticated;

-- 4) signal_accuracy 뷰 — anon에 SELECT 권한 (권한 드리프트 방지 위해 REVOKE 선행)
REVOKE ALL ON public.signal_accuracy FROM anon;
GRANT SELECT ON public.signal_accuracy TO anon;
