-- ─────────────────────────────────────────────────────────────────────────────
-- Phase M — Edit-client RPC.
--
-- Adds `public.update_client_profile`, a SECURITY DEFINER function that
-- lets an agent / admin edit the name, contact email, and phone of a
-- client in their organization.
--
-- Why an RPC: the "Update own profile" policy on `public.profiles`
-- (installed in 0012) only lets a user update their own row. An agent
-- updating a client's profile fails RLS by design — broadening the
-- policy would also let agents change role / organization_id /
-- status, which is a privilege escalation surface we want to keep
-- closed. The RPC bypasses RLS via SECURITY DEFINER but enforces the
-- exact column subset + the same org/role guards used by 0016's
-- revoke_client_portal_access and 0019's delete_client.
--
-- Auth email vs. profile email:
--   This function updates `profiles.email`, the contact email shown
--   on transactions and in the agent's workspace. It does NOT change
--   `auth.users.email`, which is the actual sign-in identifier. The
--   client continues to sign in with the address they were invited
--   with. The modal UI surfaces this distinction.
--
-- Idempotency: every CREATE OR REPLACE is safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.update_client_profile(
  target_client_id uuid,
  new_full_name    text,
  new_email        text,
  new_phone        text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id    uuid := auth.uid();
  caller_org   uuid;
  caller_role  text;
  target_role  text;
  target_org   uuid;
  clean_name   text;
  clean_email  text;
  clean_phone  text;
begin
  if caller_id is null then
    raise exception 'not_signed_in';
  end if;

  select organization_id, role
    into caller_org, caller_role
    from public.profiles
   where id = caller_id;

  if caller_role is null then
    raise exception 'caller_profile_missing';
  end if;
  if caller_role not in ('agent', 'admin') then
    raise exception 'caller_not_authorized';
  end if;

  -- Target validation.
  select role, organization_id
    into target_role, target_org
    from public.profiles
   where id = target_client_id;

  if target_role is null then
    raise exception 'target_not_found';
  end if;
  if target_role <> 'client' then
    raise exception 'target_not_a_client';
  end if;
  if target_org is distinct from caller_org then
    raise exception 'target_other_organization';
  end if;

  -- Field validation.
  clean_name  := btrim(coalesce(new_full_name, ''));
  clean_email := btrim(coalesce(new_email,     ''));
  clean_phone := nullif(btrim(coalesce(new_phone, '')), '');

  if clean_name = '' then
    raise exception 'full_name_required';
  end if;
  if clean_email = '' then
    raise exception 'email_required';
  end if;
  -- Cheap shape check; full RFC validation lives at the form layer.
  if clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email_invalid';
  end if;

  update public.profiles
     set full_name  = clean_name,
         email      = clean_email,
         phone      = clean_phone,
         updated_at = now()
   where id = target_client_id;

  insert into public.activity_log (
    organization_id, actor_id, actor_role, action,
    resource_type, resource_id, metadata
  )
  values (
    caller_org, caller_id, caller_role, 'client.updated',
    'profile', target_client_id,
    jsonb_build_object('target_client_id', target_client_id)
  );
end;
$$;

grant  execute on function public.update_client_profile(uuid, text, text, text) to authenticated;
revoke execute on function public.update_client_profile(uuid, text, text, text) from anon;

-- Tell PostgREST to refresh so the new RPC is visible to supabase-js
-- without a manual restart.
notify pgrst, 'reload schema';
