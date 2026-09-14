// Approval workflow operations (Build Order G). Pure DB + validation logic,
// callable by the server actions (which own auth) and by tests. NONE of these
// send email, assign prospects, or launch anything. Approval marks intent only;
// H does the external work and verifies contentHash first.

import { commandDb } from "@/lib/command/prisma";
import { validateChallengerCopy, type ChallengerStep } from "./guardrails";
import { computeFeasibility, type Target, type SegmentFilter } from "./feasibility";
import { contentHash, type ApprovalSnapshot } from "./approval";

export type Ok = { ok: true };
export type Err = { ok: false; error: string };
export type ApproveResult = Ok | Err | { ok: false; requiresInfeasibleConfirm: true; error: string };

export type EditPatch = {
  challengerSteps?: ChallengerStep[];
  sampleSize?: number;
  allocationPct?: number;
  primaryMetric?: string;
  secondaryMetrics?: string[];
  targetSegment?: Target;
  exclusions?: SegmentFilter[];
};

// Statuses at which the proposal content is still mutable (pre-approval).
const EDITABLE_STATUSES = ["awaiting_approval", "draft"];

export async function editExperiment(experimentId: string, actorUserId: string | null, patch: EditPatch): Promise<Ok | Err> {
  const exp = await commandDb.outreachExperiment.findUnique({
    where: { id: experimentId },
    select: { id: true, status: true, targetSegment: true, exclusions: true, sampleSize: true },
  });
  if (!exp) return { ok: false, error: "Experiment not found." };
  if (!EDITABLE_STATUSES.includes(exp.status)) {
    return { ok: false, error: `This proposal is ${exp.status} and can no longer be edited. To change an approved proposal, reject it and create a new one.` };
  }

  // A human edit cannot bypass the app guardrails.
  if (patch.challengerSteps) {
    const g = validateChallengerCopy(patch.challengerSteps);
    if (!g.ok) {
      return { ok: false, error: `Edited challenger copy failed guardrails: ${g.violations.map((v) => `step ${v.step} ${v.field}: ${v.kind}`).join("; ")}` };
    }
  }

  // Recompute feasibility deterministically whenever target/exclusions/sample change.
  const target = (patch.targetSegment ?? (exp.targetSegment as Target | null)) ?? null;
  const exclusions = (patch.exclusions ?? (exp.exclusions as SegmentFilter[] | null)) ?? [];
  const recommendedSample = patch.sampleSize ?? exp.sampleSize ?? 0;
  const feasibility = await computeFeasibility({ target, exclusions, recommendedSample });

  await commandDb.outreachExperiment.update({
    where: { id: experimentId },
    data: {
      ...(patch.sampleSize !== undefined ? { sampleSize: patch.sampleSize } : {}),
      ...(patch.allocationPct !== undefined ? { allocationPct: patch.allocationPct } : {}),
      ...(patch.primaryMetric !== undefined ? { primaryMetric: patch.primaryMetric } : {}),
      ...(patch.secondaryMetrics !== undefined ? { secondaryMetrics: patch.secondaryMetrics } : {}),
      ...(patch.targetSegment !== undefined ? { targetSegment: patch.targetSegment } : {}),
      ...(patch.exclusions !== undefined ? { exclusions: patch.exclusions } : {}),
      feasibility,
      editedAfterReview: true,
      lastEditedById: actorUserId,
      lastEditedAt: new Date(),
    },
  });

  if (patch.challengerSteps) {
    const challenger = await commandDb.outreachVariant.findFirst({ where: { experimentId, role: "challenger" }, select: { id: true } });
    if (challenger) await commandDb.outreachVariant.update({ where: { id: challenger.id }, data: { emails: patch.challengerSteps } });
  }
  return { ok: true };
}

export async function approveExperiment(experimentId: string, actorUserId: string | null, opts?: { confirmInfeasible?: boolean }): Promise<ApproveResult> {
  const exp = await commandDb.outreachExperiment.findUnique({
    where: { id: experimentId },
    include: { variants: { select: { role: true, emails: true } } },
  });
  if (!exp) return { ok: false, error: "Experiment not found." };
  if (exp.status !== "awaiting_approval") {
    return { ok: false, error: `Only proposals awaiting approval can be approved (this is ${exp.status}).` };
  }

  // Infeasible proposals require a deliberate confirmation (never silent one-click).
  const feas = exp.feasibility as { feasible?: boolean } | null;
  if (feas && feas.feasible === false && !opts?.confirmInfeasible) {
    return {
      ok: false,
      requiresInfeasibleConfirm: true,
      error: "This proposal is currently infeasible at the recommended sample. Approval does not launch it; H will re-resolve eligibility and never exceed the actual eligible population. Confirm to approve anyway.",
    };
  }

  const control = exp.variants.find((v) => v.role === "control")?.emails ?? null;
  const challenger = exp.variants.find((v) => v.role === "challenger")?.emails ?? null;
  const snapshot: ApprovalSnapshot = {
    control,
    challenger,
    targetSegment: exp.targetSegment,
    exclusions: exp.exclusions,
    allocationPct: exp.allocationPct,
    primaryMetric: exp.primaryMetric,
    secondaryMetrics: exp.secondaryMetrics,
  };
  const hash = contentHash(snapshot);

  await commandDb.outreachExperiment.update({
    where: { id: experimentId },
    data: {
      status: "approved",
      approvedById: actorUserId,
      approvedAt: new Date(),
      approvedSnapshot: snapshot as object,
      contentHash: hash,
    },
  });
  return { ok: true };
}

export async function rejectExperiment(experimentId: string, reason?: string): Promise<Ok | Err> {
  const exp = await commandDb.outreachExperiment.findUnique({ where: { id: experimentId }, select: { status: true } });
  if (!exp) return { ok: false, error: "Experiment not found." };
  if (exp.status === "approved" || exp.status === "archived") {
    return { ok: false, error: `Cannot reject a ${exp.status} proposal.` };
  }
  await commandDb.outreachExperiment.update({
    where: { id: experimentId },
    data: { status: "rejected", humanRejectionReason: reason?.slice(0, 1000) ?? null },
  });
  return { ok: true };
}

export async function discardExperiment(experimentId: string): Promise<Ok | Err> {
  const exp = await commandDb.outreachExperiment.findUnique({ where: { id: experimentId }, select: { status: true } });
  if (!exp) return { ok: false, error: "Experiment not found." };
  await commandDb.outreachExperiment.update({ where: { id: experimentId }, data: { status: "archived" } });
  return { ok: true };
}

export async function overrideReviewerReject(experimentId: string, actorUserId: string | null, reason: string): Promise<Ok | Err> {
  if (!reason || reason.trim().length < 3) return { ok: false, error: "An override reason is required." };
  const exp = await commandDb.outreachExperiment.findUnique({ where: { id: experimentId }, select: { status: true, reviewOutcome: true } });
  if (!exp) return { ok: false, error: "Experiment not found." };
  if (!(exp.status === "draft" && exp.reviewOutcome === "reject")) {
    return { ok: false, error: "Only a reviewer-rejected draft can be overridden." };
  }
  // Promote to awaiting_approval but PRESERVE reviewOutcome=reject and reviewerResult
  // so it stays obvious GPT originally rejected it. Stamp the override audit.
  await commandDb.outreachExperiment.update({
    where: { id: experimentId },
    data: {
      status: "awaiting_approval",
      reviewerOverrideReason: reason.slice(0, 1000),
      reviewerOverriddenAt: new Date(),
      reviewerOverriddenById: actorUserId,
    },
  });
  return { ok: true };
}
