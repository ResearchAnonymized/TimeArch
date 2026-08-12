-- Phase 3: feature_mappings — maps a feature_change to the architecture elements it touches
CREATE TABLE public.feature_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  feature_change_id uuid NOT NULL REFERENCES public.feature_changes(id) ON DELETE CASCADE,
  element_type text NOT NULL, -- ui | api | service | domain | data | event | external | test | deploy | component
  element_ref text NOT NULL,  -- free-form identifier (component name, endpoint path, table name, etc.)
  element_label text,
  relationship text NOT NULL DEFAULT 'touches', -- touches | modifies | reads | writes | replaces | extends | removes
  confidence numeric NOT NULL DEFAULT 0.5,
  source text NOT NULL DEFAULT 'ai', -- tool | ai | human
  review_status text NOT NULL DEFAULT 'pending', -- pending | approved | corrected | removed
  rationale text,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feature_mappings_fc ON public.feature_mappings(feature_change_id);
CREATE INDEX idx_feature_mappings_project ON public.feature_mappings(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_mappings TO authenticated;
GRANT ALL ON public.feature_mappings TO service_role;

ALTER TABLE public.feature_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view feature_mappings"
  ON public.feature_mappings FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Members can insert feature_mappings"
  ON public.feature_mappings FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Members can update feature_mappings"
  ON public.feature_mappings FOR UPDATE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Members can delete feature_mappings"
  ON public.feature_mappings FOR DELETE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE TRIGGER update_feature_mappings_updated_at
  BEFORE UPDATE ON public.feature_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 4: impact_findings — ripple effects of a proposed change
CREATE TABLE public.impact_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  feature_change_id uuid NOT NULL REFERENCES public.feature_changes(id) ON DELETE CASCADE,
  origin_mapping_id uuid REFERENCES public.feature_mappings(id) ON DELETE SET NULL,
  impacted_element_type text NOT NULL,
  impacted_element_ref text NOT NULL,
  impacted_element_label text,
  classification text NOT NULL DEFAULT 'possible', -- confirmed | probable | possible | unlikely | unknown
  severity text NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  reason text,
  dependency_path jsonb NOT NULL DEFAULT '[]'::jsonb, -- ordered list of {type, ref, label}
  recommended_action text,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_impact_findings_fc ON public.impact_findings(feature_change_id);
CREATE INDEX idx_impact_findings_project ON public.impact_findings(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.impact_findings TO authenticated;
GRANT ALL ON public.impact_findings TO service_role;

ALTER TABLE public.impact_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view impact_findings"
  ON public.impact_findings FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Members can insert impact_findings"
  ON public.impact_findings FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Members can update impact_findings"
  ON public.impact_findings FOR UPDATE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Members can delete impact_findings"
  ON public.impact_findings FOR DELETE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE TRIGGER update_impact_findings_updated_at
  BEFORE UPDATE ON public.impact_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
