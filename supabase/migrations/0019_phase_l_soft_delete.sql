-- ─────────────────────────────────────────────────────────────────────────────
-- Phase L — Soft-delete transactions + clients.
--
-- Adds:
--   1. `public.transactions.deleted_at` so an agent/admin can hide a
--      transaction from active dashboards while keeping the row + all of
--      its FK chain (documents, messages, notifications, stages, tasks)
--      intact for audit.
--   2. `public.delete_transaction(uuid)` SECURITY DEFINER RPC. Same
--      guard pattern as 0016's `revoke_client_portal_access`: only an
--      agent who owns the tx (or any admin in the same org) can call it,
--      and the action is idempotent.
--   3. `public.delete_client(uuid)` SECURITY DEFINER RPC. Flips a client
--      profile to `status='deleted'` and stamps `deleted_at` +
--      `portal_access_revoked_at`. Distinct from
--      `revoke_client_portal_access` (which only sets status='inactive')
--      so we can keep both UI actions: "remove portal access" and
--      "delete client."
--
-- Filter strategy:
--   App-layer queries that drive "active" surfaces add `.is("deleted_at",
--   null)` (transactions) / `.eq("status", "active")` (profiles) so the
--   row stays selectable for audit / restore tooling but doesn't show in
--   day-to-day lists. RLS is unchanged — keeping deleted rows readable
--   means the existing FK references on documents/messages/notifications
--   continue to resolve when the agent reads history.
--
-- Idempotency:
--   Every statement uses `if not exists` / `create or replace` so running
--   this migration a second time is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Soft-delete column on transactions ─────────────────────────────────
alter table public.transactions
  add column if not exists deleted_at timestamptz;

-- Partial index — most queries filter `deleted_at is null`, so a partial
-- index on the non-deleted rows stays small and keeps existing scans hot.
create index if not exists transactions_active_idx
  on public.transactions (organization_id, agent_id)
  where deleted_at is null;


-- ─── 2. delete_transaction RPC ─────────────────────────────────────────────
-- Soft-deletes a transaction the caller owns (or admin) by stamping
-- `deleted_at`. The row itself is not removed; FK references in
-- documents / messages / notifications / stages / tasks stay valid.
create or replace function public.delete_transaction(
  target_tx_id uuid
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
  tx_agent_id  uuid;
  tx_org       uuid;
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

  -- Target validation. The RPC bypasses RLS via SECURITY DEFINER, so we
  -- look up the row directly and enforce ownership ourselves.
  select agent_id, organization_id
    into tx_agent_id, tx_org
    from public.transactions
   where id = target_tx_id;

  if tx_agent_id is null then
    raise exception 'target_not_found';
  end if;
  if tx_org is distinct from caller_org then
    raise exception 'target_other_organization';
  end if;
  if caller_role <> 'admin' and tx_agent_id <> caller_id then
    raise exception 'target_not_yours';
  end if;

  -- Idempotent: re-deleting an already-deleted transaction is a no-op.
  update public.transactions
     set deleted_at = coalesce(deleted_at, now()),
         updated_at = now()
   where id = target_tx_id
     and deleted_at is null;

  -- Audit trail. `activity_log` already has an org-scoped read policy
  -- for agents, so the deletion shows up in the notification history
  -- feed alongside other lifecycle events.
  insert into public.activity_log (
    organization_id, actor_id, actor_role, action,
    resource_type, resource_id, metadata
  )
  values (
    caller_org, caller_id, caller_role, 'transaction.deleted',
    'transaction', target_tx_id,
    jsonb_build_object('target_tx_id', target_tx_id)
  );
end;
$$;

grant  execute on function public.delete_transaction(uuid) to authenticated;
revoke execute on function public.delete_transaction(uuid) from anon;


-- ─── 3. delete_client RPC ──────────────────────────────────────────────────
-- Distinct from `revoke_client_portal_access` (0016). That function flips
-- status='inactive' so the client merely loses login while still
-- visually existing in agent lists. THIS function fully removes them
-- from active workspaces by setting status='deleted' AND stamping
-- deleted_at — the existing `getClientsForCurrentAgent` query already
-- filters `status='active'` so the row disappears from the clients
-- table the moment this runs.
create or replace function public.delete_client(
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

  -- Idempotent: re-deleting an already-deleted client is a no-op.
  -- `portal_access_revoked_at` is preserved if it was already stamped
  -- by a prior revoke; otherwise it gets stamped now (deletion
  -- implies access revoked).
  update public.profiles
     set status                   = 'deleted',
         deleted_at               = coalesce(deleted_at, now()),
         portal_access_revoked_at = coalesce(portal_access_revoked_at, now()),
         updated_at               = now()
   where id = target_client_id
     and status <> 'deleted';

  insert into public.activity_log (
    organization_id, actor_id, actor_role, action,
    resource_type, resource_id, metadata
  )
  values (
    caller_org, caller_id, caller_role, 'client.deleted',
    'profile', target_client_id,
    jsonb_build_object('target_client_id', target_client_id)
  );
end;
$$;

grant  execute on function public.delete_client(uuid) to authenticated;
revoke execute on function public.delete_client(uuid) from anon;


-- ─── 4. PostgREST schema cache reload ──────────────────────────────────────
-- Tell PostgREST to refresh so the new column + RPCs are visible to the
-- supabase-js client without a manual restart.
notify pgrst, 'reload schema';
