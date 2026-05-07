-- signal_history anon SELECT 허용 (P3-14 시그널 히스토리 타임라인)
-- 쓰기(INSERT/UPDATE/DELETE)는 여전히 service_role_only 정책으로 차단됨
-- 읽기는 공개 시계열 데이터이므로 anon 허용이 안전
ALTER TABLE public.signal_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select"
  ON public.signal_history
  FOR SELECT
  TO anon, authenticated
  USING (true);
