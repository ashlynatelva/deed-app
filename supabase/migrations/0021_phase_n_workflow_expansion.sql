-- ─────────────────────────────────────────────────────────────────────────────
-- Phase N — Workflow expansion (transactions + documents).
--
-- Extends DEED beyond residential purchase/sale into leasing, onboarding,
-- and signing workflows. All changes are additive: existing rows + UI
-- continue to work; new fields are opt-in.
--
-- Sections:
--   1. Extend stage_key constraint (transactions + transaction_stages)
--   2. transactions: client_type + rental_price columns
--   3. documents.status: 4 new signing statuses
--   4. documents.doc_category: controlled-vocab column (kept alongside
--      legacy free-text doc_type for backward compat)
--   5. documents: vendor-neutral signing scaffolding columns
--   6. Workflow-aware bootstrap_transaction_stages trigger
--   7. notify pgrst
--
-- Idempotency: every alter uses `add column if not exists`, every
-- constraint is dropped + recreated by name, every function uses
-- `create or replace`. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Extend stage_key constraint on transactions + transaction_stages ───
-- The original constraint allowed 9 sale stages. Adding 6 more:
--   listing_onboarding, buyer_onboarding   — pre-offer / pre-listing
--   credit_repair                           — lender-stage variant
--   frame                                   — construction milestone
--   lease_signed, occupancy                 — leasing terminal stages
alter table public.transactions
  drop constraint if exists transactions_stage_key_check;
alter table public.transactions
  add constraint transactions_stage_key_check
  check (stage_key in (
    'offer','contract','earnest','inspection','appraisal','loan','ctc','walk','closing',
    'listing_onboarding','buyer_onboarding','credit_repair','frame','lease_signed','occupancy'
  ));

alter table public.transaction_stages
  drop constraint if exists transaction_stages_stage_key_check;
alter table public.transaction_stages
  add constraint transaction_stages_stage_key_check
  check (stage_key in (
    'offer','contract','earnest','inspection','appraisal','loan','ctc','walk','closing',
    'listing_onboarding','buyer_onboarding','credit_repair','frame','lease_signed','occupancy'
  ));


-- ─── 2. transactions: client_type + rental_price ───────────────────────────
-- `client_type` is the new primary signal for which workflow a transaction
-- belongs to. It drives:
--   - the bootstrap trigger's choice of stage array
--   - whether the UI shows Sale price vs Rental price
--   - the dashboard's KPI grouping (future)
-- `representation` (buyer_client / buyer_customer / seller_client /
-- seller_customer) stays as-is — it's still the right way to express
-- buy-side agency for sale transactions. For tenant transactions
-- representation is simply null.
alter table public.transactions
  add column if not exists client_type text
    check (client_type in ('buyer','seller','commercial_tenant','residential_tenant'));

-- Monthly rent in whole dollars. Null for sale workflows.
alter table public.transactions
  add column if not exists rental_price bigint
    check (rental_price is null or rental_price >= 0);

-- Backfill client_type for existing rows from representation. Buyer_*
-- → 'buyer', seller_* → 'seller', null → 'buyer' (safe default; the
-- agent can edit via the new Edit transaction modal).
update public.transactions
   set client_type = case
     when representation in ('buyer_client','buyer_customer')   then 'buyer'
     when representation in ('seller_client','seller_customer') then 'seller'
     else 'buyer'
   end
 where client_type is null;


-- ─── 3. documents.status: extend with signing statuses ─────────────────────
-- Adds 4 new statuses for the signing workflow. The existing 5 (needed,
-- submitted, received, reviewed, revision) are preserved verbatim.
alter table public.documents
  drop constraint if exists documents_status_check;
alter table public.documents
  add constraint documents_status_check
  check (status in (
    'needed','submitted','received','reviewed','revision',
    'awaiting_signature','signed','rejected','expired'
  ));


-- ─── 4. documents.doc_category: controlled vocab ──────────────────────────
-- Kept alongside the legacy free-text `doc_type` for backward compat.
-- New uploads write `doc_category`; old rows with `doc_type` keep their
-- free-text labels. A future migration can drop `doc_type` once every
-- read path uses `doc_category`.
alter table public.documents
  add column if not exists doc_category text
    check (doc_category in (
      'purchase_agreement','lease_agreement','loan_documents',
      'inspection_reports','id_verification','hoa_docs',
      'closing_disclosures','other'
    ));


-- ─── 5. documents: vendor-neutral signing scaffolding ─────────────────────
-- These columns are populated when an e-signature flow is initiated.
-- Today no app code writes them — they exist so the schema is ready
-- when DocuSign / Dropbox Sign / etc. is wired in post-beta. The
-- `audit_trail` jsonb is an append-only event log; even before vendor
-- integration we can write app-level events (uploaded, viewed,
-- visibility changed) for compliance.
alter table public.documents
  add column if not exists signature_provider text
    check (signature_provider is null or signature_provider in ('docusign','dropbox_sign'));
alter table public.documents
  add column if not exists signature_envelope_id text;
alter table public.documents
  add column if not exists signature_requested_at timestamptz;
alter table public.documents
  add column if not exists signed_at timestamptz;
alter table public.documents
  add column if not exists signer_id uuid references public.profiles(id) on delete set null;
alter table public.documents
  add column if not exists audit_trail jsonb not null default '[]'::jsonb;

create index if not exists documents_signer_id_idx on public.documents(signer_id)
  where signer_id is not null;


-- ─── 6. Workflow-aware bootstrap_transaction_stages trigger ────────────────
-- Replaces the version from 0007. The trigger now picks the per-workflow
-- stage array based on `client_type`:
--
--   'buyer'                          → buyer_onboarding + 9 sale stages
--   'seller'                         → listing_onboarding + 9 sale stages
--   'commercial_tenant' /
--   'residential_tenant'             → lease_signed, occupancy
--   null / unknown                   → legacy 9 sale stages (back-compat)
--
-- 'credit_repair' and 'frame' are cross-cutting (could apply to any
-- workflow) and intentionally NOT auto-seeded. Agents can set those
-- values on transactions.stage_key directly; the timeline won't show
-- a row for them. Workflow-specific timeline polish is a post-beta
-- item.
create or replace function public.bootstrap_transaction_stages()
returns trigger
language plpgsql
as $$
declare
  s_key        text;
  s_pos        smallint := 1;
  current_pos  smallint;
  stages       text[];
begin
  if new.client_type in ('commercial_tenant', 'residential_tenant') then
    stages := array['lease_signed', 'occupancy'];
  elsif new.client_type = 'seller' then
    stages := array[
      'listing_onboarding',
      'offer','contract','earnest','inspection','appraisal','loan','ctc','walk','closing'
    ];
  elsif new.client_type = 'buyer' then
    stages := array[
      'buyer_onboarding',
      'offer','contract','earnest','inspection','appraisal','loan','ctc','walk','closing'
    ];
  else
    stages := array[
      'offer','contract','earnest','inspection','appraisal','loan','ctc','walk','closing'
    ];
  end if;

  current_pos := array_position(stages, new.stage_key);
  if current_pos is null then current_pos := 0; end if;

  foreach s_key in array stages loop
    insert into public.transaction_stages (transaction_id, stage_key, state, position)
    values (
      new.id, s_key,
      case
        when s_pos < current_pos then 'done'
        when s_pos = current_pos then 'current'
        else 'upcoming'
      end,
      s_pos
    );
    s_pos := s_pos + 1;
  end loop;
  return new;
end;
$$;


-- ─── 7. PostgREST schema cache reload ──────────────────────────────────────
notify pgrst, 'reload schema';
