
ALTER TABLE public.experiment_proposals
  ADD COLUMN IF NOT EXISTS pr_url text,
  ADD COLUMN IF NOT EXISTS pr_repo text,
  ADD COLUMN IF NOT EXISTS pr_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS pr_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pr_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS pr_merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS pr_title text;
