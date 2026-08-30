import { commandDb } from "@/lib/command/prisma";
import { classifySource } from "@/lib/analytics/attribution";

// Website & Growth — DB-authoritative growth intelligence. Composes the signup
// attribution columns (Slice 1), the transaction/exchange model, and banked
// revenue (InvoiceLine) into the acquisition → activation → retention → exchange
// → revenue story. Everything here works with PostHog OFF; the web-behaviour
// half is added later via a PostHog read layer.
//
// Exclusions applied everywhere: agency.isInternal=false, tx isDemo=false,
// tx isMigrated=false. Revenue = InvoiceLine.totalPence on banked invoices only
// (issued/paid/failed) — never purchasePrice or agent fee. Free/trial files can
// exchange (£0) but never bank revenue.

export type GrowthPeriodKey = "7d" | "30d" | "90d" | "month" | "last-month" | "quarter";
export type GrowthTier = "all" | "self" | "outsourced";

export const GROWTH_PERIODS: Array<{ key: GrowthPeriodKey; label: string }> = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
];
export const GROWTH_TIERS: Array<{ key: GrowthTier; label: string }> = [
  { key: "all", label: "All" },
  { key: "self", label: "Self-progress" },
  { key: "outsourced", label: "Outsourced" },
];

const BANKED_STATUSES = ["issued", "paid", "failed"] as const;

export type GrowthPeriod = { key: GrowthPeriodKey; label: string; start: Date; end: Date; prevStart: Date; prevEnd: Date };

export function resolveGrowthPeriod(key: GrowthPeriodKey): GrowthPeriod {
  const now = new Date();
  const label = GROWTH_PERIODS.find((p) => p.key === key)?.label ?? "30 days";
  const days = (n: number) => new Date(now.getTime() - n * 86400000);
  const monthStart = (y: number, m: number) => new Date(y, m, 1);

  if (key === "month") {
    const start = monthStart(now.getFullYear(), now.getMonth());
    const prevStart = monthStart(now.getFullYear(), now.getMonth() - 1);
    return { key, label, start, end: now, prevStart, prevEnd: start };
  }
  if (key === "last-month") {
    const start = monthStart(now.getFullYear(), now.getMonth() - 1);
    const end = monthStart(now.getFullYear(), now.getMonth());
    const prevStart = monthStart(now.getFullYear(), now.getMonth() - 2);
    return { key, label, start, end, prevStart, prevEnd: start };
  }
  if (key === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const start = monthStart(now.getFullYear(), q * 3);
    const prevStart = monthStart(now.getFullYear(), q * 3 - 3);
    return { key, label, start, end: now, prevStart, prevEnd: start };
  }
  const n = key === "7d" ? 7 : key === "90d" ? 90 : 30;
  return { key, label, start: days(n), end: now, prevStart: days(n * 2), prevEnd: days(n) };
}

function inRange(d: Date | null | undefined, start: Date, end: Date): boolean {
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= start.getTime() && t < end.getTime();
}
function normTier(v: string | null): "self" | "outsourced" | null {
  if (v === "self" || v === "self_managed") return "self";
  if (v === "outsourced") return "outsourced";
  return null;
}

type AgencyAgg = {
  id: string;
  name: string;
  signupAt: Date | null;
  source: string; // classified channel
  ctaLocation: string | null;
  realTx: number;
  exchanged: number;
  firstTxAt: Date | null;
  tier: "self" | "outsourced" | null; // primary tier (tx majority, else signup interest)
  bankedPence: number;
};

