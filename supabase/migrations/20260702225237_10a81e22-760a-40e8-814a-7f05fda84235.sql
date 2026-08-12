
DO $$ BEGIN
  CREATE TYPE public.ui_mode AS ENUM ('classic', 'studio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_mode public.ui_mode;

-- Existing users default to classic; new users left NULL so we can force the chooser.
UPDATE public.profiles SET ui_mode = 'classic' WHERE ui_mode IS NULL AND created_at < now();
