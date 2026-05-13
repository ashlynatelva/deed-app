-- ─────────────────────────────────────────────────────────────────────────────
-- Phase E follow-up #4 (consolidated) — Single migration that:
--   1. Creates the plpgsql helpers `app_user_role` / `app_user_org`
--      (intended in 0010 but never landed cleanly).
--   2. Rewrites every RLS policy across the schema that previously
--      inlined a profile subquery (the 0006/0007 set) so it uses those
--      helpers instead.
--
-- Why 0010 + 0011 failed to land:
--   0010 attempted `DROP FUNCTION public.current_role()` /
--   `public.current_org()`. Both are referenced by the "Org staff read
--   org profiles" policy that 0009 left in place. Postgres refuses to
--   drop a function with dependents unless you say CASCADE. In Supabase
--   Studio the whole script runs in one transaction — that drop failure
--   rolled back the `CREATE FUNCTION app_user_*` calls too. 0011 then
--   tried to reference `public.app_user_org()` which didn't exist, and
--   blew up with 42883.
--
-- Why this migration is safe:
--   We never drop the old `current_role` / `current_org` functions. They
--   stay in the schema as dead code; nothing references them anymore
--   once this migration finishes. A future cleanup pass can remove them
--   with `DROP FUNCTION ... CASCADE` once the team is comfortable.
--
--   Every block uses `drop policy if exists` + `create policy` and
--   `create or replace function`, so the migration is fully idempotent
--   and safe to re-run.
--
-- Recursion-safety argument (the whole point of this exercise):
--   • plpgsql functions are NEVER inlined by the planner
--     (https://www.postgresql.org/docs/current/xfunc-sql.html). The
--     SECURITY DEFINER wrapper therefore survives, and the helper's
--     internal SELECT on profiles runs with the function owner's
--     privileges — BYPASSRLS, no policy re-entry.
--   • After this migration, NO policy outside of `public.profiles`
--     contains a `SELECT … FROM public.profiles …` subquery. The RLS
--     planner graph has no edge that closes back to profiles, so no
--     cycle the recursion detector can trip on.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Helpers ─────────────────────────────────────────────────────────────
create or replace function public.app_user_role()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  select role into v_role
    from public.profiles
   where id = auth.uid();
  return v_role;
end;
$$;

create or replace function public.app_user_org()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org
    from public.profiles
   where id = auth.uid();
  return v_org;
end;
$$;

-- Authenticated callers need EXECUTE so the RLS planner can call the
-- helpers when evaluating policies. Anon never needs them.
grant  execute on function public.app_user_role() to authenticated;
grant  execute on function public.app_user_org()  to authenticated;
revoke execute on function public.app_user_role() from anon;
revoke execute on function public.app_user_org()  from anon;


-- ─── 2. profiles ────────────────────────────────────────────────────────────
-- "Org staff read org profiles" was the direct-recursion source; it has
-- to be rewritten on top of the helpers. We also re-assert the other
-- two SELECT policies for a deterministic final state.
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Org staff read org profiles" on public.profiles;
create policy "Org staff read org profiles"
  on public.profiles for select to authenticated
  using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('agent','admin')
  );

drop policy if exists "Clients read their agent" on public.profiles;
create policy "Clients read their agent"
  on public.profiles for select to authenticated
  using (
    id in (
      select agent_id from public.transactions where client_id = auth.uid()
    )
  );


-- ─── 3. organizations ───────────────────────────────────────────────────────
drop policy if exists "Org staff update own org" on public.organizations;
create policy "Org staff update own org"
  on public.organizations for update to authenticated
  using (
    id = public.app_user_org()
    and public.app_user_role() in ('agent','admin')
  )
  with check (
    id = public.app_user_org()
    and public.app_user_role() in ('agent','admin')
  );


-- ─── 4. transactions ───────────────────────────────────────────────────────
-- This is the root cause of the indirect cycle that 0010 alone didn't fix.
drop policy if exists "Agents read/write their txs" on public.transactions;
create policy "Agents read/write their txs"
  on public.transactions for all to authenticated
  using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('agent','admin')
    and (
      agent_id = auth.uid()
      or public.app_user_role() = 'admin'
    )
  )
  with check (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('agent','admin')
    and (
      agent_id = auth.uid()
      or public.app_user_role() = 'admin'
    )
  );

