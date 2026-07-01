
-- 1. Per-token security settings
ALTER TABLE public.api_tokens
  ADD COLUMN IF NOT EXISTS rate_limit_per_min integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS allowed_ips inet[] NULL,
  ADD COLUMN IF NOT EXISTS last_used_ip inet NULL;

-- 2. API call audit log
CREATE TABLE IF NOT EXISTS public.api_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.api_tokens(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  project_id uuid NULL,
  op text NOT NULL,
  method text NULL,
  status_code integer NULL,
  ip inet NULL,
  user_agent text NULL,
  error text NULL,
  duration_ms integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_call_log TO authenticated;
GRANT ALL ON public.api_call_log TO service_role;
ALTER TABLE public.api_call_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own api call log"
  ON public.api_call_log FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
CREATE INDEX IF NOT EXISTS api_call_log_token_created_idx
  ON public.api_call_log (token_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_call_log_owner_created_idx
  ON public.api_call_log (owner_id, created_at DESC);

-- 3. Rate-limit buckets (one row per token per minute)
CREATE TABLE IF NOT EXISTS public.api_rate_buckets (
  token_id uuid NOT NULL REFERENCES public.api_tokens(id) ON DELETE CASCADE,
  minute_bucket timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (token_id, minute_bucket)
);
GRANT SELECT ON public.api_rate_buckets TO authenticated;
GRANT ALL ON public.api_rate_buckets TO service_role;
ALTER TABLE public.api_rate_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own rate buckets"
  ON public.api_rate_buckets FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.api_tokens t
    WHERE t.id = api_rate_buckets.token_id AND t.owner_id = auth.uid()
  ));

-- 4. Atomic rate-limit check + increment
CREATE OR REPLACE FUNCTION public.api_check_rate(_token_id uuid, _limit integer)
RETURNS TABLE(allowed boolean, remaining integer, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bucket timestamptz := date_trunc('minute', now());
  new_count integer;
BEGIN
  INSERT INTO public.api_rate_buckets (token_id, minute_bucket, count)
  VALUES (_token_id, bucket, 1)
  ON CONFLICT (token_id, minute_bucket)
  DO UPDATE SET count = public.api_rate_buckets.count + 1
  RETURNING count INTO new_count;

  RETURN QUERY SELECT (new_count <= _limit), GREATEST(_limit - new_count, 0), new_count;
END;
$$;

-- 5. Cleanup helper (call from a cron or on demand)
CREATE OR REPLACE FUNCTION public.api_cleanup_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.api_call_log    WHERE created_at < now() - interval '30 days';
  DELETE FROM public.api_rate_buckets WHERE minute_bucket < now() - interval '1 hour';
$$;
