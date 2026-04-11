-- 시그널 적중률 기록/평가용 SECURITY DEFINER RPC + anon 권한 (#102)
-- 목적: Vercel 프로덕션에 service_role 키 없이도 /api/signal-accuracy가
--       동작하도록 anon 키 + SECURITY DEFINER RPC로 RLS 우회.
--       페이로드 검증은 함수 내부에서 강제.

-- 1) 배치 INSERT RPC
CREATE OR REPLACE FUNCTION public.record_signal_batch(signals jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count int;
BEGIN
  IF signals IS NULL OR jsonb_typeof(signals) <> 'array' THEN
    RAISE EXCEPTION 'signals must be a JSON array';
  END IF;
  IF jsonb_array_length(signals) = 0 THEN
    RETURN 0;
  END IF;
  IF jsonb_array_length(signals) > 50 THEN
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
    COALESCE(NULLIF(s->>'strength','')::int, 1),
    COALESCE(s->>'title', ''),
    NULLIF(s->>'price_at_fire','')::numeric,
    COALESCE(s->'meta', '{}'::jsonb)
  FROM jsonb_array_elements(signals) AS s
  WHERE s->>'signal_type' IS NOT NULL
    AND s->>'symbol'      IS NOT NULL
    AND s->>'market'      IS NOT NULL
    AND s->>'direction'   IS NOT NULL;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_signal_batch(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_signal_batch(jsonb) TO anon, authenticated;

-- 2) 단일 UPDATE RPC (적중률 평가 크론 용)
CREATE OR REPLACE FUNCTION public.update_signal_evaluation(
  p_id      bigint,
  p_horizon text,
  p_price   numeric,
  p_change  numeric,
  p_hit     boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean := false;
BEGIN
  IF p_horizon NOT IN ('1h','4h','24h') THEN
    RAISE EXCEPTION 'invalid horizon: %', p_horizon;
  END IF;

  IF p_horizon = '1h' THEN
    UPDATE public.signal_history
       SET price_1h = p_price,
           change_1h = p_change,
           hit_1h = p_hit,
           checked_1h_at = now()
     WHERE id = p_id AND hit_1h IS NULL;
  ELSIF p_horizon = '4h' THEN
    UPDATE public.signal_history
       SET price_4h = p_price,
           change_4h = p_change,
           hit_4h = p_hit,
           checked_4h_at = now()
     WHERE id = p_id AND hit_4h IS NULL;
  ELSE
    UPDATE public.signal_history
       SET price_24h = p_price,
           change_24h = p_change,
           hit_24h = p_hit,
           checked_24h_at = now()
     WHERE id = p_id AND hit_24h IS NULL;
  END IF;

  GET DIAGNOSTICS ok = ROW_COUNT;
  RETURN ok;
END;
$$;

REVOKE ALL ON FUNCTION public.update_signal_evaluation(bigint,text,numeric,numeric,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_signal_evaluation(bigint,text,numeric,numeric,boolean) TO anon, authenticated;

-- 3) 평가 대상 신호 조회 RPC
--    anon에 signal_history SELECT 권한을 직접 주지 않기 위해 RPC로 감쌈.
CREATE OR REPLACE FUNCTION public.list_pending_signals(p_horizon text, p_limit int DEFAULT 200)
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
         AND sh.fired_at > now() - interval '7 days'
         AND sh.price_at_fire IS NOT NULL
       ORDER BY sh.fired_at ASC
       LIMIT p_limit;
  ELSIF p_horizon = '4h' THEN
    RETURN QUERY
      SELECT sh.id, sh.signal_type, sh.symbol, sh.market, sh.direction, sh.fired_at, sh.price_at_fire
        FROM public.signal_history sh
       WHERE sh.hit_4h IS NULL
         AND sh.fired_at <= now() - interval '4 hours'
         AND sh.fired_at > now() - interval '7 days'
         AND sh.price_at_fire IS NOT NULL
       ORDER BY sh.fired_at ASC
       LIMIT p_limit;
  ELSE
    RETURN QUERY
      SELECT sh.id, sh.signal_type, sh.symbol, sh.market, sh.direction, sh.fired_at, sh.price_at_fire
        FROM public.signal_history sh
       WHERE sh.hit_24h IS NULL
         AND sh.fired_at <= now() - interval '24 hours'
         AND sh.fired_at > now() - interval '7 days'
         AND sh.price_at_fire IS NOT NULL
       ORDER BY sh.fired_at ASC
       LIMIT p_limit;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.list_pending_signals(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_pending_signals(text, int) TO anon, authenticated;

-- 4) signal_accuracy 뷰 — anon에 SELECT 권한
GRANT SELECT ON public.signal_accuracy TO anon;
