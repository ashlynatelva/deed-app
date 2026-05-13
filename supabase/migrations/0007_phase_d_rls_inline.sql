-- ─────────────────────────────────────────────────────────────────────────────
-- Phase D RLS rewrite — inline all helper-using policies.
--
-- After 0006 fixed the same family of bug on `organizations`, we have proof
-- that helper-based policies were silently denying valid updates. Phase D
-- starts hitting transactions / tasks / transaction_updates from real
-- Supabase queries — every one of those policies uses the same `current_role()`
-- / `current_org()` helpers. Preempt the bug here.
--
-- Pattern: every helper call is replaced with an inline subquery against
-- `public.profiles` filtered by `auth.uid()`. Semantically identical, no
-- function indirection, easy to audit.
--
-- The helper functions themselves are LEFT IN PLACE. They're occasionally
-- useful in app code via RPC, and removing them would require a
-- coordinated change. We just stop relying on them inside RLS.
--
-- Also fixes the bootstrap-stage trigger so transactions seeded with an
-- in-progress stage_key automatically mark earlier stages as 'done' instead
-- of 'upcoming' (the previous trigger only set the current stage).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── profiles ───────────────────────────────────────────────────────────────

drop policy if exists "Org staff read org profiles" on public.profiles;
create policy "Org staff read org profiles"
  on public.profiles for select to authenticated
  using (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid()
        and role in ('agent','admin')
    )
  );

drop policy if exists "Clients read their agent" on public.profiles;
create policy "Clients read their agent"
  on public.profiles for select to authenticated
  using (
    id in (
      select agent_id from public.transactions where client_id = auth.uid()
    )
  );

-- ─── transactions ───────────────────────────────────────────────────────────

drop policy if exists "Agents read/write their txs" on public.transactions;
create policy "Agents read/write their txs"
  on public.transactions for all to authenticated
  using (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid() and role in ('agent','admin')
    )
    and (
      agent_id = auth.uid()
      or auth.uid() in (
        select id from public.profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  )
  with check (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid() and role in ('agent','admin')
    )
    and (
      agent_id = auth.uid()
      or auth.uid() in (
        select id from public.profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

drop policy if exists "Clients read their tx" on public.transactions;
create policy "Clients read their tx"
  on public.transactions for select to authenticated
  using (
    client_id = auth.uid()
    and auth.uid() in (
      select id from public.profiles where id = auth.uid() and role = 'client'
    )
  );

-- ─── transaction_stages ─────────────────────────────────────────────────────

drop policy if exists "Agents read/write stages on their txs" on public.transaction_stages;
create policy "Agents read/write stages on their txs"
  on public.transaction_stages for all to authenticated
  using (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid()
         or auth.uid() in (
           select id from public.profiles
           where id = auth.uid() and role = 'admin'
         )
    )
  )
  with check (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid()
         or auth.uid() in (
           select id from public.profiles
           where id = auth.uid() and role = 'admin'
         )
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
         or auth.uid() in (
           select id from public.profiles
           where id = auth.uid() and role = 'admin'
         )
    )
  )
  with check (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid()
         or auth.uid() in (
           select id from public.profiles
           where id = auth.uid() and role = 'admin'
         )
    )
  );

drop policy if exists "Clients upload to their tx" on public.documents;
create policy "Clients upload to their tx"
  on public.documents for insert to authenticated
  with check (
    auth.uid() in (
      select id from public.profiles where id = auth.uid() and role = 'client'
    )
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
    auth.uid() in (
      select id from public.profiles where id = auth.uid() and role = 'client'
    )
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
    auth.uid() in (
      select id from public.profiles
      where id = auth.uid() and role in ('agent','admin')
    )
    and agent_id = auth.uid()
    and transaction_id in (
      select id from public.transactions where agent_id = auth.uid()
    )
  );

drop policy if exists "Clients create threads on their tx" on public.message_threads;
create policy "Clients create threads on their tx"
  on public.message_threads for insert to authenticated
  with check (
    auth.uid() in (
      select id from public.profiles where id = auth.uid() and role = 'client'
    )
    and client_id = auth.uid()
    and transaction_id in (
      select id from public.transactions where client_id = auth.uid()
    )
  );

