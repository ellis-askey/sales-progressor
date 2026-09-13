"use server";

// AI Outreach server actions (Build Order F). Superadmin-only. The only action so
// far is a manual "generate a proposal" trigger: it runs one bounded strategy
// cycle (strategist -> reviewer -> conditional revision) and persists a proposal.
// It generates only: it cannot approve, launch, assign prospects, or send anything.
// There is no cron/scheduler; a proposal is created only on explicit invocation.

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { runStrategyCycle } from "@/lib/outreach/orchestrator";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");
  return session;
}

export type GenerateProposalResult =
  | { ok: true; experimentId: string; status: string; reviewOutcome: string; revisionRan: boolean }
  | { ok: false; error: string };

export async function runStrategyCycleAction(): Promise<GenerateProposalResult> {
  const session = await requireSuperAdmin();
  const res = await runStrategyCycle({ actorUserId: session.user.id });
  if (!res.ok) return { ok: false, error: `${res.stage}: ${res.error}` };
  revalidatePath("/command/ai-outreach");
  return {
    ok: true,
    experimentId: res.experimentId,
    status: res.status,
    reviewOutcome: res.reviewOutcome,
    revisionRan: res.revisionRan,
  };
}
