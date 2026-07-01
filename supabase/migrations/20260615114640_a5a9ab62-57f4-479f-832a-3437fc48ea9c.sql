CREATE TABLE public.drift_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  import_id uuid REFERENCES public.project_imports(id) ON DELETE SET NULL,
  baseline_artifact_id uuid REFERENCES public.architecture_artifacts(id) ON DELETE SET NULL,
  stage integer NOT NULL,
  kind text NOT NULL,
  source_label text,
  category text NOT NULL CHECK (category IN ('added','removed','changed','error')),
  entity_type text,
  entity_ref text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  fresh_snapshot jsonb,
  scan_run_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed','rebaselined','adr_recorded')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX drift_findings_project_idx ON public.drift_findings(project_id, status, detected_at DESC);
CREATE INDEX drift_findings_scan_idx ON public.drift_findings(scan_run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drift_findings TO authenticated;
GRANT ALL ON public.drift_findings TO service_role;

ALTER TABLE public.drift_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view drift findings"
  ON public.drift_findings FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can update drift findings"
  ON public.drift_findings FOR UPDATE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can delete drift findings"
  ON public.drift_findings FOR DELETE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE TRIGGER drift_findings_set_updated_at
  BEFORE UPDATE ON public.drift_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();