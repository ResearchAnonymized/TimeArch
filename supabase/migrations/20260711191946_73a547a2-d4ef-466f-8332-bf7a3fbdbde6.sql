ALTER TABLE public.requirements
  ADD COLUMN IF NOT EXISTS change_type text
    CHECK (change_type IS NULL OR change_type IN ('preserve','change','deprecate','new'));

COMMENT ON COLUMN public.requirements.change_type IS
  'Brownfield delta tag: preserve (keep as-is), change (modify), deprecate (retire), new (net-new).';