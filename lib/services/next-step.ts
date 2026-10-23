// The single "what's the one most important thing about this file right now"
// line shown in the Files list (All / Active tabs). It reads the SAME chase
// state the Reminders page computes — resolveAutopilot (auto vs handed-to-you,
// with honest reasons) + classifyReminder (date buckets off the reminder's
// next-raise date, never a stale task date) — so the two screens can never
// disagree. Collapses a file's reminders to one headline by a worst-first ladder,
// folding in the "ready to exchange" / "waiting on the chain" milestone states.
//
// Why reuse getAgentReminderLogs rather than re-derive: it already loads each
// file's live chase + computes the time-based hand-overs (autopilot finished /
// solicitor gone quiet). Re-deriving a lighter version is exactly the bug class
// we're removing (a second source of truth that drifts). It runs cross-file in a
// handful of queries per page, like the work-queue.

import { prisma } from "@/lib/prisma";
import { getAgentReminderLogs } from "@/lib/services/reminders";
import { resolveAutopilot, type AutopilotFlags, type AutopilotStatus } from "@/lib/services/reminder-autopilot";
import { classifyReminder } from "@/lib/reminders/classify";
import { pickLiveChase } from "@/lib/reminders/pick-live-chase";
import { toUKDateStr } from "@/lib/utils";
import { addWorkingDays } from "@/lib/emails/working-hours";
import type { AgentVisibility } from "@/lib/services/agent";

export type NextStepTone = "danger" | "warn" | "ready" | "auto" | "chain" | "muted";
export type FileNextStep = { text: string; tone: NextStepTone };

// The milestone/chain readiness a row already knows about itself (computed in
// listTransactions), threaded in so the collapser can interleave "Ready to
// exchange" / "Waiting on the chain" with the chase states in one precedence.
export type RowReadiness = {
  id: string;
  status: string;
  exchanged: boolean;      // exchangedAt set
  ourSideReady: boolean;   // both solicitors confirmed (VM18 + PM25)
  readyToExchange: boolean;// ourSideReady AND (no chain OR chain confirmed)
  inChain: boolean;
  chainReady: boolean;     // chain link confirmed ready to exchange
};

type LogShape = Awaited<ReturnType<typeof getAgentReminderLogs>>[number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(d: Date): string {
  const x = new Date(d);
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`;
}

// "the buyer" / "the seller" / "…'s solicitor" from the milestone code (PM = buyer
// side, VM = seller side) and the pipeline that's chasing. Matches the Reminders
// card copy derivation.
function party(code: string | null | undefined, pipeline: "client" | "solicitor" | null): string {
  const buyer = !!code?.startsWith("PM");
  if (pipeline === "solicitor") return buyer ? "the buyer's solicitor" : "the seller's solicitor";
  return buyer ? "the buyer" : "the seller";
}

// A manual (handed-to-you) chase → a short, honest headline + tone. Red = act now,
// amber = a fixable blocker. Reads the resolveAutopilot category/reason + the date
// bucket (escalated beats everything).
function needsYouHeadline(st: Extract<AutopilotStatus, { kind: "manual" }>, code: string | null | undefined, escalated: boolean): FileNextStep {
  const buyer = !!code?.startsWith("PM");
  const client = buyer ? "the buyer" : "the seller";
  if (escalated) return { text: "Escalated, needs you", tone: "danger" };
  switch (st.category) {
    case "solicitor_handover": return { text: `${buyer ? "Buyer's" : "Seller's"} solicitor's gone quiet, chase them`, tone: "danger" };
    case "exhausted":          return { text: "Autopilot's done, over to you", tone: "danger" };
    case "blocker_client_email": {
      const bounced = !!st.reason && /bounc|fail/i.test(st.reason);
      return { text: bounced ? `Chase bounced, update ${client}'s email` : `No email for ${client}, add one`, tone: "warn" };
    }
    case "blocker_solicitor":  return { text: "No solicitor on file, add one", tone: "warn" };
    case "autochase_off":      return { text: "Auto-chase off, chase manually", tone: "warn" };
    case "info":
    default: {
      if (st.reason && /opted out/i.test(st.reason)) return { text: `${buyer ? "Buyer" : "Seller"} opted out, reach them another way`, tone: "warn" };
      return { text: "Needs you", tone: "danger" };
    }
  }
}

type Cat =
  | { kind: "needs_you"; step: FileNextStep }
  | { kind: "auto"; code: string | null; pipeline: "client" | "solicitor" }
  | { kind: "auto_paused"; resume: Date }
  | { kind: "coming_up"; code: string | null; when: Date }
  | { kind: "chased"; code: string | null; when: Date }
  | { kind: "snoozed"; until: Date };

