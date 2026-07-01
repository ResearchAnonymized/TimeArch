CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  role text,
  workshop_name text,
  contact_email text,
  q1_value smallint CHECK (q1_value BETWEEN 1 AND 5),
  q2_lifecycle smallint CHECK (q2_lifecycle BETWEEN 1 AND 5),
  q3_agents_trust smallint CHECK (q3_agents_trust BETWEEN 1 AND 5),
  q4_critic smallint CHECK (q4_critic BETWEEN 1 AND 5),
  q5_artifacts smallint CHECK (q5_artifacts BETWEEN 1 AND 5),
  q6_navigation smallint CHECK (q6_navigation BETWEEN 1 AND 5),
  q7_next_step smallint CHECK (q7_next_step BETWEEN 1 AND 5),
  q8_guidance smallint CHECK (q8_guidance BETWEEN 1 AND 5),
  q9_fit smallint CHECK (q9_fit BETWEEN 1 AND 5),
  q10_use_again smallint CHECK (q10_use_again BETWEEN 1 AND 5),
  most_valuable text,
  improvements text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.survey_responses TO anon;
GRANT INSERT ON public.survey_responses TO authenticated;
GRANT SELECT ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit survey"
  ON public.survey_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view all survey responses"
  ON public.survey_responses FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));