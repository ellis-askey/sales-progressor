"use server";

// AI Outreach server actions (Build Order F + G). Superadmin-only, thin auth
// wrappers over lib/outreach/* logic. NONE of these send email, assign prospects,
// or launch anything. Approval marks intent only; H does the external work and
// verifies the content hash first.

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { runStrategyCycle } from "@/lib/outreach/orchestrator";
import {
  approveExperiment,
  rejectExperiment,
  discardExperiment,
  overrideReviewerReject,
  editExperiment,
  type EditPatch,
  type Ok,
  type Err,
  type ApproveResult,
} from "@/lib/outreach/approval-ops";

export type { EditPatch } from "@/lib/outreach/approval-ops";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");
  return session;
}

const REVALIDATE = "/command/ai-outreach";

// ── F: generate ──────────────────────────────────────────────────────────────
export type GenerateProposalResult =
  | { ok: true; experimentId: string; status: string; reviewOutcome: string; revisionRan: boolean }
  | { ok: false; error: string };

export async function runStrategyCycleAction(): Promise<GenerateProposalResult> {
  const session = await requireSuperAdmin();
  const res = await runStrategyCycle({ actorUserId: session.user.id });
  if (!res.ok) return { ok: false, error: `${res.stage}: ${res.error}` };
  revalidatePath(REVALIDATE);
  return { ok: true, experimentId: res.experimentId, status: res.status, reviewOutcome: res.reviewOutcome, revisionRan: res.revisionRan };
}

// ── G: approval workflow ─────────────────────────────────────────────────────
export async function editExperimentAction(experimentId: string, patch: EditPatch): Promise<Ok | Err> {
  const session = await requireSuperAdmin();
  const res = await editExperiment(experimentId, session.user.id, patch);
  if (res.ok) revalidatePath(REVALIDATE);
  return res;
}

export async function approveExperimentAction(experimentId: string, opts?: { confirmInfeasible?: boolean }): Promise<ApproveResult> {
  const session = await requireSuperAdmin();
  const res = await approveExperiment(experimentId, session.user.id, opts);
  if (res.ok) revalidatePath(REVALIDATE);
  return res;
}

export async function rejectExperimentAction(experimentId: string, reason?: string): Promise<Ok | Err> {
  await requireSuperAdmin();
  const res = await rejectExperiment(experimentId, reason);
  if (res.ok) revalidatePath(REVALIDATE);
  return res;
}

export async function discardExperimentAction(experimentId: string): Promise<Ok | Err> {
  await requireSuperAdmin();
  const res = await discardExperiment(experimentId);
  if (res.ok) revalidatePath(REVALIDATE);
  return res;
}

export async function overrideReviewerRejectAction(experimentId: string, reason: string): Promise<Ok | Err> {
  const session = await requireSuperAdmin();
  const res = await overrideReviewerReject(experimentId, session.user.id, reason);
  if (res.ok) revalidatePath(REVALIDATE);
  return res;
}
