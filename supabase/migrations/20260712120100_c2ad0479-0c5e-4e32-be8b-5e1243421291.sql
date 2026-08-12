
-- Architecture alternatives
CREATE TABLE public.architecture_alternatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  feature_change_id uuid NOT NULL REFERENCES public.feature_changes(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  pros jsonb NOT NULL DEFAULT '[]'::jsonb,
  cons jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  effort text,
  risk text,
  recommended boolean NOT NULL DEFAULT false,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.architecture_alternatives TO authenticated;
GRANT ALL ON public.architecture_alternatives TO service_role;
ALTER TABLE public.architecture_alternatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view alternatives" ON public.architecture_alternatives FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "members insert alternatives" ON public.architecture_alternatives FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id) AND created_by = auth.uid());
CREATE POLICY "creators update alternatives" ON public.architecture_alternatives FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "creators delete alternatives" ON public.architecture_alternatives FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE TRIGGER trg_alt_updated BEFORE UPDATE ON public.architecture_alternatives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_alt_fc ON public.architecture_alternatives(feature_change_id);

-- ADR records
CREATE TABLE public.adr_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  feature_change_id uuid REFERENCES public.feature_changes(id) ON DELETE SET NULL,
  chosen_alternative_id uuid REFERENCES public.architecture_alternatives(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  number integer,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  context text,
  decision text,
  consequences text,
  alternatives_considered jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  superseded_by uuid REFERENCES public.adr_records(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adr_records TO authenticated;
GRANT ALL ON public.adr_records TO service_role;
ALTER TABLE public.adr_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view adrs" ON public.adr_records FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "members insert adrs" ON public.adr_records FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id) AND created_by = auth.uid());
CREATE POLICY "creators update adrs" ON public.adr_records FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "creators delete adrs" ON public.adr_records FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE TRIGGER trg_adr_updated BEFORE UPDATE ON public.adr_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_adr_fc ON public.adr_records(feature_change_id);

-- Quality impact assessments
CREATE TABLE public.quality_impact_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  feature_change_id uuid NOT NULL REFERENCES public.feature_changes(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  attribute text NOT NULL,
  direction text NOT NULL DEFAULT 'neutral',
  severity text NOT NULL DEFAULT 'medium',
  rationale text,
  mitigations jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_impact_assessments TO authenticated;
GRANT ALL ON public.quality_impact_assessments TO service_role;
ALTER TABLE public.quality_impact_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view qia" ON public.quality_impact_assessments FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "members insert qia" ON public.quality_impact_assessments FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id) AND created_by = auth.uid());
CREATE POLICY "creators update qia" ON public.quality_impact_assessments FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "creators delete qia" ON public.quality_impact_assessments FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE TRIGGER trg_qia_updated BEFORE UPDATE ON public.quality_impact_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_qia_fc ON public.quality_impact_assessments(feature_change_id);
