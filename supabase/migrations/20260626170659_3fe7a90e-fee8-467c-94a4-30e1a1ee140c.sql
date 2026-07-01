
-- 1) agent_runs_v2
CREATE TABLE public.agent_runs_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  stage int NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  goal text,
  final_artifact_id uuid,
  iterations int NOT NULL DEFAULT 0,
  tokens_in int NOT NULL DEFAULT 0,
  tokens_out int NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_agent_runs_v2_project_stage ON public.agent_runs_v2(project_id, stage, started_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.agent_runs_v2 TO authenticated;
GRANT ALL ON public.agent_runs_v2 TO service_role;
ALTER TABLE public.agent_runs_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read agent_runs_v2" ON public.agent_runs_v2
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "service writes agent_runs_v2" ON public.agent_runs_v2
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2) agent_trace_steps
CREATE TABLE public.agent_trace_steps (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.agent_runs_v2(id) ON DELETE CASCADE,
  step_index int NOT NULL,
  node text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  tokens_in int,
  tokens_out int,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_trace_run ON public.agent_trace_steps(run_id, step_index);
GRANT SELECT ON public.agent_trace_steps TO authenticated;
GRANT ALL ON public.agent_trace_steps TO service_role;
ALTER TABLE public.agent_trace_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read trace_steps" ON public.agent_trace_steps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_runs_v2 r
    WHERE r.id = agent_trace_steps.run_id
      AND public.is_project_member(auth.uid(), r.project_id)
  ));
CREATE POLICY "service writes trace_steps" ON public.agent_trace_steps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) agent_blackboard
CREATE TABLE public.agent_blackboard (
  run_id uuid NOT NULL REFERENCES public.agent_runs_v2(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, key)
);
GRANT SELECT ON public.agent_blackboard TO authenticated;
GRANT ALL ON public.agent_blackboard TO service_role;
ALTER TABLE public.agent_blackboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read blackboard" ON public.agent_blackboard
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_runs_v2 r
    WHERE r.id = agent_blackboard.run_id
      AND public.is_project_member(auth.uid(), r.project_id)
  ));
CREATE POLICY "service writes blackboard" ON public.agent_blackboard
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4) Realtime publication for trace streaming
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_trace_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs_v2;
