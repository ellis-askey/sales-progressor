import { Prisma } from "@prisma/client";
import { commandDb } from "@/lib/command/prisma";

// Command Centre → Feature usage. A whole-platform view of which product
// features are actually getting used, ranked most-used to least-used, on
// surface tabs (client portal / agent app / solicitor / internal).
//
// There is no single "a feature was used" stream in this codebase (see
// docs/active/feature-usage/00-spec.md). So this is a REGISTRY: every feature
// declares metadata + a fetcher that knows which table backs it, and we
// normalise each to one metric shape. Each feature reads exactly one source, so
// nothing is double-counted. PostHog is dormant (no key), so we only ever read
// first-party DB rows.
//
// Deliberately does NOT re-plot raw portal visits / engaged-time (App adoption
// owns those) or the enquiries-chase experiment (its own page owns that).

// ─── Shared types ─────────────────────────────────────────────────────────────

export type Surface = "portal" | "agent" | "solicitor" | "internal";
export type AdopterUnit = "client" | "agent" | "firm" | "file" | "agency";
export type CommandPeriod = "all" | "30d" | "90d";

// One usage record, normalised. `at` is null for one-shot features that store a
// boolean flag with no reliable timestamp (e.g. "customised their overview").
type UsageRow = { at: Date | null; actor: string; agencyId: string | null };

export type FeatureMetric = {
  usesAllTime: number;
  usesInPeriod: number;
  adoptersAllTime: number;
  adoptersInPeriod: number;
  firstAt: Date | null;
  lastAt: Date | null;
  weekly: number[]; // length WEEKS, uses per week (oldest → newest)
  // True for features whose signal is a flag with no date, so period columns
  // can't be time-filtered — the UI shows the standing total instead of 0.
  undated: boolean;
};

export type FeatureRow = {
  id: string;
  name: string;
  surface: Surface;
  category: string;
  adopterUnit: AdopterUnit;
  blurb: string;
  metric: FeatureMetric;
};

export type FeatureFunnelStage = { label: string; value: number; hint?: string };

export type ByAgencyRow = { agencyId: string; agencyName: string; uses: number; adopters: number };

export type FeatureDetail = {
  id: string;
  name: string;
  surface: Surface;
  adopterUnit: AdopterUnit;
  blurb: string;
  metric: FeatureMetric;
  funnel: FeatureFunnelStage[] | null;
  byAgency: ByAgencyRow[];
  recent: { at: Date | null; actorLabel: string; agencyName: string }[];
};

export type FeatureUsageResult = {
  period: CommandPeriod;
  scopeLabel: string;
  agencyCount: number;
  transactionCount: number;
  features: FeatureRow[];
  weeks: Date[]; // week-start dates for the sparklines
};

const WEEKS = 12;

// ─── Scope ────────────────────────────────────────────────────────────────────

type Ctx = {
  txIds: string[];
  agencyIds: string[];
  txAgency: Map<string, string>; // transactionId → agencyId
  agencyName: Map<string, string>;
  since: Date | null; // period start (null = all time)
  weeks: Date[]; // WEEKS Monday starts, oldest → newest
  weekIndex: Map<number, number>; // week-start ms → index
};

export type FeaturePrefs = { mode: "sp" | "pm" | "combined"; agencyIds: string[] };

function weekStartOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const mondayOffset = (x.getDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0
  x.setDate(x.getDate() - mondayOffset);
  return x;
}