async function loadGrowth() {
  const [agencies, txns, lines] = await Promise.all([
    commandDb.agency.findMany({
      where: { isInternal: false },
      select: {
        id: true, name: true, signupAt: true, firstSubmissionAt: true,
        signupSource: true, signupMedium: true, signupCampaign: true, signupReferrer: true,
        signupCtaLocation: true, signupTier: true,
      },
    }),
    commandDb.propertyTransaction.findMany({
      where: { isDemo: false, isMigrated: false, agency: { isInternal: false } },
      select: { id: true, agencyId: true, createdAt: true, exchangedAt: true, serviceType: true },
    }),
    commandDb.invoiceLine.findMany({
      where: { invoice: { status: { in: [...BANKED_STATUSES] }, agency: { isInternal: false } } },
      select: { transactionId: true, totalPence: true, invoice: { select: { agencyId: true } } },
    }),
  ]);

  // Per-transaction banked revenue + per-agency lifetime banked.
  const revByTx = new Map<string, number>();
  const revByAgency = new Map<string, number>();
  for (const l of lines) {
    if (l.transactionId) revByTx.set(l.transactionId, (revByTx.get(l.transactionId) ?? 0) + l.totalPence);
    const aid = l.invoice.agencyId;
    revByAgency.set(aid, (revByAgency.get(aid) ?? 0) + l.totalPence);
  }

  // Per-agency transaction aggregation.
  const txAgg = new Map<string, { count: number; exchanged: number; firstTxAt: Date | null; self: number; outsourced: number }>();
  for (const t of txns) {
    const a = txAgg.get(t.agencyId) ?? { count: 0, exchanged: 0, firstTxAt: null, self: 0, outsourced: 0 };
    a.count++;
    if (t.exchangedAt) a.exchanged++;
    if (!a.firstTxAt || new Date(t.createdAt) < a.firstTxAt) a.firstTxAt = new Date(t.createdAt);
    if (t.serviceType === "self_managed") a.self++; else if (t.serviceType === "outsourced") a.outsourced++;
    txAgg.set(t.agencyId, a);
  }

  const agg: AgencyAgg[] = agencies.map((ag) => {
    const t = txAgg.get(ag.id);
    const primaryTier: "self" | "outsourced" | null = t && (t.self || t.outsourced)
      ? (t.self >= t.outsourced ? "self" : "outsourced")
      : normTier(ag.signupTier);
    return {
      id: ag.id,
      name: ag.name,
      signupAt: ag.signupAt,
      source: classifySource({ source: ag.signupSource ?? undefined, medium: ag.signupMedium ?? undefined, campaign: ag.signupCampaign ?? undefined, referrer: ag.signupReferrer ?? undefined }),
      ctaLocation: ag.signupCtaLocation,
      realTx: t?.count ?? 0,
      exchanged: t?.exchanged ?? 0,
      firstTxAt: t?.firstTxAt ?? null,
      tier: primaryTier,
      bankedPence: revByAgency.get(ag.id) ?? 0,
    };
  });

  return { agg, txns, revByTx };
}

export type GrowthOverview = {
  signups: number; prevSignups: number;
  activated: number; prevActivated: number;
  activationRate: number | null;
  exchanges: number; prevExchanges: number;
  revenuePence: number; prevRevenuePence: number;
};
export type FunnelStage = { label: string; value: number; disabled?: boolean; tip?: string };
export type AcquisitionRow = { source: string; signups: number; activated: number; activationRate: number | null; exchangedAgencies: number; revenuePence: number };
export type CtaRow = { cta: string; signups: number; activated: number; revenuePence: number };
export type AdoptionStats = {
  totalAgencies: number; activated: number; activationRate: number | null;
  reached2: number; reached5: number; reached10: number; neverActivated: number;
  avgDaysToFirstSale: number | null;
};
export type TrackingHealth = {
  posthogClientKey: boolean; posthogReadKey: boolean; posthogProjectId: boolean;
  knownAttributionPct: number | null; attributedSignups: number; totalSignups: number;
};
export type GrowthDashboard = {
  period: GrowthPeriod;
  overview: GrowthOverview;
  funnel: FunnelStage[];
  cohortRevenuePence: number;
  acquisition: AcquisitionRow[];
  cta: CtaRow[];
  adoption: AdoptionStats;
  insights: Array<{ tone: "neutral" | "good" | "watch"; text: string }>;
  tracking: TrackingHealth;
};

