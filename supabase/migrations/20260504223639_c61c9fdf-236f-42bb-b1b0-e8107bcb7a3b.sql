CREATE TABLE public.architecture_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  category text NOT NULL,
  framework text NOT NULL DEFAULT 'iso_25010',
  title text NOT NULL,
  description text,
  current_state text,
  target_state text,
  severity text NOT NULL DEFAULT 'medium',
  effort text NOT NULL DEFAULT 'medium',
  recommendation text,
  source_artifact_ids uuid[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  agent_run_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.architecture_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view gaps" ON public.architecture_gaps
  FOR SELECT TO authenticated USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can insert gaps" ON public.architecture_gaps
  FOR INSERT TO authenticated WITH CHECK (is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can update gaps" ON public.architecture_gaps
  FOR UPDATE TO authenticated USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can delete gaps" ON public.architecture_gaps
  FOR DELETE TO authenticated USING (is_project_member(auth.uid(), project_id));

CREATE TRIGGER update_architecture_gaps_updated_at
  BEFORE UPDATE ON public.architecture_gaps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_architecture_gaps_project ON public.architecture_gaps(project_id, status);