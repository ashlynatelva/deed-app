-- ─────────────────────────────────────────────────────────────────────────────
-- Stravex — Initial schema
--
-- Single-tenant for the MVP (one seeded Stravex organization) but the
-- organization_id foreign keys are in place so the same schema scales to
-- multi-tenant without a future migration.
--
-- Run order: 0001 (this file) → 0002_rls_policies → 0003_storage → seed script.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ─── organizations ──────────────────────────────────────────────────────────
-- One row per brokerage. Branding (welcome copy, accent, logo URL, footer,
-- support contact, etc.) lives in a jsonb column so we don't migrate the
-- schema every time we add a brand field.
create table if not exists public.organizations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  support_phone    text,
  support_email    text,
  branding         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ─── profiles ───────────────────────────────────────────────────────────────
-- One row per signed-in user. PK is the auth.users id so JOINs are free.
-- Role gates everything in RLS — never trust client-side state.
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete restrict,
  role             text not null check (role in ('admin','agent','client')),
  full_name        text not null,
  email            text not null,
  phone            text,
  title            text,
  avatar_url       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists profiles_org_idx  on public.profiles(organization_id);
create index if not exists profiles_role_idx on public.profiles(role);

-- ─── transactions ───────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete restrict,
  agent_id         uuid not null references public.profiles(id) on delete restrict,
  client_id        uuid     references public.profiles(id) on delete set null,
  address          text not null,
  city             text,
  price            numeric,
  type             text,
  representation   text check (representation in ('buyer_client','buyer_customer','seller_client','seller_customer')),
  stage_key        text not null default 'offer' check (stage_key in (
                     'offer','contract','earnest','inspection','appraisal','loan','ctc','walk','closing')),
  closing          date,
  status           text not null default 'on_track' check (status in ('on_track','needs_attention','at_risk')),
  listing_agent    text,
  co_agent         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists transactions_agent_idx  on public.transactions(agent_id);
create index if not exists transactions_client_idx on public.transactions(client_id);
create index if not exists transactions_org_idx    on public.transactions(organization_id);

-- ─── transaction_stages ─────────────────────────────────────────────────────
-- 9 rows per transaction (one per stage). Auto-bootstrapped by a trigger
-- on transactions insert (see below) so the app doesn't have to do it.
create table if not exists public.transaction_stages (
  id               uuid primary key default gen_random_uuid(),
  transaction_id   uuid not null references public.transactions(id) on delete cascade,
  stage_key        text not null check (stage_key in (
                     'offer','contract','earnest','inspection','appraisal','loan','ctc','walk','closing')),
  state            text not null default 'upcoming' check (state in ('done','current','upcoming')),
  due_date         date,
  done_date        date,
  note             text,
  position         smallint not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (transaction_id, stage_key)
);

create index if not exists transaction_stages_tx_idx on public.transaction_stages(transaction_id);

