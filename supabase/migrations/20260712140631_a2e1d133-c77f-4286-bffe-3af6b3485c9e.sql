-- Experiment Ground: proposals, runs, stage results, rubric scores.
-- All auth-only; RLS scoped via is_project_member; service_role for edge functions.

CREATE TABLE public.experiment_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  change_type TEXT NOT NULL DEFAULT 'add',
  source TEXT NOT NULL DEFAULT 'manual',
  pr_number INTEGER,
  expected_hints JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiment_proposals TO authenticated;
GRANT ALL ON public.experiment_proposals TO service_role;
ALTER TABLE public.experiment_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read proposals" ON public.experiment_proposals
  FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "members insert proposals" ON public.experiment_proposals
  FOR INSERT TO authenticated WITH CHECK (public.is_project_member(auth.uid(), project_id) AND created_by = auth.uid());
CREATE POLICY "members update proposals" ON public.experiment_proposals
  FOR UPDATE TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "members delete proposals" ON public.experiment_proposals
  FOR DELETE TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE TRIGGER trg_experiment_proposals_updated
  BEFORE UPDATE ON public.experiment_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.experiment_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.experiment_proposals(id) ON DELETE SET NULL,
  feature_change_id UUID REFERENCES public.feature_changes(id) ON DELETE SET NULL,
  track TEXT NOT NULL DEFAULT 'prospective',
  status TEXT NOT NULL DEFAULT 'running',
  wall_ms INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  guardrail_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_by UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiment_runs TO authenticated;
GRANT ALL ON public.experiment_runs TO service_role;
ALTER TABLE public.experiment_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read runs" ON public.experiment_runs
  FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "members insert runs" ON public.experiment_runs
  FOR INSERT TO authenticated WITH CHECK (public.is_project_member(auth.uid(), project_id) AND triggered_by = auth.uid());
CREATE POLICY "members update runs" ON public.experiment_runs
  FOR UPDATE TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "members delete runs" ON public.experiment_runs
  FOR DELETE TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE TRIGGER trg_experiment_runs_updated
  BEFORE UPDATE ON public.experiment_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_experiment_runs_project ON public.experiment_runs(project_id, started_at DESC);

CREATE TABLE public.experiment_stage_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.experiment_runs(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  row_count INTEGER NOT NULL DEFAULT 0,
  wall_ms INTEGER NOT NULL DEFAULT 0,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiment_stage_results TO authenticated;
GRANT ALL ON public.experiment_stage_results TO service_role;
ALTER TABLE public.experiment_stage_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read stage results" ON public.experiment_stage_results
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.experiment_runs r
      WHERE r.id = experiment_stage_results.run_id
        AND public.is_project_member(auth.uid(), r.project_id))
  );
CREATE INDEX idx_experiment_stage_results_run ON public.experiment_stage_results(run_id, stage_order);

CREATE TABLE public.experiment_rubric_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.experiment_runs(id) ON DELETE CASCADE,
  rater_user_id UUID NOT NULL,
  dimension TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 3),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, rater_user_id, dimension)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiment_rubric_scores TO authenticated;
GRANT ALL ON public.experiment_rubric_scores TO service_role;
ALTER TABLE public.experiment_rubric_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read rubric" ON public.experiment_rubric_scores
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.experiment_runs r
      WHERE r.id = experiment_rubric_scores.run_id
        AND public.is_project_member(auth.uid(), r.project_id))
  );
CREATE POLICY "raters insert own rubric" ON public.experiment_rubric_scores
  FOR INSERT TO authenticated WITH CHECK (
    rater_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.experiment_runs r
      WHERE r.id = experiment_rubric_scores.run_id
        AND public.is_project_member(auth.uid(), r.project_id))
  );
CREATE POLICY "raters update own rubric" ON public.experiment_rubric_scores
  FOR UPDATE TO authenticated USING (rater_user_id = auth.uid());
CREATE POLICY "raters delete own rubric" ON public.experiment_rubric_scores
  FOR DELETE TO authenticated USING (rater_user_id = auth.uid());
