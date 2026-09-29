/*
# Bound the size of a stored workspace

## Problem
The client inlines file attachments into the workspace JSON as base64 data URLs and upserts the
whole object into `state`. Nothing on the server bounds that value, so a single account can grow
one jsonb field toward Postgres' 1 GB limit. The retired `universe_state_save` function carried a
12 MB guard; the direct-table path the app now uses had none.

## Changes
1. Constraints
   - `public.user_universe_state.state`: CHECK octet_length(state::text) <= 12582912 (12 MB)
   - `public.universe_state.state`: same bound, matching the guard the dropped RPC used to enforce

## Important notes
- No data is modified or removed. Both constraints are added NOT VALID first and then validated,
  so adding them cannot fail on pre-existing rows; existing rows are ~1.2 KB and well inside the
  bound.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_universe_state'::regclass
      AND conname = 'user_universe_state_state_size_check'
  ) THEN
    ALTER TABLE public.user_universe_state
      ADD CONSTRAINT user_universe_state_state_size_check
      CHECK (octet_length(state::text) <= 12582912) NOT VALID;
    ALTER TABLE public.user_universe_state
      VALIDATE CONSTRAINT user_universe_state_state_size_check;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.universe_state'::regclass
      AND conname = 'universe_state_state_size_check'
  ) THEN
    ALTER TABLE public.universe_state
      ADD CONSTRAINT universe_state_state_size_check
      CHECK (octet_length(state::text) <= 12582912) NOT VALID;
    ALTER TABLE public.universe_state
      VALIDATE CONSTRAINT universe_state_state_size_check;
  END IF;
END $$;