-- ─── documents ──────────────────────────────────────────────────────────────
-- `storage_path` is nullable — "needed" placeholder docs exist without a file.
-- `client_visible` and `removable_by_client` enforce client-portal permissions
-- alongside RLS.
create table if not exists public.documents (
  id                    uuid primary key default gen_random_uuid(),
  transaction_id        uuid not null references public.transactions(id) on delete cascade,
  name                  text not null,
  doc_type              text,
  who                   text check (who in ('Client','Agent','Both')),
  status                text not null default 'needed' check (status in ('needed','submitted','received','reviewed','revision')),
  client_visible        boolean not null default true,
  removable_by_client   boolean not null default false,
  uploaded_by           uuid references public.profiles(id) on delete set null,
  uploaded_by_role      text check (uploaded_by_role in ('agent','client')),
  storage_path          text,
  file_name             text,
  file_type             text,
  file_size             bigint,
  due_date              date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists documents_tx_idx     on public.documents(transaction_id);
create index if not exists documents_status_idx on public.documents(status);

-- ─── message_threads ────────────────────────────────────────────────────────
create table if not exists public.message_threads (
  id                uuid primary key default gen_random_uuid(),
  transaction_id    uuid not null references public.transactions(id) on delete cascade,
  client_id         uuid not null references public.profiles(id) on delete restrict,
  agent_id          uuid not null references public.profiles(id) on delete restrict,
  subject           text not null,
  related_property  text,
  status            text not null default 'needs_response' check (status in ('needs_response','resolved')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists message_threads_client_idx on public.message_threads(client_id);
create index if not exists message_threads_agent_idx  on public.message_threads(agent_id);
create index if not exists message_threads_tx_idx     on public.message_threads(transaction_id);

-- ─── messages ───────────────────────────────────────────────────────────────
-- sender_name is denormalized so a later profile rename doesn't rewrite
-- conversation history.
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references public.message_threads(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null,
  sender_role     text not null check (sender_role in ('agent','client')),
  sender_name     text not null,
  body            text not null,
  read_by_agent   boolean not null default false,
  read_by_client  boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists messages_thread_idx on public.messages(thread_id);

-- ─── tasks (agent-only — RLS has NO client policy) ──────────────────────────
create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete restrict,
  agent_id         uuid not null references public.profiles(id) on delete restrict,
  transaction_id   uuid references public.transactions(id) on delete set null,
  title            text not null,
  notes            text,
  due_date         date,
  priority         text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status           text not null default 'todo'    check (status   in ('todo','progress','waiting','done')),
  reminder         boolean not null default false,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists tasks_agent_idx on public.tasks(agent_id);
create index if not exists tasks_tx_idx    on public.tasks(transaction_id);

-- ─── transaction_updates (advisor-posted posts shown to clients) ────────────
-- `visible = false` marks internal-only notes the client must never see.
create table if not exists public.transaction_updates (
  id               uuid primary key default gen_random_uuid(),
  transaction_id   uuid not null references public.transactions(id) on delete cascade,
  author_id        uuid not null references public.profiles(id) on delete restrict,
  title            text not null,
  body             text,
  visible          boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists transaction_updates_tx_idx on public.transaction_updates(transaction_id);

-- ─── notifications ──────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id                       uuid primary key default gen_random_uuid(),
  recipient_id             uuid not null references public.profiles(id) on delete cascade,
  recipient_role           text not null check (recipient_role in ('agent','client','admin')),
  title                    text not null,
  detail                   text,
  kind                     text not null check (kind in ('upload','message','deadline','update')),
  read                     boolean not null default false,
  href                     text,
  related_transaction_id   uuid references public.transactions(id) on delete cascade,
  related_thread_id        uuid references public.message_threads(id) on delete cascade,
  created_at               timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications(recipient_id);
create index if not exists notifications_unread_idx    on public.notifications(recipient_id, read) where read = false;

-- ─── activity_log (append-only audit trail) ─────────────────────────────────
create table if not exists public.activity_log (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  actor_id         uuid references public.profiles(id) on delete set null,
  actor_role       text,
  action           text not null,           -- e.g. 'document.uploaded', 'stage.updated'
  resource_type    text,
  resource_id      uuid,
  transaction_id   uuid references public.transactions(id) on delete cascade,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists activity_log_org_idx on public.activity_log(organization_id, created_at desc);
create index if not exists activity_log_tx_idx  on public.activity_log(transaction_id,  created_at desc);

-- ─── invites (pre-signup state for clients) ─────────────────────────────────
create table if not exists public.invites (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  agent_id         uuid not null references public.profiles(id) on delete restrict,
  transaction_id   uuid not null references public.transactions(id) on delete cascade,
  email            text not null,
  full_name        text not null,
  token            text not null unique,
  status           text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  expires_at       timestamptz,
  accepted_at      timestamptz,
  accepted_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists invites_email_idx on public.invites(email);
create index if not exists invites_token_idx on public.invites(token);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper functions (used by RLS in 0002 and by app code)
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns the role of the calling user. Stable + security-definer so the
-- function can read profiles without recursive RLS lookups.
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Returns the organization_id of the calling user.
create or replace function public.current_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Generic updated_at touch trigger
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$ begin
  drop trigger if exists organizations_touch_updated_at      on public.organizations;
  drop trigger if exists profiles_touch_updated_at           on public.profiles;
  drop trigger if exists transactions_touch_updated_at       on public.transactions;
  drop trigger if exists transaction_stages_touch_updated_at on public.transaction_stages;
  drop trigger if exists documents_touch_updated_at          on public.documents;
  drop trigger if exists message_threads_touch_updated_at    on public.message_threads;
  drop trigger if exists tasks_touch_updated_at              on public.tasks;
end $$;

create trigger organizations_touch_updated_at      before update on public.organizations      for each row execute function public.touch_updated_at();
create trigger profiles_touch_updated_at           before update on public.profiles           for each row execute function public.touch_updated_at();
create trigger transactions_touch_updated_at       before update on public.transactions       for each row execute function public.touch_updated_at();
create trigger transaction_stages_touch_updated_at before update on public.transaction_stages for each row execute function public.touch_updated_at();
create trigger documents_touch_updated_at          before update on public.documents          for each row execute function public.touch_updated_at();
create trigger message_threads_touch_updated_at    before update on public.message_threads    for each row execute function public.touch_updated_at();
create trigger tasks_touch_updated_at              before update on public.tasks              for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-create the 9 stage rows when a transaction is inserted
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.bootstrap_transaction_stages()
returns trigger
language plpgsql
as $$
declare
  s_key text;
  s_pos smallint := 1;
  stages constant text[] := array[
    'offer','contract','earnest','inspection','appraisal','loan','ctc','walk','closing'
  ];
begin
  foreach s_key in array stages loop
    insert into public.transaction_stages (transaction_id, stage_key, state, position)
    values (
      new.id,
      s_key,
      case when s_key = new.stage_key then 'current' else 'upcoming' end,
      s_pos
    );
    s_pos := s_pos + 1;
  end loop;
  return new;
end;
$$;

drop trigger if exists transactions_bootstrap_stages on public.transactions;

create trigger transactions_bootstrap_stages
  after insert on public.transactions
  for each row execute function public.bootstrap_transaction_stages();

-- ─────────────────────────────────────────────────────────────────────────────
-- Stage-change side effects: when stage_key changes on a transaction, emit a
-- transaction_update + notify the client. Activity logging is also inserted.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.on_transaction_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_stage_label text;
begin
  if new.stage_key is distinct from old.stage_key then
    -- Mark the new stage as current, prior stages as done.
    update public.transaction_stages
       set state = case
         when stage_key = new.stage_key then 'current'
         when position < (select position from public.transaction_stages
                          where transaction_id = new.id and stage_key = new.stage_key) then 'done'
         else 'upcoming'
       end
     where transaction_id = new.id;

    select client_id into v_client_id from public.transactions where id = new.id;
    v_stage_label := initcap(replace(new.stage_key, '_', ' '));

    if v_client_id is not null then
      -- Visible client-facing update.
      insert into public.transaction_updates (transaction_id, author_id, title, body, visible)
      values (
        new.id, new.agent_id,
        'Stage updated: ' || v_stage_label,
        'Your transaction has moved to the ' || v_stage_label || ' stage.',
        true
      );

      -- Notification for the client.
      insert into public.notifications (recipient_id, recipient_role, title, detail, kind, href, related_transaction_id)
      values (
        v_client_id, 'client',
        'Stage updated: ' || v_stage_label,
        new.address,
        'update',
        '/client/updates',
        new.id
      );
    end if;

    -- Activity log entry.
    insert into public.activity_log (organization_id, actor_id, actor_role, action, resource_type, resource_id, transaction_id, metadata)
    values (
      new.organization_id, new.agent_id, 'agent', 'stage.updated', 'transaction', new.id, new.id,
      jsonb_build_object('from', old.stage_key, 'to', new.stage_key)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_on_stage_change on public.transactions;

create trigger transactions_on_stage_change
  after update of stage_key on public.transactions
  for each row execute function public.on_transaction_stage_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- Message → notification for the other party
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.message_threads;
  v_recipient uuid;
  v_recipient_role text;
  v_href text;
begin
  select * into v_thread from public.message_threads where id = new.thread_id;

  if new.sender_role = 'agent' then
    v_recipient := v_thread.client_id;
    v_recipient_role := 'client';
    v_href := '/client/messages';
  else
    v_recipient := v_thread.agent_id;
    v_recipient_role := 'agent';
    v_href := '/agent/messages/' || v_thread.id::text;
  end if;

  insert into public.notifications (
    recipient_id, recipient_role, title, detail, kind, href,
    related_transaction_id, related_thread_id
  )
  values (
    v_recipient, v_recipient_role,
    'New message: ' || v_thread.subject,
    new.body,
    'message',
    v_href,
    v_thread.transaction_id,
    v_thread.id
  );

  -- Client reply re-opens a resolved thread so the agent's inbox surfaces it.
  if new.sender_role = 'client' and v_thread.status = 'resolved' then
    update public.message_threads set status = 'needs_response' where id = v_thread.id;
  end if;

  -- Bump updated_at on the thread for sort-by-recency.
  update public.message_threads set updated_at = now() where id = v_thread.id;

  -- Activity log.
  insert into public.activity_log (organization_id, actor_id, actor_role, action, resource_type, resource_id, transaction_id, metadata)
  values (
    (select organization_id from public.profiles where id = new.sender_id),
    new.sender_id, new.sender_role,
    'message.sent', 'message', new.id, v_thread.transaction_id,
    jsonb_build_object('thread_id', v_thread.id)
  );

  return new;
end;
$$;

drop trigger if exists messages_on_insert on public.messages;

create trigger messages_on_insert
  after insert on public.messages
  for each row execute function public.on_message_insert();
