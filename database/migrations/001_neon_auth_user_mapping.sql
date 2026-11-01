-- Link ORS profile rows to Neon Managed Better Auth users.
-- Safe additive migration; does not delete or rewrite existing project data.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS neon_auth_user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_neon_auth_user_id_fkey'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_neon_auth_user_id_fkey
      FOREIGN KEY (neon_auth_user_id)
      REFERENCES neon_auth."user"(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_neon_auth_user_id_idx
  ON public.users(neon_auth_user_id)
  WHERE neon_auth_user_id IS NOT NULL;
