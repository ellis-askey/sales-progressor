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