export async function getGrowthDashboard(periodKey: GrowthPeriodKey, tier: GrowthTier): Promise<GrowthDashboard> {
  const period = resolveGrowthPeriod(periodKey);
  const { agg, txns, revByTx } = await loadGrowth();

  const tierOk = (t: "self" | "outsourced" | null) => tier === "all" || t === tier;
  const byId = new Map(agg.map((a) => [a.id, a]));

  // Signup cohorts (agencies that signed up in the window), tier-filtered.
  const cohort = agg.filter((a) => tierOk(a.tier) && inRange(a.signupAt, period.start, period.end));
  const prevCohort = agg.filter((a) => tierOk(a.tier) && inRange(a.signupAt, period.prevStart, period.prevEnd));

  // Exchange + revenue are event-based (transactions exchanged in the window).
  const exchangedInPeriod = txns.filter((t) => tierOk(byId.get(t.agencyId)?.tier ?? null) && inRange(t.exchangedAt, period.start, period.end));
  const prevExchangedInPeriod = txns.filter((t) => tierOk(byId.get(t.agencyId)?.tier ?? null) && inRange(t.exchangedAt, period.prevStart, period.prevEnd));
  const sumRev = (list: typeof txns) => list.reduce((s, t) => s + (revByTx.get(t.id) ?? 0), 0);

  const activatedCount = cohort.filter((a) => a.realTx >= 1).length;
  const overview: GrowthOverview = {
    signups: cohort.length,
    prevSignups: prevCohort.length,
    activated: activatedCount,
    prevActivated: prevCohort.filter((a) => a.realTx >= 1).length,
    activationRate: cohort.length ? Math.round((activatedCount / cohort.length) * 100) : null,
    exchanges: exchangedInPeriod.length,
    prevExchanges: prevExchangedInPeriod.length,
    revenuePence: sumRev(exchangedInPeriod),
    prevRevenuePence: sumRev(prevExchangedInPeriod),
  };

  // Cohort funnel: signup → activated → 2nd → 5th → exchanged.
  const funnel: FunnelStage[] = [
    { label: "Visitors", value: 0, disabled: true, tip: "Needs website analytics (PostHog). Connect it to light this up." },
    { label: "Signups", value: cohort.length },
    { label: "Activated", value: cohort.filter((a) => a.realTx >= 1).length, tip: "Created their first real sale." },
    { label: "2nd sale", value: cohort.filter((a) => a.realTx >= 2).length },
    { label: "5th sale", value: cohort.filter((a) => a.realTx >= 5).length },
    { label: "Exchanged", value: cohort.filter((a) => a.exchanged >= 1).length, tip: "At least one sale reached exchange." },
  ];
  const cohortRevenuePence = cohort.reduce((s, a) => s + a.bankedPence, 0);

  // Acquisition by classified source (signup cohort).
  const srcMap = new Map<string, AcquisitionRow>();
  for (const a of cohort) {
    const r = srcMap.get(a.source) ?? { source: a.source, signups: 0, activated: 0, activationRate: null, exchangedAgencies: 0, revenuePence: 0 };
    r.signups++;
    if (a.realTx >= 1) r.activated++;
    if (a.exchanged >= 1) r.exchangedAgencies++;
    r.revenuePence += a.bankedPence;
    srcMap.set(a.source, r);
  }
  const acquisition = [...srcMap.values()].map((r) => ({ ...r, activationRate: r.signups ? Math.round((r.activated / r.signups) * 100) : null })).sort((a, b) => b.signups - a.signups);

  // CTA performance (signup cohort, where a CTA location was captured).
  const ctaMap = new Map<string, CtaRow>();
  for (const a of cohort) {
    if (!a.ctaLocation) continue;
    const r = ctaMap.get(a.ctaLocation) ?? { cta: a.ctaLocation, signups: 0, activated: 0, revenuePence: 0 };
    r.signups++;
    if (a.realTx >= 1) r.activated++;
    r.revenuePence += a.bankedPence;
    ctaMap.set(a.ctaLocation, r);
  }
  const cta = [...ctaMap.values()].sort((a, b) => b.signups - a.signups);

  // Adoption — lifetime (all real agencies), tier-filtered.
  const adoptionPool = agg.filter((a) => tierOk(a.tier));
  const activatedPool = adoptionPool.filter((a) => a.realTx >= 1);
  const daysToFirst = activatedPool
    .filter((a) => a.signupAt && a.firstTxAt)
    .map((a) => Math.max(0, Math.round((a.firstTxAt!.getTime() - a.signupAt!.getTime()) / 86400000)));
  const adoption: AdoptionStats = {
    totalAgencies: adoptionPool.length,
    activated: activatedPool.length,
    activationRate: adoptionPool.length ? Math.round((activatedPool.length / adoptionPool.length) * 100) : null,
    reached2: adoptionPool.filter((a) => a.realTx >= 2).length,
    reached5: adoptionPool.filter((a) => a.realTx >= 5).length,
    reached10: adoptionPool.filter((a) => a.realTx >= 10).length,
    neverActivated: adoptionPool.length - activatedPool.length,
    avgDaysToFirstSale: daysToFirst.length ? Math.round(daysToFirst.reduce((a, b) => a + b, 0) / daysToFirst.length) : null,
  };

  // Deterministic insights.
  const insights: GrowthDashboard["insights"] = [];
  if (overview.prevSignups > 0) {
    const d = overview.signups - overview.prevSignups;
    const pct = Math.round((d / overview.prevSignups) * 100);
    if (Math.abs(pct) >= 10) insights.push({ tone: d >= 0 ? "good" : "watch", text: `Signups ${d >= 0 ? "up" : "down"} ${Math.abs(pct)}% vs the previous ${period.label.toLowerCase()} (${overview.signups} vs ${overview.prevSignups}).` });
  }
  const notActivated = cohort.filter((a) => a.realTx === 0).length;
  if (notActivated > 0) insights.push({ tone: "watch", text: `${notActivated} ${notActivated === 1 ? "agency" : "agencies"} registered this period but ${notActivated === 1 ? "hasn't" : "haven't"} added their first real sale yet.` });
  if (acquisition.length >= 2) {
    const byVolume = acquisition[0];
    const byActivation = [...acquisition].filter((r) => r.signups >= 2 && r.activationRate != null).sort((a, b) => (b.activationRate ?? 0) - (a.activationRate ?? 0))[0];
    if (byActivation && byActivation.source !== byVolume.source && (byActivation.activationRate ?? 0) > (byVolume.activationRate ?? 0)) {
      insights.push({ tone: "neutral", text: `${byVolume.source} drove the most signups (${byVolume.signups}), but ${byActivation.source} activates at ${byActivation.activationRate}% vs ${byVolume.activationRate ?? 0}%.` });
    }
  }
  if (cta.length >= 2) {
    const top = [...cta].filter((c) => c.signups >= 2).sort((a, b) => b.signups - a.signups)[0];
    if (top) insights.push({ tone: "neutral", text: `The "${top.cta}" CTA produced the most signups (${top.signups}), ${top.activated} of which activated.` });
  }
  if (insights.length === 0) insights.push({ tone: "neutral", text: "Not enough signal yet for period-over-period insights — they appear as attributed signups accumulate." });

  // Tracking health.
  const withSource = agg.filter((a) => a.signupAt && a.source !== "Direct / Unknown").length;
  const totalWithSignup = agg.filter((a) => a.signupAt).length;
  const tracking: TrackingHealth = {
    posthogClientKey: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
    posthogReadKey: !!process.env.POSTHOG_API_KEY,
    posthogProjectId: !!process.env.POSTHOG_PROJECT_ID,
    knownAttributionPct: totalWithSignup ? Math.round((withSource / totalWithSignup) * 100) : null,
    attributedSignups: withSource,
    totalSignups: totalWithSignup,
  };

  return { period, overview, funnel, cohortRevenuePence, acquisition, cta, adoption, insights, tracking };
}
