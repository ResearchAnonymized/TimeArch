
-- Create a security definer function to check project membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members WHERE user_id = _user_id AND project_id = _project_id
  ) OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id
  )
$$;

-- Fix projects SELECT
DROP POLICY IF EXISTS "Project members can view project" ON public.projects;
CREATE POLICY "Project members can view project" ON public.projects FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_project_member(auth.uid(), id));

-- Fix project_members SELECT
DROP POLICY IF EXISTS "Project members can view membership" ON public.project_members;
CREATE POLICY "Project members can view membership" ON public.project_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_project_member(auth.uid(), project_id));

-- Fix all other policies that reference projects/project_members to use the function
DROP POLICY IF EXISTS "Project members can view requirements" ON public.requirements;
CREATE POLICY "Project members can view requirements" ON public.requirements FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can insert requirements" ON public.requirements;
CREATE POLICY "Project members can insert requirements" ON public.requirements FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can update requirements" ON public.requirements;
CREATE POLICY "Project members can update requirements" ON public.requirements FOR UPDATE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can view drivers" ON public.architecture_drivers;
DROP POLICY IF EXISTS "Project members can manage drivers" ON public.architecture_drivers;
CREATE POLICY "Project members can view drivers" ON public.architecture_drivers FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can manage drivers" ON public.architecture_drivers FOR ALL TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can view artifacts" ON public.architecture_artifacts;
DROP POLICY IF EXISTS "Project members can manage artifacts" ON public.architecture_artifacts;
CREATE POLICY "Project members can view artifacts" ON public.architecture_artifacts FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can manage artifacts" ON public.architecture_artifacts FOR ALL TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can view approvals" ON public.stage_approvals;
DROP POLICY IF EXISTS "Authorized users can create approvals" ON public.stage_approvals;
CREATE POLICY "Project members can view approvals" ON public.stage_approvals FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Authorized users can create approvals" ON public.stage_approvals FOR INSERT TO authenticated
  WITH CHECK (approved_by = auth.uid() AND public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can view agent runs" ON public.agent_runs;
DROP POLICY IF EXISTS "Project members can insert agent runs" ON public.agent_runs;
DROP POLICY IF EXISTS "Project members can update agent runs" ON public.agent_runs;
CREATE POLICY "Project members can view agent runs" ON public.agent_runs FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can insert agent runs" ON public.agent_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Project members can update agent runs" ON public.agent_runs FOR UPDATE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can view audit log" ON public.audit_log;
CREATE POLICY "Project members can view audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (project_id IS NULL OR public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can view comments" ON public.comments;
CREATE POLICY "Project members can view comments" ON public.comments FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
