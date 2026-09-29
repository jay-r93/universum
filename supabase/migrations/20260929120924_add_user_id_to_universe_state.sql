/*
# Add user_id column to user_universe_state for per-user isolation

1. Modified Tables
- `user_universe_state`: add `user_id` column (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users)
- The table already existed with id (uuid), state (jsonb), updated_at (timestamptz)
- Added user_id to scope each row to an authenticated user
2. Security
- Enable RLS (already enabled, kept on)
- Drop old public-access policies if they exist
- Create per-user CRUD policies: each authenticated user only accesses their own row
3. Important notes
- The id column stays as uuid (existing data preserved)
- user_id defaults to auth.uid() so inserts without explicit user_id succeed
*/

ALTER TABLE public.user_universe_state
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_universe_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read user universe state" ON public.user_universe_state;
DROP POLICY IF EXISTS "public insert user universe state" ON public.user_universe_state;
DROP POLICY IF EXISTS "public update user universe state" ON public.user_universe_state;
DROP POLICY IF EXISTS "public delete user universe state" ON public.user_universe_state;
DROP POLICY IF EXISTS "select_own_universe_state" ON public.user_universe_state;
DROP POLICY IF EXISTS "insert_own_universe_state" ON public.user_universe_state;
DROP POLICY IF EXISTS "update_own_universe_state" ON public.user_universe_state;
DROP POLICY IF EXISTS "delete_own_universe_state" ON public.user_universe_state;

CREATE POLICY "select_own_universe_state" ON public.user_universe_state FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_universe_state" ON public.user_universe_state FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_universe_state" ON public.user_universe_state FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_universe_state" ON public.user_universe_state FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
