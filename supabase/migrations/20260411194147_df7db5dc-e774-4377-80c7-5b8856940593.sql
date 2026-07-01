
-- Create token_usage table for tracking AI token consumption
CREATE TABLE public.token_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  model text NOT NULL DEFAULT 'unknown',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  cost_estimate numeric(10,6) DEFAULT 0,
  stage integer,
  agent_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

-- Admins can view all token usage
CREATE POLICY "Admins can view all token usage"
ON public.token_usage
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Project members can view their project's token usage
CREATE POLICY "Project members can view project token usage"
ON public.token_usage
FOR SELECT
TO authenticated
USING (public.is_project_member(auth.uid(), project_id));

-- Authenticated users can insert their own token usage
CREATE POLICY "Users can insert own token usage"
ON public.token_usage
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_token_usage_user_id ON public.token_usage(user_id);
CREATE INDEX idx_token_usage_project_id ON public.token_usage(project_id);
CREATE INDEX idx_token_usage_created_at ON public.token_usage(created_at);
