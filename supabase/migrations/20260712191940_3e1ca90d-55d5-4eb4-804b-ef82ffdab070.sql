
ALTER TABLE public.feature_changes
  ADD COLUMN IF NOT EXISTS merit_score numeric(3,1),
  ADD COLUMN IF NOT EXISTS merit_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS merit_justification text,
  ADD COLUMN IF NOT EXISTS merit_scored_at timestamptz;
