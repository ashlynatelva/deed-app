-- ─────────────────────────────────────────────────────────────────────────────
-- Phase C recovery — rebuild the `organizations` UPDATE policy without the
-- `public.current_role()` / `public.current_org()` helper functions.
--
-- Symptom that prompted this:
--   Branding saves were producing PGRST116 "Cannot coerce the result to a
--   single JSON object" / "update returned 0 rows" with no Postgres error.
--   Manual SELECT confirmed:
--     - the agent's profile.organization_id matches the org being updated
--     - profile.role = 'agent'
--   …so the policy was clearly the issue.
--
-- The previous policy:
--   USING ( id = public.current_org() AND public.current_role() IN ('agent','admin') )
--
-- Replaced with an inline subquery against `profiles`:
--   USING ( id IN (
--     SELECT organization_id FROM public.profiles
--     WHERE id = auth.uid() AND role IN ('agent','admin')
--   ) )
--
-- Equivalent semantics, no function indirection. The subquery against
-- profiles is gated by the "Read own profile" policy, which already allows
-- the calling user to read their own row, so RLS doesn't block it.
--
-- We're leaving the helper functions in place for now — other tables that
-- still reference them in RLS won't be exercised until Phase D migrates
-- transactions / documents / messages, at which point we'll switch them to
-- the same direct-subquery pattern preemptively.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Admins update own org"    on public.organizations;
drop policy if exists "Org staff update own org" on public.organizations;

create policy "Org staff update own org"
  on public.organizations for update to authenticated
  using (
    id in (
      select organization_id
      from public.profiles
      where id = auth.uid()
        and role in ('agent','admin')
    )
  )
  with check (
    id in (
      select organization_id
      from public.profiles
      where id = auth.uid()
        and role in ('agent','admin')
    )
  );
