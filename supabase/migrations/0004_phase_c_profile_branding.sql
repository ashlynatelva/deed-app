-- ─────────────────────────────────────────────────────────────────────────────
-- Phase C amendments — profile + branding migrate to Supabase.
--
-- Two policy changes:
--   1. Branding (organizations.SELECT): allow anon reads.
--      The login screen reads the brokerage's branding (logo, name, footer)
--      without a session. Single-tenant MVP — branding is public-facing.
--      Multi-tenant later will scope reads by hostname / org_slug.
--
--   2. Branding (organizations.UPDATE): widen from admin-only to agent+admin.
--      The /agent/settings → Branding panel is editable by agents in the
--      current product. Tighter admin-only is possible once we add admin
--      roles to the seed.
-- ─────────────────────────────────────────────────────────────────────────────

-- Replace the authenticated-only SELECT with an anon+authenticated SELECT.
drop policy if exists "Read own org" on public.organizations;
create policy "Anyone can read organizations"
  on public.organizations for select
  to anon, authenticated
  using (true);

-- Widen UPDATE from admin-only to agent+admin within the org.
drop policy if exists "Admins update own org"   on public.organizations;
drop policy if exists "Org staff update own org" on public.organizations;
create policy "Org staff update own org"
  on public.organizations for update to authenticated
  using (
    id = public.current_org()
    and public.current_role() in ('agent','admin')
  )
  with check (
    id = public.current_org()
    and public.current_role() in ('agent','admin')
  );
