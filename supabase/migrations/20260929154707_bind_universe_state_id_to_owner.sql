/*
  # Bind user_universe_state.id to the row owner

  1. Security
  - `id` and `user_id` were two independent columns, both defaulting to auth.uid(),
    but every RLS policy checked only `user_id`. A client could therefore send an
    explicit `id` belonging to another account while keeping `user_id = auth.uid()`,
    squatting the victim's primary key and permanently breaking their first sync.
  - Add a CHECK constraint so the two columns can never diverge.
  - Recreate the INSERT and UPDATE policies so the session must own BOTH columns.

  2. Notes
  - The application never sends `id` or `user_id`; both fall back to their
    auth.uid() defaults, so legitimate writes are unaffected.
  - SELECT and DELETE policies are left unchanged (already keyed on user_id,
    which the new constraint keeps equal to id).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_universe_state_id_matches_user'
      AND conrelid = 'public.user_universe_state'::regclass
  ) THEN
    ALTER TABLE public.user_universe_state
      ADD CONSTRAINT user_universe_state_id_matches_user CHECK (id = user_id);
  END IF;
END $$;

DROP POLICY IF EXISTS "insert_own_universe_state" ON public.user_universe_state;
CREATE POLICY "insert_own_universe_state" ON public.user_universe_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND auth.uid() = id);

DROP POLICY IF EXISTS "update_own_universe_state" ON public.user_universe_state;
CREATE POLICY "update_own_universe_state" ON public.user_universe_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND auth.uid() = id)
  WITH CHECK (auth.uid() = user_id AND auth.uid() = id);
