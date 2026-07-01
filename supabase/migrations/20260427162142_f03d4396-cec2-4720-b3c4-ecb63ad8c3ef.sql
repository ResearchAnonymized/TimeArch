CREATE TABLE IF NOT EXISTS public.requirement_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  stage integer NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('requirement','driver','ai_candidate')),
  target_key text NOT NULL,
  target_label text,
  verdict text NOT NULL CHECK (verdict IN ('approve','revise','reject')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','minor','major','critical')),
  rationale text,
  suggested_rewrite text,
  violated_rules jsonb DEFAULT '[]'::jsonb,
  agent_run_id uuid,
  created_by uuid,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_req_reviews_project_stage ON public.requirement_reviews(project_id, stage);
CREATE INDEX IF NOT EXISTS idx_req_reviews_target ON public.requirement_reviews(project_id, target_type, target_key);

ALTER TABLE public.requirement_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view requirement reviews"
  ON public.requirement_reviews FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can insert requirement reviews"
  ON public.requirement_reviews FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can update requirement reviews"
  ON public.requirement_reviews FOR UPDATE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can delete requirement reviews"
  ON public.requirement_reviews FOR DELETE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE TRIGGER trg_req_reviews_updated_at
BEFORE UPDATE ON public.requirement_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();