-- ─── tasks (agent-only) ────────────────────────────────────────────────────

drop policy if exists "Agents manage own tasks" on public.tasks;
create policy "Agents manage own tasks"
  on public.tasks for all to authenticated
  using (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid() and role in ('agent','admin')
    )
    and (
      agent_id = auth.uid()
      or auth.uid() in (
        select id from public.profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  )
  with check (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid() and role in ('agent','admin')
    )
    and (
      agent_id = auth.uid()
      or auth.uid() in (
        select id from public.profiles
        where id = auth.uid() and role = 'admin'
      )
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
         or auth.uid() in (
           select id from public.profiles
           where id = auth.uid() and role = 'admin'
         )
    )
  )
  with check (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid()
         or auth.uid() in (
           select id from public.profiles
           where id = auth.uid() and role = 'admin'
         )
    )
  );

-- (Clients read visible updates on their tx — already simple, no helpers used.)

-- ─── activity_log ──────────────────────────────────────────────────────────

drop policy if exists "Agents read org activity" on public.activity_log;
create policy "Agents read org activity"
  on public.activity_log for select to authenticated
  using (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid() and role in ('agent','admin')
    )
  );

drop policy if exists "Clients read their tx activity" on public.activity_log;
create policy "Clients read their tx activity"
  on public.activity_log for select to authenticated
  using (
    auth.uid() in (
      select id from public.profiles where id = auth.uid() and role = 'client'
    )
    and transaction_id in (
      select id from public.transactions where client_id = auth.uid()
    )
  );

-- ─── invites ──────────────────────────────────────────────────────────────

drop policy if exists "Agents manage invites in their org" on public.invites;
create policy "Agents manage invites in their org"
  on public.invites for all to authenticated
  using (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid() and role in ('agent','admin')
    )
  )
  with check (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid() and role in ('agent','admin')
    )
    and agent_id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Improved bootstrap_transaction_stages trigger
--
-- Marks every stage BEFORE the transaction's `stage_key` as 'done', the
-- matching stage as 'current', and everything after as 'upcoming'. The old
-- version only set the current stage, leaving prior stages as 'upcoming' —
-- which broke the timeline UI for any transaction whose stage_key wasn't
-- 'offer'.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.bootstrap_transaction_stages()
returns trigger
language plpgsql
as $$
declare
  s_key       text;
  s_pos       smallint := 1;
  current_pos smallint;
  stages constant text[] := array[
    'offer','contract','earnest','inspection','appraisal','loan','ctc','walk','closing'
  ];
begin
  -- Resolve the new transaction's stage_key to its 1-based position.
  current_pos := array_position(stages, new.stage_key);

  foreach s_key in array stages loop
    insert into public.transaction_stages (transaction_id, stage_key, state, position)
    values (
      new.id,
      s_key,
      case
        when s_pos <  current_pos then 'done'
        when s_pos =  current_pos then 'current'
        else 'upcoming'
      end,
      s_pos
    );
    s_pos := s_pos + 1;
  end loop;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: paint existing t2–t6 stages so previously-completed stages flip
-- from 'upcoming' to 'done'. Idempotent — picks up the transaction's
-- current stage_key from `transactions` and rewrites the rows.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  tx record;
  stages constant text[] := array[
    'offer','contract','earnest','inspection','appraisal','loan','ctc','walk','closing'
  ];
  current_pos smallint;
begin
  -- Skip transactions whose stages have been hand-painted by the seed
  -- script — detected by any stage having a non-null due_date or done_date
  -- on it. Those rows came from the seed's curated stageRows update.
  for tx in
    select t.id, t.stage_key
    from public.transactions t
    where not exists (
      select 1 from public.transaction_stages s
      where s.transaction_id = t.id
        and (s.due_date is not null or s.done_date is not null or coalesce(s.note,'') <> '')
    )
  loop
    current_pos := array_position(stages, tx.stage_key);
    update public.transaction_stages
    set state = case
      when position <  current_pos then 'done'
      when position =  current_pos then 'current'
      else 'upcoming'
    end
    where transaction_id = tx.id;
  end loop;
end $$;
