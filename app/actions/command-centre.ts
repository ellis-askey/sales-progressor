"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { redirect } from "next/navigation";
import { commandDb } from "@/lib/command/prisma";
import { startExperiment, abandonExperiment, concludeExperiment } from "@/lib/services/experiments/lifecycle";
import { anthropic } from "@/lib/anthropic";
import { METRIC_KEYS, METRIC_DEFS, type MetricKey } from "@/lib/command/experiment-metrics";
import { getSuggestionDataSummary, type ExperimentSuggestion } from "@/lib/command/experiment-suggestions";
import { getChaseDetail, type ChaseType, type ChaseDetail } from "@/lib/command/chasing";

export async function getChaseDetailAction(type: ChaseType, id: string): Promise<ChaseDetail | null> {
  await requireSuperAdmin();
  return getChaseDetail(type, id);
}

const clampWindow = (d: number, fallback: number) => Math.min(60, Math.max(7, Math.round(d || fallback)));
const validMetric = (k: string): MetricKey => (METRIC_KEYS.includes(k as MetricKey) ? (k as MetricKey) : "milestonesConfirmed");
const validGuardrails = (ks: string[] | undefined): string[] => (ks ?? []).filter((k) => METRIC_KEYS.includes(k as MetricKey));

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");
  return session;
}

export async function acknowledgeSignalAction(signalId: string) {
  await requireSuperAdmin();
  await commandDb.signal.update({
    where: { id: signalId },
    data: { acknowledged: true, acknowledgedAt: new Date() },
  });
  revalidatePath("/command/insights");
  revalidatePath("/command/overview");
}

// Mark every live, unacknowledged signal from one detector as dealt with in a
// single click — the escape hatch for a detector that fired a batch of the same
// kind of thing.
export async function acknowledgeDetectorSignalsAction(detectorName: string) {
  await requireSuperAdmin();
  await commandDb.signal.updateMany({
    where: { detectorName, acknowledged: false, resolvedAt: null },
    data: { acknowledged: true, acknowledgedAt: new Date() },
  });
  revalidatePath("/command/insights");
  revalidatePath("/command/overview");
}

// Snooze a signal for a number of days. It drops out of the feed and the briefs
// until then; if the situation is still live when it wakes, it resurfaces.
export async function snoozeSignalAction(signalId: string, days: number) {
  await requireSuperAdmin();
  const until = new Date();
  until.setUTCDate(until.getUTCDate() + Math.max(1, days));
  await commandDb.signal.update({
    where: { id: signalId },
    data: { snoozedUntil: until },
  });
  revalidatePath("/command/insights");
  revalidatePath("/command/overview");
}

// "Not useful" — clear it and resolve it so this instance stops surfacing.
export async function dismissSignalAction(signalId: string) {
  await requireSuperAdmin();
  await commandDb.signal.update({
    where: { id: signalId },
    data: { acknowledged: true, acknowledgedAt: new Date(), resolvedAt: new Date() },
  });
  revalidatePath("/command/insights");
  revalidatePath("/command/overview");
}

export async function startExperimentAction(experimentId: string) {
  await requireSuperAdmin();
  await startExperiment(experimentId);
  revalidatePath("/command/experiments");
}

// Enquiries-chase experiment: the founder ticks a chase send as "the solicitor
// replied by email" (rather than using the link), so email replies count in the
// response rate.
export async function setChaseRepliedByEmailAction(chaseSendId: string, on: boolean) {
  await requireSuperAdmin();
  await commandDb.chaseSend.update({
    where: { id: chaseSendId },
    data: { repliedByEmailAt: on ? new Date() : null },
  });
  revalidatePath("/command/enquiries-chase");
}

export async function abandonExperimentAction(experimentId: string, reason: string) {
  await requireSuperAdmin();
  await abandonExperiment(experimentId, reason);
  revalidatePath("/command/experiments");
}

export async function concludeExperimentAction(
  experimentId: string,
  outcome: "win" | "loss" | "inconclusive" | "mixed",
  conclusionNote: string
) {
  await requireSuperAdmin();
  await concludeExperiment(experimentId, outcome, conclusionNote);
  revalidatePath("/command/experiments");
}

const METRIC_FROM_DETECTOR: Record<string, string> = {
  signup_rate_drop:               "signups",
  activation_stall:               "signups",
  milestone_progression_slowdown: "milestonesConfirmed",
  chase_effectiveness_decline:    "chasesSent",
  cost_drift:                     "aiCostCents",
  ai_draft_adoption_drop:         "aiDraftsGenerated",
  retention_risk:                 "uniqueActiveUsers",
};

