-- ─────────────────────────────────────────────────────────────────────────────
-- Stravex — Row-Level Security policies
--
-- Permission matrix (enforced here, not in the UI):
--
--   agents  : full r/w on rows they own (agent_id = auth.uid())
--   clients : r on rows they own (client_id = auth.uid()), w only where
--             explicitly allowed (their own message replies, their own
--             upload-deletable documents)
--   admins  : r/w within their organization
--
-- Critical client guarantees:
--   • Cannot read tasks (no client policy on the tasks table)
--   • Cannot read documents where client_visible = false (e.g. compliance)
--   • Cannot read transaction_updates where visible = false (internal notes)
--   • Cannot read message threads they're not on
--   • Cannot read other clients' or other orgs' data
--   • Cannot delete approved or agent-uploaded documents
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.organizations         enable row level security;
alter table public.profiles              enable row level security;
alter table public.transactions          enable row level security;
alter table public.transaction_stages    enable row level security;
alter table public.documents             enable row level security;
alter table public.message_threads       enable row level security;
alter table public.messages              enable row level security;
alter table public.tasks                 enable row level security;
alter table public.transaction_updates   enable row level security;
alter table public.notifications         enable row level security;
alter table public.activity_log          enable row level security;
alter table public.invites               enable row level security;

-- ─── organizations ──────────────────────────────────────────────────────────
create policy "Read own org"
  on public.organizations for select to authenticated
  using (id = public.current_org());

create policy "Admins update own org"
  on public.organizations for update to authenticated
  using (id = public.current_org() and public.current_role() = 'admin')
  with check (id = public.current_org() and public.current_role() = 'admin');

-- ─── profiles ───────────────────────────────────────────────────────────────
-- Own profile is always visible.
create policy "Read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- Agents/admins see every profile in their org.
create policy "Org staff read org profiles"
  on public.profiles for select to authenticated
  using (
    organization_id = public.current_org()
    and public.current_role() in ('agent','admin')
  );

-- Clients can see the agent assigned to their transaction (and nothing else).
create policy "Clients read their agent"
  on public.profiles for select to authenticated
  using (
    public.current_role() = 'client'
    and id in (
      select agent_id from public.transactions where client_id = auth.uid()
    )
  );

-- Update own profile only (cannot escalate role or move orgs).
create policy "Update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and organization_id = (select organization_id from public.profiles where id = auth.uid())
  );

-- ─── transactions ───────────────────────────────────────────────────────────
create policy "Agents read/write their txs"
  on public.transactions for all to authenticated
  using (
    public.current_role() in ('agent','admin')
    and (agent_id = auth.uid() or public.current_role() = 'admin')
    and organization_id = public.current_org()
  )
  with check (
    public.current_role() in ('agent','admin')
    and organization_id = public.current_org()
    and (agent_id = auth.uid() or public.current_role() = 'admin')
  );

create policy "Clients read their tx"
  on public.transactions for select to authenticated
  using (
    public.current_role() = 'client'
    and client_id = auth.uid()
  );

-- ─── transaction_stages ─────────────────────────────────────────────────────
create policy "Agents read/write stages on their txs"
  on public.transaction_stages for all to authenticated
  using (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid() or public.current_role() = 'admin'
    )
  )
  with check (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid() or public.current_role() = 'admin'
    )
  );

create policy "Clients read stages on their tx"
  on public.transaction_stages for select to authenticated
  using (
    transaction_id in (
      select id from public.transactions where client_id = auth.uid()
    )
  );

-- ─── documents ──────────────────────────────────────────────────────────────
-- Agents/admins: full access on their txs.
create policy "Agents manage docs on their txs"
  on public.documents for all to authenticated
  using (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid() or public.current_role() = 'admin'
    )
  )
  with check (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid() or public.current_role() = 'admin'
    )
  );

-- Clients: read only client-visible docs on their own transaction.
create policy "Clients read visible docs"
  on public.documents for select to authenticated
  using (
    transaction_id in (select id from public.transactions where client_id = auth.uid())
    and client_visible = true
  );

-- Clients: upload to their own transaction, always client-visible + removable.
create policy "Clients upload to their tx"
  on public.documents for insert to authenticated
  with check (
    public.current_role() = 'client'
    and transaction_id in (select id from public.transactions where client_id = auth.uid())
    and uploaded_by = auth.uid()
    and uploaded_by_role = 'client'
    and client_visible = true
    and removable_by_client = true
  );