async function resolveCtx(prefs: FeaturePrefs, period: CommandPeriod): Promise<Ctx> {
  // Resolve the in-scope agencies. SP/PM map to agency modeProfile; a specific
  // agency selection overrides the mode. Internal/test agencies are always out.
  const agencyWhere: {
    isInternal: false;
    id?: { in: string[] };
    modeProfile?: "self_progressed" | "progressor_managed";
  } = { isInternal: false };
  if (prefs.agencyIds.length > 0) {
    agencyWhere.id = { in: prefs.agencyIds };
  } else if (prefs.mode === "sp") {
    agencyWhere.modeProfile = "self_progressed";
  } else if (prefs.mode === "pm") {
    agencyWhere.modeProfile = "progressor_managed";
  }

  const agencies = await commandDb.agency.findMany({
    where: agencyWhere,
    select: { id: true, name: true },
  });
  const agencyIds = agencies.map((a) => a.id);
  const agencyName = new Map(agencies.map((a) => [a.id, a.name] as const));

  // In-scope transactions (exclude demo showcase files).
  const txs = agencyIds.length
    ? await commandDb.propertyTransaction.findMany({
        where: { agencyId: { in: agencyIds }, isDemo: false },
        select: { id: true, agencyId: true },
      })
    : [];
  const txIds = txs.map((t) => t.id);
  const txAgency = new Map(txs.map((t) => [t.id, t.agencyId] as const));

  const now = new Date();
  const since =
    period === "30d"
      ? new Date(now.getTime() - 30 * 86400_000)
      : period === "90d"
        ? new Date(now.getTime() - 90 * 86400_000)
        : null;

  // 12 week-starts, oldest → newest, ending with the current week.
  const thisWeek = weekStartOf(now);
  const weeks: Date[] = [];
  const weekIndex = new Map<number, number>();
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);
    weekIndex.set(start.getTime(), weeks.length);
    weeks.push(start);
  }

  return { txIds, agencyIds, txAgency, agencyName, since, weeks, weekIndex };
}

// ─── Metric derivation ────────────────────────────────────────────────────────

function metricFrom(rows: UsageRow[], ctx: Ctx, undated: boolean): FeatureMetric {
  const weekly = new Array(WEEKS).fill(0);
  const allActors = new Set<string>();
  const periodActors = new Set<string>();
  let usesInPeriod = 0;
  let firstAt: Date | null = null;
  let lastAt: Date | null = null;

  for (const r of rows) {
    allActors.add(r.actor);
    if (undated || !r.at) {
      // No date signal — the row counts toward the standing total only. Period
      // filtering can't apply, so we treat every row as "in period".
      usesInPeriod++;
      periodActors.add(r.actor);
      continue;
    }
    if (!firstAt || r.at < firstAt) firstAt = r.at;
    if (!lastAt || r.at > lastAt) lastAt = r.at;
    if (!ctx.since || r.at >= ctx.since) {
      usesInPeriod++;
      periodActors.add(r.actor);
    }
    const wi = ctx.weekIndex.get(weekStartOf(r.at).getTime());
    if (wi != null) weekly[wi]++;
  }

  return {
    usesAllTime: rows.length,
    usesInPeriod,
    adoptersAllTime: allActors.size,
    adoptersInPeriod: periodActors.size,
    firstAt,
    lastAt,
    weekly,
    undated,
  };
}

// ─── The registry ─────────────────────────────────────────────────────────────

type FeatureDef = {
  id: string;
  name: string;
  surface: Surface;
  category: string;
  adopterUnit: AdopterUnit;
  blurb: string;
  undated?: boolean;
  // Returns every usage record in scope, normalised.
  fetch: (ctx: Ctx) => Promise<UsageRow[]>;
  // Optional funnel for the drill-down (computed on demand).
  funnel?: (ctx: Ctx) => Promise<FeatureFunnelStage[]>;
};

// Helper: map a transactionId to its agency for row attribution.
const agOf = (ctx: Ctx, txId: string | null | undefined) =>
  txId ? ctx.txAgency.get(txId) ?? null : null;

