
-- 1. Project mode (greenfield default keeps existing behavior unchanged)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'greenfield',
  ADD COLUMN IF NOT EXISTS source_repo_url text;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_mode_check
  CHECK (mode IN ('greenfield', 'brownfield'));

-- 2. project_imports table for Stage 0 Discovery uploads
CREATE TABLE public.project_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('repo','openapi','db_schema','adr','srs','diagram','other')),
  source_label text NOT NULL,
  storage_path text,
  source_url text,
  parsed_summary jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','parsed','failed')),
  error text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_imports_project ON public.project_imports(project_id);

ALTER TABLE public.project_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view imports"
  ON public.project_imports FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can insert imports"
  ON public.project_imports FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can update imports"
  ON public.project_imports FOR UPDATE TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can delete imports"
  ON public.project_imports FOR DELETE TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE TRIGGER update_project_imports_updated_at
  BEFORE UPDATE ON public.project_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Private storage bucket for discovery uploads (project-scoped paths: <project_id>/<file>)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-imports', 'project-imports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Project members can read project-imports"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-imports'
    AND is_project_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Project members can upload project-imports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-imports'
    AND is_project_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Project members can update project-imports"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-imports'
    AND is_project_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Project members can delete project-imports"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-imports'
    AND is_project_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
