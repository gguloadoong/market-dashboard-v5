-- 시그널 적중률 기록/평가용 SECURITY DEFINER RPC + shared secret 검증 (#102)
--
-- 목적: Vercel 프로덕션에 service_role 키 없이도 /api/signal-accuracy 가
--       동작하도록 anon 키 + SECURITY DEFINER RPC 로 RLS 우회.
--       anon 키는 공개라서 프론트엔드 번들에도 들어가므로,
--       공격자가 RPC 에 직접 접근해 DB 를 오염시키지 못하도록
--       shared secret (SHA256 해시 비교) 를 함수 내부에서 강제.
--
-- 호출자 인증 흐름:
--   브라우저 → /api/signal-accuracy (Vercel API route, SIGNAL_RPC_SECRET 주입)
--            → Supabase RPC (anon 키 + p_secret) → verify_signal_rpc_secret()

-- ────────────────────────────────────────────────────────────
-- 0) private 스키마 + shared secret 저장소
-- ────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.signal_rpc_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);
REVOKE ALL ON TABLE private.signal_rpc_config FROM PUBLIC, anon, authenticated;

-- NOTE: 초기 rpc_secret_sha256 값은 배포 시 별도로 주입한다.
--       (예: SQL 콘솔에서 INSERT ... ON CONFLICT DO UPDATE)
--       비밀 원본은 저장하지 않고 SHA256 해시만 보관한다.
--       이 파일에는 해시 값을 커밋하지 않는다 — 환경마다 다름.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE OR REPLACE FUNCTION private.verify_signal_rpc_secret(p_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, pg_catalog, public
AS $$
DECLARE
  stored text;
BEGIN
  IF p_secret IS NULL OR length(p_secret) < 32 THEN
    RETURN false;
  END IF;
  SELECT value INTO stored
    FROM private.signal_rpc_config
   WHERE key = 'rpc_secret_sha256';
  IF stored IS NULL THEN
    RETURN false;
  END IF;
  RETURN stored = encode(digest(p_secret, 'sha256'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION private.verify_signal_rpc_secret(text) FROM PUBLIC;
-- 외부 role 에 EXECUTE 권한 부여하지 않음. 아래 SECURITY DEFINER 함수들만 호출.

-- ────────────────────────────────────────────────────────────
-- 1) 배치 INSERT RPC
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_signal_batch(p_secret text, signals jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count    int;
  inserted_count int;
BEGIN
  IF NOT private.verify_signal_rpc_secret(p_secret) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

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

REVOKE ALL ON FUNCTION public.record_signal_batch(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_signal_batch(text, jsonb) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 2) 배치 UPDATE RPC (적중률 평가 크론 용)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_signal_evaluation_batch(
  p_secret  text,
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
  IF NOT private.verify_signal_rpc_secret(p_secret) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

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
      SELECT (e->>'id')::bigint      AS id,
             (e->>'price')::numeric  AS price,
             (e->>'change')::numeric AS change,
             (e->>'hit')::boolean    AS hit
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
      SELECT (e->>'id')::bigint      AS id,
             (e->>'price')::numeric  AS price,
             (e->>'change')::numeric AS change,
             (e->>'hit')::boolean    AS hit
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
      SELECT (e->>'id')::bigint      AS id,
             (e->>'price')::numeric  AS price,
             (e->>'change')::numeric AS change,
             (e->>'hit')::boolean    AS hit
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

REVOKE ALL ON FUNCTION public.update_signal_evaluation_batch(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_signal_evaluation_batch(text, text, jsonb) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 3) 평가 대상 신호 조회 RPC
--    horizon 별 상·하한으로 오래된 신호를 "현재가 기준" 잘못 평가 방지.
--      1h:  fired_at ∈ (now-3h,  now-1h]
--      4h:  fired_at ∈ (now-12h, now-4h]
--      24h: fired_at ∈ (now-48h, now-24h]
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_pending_signals(
  p_secret  text,
  p_horizon text,
  p_limit   int DEFAULT 100
)
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
  IF NOT private.verify_signal_rpc_secret(p_secret) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

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

REVOKE ALL ON FUNCTION public.list_pending_signals(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_pending_signals(text, text, int) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 4) signal_accuracy 뷰 — anon SELECT (권한 드리프트 방지)
-- ────────────────────────────────────────────────────────────
REVOKE ALL ON public.signal_accuracy FROM anon;
GRANT SELECT ON public.signal_accuracy TO anon;
