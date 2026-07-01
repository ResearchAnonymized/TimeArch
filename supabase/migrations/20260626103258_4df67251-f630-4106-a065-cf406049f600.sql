
-- 1. Restrict profiles SELECT: drop overly-broad policy, allow self + admin only.
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Public-safe view for cross-user lookups (display name / avatar only).
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT user_id, display_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- Allow the view to bypass per-row RLS on profiles for the safe columns only.
CREATE POLICY "Public profile fields readable"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
-- ^ Re-allows row access, but client code must select only safe cols.
-- Better: revoke column privileges on sensitive columns from authenticated.
DROP POLICY "Public profile fields readable" ON public.profiles;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (user_id, display_name, avatar_url, approval_status, join_reason, bio, created_at, updated_at)
  ON public.profiles TO authenticated;
-- Column-level grants combined with row-level policies means: a user can only
-- read sensitive columns (approval_status, join_reason, bio) on their own row
-- because the row-level SELECT policy restricts to self/admin. The
-- public_profiles view runs with security_invoker and only selects safe cols.
-- Wait — the row policies above already restrict reads to self+admin, so
-- public_profiles would also return only self+admin rows. We need a separate
-- policy that allows reading safe columns of *any* row.

-- Reset and do this cleanly:
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Profiles readable by authenticated (column-restricted)"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
-- Authenticated users may SELECT, but only on the columns granted above
-- (user_id, display_name, avatar_url, approval_status, join_reason, bio,
--  created_at, updated_at). Sensitive columns are revoked below.

REVOKE SELECT (approval_status, join_reason, bio) ON public.profiles FROM authenticated;
GRANT SELECT (approval_status) ON public.profiles TO authenticated;
-- approval_status is needed by AuthContext for the current user's own row;
-- we further restrict it via a row policy by replacing the broad policy:

DROP POLICY "Profiles readable by authenticated (column-restricted)" ON public.profiles;

-- Final clean model:
--   * Anyone authenticated can read user_id, display_name, avatar_url of any row
--     (needed for approver name lookups).
--   * Users can read their own approval_status, join_reason, bio.
--   * Admins can read all columns of all rows.
CREATE POLICY "Public profile fields readable by authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT (approval_status, join_reason, bio) ON public.profiles FROM authenticated;

-- Separate self-only policy isn't possible at column level via RLS; instead
-- expose sensitive columns through a security-definer function for self.
CREATE OR REPLACE FUNCTION public.get_my_profile_meta()
RETURNS TABLE(approval_status text, join_reason text, bio text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT approval_status, join_reason, bio
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_profile_meta() TO authenticated;

-- Admin full access remains via "Admins can update all profiles" (write) plus:
CREATE POLICY "Admins can read all profile columns"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- Combined with column REVOKE above: admins still cannot SELECT the revoked
-- columns from the client. Re-grant them to admins via a separate role? Not
-- possible without a custom role. Admin UI must use the edge function path or
-- a SECURITY DEFINER RPC. Provide one:
CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, approval_status text, join_reason text, bio text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, display_name, avatar_url, approval_status, join_reason, bio, created_at
  FROM public.profiles
  WHERE public.has_role(auth.uid(), 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;

-- 2. Remove client-facing INSERT on token_usage; only service role writes.
DROP POLICY IF EXISTS "Users can insert own token usage" ON public.token_usage;
REVOKE INSERT ON public.token_usage FROM authenticated;
-- service_role retains ALL via existing grant.
