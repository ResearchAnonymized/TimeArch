
CREATE TABLE public.feature_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  feature_change_id uuid NOT NULL REFERENCES public.feature_changes(id) ON DELETE CASCADE,
  adr_id uuid REFERENCES public.adr_records(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'implementation',
  priority text NOT NULL DEFAULT 'medium',
  effort text,
  status text NOT NULL DEFAULT 'proposed',
  validation_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ordering integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_work_items TO authenticated;
GRANT ALL ON public.feature_work_items TO service_role;
ALTER TABLE public.feature_work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view work items" ON public.feature_work_items FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "members insert work items" ON public.feature_work_items FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id) AND created_by = auth.uid());
CREATE POLICY "creators update work items" ON public.feature_work_items FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "creators delete work items" ON public.feature_work_items FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE TRIGGER trg_fwi_updated BEFORE UPDATE ON public.feature_work_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_fwi_fc ON public.feature_work_items(feature_change_id);
