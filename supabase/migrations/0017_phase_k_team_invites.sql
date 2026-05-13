-- ─────────────────────────────────────────────────────────────────────────────
-- Phase K — Team management. Extend the `invites` table to support
-- agent + admin invitations in addition to the existing client invites.
--
-- Schema today (0001):
--   invites.transaction_id uuid NOT NULL references transactions(id)
--
-- That hard-coded coupling means every invite is implicitly a "client
-- invite for transaction X". Team management needs to invite agents and
-- admins who aren't tied to a specific transaction.
--
-- Changes:
--   1. New column: `target_role text not null default 'client'` with a
--      CHECK constraint limiting it to ('client','agent','admin').
--      Existing rows backfill to 'client' (their original meaning).
--
--   2. Make `transaction_id` nullable. The original NOT NULL is replaced
--      by a row-level check constraint that ties the two columns
--      together:
--        - target_role='client'        → transaction_id REQUIRED
--        - target_role in ('agent','admin') → transaction_id MUST be NULL
--      Postgres enforces this at insert/update; the app can't accidentally
--      create an agent invite that points at a transaction.
--
--   3. Index on target_role for the two query patterns we have:
--      pending-client-invites (used by /agent/clients) and
--      pending-team-invites (used by /agent/team).
--
-- RLS:
--   No policy changes. The existing "Agents manage invites in their org"
--   policy (recursion-safe after 0012/0015) already lets agents + admins
--   read/write invites scoped to their org. The "only admins can invite
--   agents/admins" rule lives in the server action layer
--   (lib/actions/invites.ts) — RLS provides defense in depth, the action
--   provides the business rule + a clean error message.
--
-- Idempotent: all alters are `if exists` / `if not exists`.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. target_role column. Backfills existing rows to 'client'.
alter table public.invites
  add column if not exists target_role text not null default 'client';

-- (Re-create the check constraint idempotently. ALTER ... ADD CONSTRAINT
-- doesn't support IF NOT EXISTS in Postgres, so we drop-then-add.)
alter table public.invites
  drop constraint if exists invites_target_role_check;
alter table public.invites
  add  constraint invites_target_role_check
       check (target_role in ('client', 'agent', 'admin'));

-- 2. Make transaction_id nullable. Idempotent — drop-not-null is a no-op
-- if the column is already nullable.
alter table public.invites
  alter column transaction_id drop not null;

-- Row-level check binding target_role to transaction_id presence.
alter table public.invites
  drop constraint if exists invites_transaction_consistency_check;
alter table public.invites
  add  constraint invites_transaction_consistency_check
       check (
         (target_role = 'client'        and transaction_id is not null)
         or
         (target_role in ('agent','admin') and transaction_id is null)
       );

-- 3. Index for the inbox / clients filters.
create index if not exists invites_target_role_idx
  on public.invites(target_role);
