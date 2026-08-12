
CREATE TABLE public.feature_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  current_behavior TEXT,
  desired_behavior TEXT,
  change_type TEXT NOT NULL DEFAULT 'modify' CHECK (change_type IN ('add','modify','remove','migrate')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','in_review','approved','implemented','archived')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_changes_project ON public.feature_changes(project_id);
CREATE INDEX idx_feature_changes_active ON public.feature_changes(project_id, is_active) WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_changes TO authenticated;
GRANT ALL ON public.feature_changes TO service_role;

ALTER TABLE public.feature_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view feature changes"
  ON public.feature_changes FOR SELECT
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can insert feature changes"
  ON public.feature_changes FOR INSERT
  WITH CHECK (public.is_project_member(auth.uid(), project_id) AND auth.uid() = created_by);

CREATE POLICY "Project members can update feature changes"
  ON public.feature_changes FOR UPDATE
  USING (public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can delete feature changes"
  ON public.feature_changes FOR DELETE
  USING (public.is_project_member(auth.uid(), project_id));

CREATE TRIGGER update_feature_changes_updated_at
  BEFORE UPDATE ON public.feature_changes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
