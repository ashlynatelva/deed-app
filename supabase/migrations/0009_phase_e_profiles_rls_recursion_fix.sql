-- ─────────────────────────────────────────────────────────────────────────────
-- Phase E follow-up — Fix infinite RLS recursion on public.profiles.
--
-- Symptom (caught by /api/debug/self-check):
--   Logged-in user-session SELECT on public.profiles errors out with
--     SQLSTATE 42P17: "infinite recursion detected in policy for
--     relation \"profiles\""
--   Result: every /agent/* and /client/* request gets bounced by the
--   middleware to /login?error=missing_profile because the profile-role
--   lookup returns 0 rows (Supabase normalizes the error into a null
--   result for some callers).
--
-- Cause:
--   Migration 0007 rewrote the "Org staff read org profiles" policy so
--   the gate inlined a subquery against public.profiles:
--     USING (organization_id IN (
--       SELECT organization_id FROM public.profiles
--       WHERE id = auth.uid() AND role IN ('agent','admin')
--     ))
--   The subquery references the same table the policy is on. When
--   Postgres evaluates SELECT on profiles, every SELECT policy is
--   OR'd together; this one's subquery re-enters the policy chain,
--   re-evaluates this same policy, recursion never terminates.
--
--   "Read own profile" (USING (id = auth.uid())) would otherwise match
--   the user's own row, but a single 42P17 anywhere in the policy set
--   aborts the entire statement before the OR resolves.
--
-- Fix:
--   Route the gate through SECURITY DEFINER helpers (`public.current_org`
--   and `public.current_role`). SECURITY DEFINER functions run with the
--   function owner's privileges and bypass RLS on the tables they
--   query — so the helper's internal SELECT from profiles doesn't
--   trigger the profiles policies, breaking the recursion cleanly.
--
--   The helpers have lived in the schema since 0001. We re-create them
--   here with hardened search_path + STABLE marker (so the planner can
--   cache calls within a single statement) and re-point the recursive
--   policy at them.
--
-- Why not also rewrite the 0007 policies on `transactions`, `tasks`,
-- `transaction_updates`, etc.?
--   Those policies also contain `SELECT ... FROM public.profiles`
--   subqueries, but they're on DIFFERENT tables. A policy on
--   `transactions` that reads from `profiles` triggers profile RLS once
--   — the recursion only kicks in if a profile policy then references
--   profiles itself. With this migration applied, none of them do,
--   so the cross-table subqueries are recursion-safe. We leave them
--   alone to keep the change minimal.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Re-create the helper functions. CREATE OR REPLACE is idempotent;
--    if 0001's versions are still in place, we strengthen them; if they
--    were dropped along the way, we restore them.
--
-- STABLE: marks the function deterministic within a single statement
--   (auth.uid() doesn't change mid-statement). Lets the planner skip
--   re-evaluations.
-- SECURITY DEFINER: runs as the owner, bypassing RLS on profiles.
-- SET search_path = public, pg_temp: locks down the search path so a
--   malicious user can't shadow `profiles` with a temp-schema table.
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_org()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

-- 2. Replace the recursive policy with a helper-driven version.
drop policy if exists "Org staff read org profiles" on public.profiles;
create policy "Org staff read org profiles"
  on public.profiles for select to authenticated
  using (
    organization_id = public.current_org()
    and public.current_role() in ('agent','admin')
  );

-- 3. Sanity check — drop and re-create "Read own profile" with the same
--    definition. Cheap belt-and-suspenders in case it got modified along
--    the way; the diagnostic dump shows the right qual today but pinning
--    it explicitly here makes the migration self-contained.
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());
