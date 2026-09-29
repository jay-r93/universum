/*
# Remove unauthenticated SECURITY DEFINER workspace access

## Problem
`public.universe_state_load(p_key text)` and `public.universe_state_save(p_key text, p_state jsonb)`
are SECURITY DEFINER functions with EXECUTE granted to `anon` and `authenticated`. They bypass
row level security on `public.universe_state` and authorize purely on a caller-supplied hex key,
with no reference to `auth.uid()` or the table's `user_id` column. This means:
  - anyone who obtains a key reads that entire workspace over /rest/v1/rpc, unauthenticated,
    permanently, with no revocation path (F1)
  - anyone can invent a key and INSERT unlimited 12 MB rows, unauthenticated (F2)

Neither function is called by the application any more; the client talks to the tables directly
and relies on RLS.

## Changes
1. Security
   - REVOKE EXECUTE on both functions from `anon`, `authenticated` and `PUBLIC`
   - DROP both functions so they are no longer routable through the Data API
   - DROP the `universe_state_valid_key` helper, which existed only to serve them

## Important notes
- No table, column or row is touched. `public.universe_state` and all of its data are preserved,
  and remain protected by their existing per-user RLS policies.
*/

REVOKE ALL ON FUNCTION public.universe_state_load(text) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.universe_state_save(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.universe_state_valid_key(text) FROM anon, authenticated, PUBLIC;

DROP FUNCTION IF EXISTS public.universe_state_load(text);
DROP FUNCTION IF EXISTS public.universe_state_save(text, jsonb);
DROP FUNCTION IF EXISTS public.universe_state_valid_key(text);
