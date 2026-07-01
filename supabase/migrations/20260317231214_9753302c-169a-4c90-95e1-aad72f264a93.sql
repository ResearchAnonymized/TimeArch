
-- Fix infinite recursion in projects RLS
DROP POLICY IF EXISTS "Project members can view project" ON public.projects;
CREATE POLICY "Project members can view project" ON public.projects FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

-- Fix project_members RLS (same issue)
DROP POLICY IF EXISTS "Project members can view membership" ON public.project_members;
CREATE POLICY "Project members can view membership" ON public.project_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));

-- Fix requirements RLS
DROP POLICY IF EXISTS "Project members can view requirements" ON public.requirements;
CREATE POLICY "Project members can view requirements" ON public.requirements FOR SELECT TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Project members can insert requirements" ON public.requirements;
CREATE POLICY "Project members can insert requirements" ON public.requirements FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Project members can update requirements" ON public.requirements;
CREATE POLICY "Project members can update requirements" ON public.requirements FOR UPDATE TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

-- Fix architecture_drivers RLS
DROP POLICY IF EXISTS "Project members can view drivers" ON public.architecture_drivers;
DROP POLICY IF EXISTS "Project members can manage drivers" ON public.architecture_drivers;
CREATE POLICY "Project members can view drivers" ON public.architecture_drivers FOR SELECT TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));
CREATE POLICY "Project members can manage drivers" ON public.architecture_drivers FOR ALL TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

-- Fix architecture_artifacts RLS
DROP POLICY IF EXISTS "Project members can view artifacts" ON public.architecture_artifacts;
DROP POLICY IF EXISTS "Project members can manage artifacts" ON public.architecture_artifacts;
CREATE POLICY "Project members can view artifacts" ON public.architecture_artifacts FOR SELECT TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));
CREATE POLICY "Project members can manage artifacts" ON public.architecture_artifacts FOR ALL TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

-- Fix stage_approvals RLS
DROP POLICY IF EXISTS "Project members can view approvals" ON public.stage_approvals;
DROP POLICY IF EXISTS "Authorized users can create approvals" ON public.stage_approvals;
CREATE POLICY "Project members can view approvals" ON public.stage_approvals FOR SELECT TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));
CREATE POLICY "Authorized users can create approvals" ON public.stage_approvals FOR INSERT TO authenticated
  WITH CHECK (approved_by = auth.uid() AND (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())));

-- Fix agent_runs RLS
DROP POLICY IF EXISTS "Project members can view agent runs" ON public.agent_runs;
DROP POLICY IF EXISTS "Project members can insert agent runs" ON public.agent_runs;
DROP POLICY IF EXISTS "Project members can update agent runs" ON public.agent_runs;
CREATE POLICY "Project members can view agent runs" ON public.agent_runs FOR SELECT TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));
CREATE POLICY "Project members can insert agent runs" ON public.agent_runs FOR INSERT TO authenticated
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));
CREATE POLICY "Project members can update agent runs" ON public.agent_runs FOR UPDATE TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

-- Fix audit_log RLS
DROP POLICY IF EXISTS "Project members can view audit log" ON public.audit_log;
CREATE POLICY "Project members can view audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (project_id IS NULL OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

-- Fix comments RLS
DROP POLICY IF EXISTS "Project members can view comments" ON public.comments;
CREATE POLICY "Project members can view comments" ON public.comments FOR SELECT TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

-- Fix organization_members RLS
DROP POLICY IF EXISTS "Members can view membership" ON public.organization_members;
CREATE POLICY "Members can view membership" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Fix organizations RLS
DROP POLICY IF EXISTS "Org members can view org" ON public.organizations;
CREATE POLICY "Org members can view org" ON public.organizations FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
