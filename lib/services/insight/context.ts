// Shared real-data context for the daily brief + weekly review.
//
// The old briefs were written ONLY from signals. This assembles the actual
// numbers first — the weekly metric movement (from the same clean rollup the
// Command Centre uses) plus a live operational snapshot — and then adds the
// de-duplicated active signals. So the AI narrates real figures, not just
// whatever detectors happened to fire.

import { prisma } from "@/lib/prisma";
import type { Signal } from "@prisma/client";

type WeeklySums = {
  transactionsCreated: number;
  transactionsExchanged: number;
  transactionsCompleted: number;
  milestonesConfirmed: number;
  chasesSent: number;
  aiDraftsGenerated: number;
  signups: number;
  logins: number;
  aiSpendCents: number;
};

async function weeklySums(start: Date, end: Date): Promise<WeeklySums> {
  const r = await prisma.dailyMetric.aggregate({
    where: { date: { gte: start, lt: end }, agencyId: null, serviceType: null, modeProfile: null },
    _sum: {
      transactionsCreated: true, transactionsExchanged: true, transactionsCompleted: true,
      milestonesConfirmed: true, chasesSent: true, aiDraftsGenerated: true,
      signups: true, logins: true, aiSpendCents: true,
    },
  });
  const s = r._sum;
  return {
    transactionsCreated: s.transactionsCreated ?? 0,
    transactionsExchanged: s.transactionsExchanged ?? 0,
    transactionsCompleted: s.transactionsCompleted ?? 0,
    milestonesConfirmed: s.milestonesConfirmed ?? 0,
    chasesSent: s.chasesSent ?? 0,
    aiDraftsGenerated: s.aiDraftsGenerated ?? 0,
    signups: s.signups ?? 0,
    logins: s.logins ?? 0,
    aiSpendCents: s.aiSpendCents ?? 0,
  };
}

function pctLine(label: string, curr: number, prev: number, extra = ""): string {
  const delta = prev === 0 ? (curr === 0 ? 0 : 100) : Math.round(((curr - prev) / prev) * 100);
  const arrow = delta > 0 ? "+" : "";
  return `  ${label}: ${curr} (was ${prev}, ${arrow}${delta}%)${extra}`;
}

const HUMAN: Record<string, string> = {
  metric_delta: "Metric moved week-on-week",
  silent_agency: "Agency gone silent",
  revenue_at_risk: "Revenue at risk",
  portal_gone_quiet: "Client gone quiet on the portal",
  chase_not_landing: "Chases not landing",
  quote_inbox_aging: "Quote inbox aging",
  solicitor_confirm_pending: "Solicitor confirmation stuck",
  funnel_drop: "Funnel drop",
  cohort_pattern: "Cohort pattern",
  source_performance: "Source performance",
  power_user_pattern: "Power-user pattern",
  ai_quality_drift: "AI quality drift",
  cost_drift: "Cost drift",
  content_performance: "Content performance",
};

function formatSignal(s: Signal): string {
  const payload = s.payload as Record<string, unknown>;
  const label = HUMAN[s.detectorName] ?? s.detectorName.replace(/_/g, " ");
  const bits: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (k === "dedupeKey") continue;
    bits.push(`${k}=${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  return `  [${s.severity.toUpperCase()} ${Math.round(s.confidence * 100)}%] ${label}: ${bits.join(", ")}`;
}

export type InsightContext = {
  contextText: string;
  activeSignals: Signal[];
  hasData: boolean;
};

/**
 * Assemble the real-data context block. `now` anchors the windows; the metric
 * comparison is always this-week vs last-week regardless of lookback.
 */
export async function buildInsightContext(now: Date): Promise<InsightContext> {
  const weekStart = new Date(now.getTime() - 7 * 86_400_000);
  const prevStart = new Date(now.getTime() - 14 * 86_400_000);

  const [cur, prev, active] = await Promise.all([
    weeklySums(weekStart, now),
    weeklySums(prevStart, weekStart),
    // De-duplicated live view: one row per ongoing situation, snoozed items out.
    prisma.signal.findMany({
      where: {
        resolvedAt: null,
        confidence: { gte: 0.2 },
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
      },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }, { lastSeenAt: "desc" }],
      take: 60,
    }),
  ]);

  const metricsBlock = [
    "=== REAL NUMBERS (this week vs last week, platform-wide, test/demo excluded) ===",
    pctLine("New transactions", cur.transactionsCreated, prev.transactionsCreated),
    pctLine("Exchanges", cur.transactionsExchanged, prev.transactionsExchanged),
    pctLine("Completions", cur.transactionsCompleted, prev.transactionsCompleted),
    pctLine("Milestones confirmed", cur.milestonesConfirmed, prev.milestonesConfirmed),
    pctLine("Chases sent", cur.chasesSent, prev.chasesSent),
    pctLine("AI drafts", cur.aiDraftsGenerated, prev.aiDraftsGenerated),
    pctLine("New agency signups", cur.signups, prev.signups),
    pctLine("Logins", cur.logins, prev.logins),
    pctLine("AI spend (pence)", cur.aiSpendCents, prev.aiSpendCents),
  ].join("\n");

  // Operational snapshot derived from the de-duplicated active signals, so the
  // brief and the on-screen feed always agree.
  const countBy = (name: string) => active.filter((s) => s.detectorName === name).length;
  const snapshotBlock = [
    "=== LIVE OPERATIONAL SNAPSHOT (open situations right now) ===",
    `  Revenue at risk: ${countBy("revenue_at_risk")} files`,
    `  Silent agencies: ${countBy("silent_agency")}`,
    `  Clients gone quiet on the portal: ${countBy("portal_gone_quiet")}`,
    `  Files with chases not landing: ${countBy("chase_not_landing")}`,
    `  Solicitor confirmations stuck: ${countBy("solicitor_confirm_pending")}`,
    `  Quote inbox aging: ${countBy("quote_inbox_aging") > 0 ? "yes" : "no"}`,
  ].join("\n");

  const signalsBlock = active.length === 0
    ? "=== ACTIVE SIGNALS ===\n  None above threshold."
    : "=== ACTIVE SIGNALS (de-duplicated, most important first) ===\n" +
      active.map(formatSignal).join("\n");

  const hasData =
    cur.transactionsCreated + cur.milestonesConfirmed + prev.milestonesConfirmed + active.length > 0;

  return {
    contextText: [metricsBlock, snapshotBlock, signalsBlock].join("\n\n"),
    activeSignals: active,
    hasData,
  };
}
