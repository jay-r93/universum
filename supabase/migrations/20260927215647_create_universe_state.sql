/*
# Create shared universe state storage

1. New Tables
- `universe_state` stores the single workspace state as JSON so categories, sub-chats, notes, and the chosen universe name survive reloads and can be shared by the app.
- `id` is the stable single-row identifier.
- `state` contains the current workspace payload.
- `updated_at` records the latest save time.
2. Security
- Row Level Security is enabled.
- The app is intentionally single-tenant and has no sign-in flow, so anon and authenticated roles may perform the four explicit CRUD operations.
3. Important notes
- The frontend keeps a local copy for immediate recovery and uses the database as the durable source when available.
*/

CREATE TABLE IF NOT EXISTS public.universe_state (
  id text PRIMARY KEY,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.universe_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read universe state" ON public.universe_state;
CREATE POLICY "public read universe state" ON public.universe_state FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public insert universe state" ON public.universe_state;
CREATE POLICY "public insert universe state" ON public.universe_state FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public update universe state" ON public.universe_state;
CREATE POLICY "public update universe state" ON public.universe_state FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public delete universe state" ON public.universe_state;
CREATE POLICY "public delete universe state" ON public.universe_state FOR DELETE TO anon, authenticated USING (true);
