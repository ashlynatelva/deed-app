-- ─────────────────────────────────────────────────────────────────────────────
-- Phase I cleanup, take 2 — Drop the dead helper functions, this time
-- after first removing the orphan policy that still depends on them.
--
-- Why 0013 failed:
--   0013 attempted to drop public.current_role() and public.current_org()
--   directly. The drop failed because one policy from 0002 still
--   references current_role():
--
--     "Clients read activity on their tx" on public.activity_log
--
--   Migration 0007 was supposed to retire this gate, but it shipped a
--   replacement policy under a slightly different name —
--   "Clients read their tx activity" (different word order). The new
--   policy got created; the original was never dropped. They've been
--   sitting side-by-side ever since, granting the same row set, with
--   the original quietly anchoring a dependency on current_role().
--
-- Audit before applying:
--   Run this in the SQL Editor first. It surfaces every policy that
--   still names current_role / current_org anywhere in its qual or
--   with_check expression, across every schema:
--
--     SELECT schemaname, tablename, policyname, cmd
--     FROM pg_policies
--     WHERE (qual LIKE '%current_role%' OR qual LIKE '%current_org%'
--            OR with_check LIKE '%current_role%' OR with_check LIKE '%current_org%')
--     ORDER BY schemaname, tablename, policyname;
--
--   Pre-apply, the only row should be:
--     public | activity_log | Clients read activity on their tx | SELECT
--
--   Post-apply, the query should return ZERO rows. If anything else
--   appears, stop — there's another orphan we haven't accounted for.
--
-- Why dropping the orphan is safe:
--   The 0012 replacement "Clients read their tx activity" already grants
--   exactly the same access (clients reading activity_log rows for
--   their own transaction), just routed through the recursion-safe
--   plpgsql helper `public.app_user_role()`. Tested working since 0012
--   shipped — the dual-policy state was redundant, not load-bearing.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the orphan policy that's holding the helper functions alive.
drop policy if exists "Clients read activity on their tx" on public.activity_log;

-- 2. Now the helpers can be retired. CASCADE intentionally NOT used —
--    if anything still depends on them, fail loudly and we audit again.
drop function if exists public.current_role();
drop function if exists public.current_org();
