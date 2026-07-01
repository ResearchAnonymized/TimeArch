CREATE TABLE IF NOT EXISTS public.prompt_overrides (
  key text PRIMARY KEY,
  content text NOT NULL,
  notes text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prompt_overrides TO authenticated;
GRANT ALL ON public.prompt_overrides TO service_role;
ALTER TABLE public.prompt_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prompt_overrides read for authenticated" ON public.prompt_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "prompt_overrides admin write" ON public.prompt_overrides FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));