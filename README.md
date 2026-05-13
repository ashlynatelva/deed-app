# DEED

**Real Estate Advisor Platform** — a calm, structured workspace for real estate transactions, designed for advisors and the clients they guide through every step of a deal.

DEED is enterprise-grade software with a luxury, minimal feel. One advisor, one client, one transaction — surfaced clearly, calmly, and securely.

---

## Stack

- **Next.js 16** App Router (Turbopack)
- **React 19** with React Compiler
- **Supabase** — Auth, Postgres, RLS, Storage, Realtime
- **Tailwind CSS v4**
- **Resend** for invite + transactional email
- **Vercel** for hosting

## Roles

| Role | Surface | Notes |
|---|---|---|
| `admin` | `/agent/*` | Can manage team, invite agents/admins, delete any transaction in the org |
| `agent` | `/agent/*` | Can create/edit/delete own transactions, invite clients |
| `client` | `/client/*` | Read-only portal for their own transaction; can message + upload docs |

Routing is enforced by `src/proxy.ts` (Next 16 middleware). RLS additionally scopes every database query by `auth.uid()` and `organization_id`.

---

## Getting started (development)

```bash
# 1. Install deps
npm install

# 2. Provision a Supabase project
#    Vercel Marketplace → Supabase → connect → copy URL + keys into .env.local
cp .env.local.example .env.local
# Then paste real values.

# 3. Apply migrations
#    Supabase SQL Editor → paste each file in supabase/migrations/ in numerical order.
#    Or via Supabase CLI: supabase link && supabase db push

# 4. (Optional) seed demo data
npm run db:seed
#    Creates one org named "DEED" + Avery Chen + 6 demo clients + 6 transactions.
#    Demo password: deed-demo-2026.
#    Re-running is a no-op; drop the DEED org to re-seed.

# 5. Dev server
npm run dev
```

Demo credentials after seed:

| Role | Email | Password |
|---|---|---|
| Agent | `avery@deed.test` | `deed-demo-2026` |
| Client | `whitney.hall@example.test` | `deed-demo-2026` |

---

## Environment variables

| Var | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Public, RLS-gated |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Public, RLS-gated |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Used by seed script + signed-URL minter. Never expose to browser. |
| `NEXT_PUBLIC_SITE_URL` | Server | Production URL with no trailing slash (e.g. `https://app.deed.app`). Used to build invite share links. |
| `RESEND_API_KEY` | Server only | When unset, invite UX falls back to a copy-link prompt. |
| `RESEND_FROM_EMAIL` | Server only | Must match a verified Resend domain. |

---

## Migrations

Numbered files in `supabase/migrations/`. **Always run in order**, never edit a published migration — append a new one. Naming convention: `NNNN_phase_<letter>_<short_description>.sql`. Every migration is idempotent (`if not exists` / `create or replace`), so re-running is safe.

---

## Project structure

```
src/
  app/
    agent/        # Agent + admin surfaces (/agent/*)
    client/       # Client portal (/client/*)
    invite/       # /invite/[token] — invite acceptance flow
    login/        # /login
    layout.tsx    # Root layout, branding chain, fonts
    providers.tsx # BrandingProvider + ToastProvider
  components/
    agent/        # Agent-specific UI
    client/       # Client-specific UI
    shared/       # Cross-role UI (Sidebar, TopNav, modals, drawer)
    ui/           # Primitives (Button, Card, Icon, Toast, etc.)
  lib/
    actions/      # Next 16 server actions (auth + mutations)
    hooks/        # Client hooks (realtime, profile, branding)
    supabase/     # Server + browser Supabase clients, queries, types
    mailer/       # Resend adapter + invite email template
  proxy.ts        # Next 16 proxy (was middleware) — auth + role gates
supabase/
  migrations/     # All schema + RLS + RPC migrations
scripts/
  seed.ts         # Demo seed (dev only)
```

---

## Deployment

See the launch runbook for the full production deploy walkthrough (Supabase prod project, Resend domain verification, Vercel env vars, smoke tests, mobile QA).

Key reminders:
- **Never** run `npm run db:seed` against a production database.
- `NEXT_PUBLIC_SITE_URL` must be set in Vercel before invites are usable (otherwise share links default to `localhost:3000`).
- After changing any env var in Vercel, trigger a redeploy — env changes do not auto-redeploy.

---

## Brand direction

Luxury, modern, minimal, calm, trusted. Enterprise-grade real estate software. Voice is steady and structured; UI privileges whitespace, restrained typography (Newsreader serif + Inter sans), and a single gold accent. Color, copy, and motion should always feel like the calmest path through a complex transaction.