-- Clients: delete only their own uploads that haven't been reviewed yet.
create policy "Clients delete own non-reviewed uploads"
  on public.documents for delete to authenticated
  using (
    public.current_role() = 'client'
    and uploaded_by = auth.uid()
    and uploaded_by_role = 'client'
    and removable_by_client = true
    and status <> 'reviewed'
  );

-- ─── message_threads ────────────────────────────────────────────────────────
create policy "Read threads I am on"
  on public.message_threads for select to authenticated
  using (agent_id = auth.uid() or client_id = auth.uid());

create policy "Agents create threads on their txs"
  on public.message_threads for insert to authenticated
  with check (
    public.current_role() in ('agent','admin')
    and agent_id = auth.uid()
    and transaction_id in (select id from public.transactions where agent_id = auth.uid())
  );

create policy "Clients create threads on their tx"
  on public.message_threads for insert to authenticated
  with check (
    public.current_role() = 'client'
    and client_id = auth.uid()
    and transaction_id in (select id from public.transactions where client_id = auth.uid())
  );

create policy "Update threads I am on"
  on public.message_threads for update to authenticated
  using (agent_id = auth.uid() or client_id = auth.uid())
  with check (agent_id = auth.uid() or client_id = auth.uid());

create policy "Delete threads I own (agent or client)"
  on public.message_threads for delete to authenticated
  using (agent_id = auth.uid() or client_id = auth.uid());

-- ─── messages ───────────────────────────────────────────────────────────────
create policy "Read messages on accessible threads"
  on public.messages for select to authenticated
  using (
    thread_id in (
      select id from public.message_threads
      where agent_id = auth.uid() or client_id = auth.uid()
    )
  );

create policy "Send messages on accessible threads"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and thread_id in (
      select id from public.message_threads
      where agent_id = auth.uid() or client_id = auth.uid()
    )
  );

-- Update is allowed by both parties so each side can flip its read flag.
create policy "Update messages on accessible threads"
  on public.messages for update to authenticated
  using (
    thread_id in (
      select id from public.message_threads
      where agent_id = auth.uid() or client_id = auth.uid()
    )
  )
  with check (
    thread_id in (
      select id from public.message_threads
      where agent_id = auth.uid() or client_id = auth.uid()
    )
  );

-- ─── tasks ──────────────────────────────────────────────────────────────────
-- Agents/admins only. NO client policy → clients get zero rows.
create policy "Agents manage own tasks"
  on public.tasks for all to authenticated
  using (
    public.current_role() in ('agent','admin')
    and (agent_id = auth.uid() or public.current_role() = 'admin')
    and organization_id = public.current_org()
  )
  with check (
    public.current_role() in ('agent','admin')
    and (agent_id = auth.uid() or public.current_role() = 'admin')
    and organization_id = public.current_org()
  );

-- ─── transaction_updates ───────────────────────────────────────────────────
create policy "Agents manage updates on their txs"
  on public.transaction_updates for all to authenticated
  using (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid() or public.current_role() = 'admin'
    )
  )
  with check (
    transaction_id in (
      select id from public.transactions
      where agent_id = auth.uid() or public.current_role() = 'admin'
    )
  );

create policy "Clients read visible updates on their tx"
  on public.transaction_updates for select to authenticated
  using (
    transaction_id in (select id from public.transactions where client_id = auth.uid())
    and visible = true
  );

-- ─── notifications ──────────────────────────────────────────────────────────
-- A user can read/update their own row only. Inserts come from server-side
-- code using the service role (triggers, API routes), which bypasses RLS.
create policy "Read own notifications"
  on public.notifications for select to authenticated
  using (recipient_id = auth.uid());

create policy "Update own notifications"
  on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ─── activity_log ──────────────────────────────────────────────────────────
-- Read-only for app users. Writes happen via triggers / service role.
create policy "Agents read org activity"
  on public.activity_log for select to authenticated
  using (
    public.current_role() in ('agent','admin')
    and organization_id = public.current_org()
  );

create policy "Clients read activity on their tx"
  on public.activity_log for select to authenticated
  using (
    public.current_role() = 'client'
    and transaction_id in (select id from public.transactions where client_id = auth.uid())
  );

-- ─── invites ──────────────────────────────────────────────────────────────
create policy "Agents manage invites in their org"
  on public.invites for all to authenticated
  using (
    public.current_role() in ('agent','admin')
    and organization_id = public.current_org()
  )
  with check (
    public.current_role() in ('agent','admin')
    and organization_id = public.current_org()
    and agent_id = auth.uid()
  );
