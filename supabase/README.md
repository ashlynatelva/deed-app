# Stravex — Supabase setup (Phase A)

This is the backend foundation. Nothing in the UI calls Supabase yet — that
starts in Phase B (auth) and Phases C–H (per-domain data refactor).

## What's in this folder

```
supabase/
├── README.md                          (this file)
├── migrations/
│   ├── 0001_initial_schema.sql        Tables, indexes, helper functions, triggers
│   ├── 0002_rls_policies.sql          Row-Level Security on every table
│   └── 0003_storage.sql               `documents` bucket + storage policies
└── (no config.toml yet — add via `supabase init` if you want local dev)
```

The seed script lives at `scripts/seed.ts` in the repo root.

## One-time setup

### 1. Provision Supabase via Vercel Marketplace

```
Vercel Dashboard → your Project → Storage → Add Database → Supabase → Continue
```

Vercel creates a Supabase project for you and auto-pushes these env vars into
every environment (Development, Preview, Production):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

If you're not yet deployed to Vercel, you can also create the Supabase project
directly at [supabase.com](https://supabase.com), grab the three keys from
**Project Settings → API**, and paste them into `.env.local`.

### 2. Pull env vars locally

```bash
# If using the Vercel integration:
vercel link        # link the repo to the Vercel project (first time only)
vercel env pull .env.local

# Or manually: copy .env.local.example → .env.local and fill in.
```

### 3. Apply the migrations

Two options:

**Option A — Supabase Studio (no CLI required)**

1. Open your Supabase project → **SQL Editor**
2. Paste the contents of `migrations/0001_initial_schema.sql` → Run
3. Repeat for `0002_rls_policies.sql`
4. Repeat for `0003_storage.sql`

**Option B — Supabase CLI**

```bash
# Install once:
brew install supabase/tap/supabase

# From the repo root:
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. Seed the demo data

```bash
npm run db:seed
```

This creates:

- 1 organization: **Stravex** (with the existing branding defaults)
- 1 agent profile: **Avery Chen** (`avery@stravex.test`)
- 6 client profiles (Whitney, Priya, Jonathan, Theo, Sarah, Aisha)
- 6 transactions matching `t1`–`t6` from the mock data
- 9 stage rows per transaction (auto-created by trigger)
- The Hall transaction's (`t1`) full timeline state, 10 documents, 4 message
  threads, advisor updates
- Priya's 2 threads, agent task seed, all 9 notifications

**Demo password for every seeded user:** `stravex-demo-2026`

Re-running `npm run db:seed` is a no-op — it checks for an existing Stravex
org and exits. To re-seed from scratch, delete the org row in Supabase
Studio (cascade deletes do the rest) and run again.

### 5. Regenerate types (optional, when you change the schema)

```bash
npm run db:types
```

Overwrites `src/lib/supabase/database.types.ts` with types pulled directly
from your live schema. Until you've linked the CLI to your project, the
hand-written types in that file are kept in sync manually.

## What the schema includes

| Table | Purpose |
|---|---|
| `organizations` | One row per brokerage. Branding is jsonb. |
| `profiles` | One row per auth user. `role` is `admin` / `agent` / `client`. |
| `transactions` | The deals. Owned by an agent, optionally linked to a client. |
| `transaction_stages` | Per-tx timeline rows. Auto-bootstrapped on tx insert. |
| `documents` | Metadata + storage path. `client_visible` + `removable_by_client` enforce client portal rules. |
| `message_threads` | Conversations between an agent and a client. |
| `messages` | Bubbles. A message insert auto-creates a notification for the other party. |
| `tasks` | Agent work queue. RLS has **no** client policy. |
| `transaction_updates` | Advisor posts shown to clients (filtered by `visible`). |
| `notifications` | Per-user feed. |
| `activity_log` | Append-only audit trail of every meaningful action. |
| `invites` | Pre-signup state for client onboarding (Phase H). |

## Triggers running today

- `transactions` insert → bootstraps 9 `transaction_stages` rows
- `transactions` update of `stage_key` →
  - Re-paints stage states (`done` / `current` / `upcoming`)
  - Inserts a visible `transaction_updates` row
  - Inserts a `notifications` row for the client
  - Logs `stage.updated` in `activity_log`
- `messages` insert →
  - Inserts a `notifications` row for the OTHER party
  - Re-opens a resolved thread if the client replied
  - Bumps `message_threads.updated_at`
  - Logs `message.sent` in `activity_log`
- `updated_at` touch trigger on every mutable table

## Critical RLS guarantees

The UI continues to gate access for UX clarity, but the data layer is the
real enforcement boundary:

| Resource | Agents | Clients |
|---|---|---|
| Transactions | r/w on rows where `agent_id = self` | r on rows where `client_id = self` |
| Documents (visible) | r/w on rows in their txs | r where `client_visible = true` on their tx |
| Documents (internal) | r/w | **no rows returned** |
| Documents (delete) | r/w | only own uploads, `removable_by_client = true`, not yet `reviewed` |
| Message threads | r/w where `agent_id = self` | r/w where `client_id = self` |
| Tasks | r/w where `agent_id = self` | **no rows returned** |
| Transaction updates | r/w | r where `visible = true` on own tx |
| Notifications | r/u where `recipient_id = self` | r/u where `recipient_id = self` |
| Activity log | r within own org | r where `transaction_id` is own tx |

## What's NOT in Phase A yet

- Login screen wiring (Phase B)
- Route protection middleware (Phase B)
- Any hook refactor (Phases C–G)
- Storage signed-URL minter API route (Phase E)
- Invite flow (Phase H)
- Realtime subscriptions (Phases F + G)

All UI still runs against the existing localStorage-backed stores. The
Supabase layer is set up and ready to be consumed, one domain at a time, in
subsequent PRs.
