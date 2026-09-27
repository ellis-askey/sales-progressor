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
import { commandDb } from "@/lib/command/prisma";
import { discoverAgencies } from "@/lib/outreach/discover";
import { runStrategyCycle } from "@/lib/outreach/orchestrator";
import { preflightExperiment, launchExperiment, resumeLaunch, type Preflight, type LaunchResult } from "@/lib/outreach/launch";
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

// ── Find agents: discover UK estate agents we don't already hold, and feed them
// into the existing prospect-import pipeline (research + dedupe + create). The
// launch flow then sends the experiment to the newly-added prospects. Discovery
// only skips names we already hold; enrichment + dedupe happen in the pipeline.
export type FindAgentsResult =
  | { ok: true; batchId: string; found: number; agencies: { name: string; location: string }[] }
  | { ok: false; error: string };

export async function findAgentsAction(area: string, count: number): Promise<FindAgentsResult> {
  const session = await requireSuperAdmin();
  const a = area.trim();
  if (!a) return { ok: false, error: "Enter an area to search (for example Kent, or Leeds)." };
  const n = Math.max(1, Math.min(50, Math.floor(count) || 25));

  // Names we already hold, so discovery doesn't return duplicates.
  const existing = await commandDb.prospect.findMany({ select: { agencyName: true } });
  const excludeNames = existing.map((p) => p.agencyName).filter(Boolean);

  let discovered: { name: string; location: string }[];
  try {
    discovered = await discoverAgencies(a, n, excludeNames);
  } catch (err) {
    console.error("[find-agents] discovery failed", err);
    return { ok: false, error: "Could not search for agents just now. Try again." };
  }
  if (discovered.length === 0) return { ok: false, error: "No new agents found for that area. Try a broader area." };

  // Feed them into the existing import batch pipeline. The enrichment step
  // researches, dedupes and creates each prospect; the UI loop below drives it,
  // and the prospect-import-drain cron finishes anything left.
  const batch = await commandDb.prospectImportBatch.create({
    data: {
      createdById: session.user.id,
      total: discovered.length,
      status: "processing",
      items: { create: discovered.map((d) => ({ inputAgency: d.name, inputLocation: d.location })) },
    },
  });
  revalidatePath("/command/prospects");
  return { ok: true, batchId: batch.id, found: discovered.length, agencies: discovered };
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

// ── H: launch (preflight / launch / resume) ──────────────────────────────────
// These use the real SendGrid transport in production. Per the Build Order H
// gate, a real end-to-end email test is separately approved; this is not invoked
// during verification (tests drive lib/outreach/launch with a mocked transport).

export async function preflightExperimentAction(experimentId: string): Promise<Preflight | { error: string }> {
  await requireSuperAdmin();
  return preflightExperiment(experimentId);
}

export async function launchExperimentAction(experimentId: string, opts?: { confirmUnderSample?: boolean }): Promise<LaunchResult> {
  const session = await requireSuperAdmin();
  const res = await launchExperiment({ experimentId, actorUserId: session.user.id, confirmUnderSample: opts?.confirmUnderSample });
  if ("ok" in res && res.ok) revalidatePath(REVALIDATE);
  return res;
}

export async function resumeLaunchAction(experimentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperAdmin();
  await resumeLaunch({ experimentId });
  revalidatePath(REVALIDATE);
  return { ok: true };
}