export async function promoteSignalToExperimentAction(signalId: string): Promise<{ experimentId: string }> {
  const session = await requireSuperAdmin();

  const signal = await commandDb.signal.findUniqueOrThrow({ where: { id: signalId } });

  const humanName = signal.detectorName.replace(/_/g, " ");
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const primaryMetric = METRIC_FROM_DETECTOR[signal.detectorName] ?? "milestonesConfirmed";

  const experiment = await commandDb.experiment.create({
    data: {
      name:            `${humanName} — ${dateStr}`,
      hypothesis:      "Promoted from signal. Add hypothesis here.",
      primaryMetric,
      guardrailMetrics: [],
      sourceSignalId:  signalId,
      sourceType:      "signal",
      createdByUserId: session.user.id,
    },
  });

  revalidatePath("/command/experiments");
  revalidatePath("/command/insights");

  return { experimentId: experiment.id };
}

// Create a proposed experiment from a test idea (catalogue or AI wildcard).
export async function createExperimentFromSuggestionAction(input: {
  title: string;
  change: string;
  why: string;
  metricKey: string;
  guardrailKeys: string[];
  durationDays: number;
  source: string;
}): Promise<{ experimentId: string }> {
  const session = await requireSuperAdmin();
  const days = clampWindow(input.durationDays, 21);
  const experiment = await commandDb.experiment.create({
    data: {
      name: input.title.slice(0, 200),
      hypothesis: input.change || input.title,
      notes: input.why || null,
      primaryMetric: validMetric(input.metricKey),
      guardrailMetrics: validGuardrails(input.guardrailKeys),
      baselineWindowDays: days,
      resultWindowDays: days,
      sourceType: input.source === "ai" ? "ai_suggestion" : "suggestion",
      createdByUserId: session.user.id,
    },
  });
  revalidatePath("/command/experiments");
  return { experimentId: experiment.id };
}

// Create a proposed experiment from scratch (the manual "New test" form).
export async function createManualExperimentAction(input: {
  name: string;
  hypothesis: string;
  primaryMetric: string;
  guardrailMetrics: string[];
  windowDays: number;
}): Promise<{ experimentId: string }> {
  const session = await requireSuperAdmin();
  if (!input.name.trim() || !input.hypothesis.trim()) {
    throw new Error("A name and a hypothesis are both required.");
  }
  const days = clampWindow(input.windowDays, 14);
  const experiment = await commandDb.experiment.create({
    data: {
      name: input.name.trim().slice(0, 200),
      hypothesis: input.hypothesis.trim(),
      primaryMetric: validMetric(input.primaryMetric),
      guardrailMetrics: validGuardrails(input.guardrailMetrics),
      baselineWindowDays: days,
      resultWindowDays: days,
      sourceType: "intuition",
      createdByUserId: session.user.id,
    },
  });
  revalidatePath("/command/experiments");
  return { experimentId: experiment.id };
}

// Edit a proposed experiment's hypothesis (fills the "Add hypothesis here"
// placeholder that signal-promoted experiments start with).
export async function updateExperimentHypothesisAction(id: string, hypothesis: string): Promise<void> {
  await requireSuperAdmin();
  if (!hypothesis.trim()) throw new Error("The hypothesis can't be empty.");
  await commandDb.experiment.update({ where: { id }, data: { hypothesis: hypothesis.trim() } });
  revalidatePath("/command/experiments");
}

// AI wildcard ideas — grounded in the same live numbers as the catalogue, but
// generated on demand by Claude. Returns unsaved suggestions (the founder
// proposes the ones worth running). Best-effort: returns [] on any failure.
export async function generateAiExperimentIdeasAction(): Promise<ExperimentSuggestion[]> {
  await requireSuperAdmin();
  const summary = await getSuggestionDataSummary();
  const metricList = METRIC_KEYS.map((k) => `"${k}" (${METRIC_DEFS[k].label})`).join(", ");
  const prompt = `You advise the founder of a UK estate-agency sales-progression SaaS on what to test to grow usage and revenue.

Current live data:
${summary}

Propose 2 sharp, specific growth experiments grounded in these numbers. Each must name one thing in the product to change and one metric to watch. Keep every field plain English with no jargon and no em dashes.

Return ONLY a JSON array (no prose) of objects with exactly these fields:
- "title": short plain-English name
- "change": one sentence on what we would change
- "why": one sentence rationale that refers to the data above
- "metricKey": one of ${metricList}
- "guardrailKeys": array of 0 to 2 of those metric keys
- "durationDays": integer between 14 and 28`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const parsed = JSON.parse(text.slice(start, end + 1)) as Array<Record<string, unknown>>;
    return parsed.slice(0, 3).map((p, i) => ({
      id: `ai-${i}`,
      source: "ai" as const,
      category: "AI idea",
      title: String(p.title ?? "Untitled idea"),
      change: String(p.change ?? ""),
      why: String(p.why ?? ""),
      metricKey: validMetric(String(p.metricKey ?? "")) ,
      guardrailKeys: Array.isArray(p.guardrailKeys) ? validGuardrails(p.guardrailKeys as string[]) as MetricKey[] : [],
      durationDays: Math.min(28, Math.max(14, Number(p.durationDays) || 21)),
      expectedDirection: "up" as const,
      opportunity: 0,
    }));
  } catch {
    return [];
  }
}
