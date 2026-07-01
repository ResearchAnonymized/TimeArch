
-- 1. Comments: require project membership on INSERT
DROP POLICY IF EXISTS "Users can insert comments" ON public.comments;
CREATE POLICY "Project members can insert comments"
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_project_member(auth.uid(), project_id));

-- 2. Audit log: drop NULL project exception
DROP POLICY IF EXISTS "Project members can view audit log" ON public.audit_log;
CREATE POLICY "Project members can view audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  project_id IS NOT NULL AND public.is_project_member(auth.uid(), project_id)
  OR (project_id IS NULL AND user_id = auth.uid())
);

-- 3. user_roles: explicit restrictive policies blocking self-mutation
CREATE POLICY "Block non-admin role inserts"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Block non-admin role updates"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Block non-admin role deletes"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Fix mutable search_path on email queue helper functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
