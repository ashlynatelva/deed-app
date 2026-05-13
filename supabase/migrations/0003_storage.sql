-- ─────────────────────────────────────────────────────────────────────────────
-- Stravex — Storage bucket + policies for document files.
--
-- Path convention: org_<org_id>/tx_<transaction_id>/<doc_id>/<file_name>
--
-- The bucket itself is private. The UI never embeds a public URL — server
-- code mints short-lived signed URLs after verifying the requester can SELECT
-- the corresponding row in `public.documents` (which is gated by the document
-- RLS policies in 0002).
--
-- These storage policies are a defense-in-depth backstop:
--   • Anyone in the org can technically request objects under their own
--     org_<id>/ prefix — but they'd still need to know the path, and our
--     signed-URL route refuses to mint one without a passing documents row
--     SELECT.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,  -- 50 MB ceiling per file
  null       -- accept any MIME — the app vets at upload time
)
on conflict (id) do nothing;

-- ─── Helpers ─────────────────────────────────────────────────────────────────
-- The first folder segment of every documents object is `org_<org_id>`.
-- This little helper makes that gate readable.

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

-- ─── Storage policies ───────────────────────────────────────────────────────
-- SELECT: any authenticated user can request an object only inside their org's
-- prefix. The actual gate (per-document client_visible / who-uploaded) is the
-- public.documents row check that our signed-URL route runs first.
drop policy if exists "Org members read their org bucket prefix" on storage.objects;
create policy "Org members read their org bucket prefix"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and public.storage_object_org(name) = public.current_org()
  );

-- INSERT: authenticated users can upload only into their org prefix.
-- The documents-row RLS policy is the one that controls *whether* an upload
-- is allowed in business terms (e.g. clients can't upload to a transaction
-- they don't own). Storage just gates the bucket prefix.
drop policy if exists "Org members upload to their org bucket prefix" on storage.objects;
create policy "Org members upload to their org bucket prefix"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.storage_object_org(name) = public.current_org()
  );

-- DELETE: same prefix gate. Documents row deletion happens first (RLS-gated)
-- and the app calls storage.from('documents').remove() in the same flow.
drop policy if exists "Org members delete from their org bucket prefix" on storage.objects;
create policy "Org members delete from their org bucket prefix"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.storage_object_org(name) = public.current_org()
  );

-- UPDATE (for replace flow):
drop policy if exists "Org members update their org bucket prefix" on storage.objects;
create policy "Org members update their org bucket prefix"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and public.storage_object_org(name) = public.current_org()
  )
  with check (
    bucket_id = 'documents'
    and public.storage_object_org(name) = public.current_org()
  );
