CREATE TABLE public.challenger_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  stage INTEGER NOT NULL,
  artifact_id UUID NOT NULL,
  concern_index INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('accept', 'reject', 'modify')),
  modification TEXT,
  architect_rationale TEXT,
  cycle INTEGER NOT NULL DEFAULT 1 CHECK (cycle BETWEEN 1 AND 2),
  decided_by UUID NOT NULL,
  decided_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, concern_index, cycle)
);

CREATE INDEX idx_challenger_decisions_project_stage ON public.challenger_decisions(project_id, stage);
CREATE INDEX idx_challenger_decisions_artifact ON public.challenger_decisions(artifact_id);

ALTER TABLE public.challenger_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view challenger decisions"
ON public.challenger_decisions
FOR SELECT
TO authenticated
USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can insert challenger decisions"
ON public.challenger_decisions
FOR INSERT
TO authenticated
WITH CHECK (decided_by = auth.uid() AND is_project_member(auth.uid(), project_id));

CREATE POLICY "Architect can update own decisions"
ON public.challenger_decisions
FOR UPDATE
TO authenticated
USING (decided_by = auth.uid());

CREATE POLICY "Architect can delete own decisions"
ON public.challenger_decisions
FOR DELETE
TO authenticated
USING (decided_by = auth.uid());

CREATE TRIGGER update_challenger_decisions_updated_at
BEFORE UPDATE ON public.challenger_decisions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();