// Collapse one file's reminder logs (+ its milestone readiness) to the single
// headline, worst-first.
export function fileNextStep(logs: LogShape[], autopilot: Map<string, AutopilotStatus>, now: Date, r: RowReadiness): FileNextStep {
  const cats: Cat[] = [];
  const upcomingCutoff = toUKDateStr(addWorkingDays(now, 3));

  for (const log of logs) {
    const bucket = classifyReminder(log, now);
    if (bucket === "snoozed") { if (log.snoozedUntil) cats.push({ kind: "snoozed", until: log.snoozedUntil }); continue; }
    const st = autopilot.get(log.id);
    const code = log.reminderRule.targetMilestoneCode;
    if (st?.kind === "auto") {
      if (st.pausedUntil) cats.push({ kind: "auto_paused", resume: new Date(st.pausedUntil) });
      else cats.push({ kind: "auto", code, pipeline: st.pipeline });
      continue;
    }
    // manual
    if (bucket === "escalated" || bucket === "overdue" || bucket === "due_today") {
      cats.push({ kind: "needs_you", step: needsYouHeadline((st as Extract<AutopilotStatus, { kind: "manual" }>) ?? { kind: "manual", reason: null, category: "info" }, code, bucket === "escalated") });
    } else if (bucket === "upcoming") {
      const within = toUKDateStr(log.nextDueDate) <= upcomingCutoff;
      if (within) cats.push({ kind: "coming_up", code, when: log.nextDueDate });
      else if ((pickLiveChase(log.chaseTasks)?.manualChaseCount ?? 0) > 0) cats.push({ kind: "chased", code, when: log.nextDueDate });
      // else: beyond the window and never chased — nothing to headline from this log
    }
  }

  // Worst-first precedence.
  const nu = cats.find((c): c is Extract<Cat, { kind: "needs_you" }> => c.kind === "needs_you");
  if (nu) return nu.step;

  if (r.readyToExchange) return { text: "Ready to exchange", tone: "ready" };

  const auto = cats.find((c): c is Extract<Cat, { kind: "auto" }> => c.kind === "auto");
  if (auto) return { text: `Auto-chasing ${party(auto.code, auto.pipeline)}`, tone: "auto" };

  const paused = cats.find((c): c is Extract<Cat, { kind: "auto_paused" }> => c.kind === "auto_paused");
  if (paused) return { text: `Auto-chase resumes ${shortDate(paused.resume)}`, tone: "muted" };

  const cu = cats.find((c): c is Extract<Cat, { kind: "coming_up" }> => c.kind === "coming_up");
  if (cu) return { text: `You'll chase ${party(cu.code, "client")} · ${shortDate(cu.when)}`, tone: "muted" };

  const ch = cats.find((c): c is Extract<Cat, { kind: "chased" }> => c.kind === "chased");
  if (ch) return { text: `Chased ${party(ch.code, "client")} · raises ${shortDate(ch.when)}`, tone: "muted" };

  const sn = cats.find((c): c is Extract<Cat, { kind: "snoozed" }> => c.kind === "snoozed");
  if (sn) return { text: `Snoozed until ${shortDate(sn.until)}`, tone: "muted" };

  // No live chase. Our side ready + genuinely waiting on the chain.
  if (r.ourSideReady && r.inChain && !r.chainReady) return { text: "Waiting on the chain", tone: "chain" };
  if (r.exchanged) return { text: "Awaiting completion", tone: "muted" };
  return { text: "All progressing", tone: "muted" };
}

/**
 * Compute the next-step headline for every ACTIVE row, reusing the Reminders
 * engine. Returns a map keyed by transaction id; callers override each row's
 * health.nextStep with it. Non-active rows are left untouched (their next-step is
 * null). `vis` is the same visibility the page already built for the Reminders /
 * work-queue surfaces.
 */
export async function resolveFileNextSteps(vis: AgentVisibility, rows: RowReadiness[], now: Date = new Date()): Promise<Map<string, FileNextStep>> {
  const out = new Map<string, FileNextStep>();
  const active = rows.filter((r) => r.status === "active");
  if (active.length === 0) return out;

  const logs = await getAgentReminderLogs(vis);

  const agencyIds = [...new Set(logs.map((l) => l.transaction.agencyId).filter((a): a is string => !!a))];
  const [solSettings, agencies] = await Promise.all([
    prisma.solicitorChaseSettings.findFirst({ select: { enabledByDefault: true } }),
    agencyIds.length
      ? prisma.agency.findMany({ where: { id: { in: agencyIds } }, select: { id: true, chaseEmailsEnabled: true, solicitorChaseEnabled: true } })
      : Promise.resolve([] as { id: string; chaseEmailsEnabled: boolean; solicitorChaseEnabled: boolean }[]),
  ]);
  const flags: AutopilotFlags = {
    clientChaseEnabled: process.env.CLIENT_CHASE_ENABLED === "true",
    solicitorGlobalEnabled: solSettings?.enabledByDefault ?? false,
    agencyClientChase: new Map(agencies.map((a) => [a.id, a.chaseEmailsEnabled])),
    agencySolicitorChase: new Map(agencies.map((a) => [a.id, a.solicitorChaseEnabled])),
  };
  const autopilot = resolveAutopilot(logs, flags);

  const byTx = new Map<string, LogShape[]>();
  for (const l of logs) {
    const arr = byTx.get(l.transaction.id) ?? [];
    arr.push(l);
    byTx.set(l.transaction.id, arr);
  }

  for (const row of active) {
    out.set(row.id, fileNextStep(byTx.get(row.id) ?? [], autopilot, now, row));
  }
  return out;
}