export const FEATURES: FeatureDef[] = [
  // ── CLIENT PORTAL ──────────────────────────────────────────────────────────
  {
    id: "followup_email",
    name: "Email your conveyancer",
    surface: "portal",
    category: "Communication",
    adopterUnit: "client",
    blurb: "Client taps the prefilled follow-up to email their solicitor (we're CC'd).",
    async fetch(ctx) {
      const taps = await commandDb.followupTap.findMany({
        where: { transactionId: { in: ctx.txIds } },
        select: { transactionId: true, contactId: true, side: true, tappedAt: true },
      });
      return taps.map((t) => ({
        at: t.tappedAt,
        actor: t.contactId ?? `${t.transactionId}:${t.side}`,
        agencyId: agOf(ctx, t.transactionId),
      }));
    },
    // Opened → sent, the original page's core value. "Sent" = a CC'd copy of
    // their email to the conveyancer filed back to the file by the inbox sync.
    // We can't see it if they strip the CC, so it's a floor, not a ceiling.
    async funnel(ctx) {
      const taps = await commandDb.followupTap.findMany({
        where: { transactionId: { in: ctx.txIds } },
        select: { transactionId: true, contactId: true, tappedAt: true },
      });
      const byContact = new Map<string, { transactionId: string; earliest: Date }>();
      for (const t of taps) {
        if (!t.contactId) continue;
        const g = byContact.get(t.contactId);
        if (!g) byContact.set(t.contactId, { transactionId: t.transactionId, earliest: t.tappedAt });
        else if (t.tappedAt < g.earliest) g.earliest = t.tappedAt;
      }
      let sent = 0;
      for (const [contactId, g] of byContact) {
        const c = await commandDb.contact.findUnique({ where: { id: contactId }, select: { email: true } });
        if (!c?.email) continue;
        const inbound = await commandDb.outboundMessage.findFirst({
          where: {
            transactionId: g.transactionId,
            type: "inbound",
            recipientEmail: { equals: c.email, mode: "insensitive" },
            sentAt: { gte: g.earliest },
          },
          select: { id: true },
        });
        if (inbound) sent++;
      }
      return [
        { label: "Tapped", value: taps.length },
        { label: "People who tapped", value: byContact.size },
        { label: "Sent one", value: sent, hint: "a CC'd copy was filed to the file" },
      ];
    },
  },
  {
    id: "client_confirm_step",
    name: "Confirm a step (client)",
    surface: "portal",
    category: "Progress",
    adopterUnit: "client",
    blurb: "Client confirms a milestone or sets a date from their own portal.",
    async fetch(ctx) {
      const rows = await commandDb.milestoneCompletion.findMany({
        where: { transactionId: { in: ctx.txIds }, confirmedByPortal: true },
        select: { transactionId: true, confirmedByContactId: true, completedAt: true },
      });
      return rows.map((r) => ({
        at: r.completedAt,
        actor: r.confirmedByContactId ?? r.transactionId,
        agencyId: agOf(ctx, r.transactionId),
      }));
    },
  },
  {
    id: "portal_message",
    name: "Message the agent",
    surface: "portal",
    category: "Communication",
    adopterUnit: "client",
    blurb: "Client sends a message to the file owner from the portal.",
    async fetch(ctx) {
      const rows = await commandDb.portalMessage.findMany({
        where: { transactionId: { in: ctx.txIds }, fromClient: true },
        select: { transactionId: true, contactId: true, createdAt: true },
      });
      return rows.map((r) => ({ at: r.createdAt, actor: r.contactId, agencyId: agOf(ctx, r.transactionId) }));
    },
  },
  {
    id: "portal_doc_upload",
    name: "Upload a document",
    surface: "portal",
    category: "Documents",
    adopterUnit: "file",
    blurb: "Client uploads a document or photo through the portal.",
    async fetch(ctx) {
      const rows = await commandDb.transactionDocument.findMany({
        where: { transactionId: { in: ctx.txIds }, source: "portal" },
        select: { transactionId: true, contactId: true, createdAt: true },
      });
      return rows.map((r) => ({
        at: r.createdAt,
        actor: r.contactId ?? r.transactionId,
        agencyId: agOf(ctx, r.transactionId),
      }));
    },
  },
  {
    id: "quote_request",
    name: "Request a quote",
    surface: "portal",
    category: "Money & quotes",
    adopterUnit: "client",
    blurb: "Client requests a survey or broker quote through the portal flow.",
    async fetch(ctx) {
      const rows = await commandDb.quoteRequest.findMany({
        where: { transactionId: { in: ctx.txIds } },
        select: { transactionId: true, contactId: true, submittedAt: true },
      });
      return rows.map((r) => ({ at: r.submittedAt, actor: r.contactId, agencyId: agOf(ctx, r.transactionId) }));
    },
    async funnel(ctx) {
      const rows = await commandDb.quoteRequest.findMany({
        where: { transactionId: { in: ctx.txIds } },
        select: { status: true },
      });
      const requested = rows.length;
      const booked = rows.filter((r) => r.status === "booked" || r.status === "won").length;
      const won = rows.filter((r) => r.status === "won").length;
      return [
        { label: "Requested", value: requested },
        { label: "Booked", value: booked, hint: "client chose one of our firms" },
        { label: "Won", value: won, hint: "referral fee earned" },
      ];
    },
  },
  {
    id: "explain_email",
    name: "Explain my email (AI)",
    surface: "portal",
    category: "AI",
    adopterUnit: "file",
    blurb: "Client asks the assistant to explain an email in plain English.",
    async fetch(ctx) {
      const rows = await commandDb.outboundMessage.findMany({
        where: {
          transactionId: { in: ctx.txIds },
          type: "internal_note",
          content: { startsWith: "[AI explain-email]" },
        },
        select: { transactionId: true, createdAt: true },
      });
      return rows.map((r) => ({
        at: r.createdAt,
        actor: r.transactionId ?? "unknown",
        agencyId: agOf(ctx, r.transactionId),
      }));
    },
  },
  {
    id: "give_authority",
    name: "Give authority to exchange",
    surface: "portal",
    category: "Progress",
    adopterUnit: "client",
    blurb: "Client confirms on exchange day that their solicitor may exchange.",
    async fetch(ctx) {
      const rows = await commandDb.contact.findMany({
        where: { propertyTransactionId: { in: ctx.txIds }, exchangeAuthorityGivenAt: { not: null } },
        select: { id: true, propertyTransactionId: true, exchangeAuthorityGivenAt: true },
      });
      return rows.map((r) => ({
        at: r.exchangeAuthorityGivenAt,
        actor: r.id,
        agencyId: agOf(ctx, r.propertyTransactionId),
      }));
    },
  },
  {
    id: "onward_report",
    name: "Report onward purchase",
    surface: "portal",
    category: "Progress",
    adopterUnit: "client",
    blurb: "Seller reports progress on the property they're buying (shadow tracker).",
    async fetch(ctx) {
      const rows = await commandDb.onwardStepConfirmation.findMany({
        where: { tracker: { transactionId: { in: ctx.txIds } }, confirmedByContactId: { not: null } },
        select: { confirmedByContactId: true, confirmedAt: true, tracker: { select: { transactionId: true } } },
      });
      return rows.map((r) => ({
        at: r.confirmedAt,
        actor: r.confirmedByContactId ?? "unknown",
        agencyId: agOf(ctx, r.tracker.transactionId),
      }));
    },
  },
  {
    id: "enable_push",
    name: "Turn on notifications",
    surface: "portal",
    category: "Onboarding",
    adopterUnit: "client",
    blurb: "Client enables portal push notifications.",
    async fetch(ctx) {
      const rows = await commandDb.portalPushSubscription.findMany({
        where: { contact: { propertyTransactionId: { in: ctx.txIds } } },
        select: { contactId: true, createdAt: true, contact: { select: { propertyTransactionId: true } } },
      });
      return rows.map((r) => ({
        at: r.createdAt,
        actor: r.contactId,
        agencyId: agOf(ctx, r.contact.propertyTransactionId),
      }));
    },
  },
  {
    id: "broker_callback",
    name: "Request a broker call-back",
    surface: "portal",
    category: "Money & quotes",
    adopterUnit: "client",
    blurb: "Buyer requests a mortgage-broker call-back from the portal card.",
    async fetch(ctx) {
      const rows = await commandDb.contact.findMany({
        where: { propertyTransactionId: { in: ctx.txIds }, brokerCallbackRequestedAt: { not: null } },
        select: { id: true, propertyTransactionId: true, brokerCallbackRequestedAt: true },
      });
      return rows.map((r) => ({
        at: r.brokerCallbackRequestedAt,
        actor: r.id,
        agencyId: agOf(ctx, r.propertyTransactionId),
      }));
    },
  },
  {
    id: "customise_overview",
    name: "Customise their overview",
    surface: "portal",
    category: "Onboarding",
    adopterUnit: "client",
    blurb: "Client reorders or hides cards on their portal home.",
    undated: true,
    async fetch(ctx) {
      const rows = await commandDb.contact.findMany({
        where: { propertyTransactionId: { in: ctx.txIds }, overviewLayout: { not: Prisma.DbNull } },
        select: { id: true, propertyTransactionId: true },
      });
      return rows.map((r) => ({ at: null, actor: r.id, agencyId: agOf(ctx, r.propertyTransactionId) }));
    },
  },
  {
    id: "profile_photo",
    name: "Add a profile photo",
    surface: "portal",
    category: "Onboarding",
    adopterUnit: "client",
    blurb: "Client uploads their own profile photo.",
    undated: true,
    async fetch(ctx) {
      const rows = await commandDb.contact.findMany({
        where: { propertyTransactionId: { in: ctx.txIds }, image: { not: null } },
        select: { id: true, propertyTransactionId: true },
      });
      return rows.map((r) => ({ at: null, actor: r.id, agencyId: agOf(ctx, r.propertyTransactionId) }));
    },
  },
  {
    id: "appearance_settings",
    name: "Change appearance",
    surface: "portal",
    category: "Onboarding",
    adopterUnit: "client",
    blurb: "Client sets theme, text size, accent or accessibility options.",
    undated: true,
    async fetch(ctx) {
      const rows = await commandDb.contact.findMany({
        where: { propertyTransactionId: { in: ctx.txIds }, portalSettings: { not: Prisma.DbNull } },
        select: { id: true, propertyTransactionId: true },
      });
      return rows.map((r) => ({ at: null, actor: r.id, agencyId: agOf(ctx, r.propertyTransactionId) }));
    },
  },

  // ── SOLICITOR ────────────────────────────────────────────────────────────────
  {
    id: "solicitor_confirm_step",
    name: "Confirm a step (solicitor)",
    surface: "solicitor",
    category: "Progress",
    adopterUnit: "firm",
    blurb: "A solicitor confirms a milestone done via their /s/ link.",
    async fetch(ctx) {
      const rows = await commandDb.milestoneCompletion.findMany({
        where: { transactionId: { in: ctx.txIds }, confirmedBySolicitorFirmId: { not: null } },
        select: { transactionId: true, confirmedBySolicitorFirmId: true, completedAt: true },
      });
      return rows.map((r) => ({
        at: r.completedAt,
        actor: r.confirmedBySolicitorFirmId ?? r.transactionId,
        agencyId: agOf(ctx, r.transactionId),
      }));
    },
  },
  {
    id: "solicitor_update",
    name: "Leave an update (solicitor)",
    surface: "solicitor",
    category: "Communication",
    adopterUnit: "file",
    blurb: "A solicitor leaves a written update via their /s/ link.",
    async fetch(ctx) {
      const rows = await commandDb.outboundMessage.findMany({
        where: {
          transactionId: { in: ctx.txIds },
          type: "internal_note",
          subject: { startsWith: "Update from " },
        },
        select: { transactionId: true, createdAt: true },
      });
      return rows.map((r) => ({
        at: r.createdAt,
        actor: r.transactionId ?? "unknown",
        agencyId: agOf(ctx, r.transactionId),
      }));
    },
  },
  {
    id: "enquiries_solicitor_reply",
    name: "Reply on enquiries (solicitor)",
    surface: "solicitor",
    category: "Progress",
    adopterUnit: "file",
    blurb: "A solicitor replies or gives a date on the enquiries loop via their /s/ link.",
    async fetch(ctx) {
      const rows = await commandDb.enquiryMovement.findMany({
        where: { tracker: { transactionId: { in: ctx.txIds } }, source: "solicitor_reply" },
        select: { trackerId: true, occurredAt: true, tracker: { select: { transactionId: true } } },
      });
      return rows.map((r) => ({
        at: r.occurredAt,
        actor: r.tracker.transactionId,
        agencyId: agOf(ctx, r.tracker.transactionId),
      }));
    },
  },

  // ── AGENT APP ──────────────────────────────────────────────────────────────
  {
    id: "create_sale",
    name: "Start a sale",
    surface: "agent",
    category: "Progress",
    adopterUnit: "agent",
    blurb: "An agent creates a new sale file.",
    async fetch(ctx) {
      const rows = await commandDb.event.findMany({
        where: { type: "transaction_created", agencyId: { in: ctx.agencyIds }, isInternalUser: false },
        select: { agencyId: true, userId: true, occurredAt: true },
      });
      return rows.map((r) => ({ at: r.occurredAt, actor: r.userId ?? r.agencyId ?? "unknown", agencyId: r.agencyId }));
    },
  },
  {
    id: "confirm_milestone_agent",
    name: "Confirm a milestone (agent)",
    surface: "agent",
    category: "Progress",
    adopterUnit: "agent",
    blurb: "An agent confirms a milestone in the file.",
    async fetch(ctx) {
      const rows = await commandDb.event.findMany({
        where: { type: "milestone_confirmed", agencyId: { in: ctx.agencyIds }, isInternalUser: false },
        select: { agencyId: true, userId: true, occurredAt: true },
      });
      return rows.map((r) => ({ at: r.occurredAt, actor: r.userId ?? r.agencyId ?? "unknown", agencyId: r.agencyId }));
    },
  },
  {
    id: "send_chase",
    name: "Send a chase",
    surface: "agent",
    category: "Communication",
    adopterUnit: "agent",
    blurb: "An agent sends (or fires an automated) chase email.",
    async fetch(ctx) {
      const rows = await commandDb.event.findMany({
        where: { type: "chase_sent", agencyId: { in: ctx.agencyIds }, isInternalUser: false },
        select: { agencyId: true, userId: true, occurredAt: true },
      });
      return rows.map((r) => ({ at: r.occurredAt, actor: r.userId ?? r.agencyId ?? "unknown", agencyId: r.agencyId }));
    },
  },
  {
    id: "agent_doc_upload",
    name: "Upload a document (agent)",
    surface: "agent",
    category: "Documents",
    adopterUnit: "file",
    blurb: "An agent uploads a document to a file.",
    async fetch(ctx) {
      const rows = await commandDb.transactionDocument.findMany({
        where: { transactionId: { in: ctx.txIds }, source: "agent" },
        select: { transactionId: true, createdAt: true },
      });
      return rows.map((r) => ({ at: r.createdAt, actor: r.transactionId, agencyId: agOf(ctx, r.transactionId) }));
    },
  },
  {
    id: "enquiry_tracker_agent",
    name: "Log an enquiry movement",
    surface: "agent",
    category: "Progress",
    adopterUnit: "agent",
    blurb: "An agent logs a movement on the enquiries tracker.",
    async fetch(ctx) {
      const rows = await commandDb.enquiryMovement.findMany({
        where: { tracker: { transactionId: { in: ctx.txIds } }, createdByUserId: { not: null } },
        select: { createdByUserId: true, occurredAt: true, tracker: { select: { transactionId: true } } },
      });
      return rows.map((r) => ({
        at: r.occurredAt,
        actor: r.createdByUserId ?? "unknown",
        agencyId: agOf(ctx, r.tracker.transactionId),
      }));
    },
  },
  {
    id: "send_quote_link",
    name: "Send a quote link",
    surface: "agent",
    category: "Money & quotes",
    adopterUnit: "file",
    blurb: "An agent sends the survey/broker quote link to a buyer.",
    async fetch(ctx) {
      const rows = await commandDb.outboundMessage.findMany({
        where: {
          transactionId: { in: ctx.txIds },
          type: "internal_note",
          content: { startsWith: "Sent survey quote link" },
        },
        select: { transactionId: true, createdAt: true },
      });
      return rows.map((r) => ({
        at: r.createdAt,
        actor: r.transactionId ?? "unknown",
        agencyId: agOf(ctx, r.transactionId),
      }));
    },
  },
  {
    id: "feedback",
    name: "Send feedback",
    surface: "agent",
    category: "Communication",
    adopterUnit: "agent",
    blurb: "A user submits in-app feedback.",
    async fetch(ctx) {
      const rows = await commandDb.feedbackSubmission.findMany({
        where: { agencyId: { in: ctx.agencyIds } },
        select: { agencyId: true, userId: true, userEmail: true, createdAt: true },
      });
      return rows.map((r) => ({
        at: r.createdAt,
        actor: r.userId ?? r.userEmail ?? "unknown",
        agencyId: r.agencyId,
      }));
    },
  },

  // ── INTERNAL ─────────────────────────────────────────────────────────────────
  {
    id: "ai_proposal_approved",
    name: "Approve an AI proposal",
    surface: "internal",
    category: "AI",
    adopterUnit: "file",
    blurb: "An AI-suggested file update (from a synced email) is approved.",
    async fetch(ctx) {
      const rows = await commandDb.milestoneProposal.findMany({
        where: { transactionId: { in: ctx.txIds }, status: "approved" },
        select: { transactionId: true, decidedById: true, decidedAt: true },
      });
      return rows.map((r) => ({
        at: r.decidedAt,
        actor: r.decidedById ?? r.transactionId,
        agencyId: agOf(ctx, r.transactionId),
      }));
    },
  },
];

