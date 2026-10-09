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
  saleCount: number;      // sales added this month
  perSalePence: number;   // £5 × this month's sales
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

export type BusinessClientRow = { agencyId: string; agencyName: string; feeSummary: string; archived: boolean };
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
