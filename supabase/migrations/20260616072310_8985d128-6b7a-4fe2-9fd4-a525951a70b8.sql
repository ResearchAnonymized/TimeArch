
-- 1. Restrict llm_endpoints SELECT to admins
DROP POLICY IF EXISTS "llm_endpoints read for authenticated" ON public.llm_endpoints;
CREATE POLICY "llm_endpoints admin select"
ON public.llm_endpoints
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Survey responses — require authentication, prevent user_id spoofing
DROP POLICY IF EXISTS "Anyone can submit survey" ON public.survey_responses;
CREATE POLICY "Authenticated users can submit survey"
ON public.survey_responses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- 3. Token usage — let users see their own personal (non-project) rows
CREATE POLICY "Users can view own personal token usage"
ON public.token_usage
FOR SELECT
TO authenticated
USING (project_id IS NULL AND user_id = auth.uid());
