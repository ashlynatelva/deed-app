-- ─────────────────────────────────────────────────────────────────────────────
-- Phase E follow-up #2 — Stop the planner from inlining the RLS helpers.
--
-- Background:
--   0009 routed the recursive "Org staff read org profiles" policy through
--   SECURITY DEFINER helpers (`current_role`, `current_org`) on the theory
--   that SECURITY DEFINER would bypass RLS inside the helper, breaking the
--   recursion. The migration applied cleanly. Login still 42P17'd.
--
-- Why 0009 didn't actually fix it:
--   PostgreSQL's planner is allowed to INLINE `LANGUAGE sql` functions
--   into the calling query when their body is a single SELECT. When that
--   happens, the function-call site is rewritten as the raw subquery and
--   the SECURITY DEFINER wrapper is dropped. The "helper" effectively
--   becomes the same inline subquery we had in 0007 — re-entering the
--   profiles policy chain and triggering infinite recursion.
--
--   The Postgres docs are explicit about this:
--     "Functions written in any language other than SQL can never be
--      inlined."
--   (https://www.postgresql.org/docs/current/xfunc-sql.html)
--
-- Fix in this migration:
--   1. Convert helpers to LANGUAGE plpgsql so they're opaque to the planner.
--   2. Rename off `current_role` — `CURRENT_ROLE` is a reserved SQL value
--      expression (returns the SQL session role). Parser interactions
--      between the reserved form and a user-defined function of the same
--      name have caused subtle "returns NULL" symptoms in this project
--      before. Using `app_user_role` / `app_user_org` removes any
--      ambiguity for future readers.
--   3. Re-create the three SELECT policies on profiles so the migration
--      is fully self-contained — anyone running it from a partial state
--      ends up with a known-good policy set.
--
-- Recursion-safety argument:
--   plpgsql function bodies are not inlined. The function body executes
--   in a separate plan, under the function owner's privileges (postgres,
--   which has BYPASSRLS in Supabase). The internal `SELECT FROM profiles`
--   therefore skips RLS, never re-entering the policy chain.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the old helpers. CASCADE not needed: 0007 already removed every
--    other policy/grant that referenced them; only the one policy from
--    0009 uses them, and we recreate that policy below with the new names.
drop function if exists public.current_role();
drop function if exists public.current_org();

-- 2. New helpers — plpgsql so the planner can't inline + bypass SECURITY DEFINER.
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
  -- Runs as the function owner (postgres) with BYPASSRLS — the inner
  -- SELECT does NOT trigger the profiles SELECT policies.
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

-- Tighten function-level grants. Authenticated users need EXECUTE so
-- the RLS policy can call them; anon doesn't need them.
grant execute on function public.app_user_role() to authenticated;
grant execute on function public.app_user_org()  to authenticated;
revoke execute on function public.app_user_role() from anon;
revoke execute on function public.app_user_org()  from anon;

-- 3. Re-create every SELECT policy on profiles so the final state is
--    deterministic regardless of which earlier migrations have run.
--    All three must be recursion-safe:
--      - "Read own profile"          : trivial qual, no subqueries.
--      - "Org staff read org profiles": helper-driven, plpgsql-opaque.
--      - "Clients read their agent"   : subqueries `transactions` only,
--                                       which does not reference profiles
--                                       in its own SELECT policies.
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Org staff read org profiles" on public.profiles;
create policy "Org staff read org profiles"
  on public.profiles for select to authenticated
  using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('agent', 'admin')
  );

drop policy if exists "Clients read their agent" on public.profiles;
create policy "Clients read their agent"
  on public.profiles for select to authenticated
  using (
    id in (
      select agent_id from public.transactions where client_id = auth.uid()
    )
  );
