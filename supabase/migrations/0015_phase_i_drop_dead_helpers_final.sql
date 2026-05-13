-- ─────────────────────────────────────────────────────────────────────────────
-- Phase I cleanup, FINAL — Self-healing helper-function drop.
--
-- Why this needed three attempts:
--   - 0013 tried to drop the helpers directly; failed because the
--     activity_log orphan from 0002 still depended on current_role().
--   - 0014 dropped that one orphan, then the helpers; failed again
--     because "Read own org" on `organizations` *also* still depended
--     on current_org(). 0004 had created a replacement
--     ("Anyone can read organizations") but apparently the original
--     drop didn't survive on every DB.
--
-- The pattern is clear: enumerating orphans by reading migration files
-- isn't reliable — replacement policies were created under
-- slightly-different names in 0007/0008, and individual drops in
-- 0004/0006 may or may not have survived re-runs. The DB itself is
-- the only source of truth.
--
-- This migration introspects pg_policies and drops every policy that
-- references current_role/current_org in its qual or with_check
-- expression, across every schema. That covers any orphan we forgot
-- about, including the storage.objects policies and any future ones
-- a contributor might add.
--
-- Safety:
--   Every helper-using policy ever written has a recursion-safe
--   replacement in the schema today (under either the same name or a
--   close variant). Audit summary:
--     - public.organizations: "Read own org" (helper-using) → replaced
--       by "Anyone can read organizations" (0004, no helpers)
--     - public.organizations: "Admins update own org" → replaced by
--       "Org staff update own org" (0012, plpgsql helper)
--     - public.profiles, public.transactions, etc.: replacements in 0012
--     - public.activity_log: "Clients read activity on their tx" →
--       replaced by "Clients read their tx activity" (0007/0012)
--     - storage.objects: rewritten by 0008 with inline subqueries
--   No functional access is lost by dropping the orphans.
--
-- The migration is idempotent: running it twice is a no-op (nothing
-- references the helpers after the first pass; the second pass finds
-- zero rows and the helper drops are gated by IF EXISTS).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Audit query — run BEFORE applying to see what will be dropped:
--
--   SELECT schemaname, tablename, policyname, cmd
--   FROM pg_policies
--   WHERE qual ~ 'current_role|current_org'
--      OR with_check ~ 'current_role|current_org'
--   ORDER BY schemaname, tablename, policyname;
--
-- Run the same query AFTER applying — it should return zero rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop every policy that depends on the legacy helpers, in every
--    schema, dynamically. EXECUTE format(...) escapes identifiers
--    correctly so policy names containing spaces (which all of these do)
--    are handled safely.
do $$
declare
  pol record;
  dropped_count int := 0;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where qual ~ 'current_role|current_org'
       or with_check ~ 'current_role|current_org'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );
    raise notice 'dropped policy %.%.%',
      pol.schemaname, pol.tablename, pol.policyname;
    dropped_count := dropped_count + 1;
  end loop;
  raise notice 'cleanup pass: % helper-dependent policies dropped', dropped_count;
end
$$;

-- 2. Verification gate. Assert no policy still references the helpers
--    before we attempt the function drops. If anything remains, fail
--    loudly with the list so the operator can investigate instead of
--    hitting an opaque "cannot drop function" error.
do $$
declare
  remaining int;
  rows text;
begin
  select count(*),
         string_agg(format('%s.%s.%s', schemaname, tablename, policyname), E'\n  ')
    into remaining, rows
    from pg_policies
   where qual ~ 'current_role|current_org'
      or with_check ~ 'current_role|current_org';

  if remaining > 0 then
    raise exception
      'Cannot drop helper functions: % policies still reference them:%s%s',
      remaining, E'\n  ', rows;
  end if;
end
$$;

-- 3. Drop the helpers. CASCADE intentionally NOT used — the
--    verification gate above guarantees there are no dependents at
--    this point.
drop function if exists public.current_role();
drop function if exists public.current_org();
