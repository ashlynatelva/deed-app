/**
 * DEED demo seed.
 *
 * Migrates the existing mock dataset (Avery Chen + 6 clients + 6 transactions
 * + message threads + tasks + transaction-level updates + notifications) into
 * Supabase. Runs once via the service-role key, so RLS doesn't apply.
 *
 * Usage:
 *   1. Provision Supabase (Vercel Marketplace) — env vars land in .env.local.
 *   2. Apply migrations in supabase/migrations/* via Supabase SQL editor or
 *      `supabase db push` (Supabase CLI).
 *   3. Run: npm run db:seed
 *
 * Re-running is a no-op: the script checks for an existing "DEED" org and
 * exits early if seed has already run. To re-seed from scratch, drop the org
 * (deletes cascade) and re-run.
 *
 * NOTE: this script is server-only and never bundled with the app. The
 * service-role key must never reach the browser.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import type { Database, StageKey, StageState } from "../src/lib/supabase/database.types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Demo password used for every seeded auth user ────────────────────────
// Change once via the Supabase dashboard or auth.admin.updateUserById() if
// you're sharing the demo externally.
const DEMO_PASSWORD = "deed-demo-2026";

const log = (msg: string) => console.log(`  ${msg}`);

// ─── Idempotency guard ────────────────────────────────────────────────────
const findExistingOrg = async () => {
  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("name", "DEED")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const createUser = async (params: {
  email: string;
  fullName: string;
  role: "agent" | "client" | "admin";
}) => {
  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: params.fullName, role: params.role },
  });
  if (error) {
    // If the user already exists (e.g. partial prior seed), fetch by email.
    if (error.message.match(/already.*registered/i)) {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
      const existing = list.users.find((u) => u.email === params.email);
      if (existing) return existing;
    }
    throw error;
  }
  return data.user!;
};

// ─── Seed body ─────────────────────────────────────────────────────────────
async function seed() {
  console.log("→ Seeding DEED demo data…");

  if (await findExistingOrg()) {
    console.log("  Already seeded (DEED org exists). Skipping.");
    console.log("  To re-seed from scratch: delete the org via the dashboard, then re-run.");
    return;
  }

  // 1. Organization with the existing branding defaults.
  log("Creating organization…");
  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name: "DEED",
      support_phone: "(617) 555-0101",
      support_email: "support@deed.app",
      branding: {
        brokerageName: "DEED",
        supportPhone: "(617) 555-0101",
        supportEmail: "support@deed.app",
        welcomeMessage: "Hi {firstName}, welcome to your home journey.",
        welcomeSubtext: "We'll guide you through each step leading up to closing day.",
        inviteEmailIntro:
          "You've been invited to your secure portal. Your advisor will guide you through every step — uploading documents, signing paperwork, and tracking your closing.",
        footerText: "© DEED · A calmer way to buy and sell homes.",
        accent: "gold",
      },
    })
    .select()
    .single();
  if (orgErr) throw orgErr;
  const orgId = orgRow.id;

  // 2. Agent — Avery Chen.
  log("Creating agent (Avery Chen)…");
  const averyUser = await createUser({
    email: "avery@deed.test",
    fullName: "Avery Chen",
    role: "agent",
  });

  const { error: agentProfileErr } = await admin.from("profiles").insert({
    id: averyUser.id,
    organization_id: orgId,
    role: "agent",
    full_name: "Avery Chen",
    email: "avery@deed.test",
    phone: "(617) 555-0101",
    title: "Senior Advisor · DEED",
  });
  if (agentProfileErr) throw agentProfileErr;
  const agentId = averyUser.id;

  // 3. Clients.
  log("Creating clients…");
  const clientSeeds = [
    { fullName: "Whitney & Marcus Hall",  email: "whitney.hall@example.test", phone: "(617) 555-0142" },
    { fullName: "Priya Ramanathan",       email: "priya.r@example.test",      phone: "(617) 555-0188" },
    { fullName: "Jonathan & Eliza Vance", email: "j.vance@example.test",      phone: "(781) 555-0119" },
    { fullName: "Theo Park",              email: "theo.park@example.test",    phone: "(617) 555-0166" },
    { fullName: "Sarah & Devin Mitchell", email: "mitchell.s@example.test",   phone: "(617) 555-0173" },
    { fullName: "Aisha Bello",            email: "aisha.bello@example.test",  phone: "(978) 555-0144" },
  ];

  const clientIds: Record<string, string> = {};
  for (const c of clientSeeds) {
    const user = await createUser({
      email: c.email,
      fullName: c.fullName,
      role: "client",
    });
    const { error } = await admin.from("profiles").insert({
      id: user.id,
      organization_id: orgId,
      role: "client",
      full_name: c.fullName,
      email: c.email,
      phone: c.phone,
    });
    if (error) throw error;
    clientIds[c.email] = user.id;
    log(`  · ${c.fullName}`);
  }

  // ─── Transactions ────────────────────────────────────────────────────
  log("Creating transactions…");
  const txSeeds = [
    { key: "t1", clientEmail: "whitney.hall@example.test", address: "412 Linden Crescent",          city: "Brookline, MA 02446",        price: 1_295_000, type: "Buyer · Single-family", representation: "buyer_client",   stage: "appraisal",  closing: "2026-05-22", status: "on_track",        coAgent: "Daniel Park" },
    { key: "t2", clientEmail: "priya.r@example.test",      address: "78 Harborview Lane, Unit 4B",  city: "South End, Boston 02118",    price:   875_000, type: "Buyer · Condo",          representation: "buyer_client",   stage: "inspection", closing: "2026-06-12", status: "needs_attention", coAgent: null },
    { key: "t3", clientEmail: "j.vance@example.test",      address: "9 Cedar Hollow Road",          city: "Wellesley, MA 02482",        price: 2_450_000, type: "Buyer · Single-family",  representation: "buyer_client",   stage: "loan",       closing: "2026-05-30", status: "at_risk",         coAgent: null },
    { key: "t4", clientEmail: "theo.park@example.test",    address: "221 Beacon Street, Apt 12",    city: "Back Bay, Boston 02116",     price: 1_100_000, type: "Seller · Condo",         representation: "seller_client",  stage: "ctc",        closing: "2026-05-15", status: "on_track",        coAgent: null },
    { key: "t5", clientEmail: "mitchell.s@example.test",   address: "44 Marblehead Way",            city: "Newton, MA 02458",           price: 1_675_000, type: "Buyer · Single-family",  representation: "buyer_customer", stage: "contract",   closing: "2026-07-08", status: "on_track",        coAgent: null },
    { key: "t6", clientEmail: "aisha.bello@example.test",  address: "6 Old Mill Pond",              city: "Concord, MA 01742",          price: 1_390_000, type: "Buyer · Single-family",  representation: "buyer_client",   stage: "walk",       closing: "2026-05-09", status: "needs_attention", coAgent: null },
  ] as const;

  const txIds: Record<string, string> = {};
  for (const t of txSeeds) {
    const { data, error } = await admin
      .from("transactions")
      .insert({
        organization_id: orgId,
        agent_id: agentId,
        client_id: clientIds[t.clientEmail],
        address: t.address,
        city: t.city,
        price: t.price,
        type: t.type,
        representation: t.representation,
        stage_key: t.stage,
        closing: t.closing,
        status: t.status,
        listing_agent: "Avery Chen (DEED)",
        co_agent: t.coAgent,
      })
      .select()
      .single();
    if (error) throw error;
    txIds[t.key] = data.id;
  }

  // ─── Tx t1: curated stage detail (matches the existing mock) ───────────
  log("Painting Hall transaction (t1) timeline…");
  const t1 = txIds["t1"];
  const stageRows: Array<{ stage_key: StageKey; state: StageState; due: string | null; done: string | null; note: string }> = [
    { stage_key: "offer",      state: "done",     due: "2026-04-02", done: "2026-04-02", note: "Offer accepted at $1.295M, 18% down." },
    { stage_key: "contract",   state: "done",     due: "2026-04-05", done: "2026-04-04", note: "PSA signed by both parties." },
    { stage_key: "earnest",    state: "done",     due: "2026-04-08", done: "2026-04-07", note: "$25,000 wired to escrow." },
    { stage_key: "inspection", state: "done",     due: "2026-04-15", done: "2026-04-14", note: "Minor roof flashing repair requested." },
    { stage_key: "appraisal",  state: "current",  due: "2026-05-06", done: null,         note: "Scheduled May 6, 9:30am." },
    { stage_key: "loan",       state: "upcoming", due: "2026-05-13", done: null,         note: "" },
    { stage_key: "ctc",        state: "upcoming", due: "2026-05-18", done: null,         note: "" },
    { stage_key: "walk",       state: "upcoming", due: "2026-05-21", done: null,         note: "" },
    { stage_key: "closing",    state: "upcoming", due: "2026-05-22", done: null,         note: "Closing at Beacon Title, 11:00am." },
  ];
  for (const s of stageRows) {
    await admin
      .from("transaction_stages")
      .update({ state: s.state, due_date: s.due, done_date: s.done, note: s.note })
      .eq("transaction_id", t1)
      .eq("stage_key", s.stage_key);
  }

  // ─── Documents on t1 (metadata only; no actual files yet) ──────────────
  log("Seeding documents for t1…");
  const t1Client = clientIds["whitney.hall@example.test"];
  const docs = [
    { name: "Purchase & Sale Agreement",    who: "Both",   status: "reviewed",  updated: "2026-04-04", clientVisible: true,  uploadedByRole: "agent",  removable: false },
    { name: "Proof of Funds",                who: "Client", status: "reviewed",  updated: "2026-04-01", clientVisible: true,  uploadedByRole: "client", removable: false },
    { name: "Earnest Money Receipt",         who: "Agent",  status: "received",  updated: "2026-04-07", clientVisible: true,  uploadedByRole: "agent",  removable: false },
    { name: "Inspection Report",             who: "Agent",  status: "reviewed",  updated: "2026-04-14", clientVisible: true,  uploadedByRole: "agent",  removable: false },
    { name: "Homeowners Insurance Binder",   who: "Client", status: "needed",    updated: null,         clientVisible: true,  uploadedByRole: null,     removable: false, due: "2026-05-08" },
    { name: "Updated Bank Statement (April)",who: "Client", status: "submitted", updated: "2026-05-01", clientVisible: true,  uploadedByRole: "client", removable: true  },
    { name: "Appraisal Report",              who: "Agent",  status: "needed",    updated: null,         clientVisible: true,  uploadedByRole: "agent",  removable: false, due: "2026-05-09" },
    { name: "Insurance Binder",              who: "Client", status: "received",  updated: "2026-05-10", clientVisible: true,  uploadedByRole: "client", removable: true  },
    { name: "AVAD (Compliance)",             who: "Agent",  status: "reviewed",  updated: "2026-04-04", clientVisible: false, uploadedByRole: "agent",  removable: false },
    { name: "Affiliated Business Disclosure",who: "Agent",  status: "reviewed",  updated: "2026-04-04", clientVisible: false, uploadedByRole: "agent",  removable: false },
  ] as const;

  for (const d of docs) {
    const uploadedBy =
      d.uploadedByRole === "agent" ? agentId :
      d.uploadedByRole === "client" ? t1Client :
      null;
    await admin.from("documents").insert({
      transaction_id: t1,
      name: d.name,
      doc_type: d.name,
      who: d.who as "Client" | "Agent" | "Both",
      status: d.status,
      client_visible: d.clientVisible,
      removable_by_client: d.removable,
      uploaded_by: uploadedBy,
      uploaded_by_role: d.uploadedByRole as "agent" | "client" | null,
      updated_at: d.updated ?? new Date().toISOString(),
      due_date: ("due" in d ? d.due : null) ?? null,
    });
  }

  // ─── Message threads ─────────────────────────────────────────────────
  log("Seeding message threads…");
  type ThreadSeed = {
    txKey: keyof typeof txIds;
    clientEmail: string;
    subject: string;
    relatedProperty: string;
    status: "resolved" | "needs_response";
    messages: { who: "client" | "agent"; name: string; body: string; date: string }[];
  };
  const threadSeeds: ThreadSeed[] = [
    {
      txKey: "t1", clientEmail: "whitney.hall@example.test",
      subject: "Question on insurance binder",
      relatedProperty: "412 Linden Crescent",
      status: "resolved",
      messages: [
        { who: "client", name: "Whitney Hall", body: "Does the policy need to list the lender as additional insured? Want to make sure I send the right version.", date: "2026-05-02" },
        { who: "agent",  name: "Avery Chen",   body: "Yes — please ask your carrier to list First Beacon Mortgage as mortgagee. I'll forward you the exact wording.", date: "2026-05-02" },
      ],
    },
    {
      txKey: "t1", clientEmail: "whitney.hall@example.test",
      subject: "Final walkthrough timing",
      relatedProperty: "412 Linden Crescent",
      status: "needs_response",
      messages: [
        { who: "client", name: "Whitney Hall", body: "Can we do the walkthrough the morning of closing instead of the day before? I have a work conflict on the 13th.", date: "2026-04-29" },
      ],
    },
    {
      txKey: "t2", clientEmail: "priya.r@example.test",
      subject: "Earnest money confirmation",
      relatedProperty: "78 Harborview Lane, Unit 4B",
      status: "needs_response",
      messages: [
        { who: "client", name: "Priya Ramanathan", body: "I wired the earnest money this morning. Can you confirm escrow received it and let me know if you need the wire receipt?", date: "2026-04-30" },
      ],
    },
    {
      txKey: "t1", clientEmail: "whitney.hall@example.test",
      subject: "Roof repair confirmation",
      relatedProperty: "412 Linden Crescent",
      status: "resolved",
      messages: [
        { who: "client", name: "Whitney Hall", body: "Just confirming — did the seller agree to the flashing repair, or are we taking the credit?", date: "2026-04-22" },
        { who: "agent",  name: "Avery Chen",   body: "Credit of $1,800 at closing in lieu of repair, per addendum #2. I'll send the signed copy this afternoon.", date: "2026-04-23" },
        { who: "client", name: "Whitney Hall", body: "Got it — thanks for handling that quickly.", date: "2026-04-23" },
      ],
    },
    {
      txKey: "t1", clientEmail: "whitney.hall@example.test",
      subject: "Closing wire instructions",
      relatedProperty: "412 Linden Crescent",
      status: "resolved",
      messages: [
        { who: "client", name: "Whitney Hall", body: "When should I expect the wire instructions for the cash to close? I want to coordinate with my bank in advance.", date: "2026-04-26" },
        { who: "agent",  name: "Avery Chen",   body: "Title will send them directly 48 hours before closing through their secure portal. Always call the number on their website to verify before you wire — never trust an emailed change.", date: "2026-04-26" },
      ],
    },
    {
      txKey: "t2", clientEmail: "priya.r@example.test",
      subject: "Settlement statement request",
      relatedProperty: "78 Harborview Lane, Unit 4B",
      status: "resolved",
      messages: [
        { who: "client", name: "Priya Ramanathan", body: "Will I receive the settlement statement before closing day? My accountant wants to review the numbers.", date: "2026-04-24" },
        { who: "agent",  name: "Avery Chen",       body: "Yes — title will issue the preliminary CD 3 business days before closing. I'll forward as soon as it lands.", date: "2026-04-25" },
      ],
    },
  ];

  for (const t of threadSeeds) {
    const txId = txIds[t.txKey];
    const clientId = clientIds[t.clientEmail];
    const { data: thread, error: threadErr } = await admin
      .from("message_threads")
      .insert({
        transaction_id: txId,
        client_id: clientId,
        agent_id: agentId,
        subject: t.subject,
        related_property: t.relatedProperty,
        status: t.status,
      })
      .select()
      .single();
    if (threadErr) throw threadErr;

    // Insert each message with a small offset so created_at is monotonic.
    let i = 0;
    for (const m of t.messages) {
      const senderId = m.who === "agent" ? agentId : clientId;
      const { error: msgErr } = await admin.from("messages").insert({
        thread_id: thread.id,
        sender_id: senderId,
        sender_role: m.who,
        sender_name: m.name,
        body: m.body,
        read_by_agent: true,
        read_by_client: true,
        created_at: `${m.date}T12:0${i}:00.000Z`,
      });
      if (msgErr) throw msgErr;
      i += 1;
    }
  }

  // ─── Tasks (agent-only) ──────────────────────────────────────────────
  log("Seeding tasks…");
  const taskSeeds = [
    { title: "Confirm appraiser parking access",   tx: "t1", due: "2026-05-05", priority: "medium",   status: "progress", notes: "Building manager Joel — 415-555-0142.", reminder: true  },
    { title: "Request HOA documents from seller",  tx: "t1", due: "2026-05-10", priority: "high",     status: "waiting",  notes: "",                                       reminder: true  },
    { title: "Send weekly update — Hall file",     tx: "t1", due: "2026-05-02", priority: "low",      status: "done",     notes: "",                                       reminder: false },
    { title: "Order title search — Linden Crescent", tx: "t2", due: "2026-04-30", priority: "high",   status: "progress", notes: "Beacon Title — file #BC-22841.",         reminder: true  },
    { title: "Schedule pre-listing photography",   tx: "t4", due: "2026-05-04", priority: "medium",   status: "todo",     notes: "",                                       reminder: false },
    { title: "Review wire instructions w/ Marcus", tx: "t1", due: "2026-05-16", priority: "critical", status: "todo",     notes: "Confirm on phone, not email.",           reminder: true  },
    { title: "Follow up on Vance loan commitment", tx: "t3", due: "2026-05-12", priority: "critical", status: "waiting",  notes: "Lender requesting updated employment letter.", reminder: true },
  ] as const;
  for (const t of taskSeeds) {
    await admin.from("tasks").insert({
      organization_id: orgId,
      agent_id: agentId,
      transaction_id: txIds[t.tx as keyof typeof txIds],
      title: t.title,
      notes: t.notes,
      due_date: t.due,
      priority: t.priority,
      status: t.status,
      reminder: t.reminder,
      created_by: agentId,
    });
  }

  // ─── Transaction updates (advisor posts on t1) ───────────────────────
  log("Seeding transaction updates…");
  const updateSeeds = [
    { title: "Appraisal scheduled",          body: "The lender's appraiser will visit the property on May 6 at 9:30am. No action needed from you.",                     visible: true,  date: "2026-05-01T11:00:00Z" },
    { title: "Inspection items resolved",    body: "Seller has agreed to a $1,800 credit at closing for the roof flashing in lieu of repairs.",                          visible: true,  date: "2026-04-23T10:35:00Z" },
    { title: "Internal: title search ordered", body: "Ordered preliminary title from Beacon Title.",                                                                       visible: false, date: "2026-04-12T08:00:00Z" },
  ];
  for (const u of updateSeeds) {
    await admin.from("transaction_updates").insert({
      transaction_id: t1,
      author_id: agentId,
      title: u.title,
      body: u.body,
      visible: u.visible,
      created_at: u.date,
    });
  }

  // ─── Notifications ──────────────────────────────────────────────────
  log("Seeding notifications…");
  const agentNotifs = [
    { title: "Whitney Hall uploaded Insurance Binder",     detail: "412 Linden Crescent",                  href: `/agent/transactions/${t1}`, read: false, kind: "upload" },
    { title: "412 Linden Crescent has 1 overdue document", detail: "Settlement Statement",                  href: `/agent/transactions/${t1}`, read: false, kind: "deadline" },
    { title: "Final walkthrough is due tomorrow",          detail: "6 Old Mill Pond — Aisha Bello",         href: "/agent/tasks",              read: false, kind: "deadline" },
    { title: "Priya Ramanathan sent a message",            detail: "Earnest money confirmation",            href: "/agent/messages",           read: true,  kind: "message" },
    { title: "Theo Park uploaded a signed addendum",       detail: "221 Beacon Street, Apt 12",             href: "/agent/documents",          read: true,  kind: "upload" },
  ] as const;
  for (const n of agentNotifs) {
    await admin.from("notifications").insert({
      recipient_id: agentId,
      recipient_role: "agent",
      title: n.title,
      detail: n.detail,
      kind: n.kind,
      read: n.read,
      href: n.href,
    });
  }

  const clientNotifs = [
    { title: "Your appraisal has been scheduled",      detail: "May 6 at 9:30am",              href: "/client/updates",   read: false, kind: "update" },
    { title: "Insurance binder uploaded successfully", detail: "Avery is reviewing",           href: "/client/documents", read: false, kind: "upload" },
    { title: "New message from Avery Chen",            detail: "Re: Final walkthrough timing", href: "/client/messages",  read: false, kind: "message" },
    { title: "Loan approval expected May 13",          detail: "First Beacon Mortgage",        href: "/client/updates",   read: true,  kind: "update" },
  ] as const;
  for (const n of clientNotifs) {
    await admin.from("notifications").insert({
      recipient_id: t1Client,
      recipient_role: "client",
      title: n.title,
      detail: n.detail,
      kind: n.kind,
      read: n.read,
      href: n.href,
    });
  }

  log("Done.");
  console.log("\n→ Seed complete.");
  console.log("\n  Sign in with:");
  console.log(`    Agent  → avery@deed.test  (password: ${DEMO_PASSWORD})`);
  console.log(`    Client → whitney.hall@example.test  (same password)`);
  console.log("\n  Or any of the other client emails (priya.r, j.vance, theo.park, mitchell.s, aisha.bello @ example.test).");
}

seed().catch((err) => {
  console.error("\n✗ Seed failed:", err);
  process.exit(1);
});
// Generate a fresh randomUUID once to keep node:crypto imported; silence
// unused warning while we don't need explicit IDs (DB defaults them).
void randomUUID;
