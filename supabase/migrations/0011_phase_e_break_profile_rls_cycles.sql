-- ─────────────────────────────────────────────────────────────────────────────
-- Phase E follow-up #3 — Break all profile-RLS cycles, not just the
-- direct one on the profiles table itself.
--
-- Background:
--   0010 made `public.app_user_role()` / `public.app_user_org()` plpgsql
--   helpers and rewrote the profile policy that previously had a
--   recursive subquery on profiles. That fixed the direct cycle:
--     profiles -> profiles
--
--   But /api/debug/self-check still reports 42P17. The reason: there's
--   an INDIRECT cycle:
--     profiles  -> transactions (via "Clients read their agent")
--     transactions -> profiles  (via the 0007 inline subqueries)
--
--   When the planner walks a profile SELECT, it plans every policy in
--   the OR'd SELECT-policy set, including `"Clients read their agent"`.
--   Planning that policy's subquery against `transactions` triggers RLS
--   planning on `transactions`. The 0007 transactions policies still
--   embed `SELECT … FROM public.profiles WHERE id = auth.uid() …`
--   subqueries — planning those re-enters profiles RLS, hitting the
--   same recursion guard that produced 42P17 before.
--
--   Same pattern bites every other 0007 policy that inlined a profile
--   lookup (tasks, documents, message_threads, activity_log, invites,
--   plus 0006's organizations UPDATE policy).
--
-- Fix:
--   Replace every `SELECT … FROM public.profiles WHERE id = auth.uid() …`
--   inside non-profiles policies with calls to the plpgsql helpers from
--   0010. Helpers run as the function owner (postgres / BYPASSRLS) and
--   are opaque to the planner — no recursion path can close through them.
--
--   The other 0007 inlined subqueries — those that select from
--   `transactions` rather than `profiles` — are safe AS LONG AS the
--   transactions policies themselves don't go back through profiles.
--   This migration enforces that invariant.
--
-- Idempotent: every block uses `drop policy if exists` + `create policy`.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── organizations ──────────────────────────────────────────────────────────
-- 0006 inlined the profile subquery here; same fix.
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


-- ─── transactions ───────────────────────────────────────────────────────────
-- The root cause of the indirect cycle. 0007 inlined two profile subqueries
-- here. Both go through helpers now.
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


-- ─── transaction_stages ─────────────────────────────────────────────────────
-- These already only subquery `transactions` (not profiles). Once
-- transactions is recursion-safe (above), these are too. Rewrite anyway
-- so the admin-fallback uses the helper instead of a second profile
-- subquery.
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


-- ─── documents ──────────────────────────────────────────────────────────────
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


-- ─── message_threads ────────────────────────────────────────────────────────
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


-- ─── tasks ──────────────────────────────────────────────────────────────────
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


-- ─── transaction_updates ────────────────────────────────────────────────────
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


-- ─── activity_log ───────────────────────────────────────────────────────────
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


-- ─── invites ────────────────────────────────────────────────────────────────
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
