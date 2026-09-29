/*
# Add user-scoped universe state for cloud accounts

1. New Tables
- `user_universe_state` — per-user workspace state for authenticated (cloud) users.
  - `id` (uuid, primary key, defaults to auth.uid())
  - `state` (jsonb, the workspace payload)
  - `updated_at` (timestamptz)
2. Security
- RLS enabled.
- Owner-scoped CRUD: each authenticated user can only access their own row.
- `user_id` column defaults to `auth.uid()` so inserts without an explicit user_id succeed.
3. Important notes
- The existing `universe_state` table (single-tenant, anon-accessible) stays for local/no-auth users.
- Cloud users get their own isolated row in `user_universe_state`.
- No data migration needed — new cloud users start fresh.
*/

CREATE TABLE IF NOT EXISTS public.user_universe_state (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_universe_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_universe_state" ON public.user_universe_state;
CREATE POLICY "select_own_universe_state" ON public.user_universe_state
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_universe_state" ON public.user_universe_state;
CREATE POLICY "insert_own_universe_state" ON public.user_universe_state
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_universe_state" ON public.user_universe_state;
CREATE POLICY "update_own_universe_state" ON public.user_universe_state
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_universe_state" ON public.user_universe_state;
CREATE POLICY "delete_own_universe_state" ON public.user_universe_state
  FOR DELETE TO authenticated USING (auth.uid() = id);
