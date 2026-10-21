// lib/command/businesses.ts
//
// Command Centre read model for the external Sales Progression businesses.
// Pure reads — it surfaces what the existing billing/dunning logic already
// computes (lib/progression/*) so the founder can see each business, the income
// it pays TSP and its payment health. Command-only (Law 8): the ProgressionBusiness
// queries go through commandDb; the per-business figures reuse the shared billing
// helpers. Nothing here writes or touches Stripe beyond a read of the cancel
// schedule.

import { commandDb } from "@/lib/command/prisma";
import {
  getBusinessBillingSummary,
  type BusinessBillingSummary,
} from "@/lib/progression/business-billing";
import {
  getBusinessPaymentState,
  type BusinessPaymentState,
} from "@/lib/progression/business-dunning";
import { getBusinessPlanSchedule } from "@/lib/progression/business-stripe";
import { parseFeeModel, feeModelSummary } from "@/lib/progression/client-fees";
import { londonDateStr } from "@/lib/services/metrics-rollup";

// A business's at-a-glance health. "no_card" = exists but hasn't set up billing
// yet (no subscription); "live" = subscribed and paying; the other two are the
// dunning states.
export type BusinessStatus = "live" | "no_card" | "payment_failed" | "blocked";

function deriveStatus(state: BusinessPaymentState, subscribed: boolean): BusinessStatus {
  if (state.kind === "blocked") return "blocked";
  if (state.kind === "warning") return "payment_failed";
  return subscribed ? "live" : "no_card";
}

// Problems first, then biggest earners — the order the founder wants to scan in.
const STATUS_ORDER: Record<BusinessStatus, number> = { blocked: 0, payment_failed: 1, live: 2, no_card: 3 };

export type BusinessOverviewRow = {
  id: string;
  name: string;
  shortName: string | null;
  senderVerified: boolean;
  subscribed: boolean;
  clientCount: number;    // active client agencies (removedAt null)
  memberCount: number;    // active members incl. owner
  mrrPence: number;       // recurring: base + seats
  saleCount: number;      // sales charged this month (billed on add OR on exchange)
  perSalePence: number;   // £5 × this month's charged sales
  addedSaleCount: number;       // of saleCount: billed on ADD (organic)
  migratedBilledCount: number;  // of saleCount: migrated files that exchanged this month
  pendingMigratedCount: number; // migrated files not yet charged — billable on exchange
  pendingMigratedPence: number; // £5 × pendingMigratedCount (the forward pipeline)
  monthTotalPence: number;// mrr + per-sale (this month's total bill)
  status: BusinessStatus;
  quiet: boolean;         // paying but no sales added this month — early churn signal
};

/** Every non-TSP progression business with its current-month figures + health.
 *  One pass per business (reuses the shared per-business helpers); fine at the
 *  handful-of-businesses scale we're at. */
export async function getBusinessesOverview(now: Date = new Date()): Promise<BusinessOverviewRow[]> {
  const businesses = await commandDb.progressionBusiness.findMany({
    where: { isTsp: false },
    select: { id: true, name: true, shortName: true, senderVerified: true, stripeSubscriptionId: true },
  });

  const rows = await Promise.all(
    businesses.map(async (b): Promise<BusinessOverviewRow> => {
      const [summary, state, clientCount] = await Promise.all([
        getBusinessBillingSummary(b.id, now),
        getBusinessPaymentState(b.id),
        commandDb.progressionBusinessClient.count({ where: { progressionBusinessId: b.id, removedAt: null } }),
      ]);
      const subscribed = !!b.stripeSubscriptionId;
      const status = deriveStatus(state, subscribed);
      return {
        id: b.id,
        name: b.name,
        shortName: b.shortName,
        senderVerified: b.senderVerified,
        subscribed,
        clientCount,
        memberCount: summary.memberCount,
        mrrPence: summary.basePence + summary.seatsPence,
        saleCount: summary.saleCount,
        perSalePence: summary.perSalePence,
        addedSaleCount: summary.addedSaleCount,
        migratedBilledCount: summary.migratedBilledCount,
        pendingMigratedCount: summary.pendingMigratedCount,
        pendingMigratedPence: summary.pendingMigratedPence,
        monthTotalPence: summary.totalPence,
        status,
        quiet: status === "live" && summary.saleCount === 0,
      };
    }),
  );

  rows.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      b.monthTotalPence - a.monthTotalPence ||
      a.name.localeCompare(b.name),
  );
  return rows;
}

