-- Auto-approve Google (and other OAuth) sign-ins so "Continue with Google"
-- is not blocked behind the email-signup admin approval queue.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  provider text := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  status text := 'pending';
BEGIN
  -- OAuth providers are treated as verified identity → approve immediately.
  IF provider IS DISTINCT FROM 'email' THEN
    status := 'approved';
  END IF;

  INSERT INTO public.profiles (user_id, display_name, avatar_url, join_reason, approval_status)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'join_reason', 'Signed in with ' || provider),
    status
  );
  RETURN NEW;
END;
$$;
