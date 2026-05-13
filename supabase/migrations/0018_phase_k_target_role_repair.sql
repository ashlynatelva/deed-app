-- ─────────────────────────────────────────────────────────────────────────────
-- Phase K repair — Re-assert the `invites.target_role` schema and force
-- PostgREST to reload its schema cache.
--
-- Background:
--   The `createAgentInvite` server action is hitting:
--     "Could not find the 'target_role' column of 'invites' in the
--      schema cache"
--   That can happen for two reasons:
--     (a) Migration 0017 never actually applied — the column doesn't
--         exist in the underlying table.
--     (b) 0017 applied, but PostgREST's schema cache hasn't been
--         refreshed and still thinks the old shape is current.
--
--   This migration handles both cases idempotently:
--     1. `add column if not exists` makes (a) a no-op when 0017 already
--        ran, and a real DDL when it didn't.
--     2. `notify pgrst, 'reload schema'` at the end refreshes the cache
--        unconditionally, fixing (b).
--
-- Why `default 'client'`:
--   Every pre-Phase-K invite row was implicitly a client invite (the
--   `transaction_id NOT NULL` constraint on the original 0001 schema
--   made it structurally impossible to be anything else). Backfilling
--   to 'client' preserves the historical semantic. New writes from
--   `createAgentInvite` set target_role='agent'|'admin' explicitly, so
--   the default is only ever applied to truly-unspecified inserts —
--   which today only happens through pre-Phase-K code paths.
--
-- Why no `invite_type` column:
--   `target_role` already discriminates: 'client' = portal invite,
--   'agent'|'admin' = team invite. A separate boolean/enum would be
--   redundant and a sync risk. Application code derives team-vs-client
--   via `target_role IN ('agent','admin')` — see
--   `getPendingAgentInvitesForCurrentOrg` and `acceptInvite`.
--
-- Safe to re-run: every statement is `if not exists` / `drop … if
-- exists` followed by re-create. Running this on a clean post-0017
-- database is a no-op apart from the cache notify.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Column + check constraint (idempotent restatement of 0017).
alter table public.invites
  add column if not exists target_role text not null default 'client';

alter table public.invites
  drop constraint if exists invites_target_role_check;
alter table public.invites
  add  constraint invites_target_role_check
       check (target_role in ('client', 'agent', 'admin'));

-- 2. Make sure transaction_id is nullable (idempotent — drop-not-null
--    is a no-op when the column is already nullable).
alter table public.invites
  alter column transaction_id drop not null;

-- 3. Re-assert the row-level consistency check binding target_role to
--    transaction_id presence.
alter table public.invites
  drop constraint if exists invites_transaction_consistency_check;
alter table public.invites
  add  constraint invites_transaction_consistency_check
       check (
         (target_role = 'client'         and transaction_id is not null)
         or
         (target_role in ('agent','admin') and transaction_id is null)
       );

-- 4. Backfill safety — every row that somehow has a null target_role
--    (shouldn't be possible with the NOT NULL default, but cheap
--    insurance during repair) gets 'client'.
update public.invites
   set target_role = 'client'
 where target_role is null;

-- 5. Index on target_role for the two query patterns we have
--    (pending-client-invites and pending-team-invites).
create index if not exists invites_target_role_idx
  on public.invites(target_role);

-- 6. Force PostgREST to refresh its schema cache. This is the line
--    that fixes the "Could not find the 'target_role' column" error
--    even when (1)-(5) were no-ops because 0017 already landed.
--
--    PostgREST listens on this channel and reloads its OpenAPI spec
--    on receipt. The reload is asynchronous but typically completes
--    within a second.
notify pgrst, 'reload schema';
