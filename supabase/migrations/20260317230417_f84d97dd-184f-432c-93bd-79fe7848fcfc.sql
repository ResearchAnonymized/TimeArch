
-- ============================================
-- TimeArch Core Database Schema
-- ============================================

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- 1. User Profiles
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. Roles (separate table per security guidelines)
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'architect', 'developer', 'reviewer', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'developer',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-assign default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'architect');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- ============================================
-- 3. Organizations & Teams
-- ============================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'developer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view org" ON public.organizations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = id AND user_id = auth.uid()));
CREATE POLICY "Owner can update org" ON public.organizations FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Authenticated can create org" ON public.organizations FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members can view membership" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = organization_id AND om.user_id = auth.uid()));
CREATE POLICY "Org owner can manage members" ON public.organization_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid()));

-- ============================================
-- 4. Projects
-- ============================================
CREATE TYPE public.project_status AS ENUM ('active', 'review', 'locked', 'archived');

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  status project_status NOT NULL DEFAULT 'active',
  current_stage INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'developer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view project" ON public.projects FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members WHERE project_id = id AND user_id = auth.uid()));
CREATE POLICY "Owner can update project" ON public.projects FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owner can delete project" ON public.projects FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Authenticated can create project" ON public.projects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Project members can view membership" ON public.project_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_id AND pm.user_id = auth.uid()));
CREATE POLICY "Project owner can manage members" ON public.project_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));

-- ============================================
-- 5. Requirements
-- ============================================
CREATE TYPE public.requirement_type AS ENUM ('functional', 'non_functional', 'user_story', 'constraint', 'assumption', 'dependency');
CREATE TYPE public.requirement_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.requirement_status AS ENUM ('draft', 'reviewed', 'approved', 'locked');

CREATE TABLE public.requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  requirement_id TEXT NOT NULL, -- e.g., FR-001, NFR-001
  title TEXT NOT NULL,
  description TEXT,
  type requirement_type NOT NULL DEFAULT 'functional',
  priority requirement_priority NOT NULL DEFAULT 'medium',
  status requirement_status NOT NULL DEFAULT 'draft',
  source TEXT, -- where the requirement came from
  category TEXT, -- grouping category
  acceptance_criteria JSONB,
  locked_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, requirement_id)
);
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_requirements_updated_at BEFORE UPDATE ON public.requirements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Project members can view requirements" ON public.requirements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));
CREATE POLICY "Project members can insert requirements" ON public.requirements FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));
CREATE POLICY "Project members can update requirements" ON public.requirements FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));

-- ============================================
-- 6. Architecture Drivers
-- ============================================
CREATE TABLE public.architecture_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  priority requirement_priority NOT NULL DEFAULT 'medium',
  category TEXT, -- 'functional', 'non_functional', 'technical', 'business'
  source_requirement_ids UUID[], -- traceability
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.architecture_drivers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_architecture_drivers_updated_at BEFORE UPDATE ON public.architecture_drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Project members can view drivers" ON public.architecture_drivers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));
CREATE POLICY "Project members can manage drivers" ON public.architecture_drivers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));

-- ============================================
-- 7. Architecture Artifacts (styles, decomposition, data arch, API design, etc.)
-- ============================================
CREATE TYPE public.artifact_type AS ENUM (
  'style_recommendation', 'tradeoff_analysis', 'decomposition',
  'data_architecture', 'api_design', 'quality_evaluation',
  'risk_analysis', 'validation_report', 'adr',
  'executive_summary', 'diagram', 'code_output'
);
CREATE TYPE public.artifact_status AS ENUM ('draft', 'generated', 'reviewed', 'approved', 'locked');

CREATE TABLE public.architecture_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  type artifact_type NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  status artifact_status NOT NULL DEFAULT 'draft',
  stage INTEGER NOT NULL, -- which lifecycle stage
  version INTEGER NOT NULL DEFAULT 1,
  generated_by TEXT, -- agent name
  locked_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.architecture_artifacts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_architecture_artifacts_updated_at BEFORE UPDATE ON public.architecture_artifacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Project members can view artifacts" ON public.architecture_artifacts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));
CREATE POLICY "Project members can manage artifacts" ON public.architecture_artifacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));

-- ============================================
-- 8. Stage Locks & Approvals
-- ============================================
CREATE TYPE public.approval_action AS ENUM ('approved', 'rejected', 'revision_requested', 'locked', 'unlocked');

CREATE TABLE public.stage_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  stage INTEGER NOT NULL,
  action approval_action NOT NULL,
  comment TEXT,
  approved_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stage_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view approvals" ON public.stage_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));
CREATE POLICY "Authorized users can create approvals" ON public.stage_approvals FOR INSERT TO authenticated
  WITH CHECK (approved_by = auth.uid() AND EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));

-- ============================================
-- 9. Audit Log
-- ============================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (project_id IS NULL OR EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));
CREATE POLICY "Authenticated can insert audit log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============================================
-- 10. Comments / Feedback
-- ============================================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  artifact_id UUID REFERENCES public.architecture_artifacts(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES public.requirements(id) ON DELETE CASCADE,
  stage INTEGER,
  content TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Project members can view comments" ON public.comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));
CREATE POLICY "Users can insert comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- 11. Agent Runs (tracking multi-agent execution)
-- ============================================
CREATE TYPE public.agent_run_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  agent_name TEXT NOT NULL,
  stage INTEGER NOT NULL,
  status agent_run_status NOT NULL DEFAULT 'pending',
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view agent runs" ON public.agent_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));
CREATE POLICY "Project members can insert agent runs" ON public.agent_runs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));
CREATE POLICY "Project members can update agent runs" ON public.agent_runs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p LEFT JOIN public.project_members pm ON pm.project_id = p.id WHERE p.id = project_id AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())));

-- Indexes
CREATE INDEX idx_requirements_project ON public.requirements(project_id);
CREATE INDEX idx_artifacts_project ON public.architecture_artifacts(project_id);
CREATE INDEX idx_artifacts_type ON public.architecture_artifacts(type);
CREATE INDEX idx_approvals_project ON public.stage_approvals(project_id);
CREATE INDEX idx_audit_project ON public.audit_log(project_id);
CREATE INDEX idx_agent_runs_project ON public.agent_runs(project_id);
CREATE INDEX idx_comments_project ON public.comments(project_id);
