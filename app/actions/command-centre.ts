"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { startExperiment, abandonExperiment } from "@/lib/services/experiments/lifecycle";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? "ellisaskey@googlemail.com";

async function requireFounder() {
  const session = await requireSession();
  if (session.user.email !== FOUNDER_EMAIL) redirect("/admin");
  return session;
}

export async function acknowledgeSignalAction(signalId: string) {
  await requireFounder();
  await prisma.signal.update({
    where: { id: signalId },
    data: { acknowledged: true, acknowledgedAt: new Date() },
  });
  revalidatePath("/admin/command-centre/signals");
}

export async function startExperimentAction(experimentId: string) {
  await requireFounder();
  await startExperiment(experimentId);
  revalidatePath("/admin/command-centre/experiments");
}

export async function abandonExperimentAction(experimentId: string, reason: string) {
  await requireFounder();
  await abandonExperiment(experimentId, reason);
  revalidatePath("/admin/command-centre/experiments");
}

export async function concludeExperimentAction(
  experimentId: string,
  outcome: "win" | "loss" | "inconclusive" | "mixed",
  conclusionNote: string
) {
  await requireFounder();
  const { concludeExperiment } = await import("@/lib/services/experiments/lifecycle");
  await concludeExperiment(experimentId, outcome, conclusionNote);
  revalidatePath("/admin/command-centre/experiments");
}
