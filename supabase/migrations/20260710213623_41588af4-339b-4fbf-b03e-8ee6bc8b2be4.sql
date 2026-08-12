
-- quality_scores
CREATE TABLE public.quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  characteristic text NOT NULL,
  score numeric(3,2) NOT NULL,
  gap_count integer NOT NULL DEFAULT 0,
  rationale text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  computed_by uuid,
  UNIQUE (project_id, characteristic)
);
GRANT SELECT ON public.quality_scores TO authenticated;
GRANT ALL ON public.quality_scores TO service_role;
ALTER TABLE public.quality_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read quality_scores" ON public.quality_scores
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

-- modernization_items
CREATE TABLE public.modernization_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  action text NOT NULL,
  effort integer NOT NULL,
  impact integer NOT NULL,
  roi numeric(4,2) NOT NULL,
  rationale text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  computed_by uuid,
  UNIQUE (project_id, name)
);
GRANT SELECT ON public.modernization_items TO authenticated;
GRANT ALL ON public.modernization_items TO service_role;
ALTER TABLE public.modernization_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read modernization_items" ON public.modernization_items
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

-- system_style
CREATE TABLE public.system_style (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  primary_style text NOT NULL,
  secondary_style text,
  confidence text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  drivers_fit jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  computed_by uuid
);
GRANT SELECT ON public.system_style TO authenticated;
GRANT ALL ON public.system_style TO service_role;
ALTER TABLE public.system_style ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read system_style" ON public.system_style
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
