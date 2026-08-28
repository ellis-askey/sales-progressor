"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { redirect } from "next/navigation";
import { commandDb } from "@/lib/command/prisma";
import { startExperiment, abandonExperiment, concludeExperiment } from "@/lib/services/experiments/lifecycle";

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