drop policy if exists "Clients read their tx" on public.transactions;
create policy "Clients read their tx"
  on public.transactions for select to authenticated
  using (
    client_id = auth.uid()
    and public.app_user_role() = 'client'
  );


-- ─── 5. transaction_stages ─────────────────────────────────────────────────
drop policy if exists "Agents read/write stages on their txs" on public.transaction_stages;
create policy "Agents read/write stages on their txs"
  on public.transaction_stages for all to authenticated
  using (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid()
         or public.app_user_role() = 'admin'
    )
  )
  with check (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid()
         or public.app_user_role() = 'admin'
    )
  );

drop policy if exists "Clients read stages on their tx" on public.transaction_stages;
create policy "Clients read stages on their tx"
  on public.transaction_stages for select to authenticated
  using (
    transaction_id in (
      select id from public.transactions where client_id = auth.uid()
    )
  );


-- ─── 6. documents ──────────────────────────────────────────────────────────
drop policy if exists "Agents manage docs on their txs" on public.documents;
create policy "Agents manage docs on their txs"
  on public.documents for all to authenticated
  using (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid()
         or public.app_user_role() = 'admin'
    )
  )
  with check (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid()
         or public.app_user_role() = 'admin'
    )
  );

drop policy if exists "Clients upload to their tx" on public.documents;
create policy "Clients upload to their tx"
  on public.documents for insert to authenticated
  with check (
    public.app_user_role() = 'client'
    and transaction_id in (
      select id from public.transactions where client_id = auth.uid()
    )
    and uploaded_by = auth.uid()
    and uploaded_by_role = 'client'
    and client_visible = true
    and removable_by_client = true
  );

drop policy if exists "Clients delete own non-reviewed uploads" on public.documents;
create policy "Clients delete own non-reviewed uploads"
  on public.documents for delete to authenticated
  using (
    public.app_user_role() = 'client'
    and uploaded_by = auth.uid()
    and uploaded_by_role = 'client'
    and removable_by_client = true
    and status <> 'reviewed'
  );


-- ─── 7. message_threads ────────────────────────────────────────────────────
drop policy if exists "Agents create threads on their txs" on public.message_threads;
create policy "Agents create threads on their txs"
  on public.message_threads for insert to authenticated
  with check (
    public.app_user_role() in ('agent','admin')
    and agent_id = auth.uid()
    and transaction_id in (
      select id from public.transactions where agent_id = auth.uid()
    )
  );

drop policy if exists "Clients create threads on their tx" on public.message_threads;
create policy "Clients create threads on their tx"
  on public.message_threads for insert to authenticated
  with check (
    public.app_user_role() = 'client'
    and client_id = auth.uid()
    and transaction_id in (
      select id from public.transactions where client_id = auth.uid()
    )
  );


-- ─── 8. tasks ──────────────────────────────────────────────────────────────
drop policy if exists "Agents manage own tasks" on public.tasks;
create policy "Agents manage own tasks"
  on public.tasks for all to authenticated
  using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('agent','admin')
    and (
      agent_id = auth.uid()
      or public.app_user_role() = 'admin'
    )
  )
  with check (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('agent','admin')
    and (
      agent_id = auth.uid()
      or public.app_user_role() = 'admin'
    )
  );


-- ─── 9. transaction_updates ────────────────────────────────────────────────
drop policy if exists "Agents manage updates on their txs" on public.transaction_updates;
create policy "Agents manage updates on their txs"
  on public.transaction_updates for all to authenticated
  using (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid()
         or public.app_user_role() = 'admin'
    )
  )
  with check (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid()
         or public.app_user_role() = 'admin'
    )
  );


-- ─── 10. activity_log ──────────────────────────────────────────────────────
drop policy if exists "Agents read org activity" on public.activity_log;
create policy "Agents read org activity"
  on public.activity_log for select to authenticated
  using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('agent','admin')
  );

drop policy if exists "Clients read their tx activity" on public.activity_log;
create policy "Clients read their tx activity"
  on public.activity_log for select to authenticated
  using (
    public.app_user_role() = 'client'
    and transaction_id in (
      select id from public.transactions where client_id = auth.uid()
    )
  );


-- ─── 11. invites ───────────────────────────────────────────────────────────
drop policy if exists "Agents manage invites in their org" on public.invites;
create policy "Agents manage invites in their org"
  on public.invites for all to authenticated
  using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('agent','admin')
  )
  with check (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('agent','admin')
    and agent_id = auth.uid()
  );
