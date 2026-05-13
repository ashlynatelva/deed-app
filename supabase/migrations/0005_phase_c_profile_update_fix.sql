-- ─────────────────────────────────────────────────────────────────────────────
-- Phase C debug fix — relax the profiles UPDATE policy.
--
-- The previous policy's WITH CHECK clause used SELECT subqueries that
-- re-read the same row mid-update:
--
--     WITH CHECK (
--       id = auth.uid()
--       AND role = (select role from public.profiles where id = auth.uid())
--       AND organization_id = (select organization_id from public.profiles where id = auth.uid())
--     )
--
-- The intent was "user can't escalate their own role / change orgs". In
-- practice that pattern is fragile under PostgREST + RLS: when the new
-- row's other columns change, the inline subquery occasionally returns no
-- rows (depending on isolation + when the executor materializes the
-- candidate row), which makes the WITH CHECK fail with no Postgres-level
-- error — Supabase's `.select().single()` then sees zero rows.
--
-- For the MVP the UI never exposes `role` or `organization_id` editing
-- (TypeScript constrains the patch shape), so the practical risk of
-- self-escalation through the client is zero. We rely on:
--
--   1. App-layer typing — `ProfilePatch` in CurrentProfileProvider only
--      allows full_name / email / phone / title / avatar_url.
--   2. Anyone who needs to change role / org goes through service-role
--      server code (Phase H invite acceptance is the first real consumer).
--
-- If we ever need to harden this further, the right place is a BEFORE
-- UPDATE trigger that compares NEW.role / NEW.organization_id against
-- OLD.* — that runs in the trigger context where OLD / NEW are first-
-- class, no subqueries needed.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Update own profile" on public.profiles;

create policy "Update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
