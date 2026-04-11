-- 시그널 적중률 트래킹 테이블
-- 시그널 발화 시 기록 → 크론으로 1h/4h/24h 후 가격 대조 → 적중 여부 자동 판정
--
-- 주: 이 파일은 Supabase 라이브 DB 에 이미 적용돼 있는 마이그레이션을
-- 레포에 역추적해 커밋한 것. 원본 version: 20260409062531 (#91).
-- 후속 마이그레이션(20260411033749 trading_signal_bot_schema)에서
-- signal_id/model/confidence/... 등의 컬럼이 추가됐으나 이 파일은
-- 초기 정의만 재현한다. fresh 환경 부트스트랩 용도 (#102 Codex P1).

CREATE TABLE IF NOT EXISTS signal_history (
  id BIGSERIAL PRIMARY KEY,

  -- 시그널 정보
  signal_type TEXT NOT NULL,           -- 시그널 타입 (volume_anomaly, composite_score 등)
  symbol TEXT NOT NULL,                -- 종목 심볼
  market TEXT NOT NULL,                -- 시장 (kr, us, coin)
  direction TEXT NOT NULL,             -- 발화 시 방향 (bullish, bearish, neutral)
  strength INT NOT NULL DEFAULT 1,     -- 강도 (1~5)
  title TEXT,                          -- 시그널 제목

  -- 발화 시점 가격
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price_at_fire NUMERIC,

  -- 1시간 후 대조
  price_1h NUMERIC,
  change_1h NUMERIC,
  hit_1h BOOLEAN,
  checked_1h_at TIMESTAMPTZ,

  -- 4시간 후 대조
  price_4h NUMERIC,
  change_4h NUMERIC,
  hit_4h BOOLEAN,
  checked_4h_at TIMESTAMPTZ,

  -- 24시간 후 대조
  price_24h NUMERIC,
  change_24h NUMERIC,
  hit_24h BOOLEAN,
  checked_24h_at TIMESTAMPTZ,

  -- 메타
  meta JSONB DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_signal_history_type      ON signal_history(signal_type);
CREATE INDEX IF NOT EXISTS idx_signal_history_symbol    ON signal_history(symbol);
CREATE INDEX IF NOT EXISTS idx_signal_history_fired_at  ON signal_history(fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_history_unchecked_1h  ON signal_history(fired_at) WHERE hit_1h  IS NULL;
CREATE INDEX IF NOT EXISTS idx_signal_history_unchecked_4h  ON signal_history(fired_at) WHERE hit_4h  IS NULL;
CREATE INDEX IF NOT EXISTS idx_signal_history_unchecked_24h ON signal_history(fired_at) WHERE hit_24h IS NULL;

-- 적중률 집계 뷰
CREATE OR REPLACE VIEW signal_accuracy AS
SELECT
  signal_type,
  COUNT(*) AS total_signals,
  -- 1시간 적중률
  COUNT(hit_1h) AS checked_1h,
  COUNT(*) FILTER (WHERE hit_1h = true) AS hits_1h,
  ROUND(100.0 * COUNT(*) FILTER (WHERE hit_1h = true) / NULLIF(COUNT(hit_1h), 0), 1) AS accuracy_1h,
  -- 4시간 적중률
  COUNT(hit_4h) AS checked_4h,
  COUNT(*) FILTER (WHERE hit_4h = true) AS hits_4h,
  ROUND(100.0 * COUNT(*) FILTER (WHERE hit_4h = true) / NULLIF(COUNT(hit_4h), 0), 1) AS accuracy_4h,
  -- 24시간 적중률
  COUNT(hit_24h) AS checked_24h,
  COUNT(*) FILTER (WHERE hit_24h = true) AS hits_24h,
  ROUND(100.0 * COUNT(*) FILTER (WHERE hit_24h = true) / NULLIF(COUNT(hit_24h), 0), 1) AS accuracy_24h,
  -- 최근 시그널
  MAX(fired_at) AS last_fired
FROM signal_history
WHERE fired_at > NOW() - INTERVAL '30 days'
GROUP BY signal_type
ORDER BY total_signals DESC;

-- RLS (기본: service_role only). 이후 마이그레이션에서 anon RPC 우회가 추가됨 (#102).
ALTER TABLE signal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON signal_history
  FOR ALL
  USING (auth.role() = 'service_role');
