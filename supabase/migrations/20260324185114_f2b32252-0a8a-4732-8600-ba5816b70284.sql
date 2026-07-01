CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'general',
  rating integer,
  message text NOT NULL,
  page_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback" ON public.feedback
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own feedback" ON public.feedback
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all feedback" ON public.feedback
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));