export type BusinessesRevenue = {
  count: number;
  mrrPence: number;        // sum of recurring MRR across all businesses
  thisMonthPence: number;  // sum of this-month totals (MRR + £5s)
  perSalePence: number;    // sum of this-month £5-per-sale
  quietCount: number;      // paying businesses with no sales this month (churn signal)
  rows: BusinessOverviewRow[];                                   // for the revenue-page strip
  needsAttention: { id: string; name: string; status: BusinessStatus }[]; // for the risks feed
};

/** Platform-wide business income for the Revenue page. Not agency-scoped —
 *  what the businesses pay TSP is TSP's income, not attributable to a client
 *  agency — so this is only shown on the whole-platform revenue view. */
export async function getBusinessesRevenue(now: Date = new Date()): Promise<BusinessesRevenue> {
  const rows = await getBusinessesOverview(now);
  return {
    count: rows.length,
    mrrPence: rows.reduce((n, r) => n + r.mrrPence, 0),
    thisMonthPence: rows.reduce((n, r) => n + r.monthTotalPence, 0),
    perSalePence: rows.reduce((n, r) => n + r.perSalePence, 0),
    quietCount: rows.filter((r) => r.quiet).length,
    rows,
    needsAttention: rows
      .filter((r) => r.status === "payment_failed" || r.status === "blocked")
      .map((r) => ({ id: r.id, name: r.name, status: r.status })),
  };
}

/** agencyId → managing business name, for agencies that are an active client of
 *  a progression business. Powers the "Managed by {business}" tag on the
 *  Agencies page. */
export async function getAgencyBusinessMap(): Promise<Map<string, string>> {
  const links = await commandDb.progressionBusinessClient.findMany({
    where: { removedAt: null, progressionBusiness: { isTsp: false } },
    select: { agencyId: true, progressionBusiness: { select: { name: true } } },
  });
  return new Map(links.map((l) => [l.agencyId, l.progressionBusiness.name]));
}

/** The progression businesses managing ONE agency (active client links only).
 *  An agency can be a client of more than one business since the unique
 *  constraint was widened, so this returns every live link, with ids so the
 *  Agency File can deep-link to each business. */
