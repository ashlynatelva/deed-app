-- ─────────────────────────────────────────────────────────────────────────────
-- Phase J — Client lifecycle (soft-delete / portal-access revocation).
--
-- Adds the schema + RPC needed to revoke a client's portal access without
-- touching the Supabase auth admin API. Soft-delete via a status column
-- preserves every FK reference (transactions, documents, messages,
-- notifications, invites) so historical records stay audit-able.
--
-- Schema additions (all on public.profiles):
--   - status:                    'active' | 'inactive' | 'deleted'
--   - portal_access_revoked_at:  set when status flips to 'inactive'
--   - deleted_at:                reserved for a future hard-delete admin
--                                action; not used yet.
--
-- Access gate:
--   public.revoke_client_portal_access(target_client_id uuid)
--
--   plpgsql SECURITY DEFINER function. Only agents/admins in the target
--   client's organization can call it, and the target must itself be a
--   `client`-role profile. The function does all the validation; the
--   caller-side server action is a thin RPC wrapper.
--
--   Why a function (not direct UPDATE):
--   The existing "Update own profile" policy only lets a user update
--   their own row. Letting agents UPDATE arbitrary profiles in their org
--   via a broader RLS policy would also let them mutate other columns
--   (role, email, organization_id). A SECURITY DEFINER function with a
--   narrow signature is the safer surface — bypasses RLS only for the
--   specific column set this action needs to write.
--
-- App-layer enforcement (in proxy + LoginForm):
--   When status != 'active', the user is signed out and bounced to
--   /login?error=revoked. The auth.users row is intact — they could
--   technically sign in again — but every gated page re-checks status
--   and re-revokes the session. Net effect: portal-blocked.
--
-- Future-proofing:
--   The 'deleted' status is reserved for a hard-delete admin action
--   we haven't built. Today's revoke flow only uses 'inactive'. The
--   restore path (status='active' again) is trivial — add an admin UI
--   when needed.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Lifecycle columns ──────────────────────────────────────────────────
alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive', 'deleted')),
  add column if not exists portal_access_revoked_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists profiles_status_idx on public.profiles(status);


-- ─── 2. Revocation RPC ─────────────────────────────────────────────────────
-- Idempotent: revoking an already-inactive client is a no-op.
-- Errors are raised as exceptions with sentinel messages the action layer
-- maps to user-facing copy.
create or replace function public.revoke_client_portal_access(
  target_client_id uuid
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
begin
  if caller_id is null then
    raise exception 'not_signed_in';
  end if;

  -- Caller's identity. Bypassing RLS via SECURITY DEFINER, so this
  -- always finds the row if the caller has a profile.
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

  -- Idempotent soft-delete.
  update public.profiles
     set status                   = 'inactive',
         portal_access_revoked_at = coalesce(portal_access_revoked_at, now()),
         updated_at               = now()
   where id = target_client_id
     and status <> 'inactive';

  -- Audit log entry. The activity_log table already has Agents read org
  -- activity (recursion-safe after 0015), so this surfaces in the
  -- notification history feed automatically.
  insert into public.activity_log (
    organization_id, actor_id, actor_role, action,
    resource_type, resource_id, metadata
  )
  values (
    caller_org, caller_id, caller_role, 'client.portal_access_revoked',
    'profile', target_client_id,
    jsonb_build_object('target_client_id', target_client_id)
  );
end;
$$;

grant  execute on function public.revoke_client_portal_access(uuid) to authenticated;
revoke execute on function public.revoke_client_portal_access(uuid) from anon;