// ─── Orchestrators ────────────────────────────────────────────────────────────

function scopeLabel(prefs: FeaturePrefs): string {
  if (prefs.agencyIds.length > 0) return `${prefs.agencyIds.length} agency${prefs.agencyIds.length > 1 ? "ies" : ""}`;
  if (prefs.mode === "sp") return "Self-managed";
  if (prefs.mode === "pm") return "Outsourced";
  return "All agencies";
}

export async function getFeatureUsage(prefs: FeaturePrefs, period: CommandPeriod): Promise<FeatureUsageResult> {
  const ctx = await resolveCtx(prefs, period);

  const features = await Promise.all(
    FEATURES.map(async (def): Promise<FeatureRow> => {
      const rows = await def.fetch(ctx);
      return {
        id: def.id,
        name: def.name,
        surface: def.surface,
        category: def.category,
        adopterUnit: def.adopterUnit,
        blurb: def.blurb,
        metric: metricFrom(rows, ctx, def.undated ?? false),
      };
    }),
  );

  return {
    period,
    scopeLabel: scopeLabel(prefs),
    agencyCount: ctx.agencyIds.length,
    transactionCount: ctx.txIds.length,
    features,
    weeks: ctx.weeks,
  };
}

export async function getFeatureDetail(
  featureId: string,
  prefs: FeaturePrefs,
  period: CommandPeriod,
): Promise<FeatureDetail | null> {
  const def = FEATURES.find((f) => f.id === featureId);
  if (!def) return null;
  const ctx = await resolveCtx(prefs, period);
  const rows = await def.fetch(ctx);
  const metric = metricFrom(rows, ctx, def.undated ?? false);

  // By-agency split — uses + distinct adopters per agency (worst-adopted last).
  const byAgencyMap = new Map<string, { uses: number; adopters: Set<string> }>();
  for (const r of rows) {
    const key = r.agencyId ?? "—";
    const g = byAgencyMap.get(key) ?? { uses: 0, adopters: new Set<string>() };
    g.uses++;
    g.adopters.add(r.actor);
    byAgencyMap.set(key, g);
  }
  const byAgency: ByAgencyRow[] = [...byAgencyMap.entries()]
    .map(([agencyId, g]) => ({
      agencyId,
      agencyName: ctx.agencyName.get(agencyId) ?? "Unknown",
      uses: g.uses,
      adopters: g.adopters.size,
    }))
    .sort((a, b) => b.uses - a.uses);

  // Recent activity — last 8 dated rows.
  const recent = rows
    .filter((r) => r.at)
    .sort((a, b) => (b.at as Date).getTime() - (a.at as Date).getTime())
    .slice(0, 8)
    .map((r) => ({
      at: r.at,
      actorLabel: r.actor,
      agencyName: r.agencyId ? ctx.agencyName.get(r.agencyId) ?? "Unknown" : "—",
    }));

  const funnel = def.funnel ? await def.funnel(ctx) : null;

  return {
    id: def.id,
    name: def.name,
    surface: def.surface,
    adopterUnit: def.adopterUnit,
    blurb: def.blurb,
    metric,
    funnel,
    byAgency,
    recent,
  };
}

// Human label for a surface tab.
export const SURFACE_LABELS: Record<Surface, string> = {
  portal: "Client portal",
  agent: "Agent app",
  solicitor: "Solicitor",
  internal: "Internal",
};

// Plural noun for an adopter unit, given a count.
export function adopterNoun(unit: AdopterUnit, n: number): string {
  const one = n === 1;
  switch (unit) {
    case "client": return one ? "client" : "clients";
    case "agent": return one ? "agent" : "agents";
    case "firm": return one ? "firm" : "firms";
    case "agency": return one ? "agency" : "agencies";
    case "file": return one ? "file" : "files";
  }
}