export async function getManagingBusinesses(agencyId: string): Promise<{ id: string; name: string }[]> {
  const links = await commandDb.progressionBusinessClient.findMany({
    where: { agencyId, removedAt: null, progressionBusiness: { isTsp: false } },
    select: { progressionBusiness: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return links.map((l) => l.progressionBusiness);
}

/** businessId → name, for every non-TSP business. Powers the per-file
 *  "Managed by {business}" tag (files key off progressionBusinessId directly). */
export async function getBusinessNameMap(): Promise<Map<string, string>> {
  const rows = await commandDb.progressionBusiness.findMany({
    where: { isTsp: false },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

export type BusinessStatementLine = { businessName: string; description: string; pence: number };

/** Line-by-line business income for the Revenue breakdown drill — each business's
 *  subscription (base + seats) and this-month £5-per-sale lines, so the detail
 *  reconciles to "Business income this month". Not agency-scoped (platform income). */
export async function getBusinessesStatement(now: Date = new Date()): Promise<{ lines: BusinessStatementLine[]; totalPence: number }> {
  const businesses = await commandDb.progressionBusiness.findMany({
    where: { isTsp: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const perBiz = await Promise.all(
    businesses.map(async (b) => {
      const s = await getBusinessBillingSummary(b.id, now);
      return s.lines.map((l) => ({ businessName: b.name, description: l.description, pence: l.amountPence }));
    }),
  );
  const lines = perBiz.flat();
  return { lines, totalPence: lines.reduce((n, l) => n + l.pence, 0) };
}

export type BusinessClientRow = { agencyId: string; agencyName: string; feeSummary: string; feeSet: boolean; archived: boolean };
export type BusinessMemberRow = { id: string; name: string; isOwner: boolean; deactivated: boolean };

export type BusinessDetail = {
  id: string;
  name: string;
  shortName: string | null;
  senderVerified: boolean;
  senderEmail: string | null;
  senderDomain: string | null;
  createdAt: Date;
  subscribed: boolean;
  hasCard: boolean;
  status: BusinessStatus;
  paymentState: BusinessPaymentState;
  schedule: { cancelAtPeriodEnd: boolean; endsAt: Date | null } | null;
  summary: BusinessBillingSummary;
  mrrPence: number;
  monthTotalPence: number;
  clients: BusinessClientRow[];
  members: BusinessMemberRow[];
  lifetimeSaleCount: number;
};

// ── Business watch: activity feed + member vitals + setup scorecard ─────────
// "Keep tabs without them knowing" layer (founder ask, 2026-10-14): everything
// is derived from the existing Event rail + billing state. No new tracking
// code, nothing visible to the business.

export type BusinessActivityItem = {
  id: string;
  occurredAt: Date;
  type: string;          // raw EventType slug — page renders via eventLabel()
  memberName: string;
  address: string | null; // resolved when the event is on one of their files
};

export type BusinessMemberVitals = {
  id: string;
  name: string;
  isOwner: boolean;
  deactivated: boolean;
  lastActiveAt: Date | null;   // latest event of any kind
  actionsThisWeek: number;     // last-7-days events excluding logins/logouts
};

export type SetupCheck = {
  key: string;
  label: string;
  state: "done" | "attention" | "todo";
  detail: string;
};

export type BusinessWatch = {
  feed: BusinessActivityItem[];
  vitals: BusinessMemberVitals[];
  setup: SetupCheck[];
};

/** Activity + vitals + setup for one business, derived from the detail already
 *  loaded. Events are matched on the members' userIds (business members have
 *  agencyId null, so the user dimension is the reliable key). */
export async function getBusinessWatch(detail: BusinessDetail, now: Date = new Date()): Promise<BusinessWatch> {
  const memberIds = detail.members.map((m) => m.id);
  const nameById = new Map(detail.members.map((m) => [m.id, m.name]));
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const [feedEvents, lastActive, weekCounts, firstMilestone, firstChase] = memberIds.length
    ? await Promise.all([
        commandDb.event.findMany({
          where: { userId: { in: memberIds } },
          orderBy: { occurredAt: "desc" },
          take: 60,
          select: { id: true, occurredAt: true, type: true, userId: true, entityType: true, entityId: true },
        }),
        commandDb.event.groupBy({
          by: ["userId"],
          where: { userId: { in: memberIds } },
          _max: { occurredAt: true },
        }),
        commandDb.event.groupBy({
          by: ["userId"],
          where: {
            userId: { in: memberIds },
            occurredAt: { gte: weekAgo },
            type: { notIn: ["user_logged_in", "user_logged_out"] },
          },
          _count: { _all: true },
        }),
        commandDb.event.findFirst({
          where: { userId: { in: memberIds }, type: "milestone_confirmed" },
          select: { id: true },
        }),
        commandDb.event.findFirst({
          where: { userId: { in: memberIds }, type: "chase_sent" },
          select: { id: true },
        }),
      ])
    : [[], [], [], null, null];

  // Resolve addresses for the file-scoped events in one read.
  const txIds = [...new Set(
    feedEvents
      .filter((e) => e.entityType === "PropertyTransaction" && e.entityId)
      .map((e) => e.entityId as string),
  )];
  const txs = txIds.length
    ? await commandDb.propertyTransaction.findMany({
        where: { id: { in: txIds } },
        select: { id: true, propertyAddress: true },
      })
    : [];
  const addressById = new Map(txs.map((t) => [t.id, t.propertyAddress]));

  const feed: BusinessActivityItem[] = feedEvents.map((e) => ({
    id: e.id,
    occurredAt: e.occurredAt,
    type: e.type,
    memberName: (e.userId && nameById.get(e.userId)) || "Team member",
    address: e.entityType === "PropertyTransaction" && e.entityId ? addressById.get(e.entityId) ?? null : null,
  }));

  const lastById = new Map(lastActive.map((r) => [r.userId, r._max.occurredAt]));
  const weekById = new Map(weekCounts.map((r) => [r.userId, r._count._all]));
  const vitals: BusinessMemberVitals[] = detail.members.map((m) => ({
    id: m.id,
    name: m.name,
    isOwner: m.isOwner,
    deactivated: m.deactivated,
    lastActiveAt: lastById.get(m.id) ?? null,
    actionsThisWeek: weekById.get(m.id) ?? 0,
  }));

  const activeClients = detail.clients.filter((c) => !c.archived);
  const missingFees = activeClients.filter((c) => !c.feeSet);
  const activeMembers = detail.members.filter((m) => !m.deactivated);
  const senderSet = !!(detail.senderEmail || detail.senderDomain);

  const setup: SetupCheck[] = [
    {
      key: "card",
      label: "Payment card",
      state: detail.hasCard ? "done" : "todo",
      detail: detail.hasCard ? "On file" : "Not added yet",
    },
    {
      key: "subscription",
      label: "Subscription",
      state: detail.subscribed ? "done" : "todo",
      detail: detail.subscribed ? "Active" : "Not started",
    },
    {
      key: "sender",
      label: "Email identity",
      state: senderSet ? (detail.senderVerified ? "done" : "attention") : "todo",
      detail: senderSet
        ? detail.senderVerified
          ? "Sends as their own address"
          : "Added, not verified yet"
        : "Sending as the platform default",
    },
    {
      key: "client",
      label: "Client agency linked",
      state: activeClients.length > 0 ? "done" : "todo",
      detail: activeClients.length > 0
        ? `${activeClients.length} linked`
        : "No clients yet",
    },
    {
      key: "fees",
      label: "Client fees set",
      state: activeClients.length === 0 ? "todo" : missingFees.length > 0 ? "attention" : "done",
      detail: activeClients.length === 0
        ? "Waiting on their first client"
        : missingFees.length > 0
        ? `${missingFees.length} of ${activeClients.length} missing a fee model`
        : "Every client has a fee model",
    },
    {
      key: "team",
      label: "Team invited",
      state: activeMembers.length > 1 ? "done" : "todo",
      detail: activeMembers.length > 1 ? `${activeMembers.length} members` : "Solo so far",
    },
    {
      key: "firstSale",
      label: "First sale created",
      state: detail.lifetimeSaleCount > 0 ? "done" : "todo",
      detail: detail.lifetimeSaleCount > 0 ? `${detail.lifetimeSaleCount} lifetime` : "No sales yet",
    },
    {
      key: "firstMilestone",
      label: "First milestone confirmed",
      state: firstMilestone ? "done" : "todo",
      detail: firstMilestone ? "Progressing files" : "None confirmed yet",
    },
    {
      key: "firstChase",
      label: "First chase sent",
      state: firstChase ? "done" : "todo",
      detail: firstChase ? "Chasing is in use" : "None sent yet",
    },
  ];

  return { feed, vitals, setup };
}

// ── Friction signals ─────────────────────────────────────────────────────────
// Started-but-stalled patterns, derived (never error-based): the founder sees
// where a business is snagging before they raise it. Each signal is a plain
// sentence; absence of signals is a real state ("nothing flagged"), not silence.

export type FrictionSignal = { key: string; label: string; detail: string };

const firstLine = (addr: string) => addr.split(",")[0].trim();

/** Friction for one business. Self-contained (fetches its own members/files)
 *  so the list page can loop it without loading full details. */
export async function getBusinessFriction(businessId: string, now: Date = new Date()): Promise<FrictionSignal[]> {
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const dayAgo = new Date(now.getTime() - 86400000);

  const members = await commandDb.user.findMany({
    where: { progressionBusinessId: businessId },
    select: { id: true },
  });
  const memberIds = members.map((m) => m.id);

  const [weekEventCounts, noContactFiles, agedClients, salesByAgency, stalledFiles] = await Promise.all([
    memberIds.length
      ? commandDb.event.groupBy({
          by: ["type"],
          where: { userId: { in: memberIds }, occurredAt: { gte: weekAgo } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    commandDb.propertyTransaction.findMany({
      where: {
        progressionBusinessId: businessId,
        isDemo: false,
        status: "active",
        createdAt: { lt: dayAgo },
        contacts: { none: {} },
      },
      select: { propertyAddress: true },
      take: 4,
    }),
    commandDb.progressionBusinessClient.findMany({
      where: { progressionBusinessId: businessId, removedAt: null, createdAt: { lt: weekAgo } },
      select: { agencyId: true, agency: { select: { name: true } } },
    }),
    commandDb.propertyTransaction.groupBy({
      by: ["agencyId"],
      where: { progressionBusinessId: businessId, isDemo: false },
      _count: { _all: true },
    }),
    commandDb.propertyTransaction.findMany({
      where: {
        progressionBusinessId: businessId,
        isDemo: false,
        status: "active",
        createdAt: { lt: weekAgo },
        milestoneCompletions: { none: { state: "complete" } },
      },
      select: { propertyAddress: true },
      take: 4,
    }),
  ]);

  const countOf = (type: string) => weekEventCounts.find((r) => r.type === type)?._count._all ?? 0;
  const logins = countOf("user_logged_in");
  const nonLoginActions = weekEventCounts
    .filter((r) => r.type !== "user_logged_in" && r.type !== "user_logged_out")
    .reduce((n, r) => n + r._count._all, 0);
  const drafts = countOf("chase_message_generated");
  const sends = countOf("chase_sent");

  const salesCountByAgency = new Map(salesByAgency.map((r) => [r.agencyId, r._count._all]));
  const clientsNoSales = agedClients.filter((c) => (salesCountByAgency.get(c.agencyId) ?? 0) === 0);

  const signals: FrictionSignal[] = [];
  if (logins >= 3 && nonLoginActions === 0) {
    signals.push({
      key: "logins_no_actions",
      label: "Signing in but completing nothing",
      detail: `${logins} sign-ins in the last 7 days with no actions taken`,
    });
  }
  if (noContactFiles.length > 0) {
    signals.push({
      key: "sales_no_contacts",
      label: "Sales with no contacts on them",
      detail: noContactFiles.map((f) => firstLine(f.propertyAddress)).join(", "),
    });
  }
  if (clientsNoSales.length > 0) {
    signals.push({
      key: "client_no_sales",
      label: "Client linked over a week, no sales yet",
      detail: clientsNoSales.map((c) => c.agency?.name ?? "Unknown agency").join(", "),
    });
  }
  if (drafts >= 2 && sends === 0) {
    signals.push({
      key: "drafts_no_sends",
      label: "Drafting chases but not sending them",
      detail: `${drafts} drafts in the last 7 days, none sent`,
    });
  }
  if (stalledFiles.length > 0) {
    signals.push({
      key: "stalled_files",
      label: "Files over a week old with no milestone confirmed",
      detail: stalledFiles.map((f) => firstLine(f.propertyAddress)).join(", "),
    });
  }
  return signals;
}

/** Friction for a set of businesses in one call (looped; fine at this scale). */
export async function getBusinessesFriction(businessIds: string[], now: Date = new Date()): Promise<Map<string, FrictionSignal[]>> {
  const entries = await Promise.all(
    businessIds.map(async (id) => [id, await getBusinessFriction(id, now)] as const),
  );
  return new Map(entries);
}

// ── Daily pulse ──────────────────────────────────────────────────────────────
// What each business did YESTERDAY (London day), so the founder gets a push-style
// read on the Businesses list / Overview without going looking.

export type BusinessPulseRow = {
  id: string;
  name: string;
  actions: number;             // yesterday's events excluding logins/logouts
  salesCreated: number;
  milestonesConfirmed: number;
  chasesSent: number;
};

export async function getBusinessesPulse(now: Date = new Date()): Promise<{ rows: BusinessPulseRow[]; totalActions: number }> {
  const todayKey = new Date(`${londonDateStr(now)}T00:00:00.000Z`);
  const yesterdayKey = new Date(todayKey.getTime() - 86400000);

  const businesses = await commandDb.progressionBusiness.findMany({
    where: { isTsp: false },
    select: { id: true, name: true, members: { select: { id: true } } },
  });
  const businessByMember = new Map<string, string>();
  for (const b of businesses) for (const m of b.members) businessByMember.set(m.id, b.id);
  const allMemberIds = [...businessByMember.keys()];

  const events = allMemberIds.length
    ? await commandDb.event.findMany({
        where: { userId: { in: allMemberIds }, occurredAt: { gte: yesterdayKey, lt: todayKey } },
        select: { userId: true, type: true },
      })
    : [];

  const rows = new Map<string, BusinessPulseRow>(
    businesses.map((b) => [b.id, { id: b.id, name: b.name, actions: 0, salesCreated: 0, milestonesConfirmed: 0, chasesSent: 0 }]),
  );
  for (const e of events) {
    const bizId = e.userId ? businessByMember.get(e.userId) : undefined;
    const row = bizId ? rows.get(bizId) : undefined;
    if (!row) continue;
    if (e.type !== "user_logged_in" && e.type !== "user_logged_out") row.actions += 1;
    if (e.type === "transaction_created") row.salesCreated += 1;
    if (e.type === "milestone_confirmed") row.milestonesConfirmed += 1;
    if (e.type === "chase_sent") row.chasesSent += 1;
  }

  const list = [...rows.values()].sort((a, b) => b.actions - a.actions || a.name.localeCompare(b.name));
  return { rows: list, totalActions: list.reduce((n, r) => n + r.actions, 0) };
}

/** Full picture of one business. Returns null for an unknown id or the TSP row
 *  (which is never a customer). */
export async function getBusinessDetail(id: string, now: Date = new Date()): Promise<BusinessDetail | null> {
  const b = await commandDb.progressionBusiness.findFirst({
    where: { id, isTsp: false },
    select: {
      id: true, name: true, shortName: true, senderVerified: true, senderEmail: true, senderDomain: true,
      createdAt: true, stripeCustomerId: true, stripeSubscriptionId: true,
      members: {
        select: { id: true, name: true, progressionBusinessRole: true, deactivatedAt: true },
        orderBy: { name: "asc" },
      },
      clients: {
        select: { agencyId: true, feeModel: true, removedAt: true, agency: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!b) return null;

  const [summary, paymentState, lifetimeSaleCount, schedule] = await Promise.all([
    getBusinessBillingSummary(id, now),
    getBusinessPaymentState(id),
    commandDb.propertyTransaction.count({ where: { progressionBusinessId: id, isDemo: false } }),
    getBusinessPlanSchedule(id).catch(() => null),
  ]);

  const subscribed = !!b.stripeSubscriptionId;
  return {
    id: b.id,
    name: b.name,
    shortName: b.shortName,
    senderVerified: b.senderVerified,
    senderEmail: b.senderEmail,
    senderDomain: b.senderDomain,
    createdAt: b.createdAt,
    subscribed,
    hasCard: !!b.stripeCustomerId,
    status: deriveStatus(paymentState, subscribed),
    paymentState,
    schedule,
    summary,
    mrrPence: summary.basePence + summary.seatsPence,
    monthTotalPence: summary.totalPence,
    clients: b.clients.map((c) => ({
      agencyId: c.agencyId,
      agencyName: c.agency?.name ?? "Unknown agency",
      feeSummary: feeModelSummary(parseFeeModel(c.feeModel)),
      feeSet: parseFeeModel(c.feeModel) !== null,
      archived: c.removedAt !== null,
    })),
    members: b.members.map((m) => ({
      id: m.id,
      name: m.name,
      isOwner: m.progressionBusinessRole === "owner",
      deactivated: m.deactivatedAt !== null,
    })),
    lifetimeSaleCount,
  };
}

// ─── Sending identity, per (company × agency) pairing ─────────────────────────
// The real-world granularity of "who sends as what". For an external progression
// business, each agency it handles can have its OWN sending identity. This mirrors
// resolveOutsourcedWhiteLabelSender (lib/progression/sender.ts) exactly, then
// classifies HOW each verified sender sends: a DNS-authenticated domain, a no-DNS
// single sender, or (unset) the platform fallback. There is no per-AGENT sender —
// sender/DNS is shared by everyone on the domain — so this per-pairing view is the
// finest granularity the send pipeline actually has.

const PLATFORM_FALLBACK_SENDER = "updates@thesalesprogressor.co.uk";

export type SenderSource = "link" | "agency" | "business" | "platform";
export type SenderMethod = "dns" | "single_sender" | "platform";

export type AgencySenderStatus = {
  agencyId: string;
  agencyName: string;
  archived: boolean;
  effectiveSender: string;   // the address that actually sends on this pairing's files
  source: SenderSource;      // where it resolved from
  method: SenderMethod;      // dns-authenticated domain / no-DNS single sender / platform fallback
  domain: string | null;     // the authenticated domain backing it, when method === "dns"
  // The raw building blocks, so the founder can see what's set up vs verified.
  linkSender: string | null;
  linkVerified: boolean;
  agencySender: string | null;
  agencyVerified: boolean;
  agencyProgressorCount: number; // active progressors on this agency (agency sender only usable when ≤1)
};

export type BusinessSendingIdentity = {
  businessSenderEmail: string | null;
  businessSenderDomain: string | null;
  businessSenderVerified: boolean;
  businessDnsDomains: { domain: string; verified: boolean }[];
  perAgency: AgencySenderStatus[];
};

function domainOf(email: string | null | undefined): string | null {
  const at = email?.trim().toLowerCase().split("@");
  return at && at.length === 2 && at[1] ? at[1] : null;
}

export async function getBusinessSendingIdentity(businessId: string): Promise<BusinessSendingIdentity | null> {
  const biz = await commandDb.progressionBusiness.findFirst({
    where: { id: businessId, isTsp: false },
    select: {
      senderEmail: true, senderDomain: true, senderVerified: true,
      clients: {
        select: {
          agencyId: true, senderEmail: true, senderVerified: true, removedAt: true,
          agency: { select: { name: true, quoteSenderEmail: true, quoteSenderVerified: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!biz) return null;

  const agencyIds = biz.clients.map((c) => c.agencyId);

  // Active-progressor count per agency (ALL businesses, matching the resolver's
  // `progressionBusinessClient.count` — the agency sender is only usable when there
  // is exactly one, so a shared address can't be misattributed to one company).
  const progressorCounts = agencyIds.length
    ? await commandDb.progressionBusinessClient.groupBy({
        by: ["agencyId"],
        where: { agencyId: { in: agencyIds }, removedAt: null },
        _count: { agencyId: true },
      })
    : [];
  const countByAgency = new Map(progressorCounts.map((r) => [r.agencyId, r._count.agencyId]));

  // Every verified sending domain owned by this business or any of its agencies.
  const domainRows = await commandDb.verifiedDomain.findMany({
    where: {
      OR: [
        { progressionBusinessId: businessId },
        ...(agencyIds.length ? [{ agencyId: { in: agencyIds } }] : []),
      ],
    },
    select: { agencyId: true, progressionBusinessId: true, domain: true, status: true },
  });
  const verifiedDomainSet = new Set(
    domainRows.filter((d) => d.status === "verified").map((d) => d.domain.toLowerCase()),
  );
  const businessDnsDomains = domainRows
    .filter((d) => d.progressionBusinessId === businessId)
    .map((d) => ({ domain: d.domain, verified: d.status === "verified" }));

  // Is the email's domain covered by an authenticated (verified) domain? If so the
  // verified sender sends via DNS; if the sender is verified but has no matching
  // domain, it's a no-DNS single sender.
  const methodFor = (email: string): { method: SenderMethod; domain: string | null } => {
    const dom = domainOf(email);
    if (dom && verifiedDomainSet.has(dom)) return { method: "dns", domain: dom };
    return { method: "single_sender", domain: null };
  };

  const perAgency: AgencySenderStatus[] = biz.clients.map((c) => {
    const progressorCount = countByAgency.get(c.agencyId) ?? 0;
    const linkOk = !!(c.senderVerified && c.senderEmail?.trim());
    const agencyOk = !!(c.agency?.quoteSenderVerified && c.agency.quoteSenderEmail?.trim());
    const businessOk = !!(biz.senderVerified && biz.senderEmail?.trim());

    let source: SenderSource;
    let effectiveSender: string;
    if (linkOk) {
      source = "link"; effectiveSender = c.senderEmail!.trim();
    } else if (agencyOk && progressorCount <= 1) {
      source = "agency"; effectiveSender = c.agency!.quoteSenderEmail!.trim();
    } else if (businessOk) {
      source = "business"; effectiveSender = biz.senderEmail!.trim();
    } else {
      source = "platform"; effectiveSender = PLATFORM_FALLBACK_SENDER;
    }

    const { method, domain } = source === "platform"
      ? { method: "platform" as SenderMethod, domain: null }
      : methodFor(effectiveSender);

    return {
      agencyId: c.agencyId,
      agencyName: c.agency?.name ?? "Unknown agency",
      archived: c.removedAt !== null,
      effectiveSender,
      source,
      method,
      domain,
      linkSender: c.senderEmail?.trim() || null,
      linkVerified: !!c.senderVerified,
      agencySender: c.agency?.quoteSenderEmail?.trim() || null,
      agencyVerified: !!c.agency?.quoteSenderVerified,
      agencyProgressorCount: progressorCount,
    };
  });

  return {
    businessSenderEmail: biz.senderEmail,
    businessSenderDomain: biz.senderDomain,
    businessSenderVerified: biz.senderVerified,
    businessDnsDomains,
    perAgency,
  };
}
