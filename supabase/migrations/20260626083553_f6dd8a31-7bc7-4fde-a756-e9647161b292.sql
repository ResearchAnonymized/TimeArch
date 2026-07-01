
CREATE TABLE public.system_disposition_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  overall_verdict text NOT NULL CHECK (overall_verdict IN ('retain','rehost','replatform','refactor','rearchitect','rebuild','retire','hybrid')),
  confidence numeric(3,2) NOT NULL DEFAULT 0.0,
  dimension_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  component_dispositions jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_value_matrix jsonb NOT NULL DEFAULT '[]'::jsonb,
  effort_estimate jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text,
  inputs_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_disposition_reports TO authenticated;
GRANT ALL ON public.system_disposition_reports TO service_role;

ALTER TABLE public.system_disposition_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can read disposition reports"
  ON public.system_disposition_reports FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can create disposition reports"
  ON public.system_disposition_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id) AND created_by = auth.uid());

CREATE POLICY "Project members can update disposition reports"
  ON public.system_disposition_reports FOR UPDATE
  TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can delete disposition reports"
  ON public.system_disposition_reports FOR DELETE
  TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE INDEX idx_disposition_reports_project ON public.system_disposition_reports(project_id, created_at DESC);

CREATE TRIGGER trg_disposition_reports_updated_at
  BEFORE UPDATE ON public.system_disposition_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
