
CREATE TABLE public.llm_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('openai-compatible','anthropic','azure','local','other')),
  base_url text NOT NULL,
  model_id text NOT NULL,
  api_key_secret_name text,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_endpoints TO authenticated;
GRANT ALL ON public.llm_endpoints TO service_role;

ALTER TABLE public.llm_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "llm_endpoints read for authenticated"
  ON public.llm_endpoints FOR SELECT TO authenticated USING (true);

CREATE POLICY "llm_endpoints admin insert"
  ON public.llm_endpoints FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "llm_endpoints admin update"
  ON public.llm_endpoints FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "llm_endpoints admin delete"
  ON public.llm_endpoints FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER llm_endpoints_updated_at
  BEFORE UPDATE ON public.llm_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
