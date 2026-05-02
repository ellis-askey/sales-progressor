"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { commandDb } from "@/lib/command/prisma";
import { startExperiment, abandonExperiment, concludeExperiment } from "@/lib/services/experiments/lifecycle";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") redirect("/dashboard");
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

export async function startExperimentAction(experimentId: string) {
  await requireSuperAdmin();
  await startExperiment(experimentId);
  revalidatePath("/command/experiments");
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
