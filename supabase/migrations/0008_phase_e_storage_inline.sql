-- ─────────────────────────────────────────────────────────────────────────────
-- Phase E — Rewrite storage.objects policies without `public.current_org()`.
--
-- Migration 0003 wired the documents-bucket policies through the same
-- SECURITY DEFINER helper that broke Phase C and Phase D. We left those
-- table-level policies behind in 0006/0007 by inlining the lookup; now we
-- do the same for storage.objects so file uploads/downloads don't get
-- silently denied for the exact same reason.
--
-- Path convention (unchanged from 0003):
--   org_<org_id>/tx_<transaction_id>/<doc_id>/<file_name>
--
-- The first segment encodes the org. We rewrite the gate to compare that
-- segment against the user's profile.organization_id via a direct subquery
-- instead of going through `public.current_org()` (which returns NULL when
-- evaluated inside the RLS path due to security-definer / search_path
-- quirks we already worked around for the documents table).
--
-- Defense-in-depth note: storage policies only gate bucket access. The
-- actual business gate (client_visible, who-uploaded, etc.) still lives in
-- `public.documents` RLS — already fixed in 0007.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Replace storage_object_org helper ──────────────────────────────────────
-- Same logic as before — extract the UUID after the literal "org_" prefix
-- in the first path segment — but documented here so future readers don't
-- have to chase 0003 to understand the gate.
create or replace function public.storage_object_org(path text)
returns uuid
language sql
immutable
as $$
  select case
    when path like 'org_%' then
      nullif(substring(split_part(path, '/', 1) from 5), '')::uuid
    else null
  end
$$;

-- ─── SELECT: any authenticated user can read objects only inside their
-- own org prefix. (Per-document gating is handled by `public.documents`
-- RLS; the signed-URL minting route still SELECTs the row first.)
drop policy if exists "Org members read their org bucket prefix" on storage.objects;
create policy "Org members read their org bucket prefix"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and public.storage_object_org(name) in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ─── INSERT: uploads confined to the org prefix. The documents-row policy
-- decides whether the business semantics allow the write (clients can only
-- upload to their own transaction; agents to transactions they own).
drop policy if exists "Org members upload to their org bucket prefix" on storage.objects;
create policy "Org members upload to their org bucket prefix"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.storage_object_org(name) in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ─── DELETE: same org-prefix gate. The app flow always deletes the
-- documents row first (which RLS already gates), then removes the
-- storage object — this policy is the safety net.
drop policy if exists "Org members delete from their org bucket prefix" on storage.objects;
create policy "Org members delete from their org bucket prefix"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.storage_object_org(name) in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ─── UPDATE (for replace flow): same gate on both sides.
drop policy if exists "Org members update their org bucket prefix" on storage.objects;
create policy "Org members update their org bucket prefix"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and public.storage_object_org(name) in (
      select organization_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    bucket_id = 'documents'
    and public.storage_object_org(name) in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );
