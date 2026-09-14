// Read-only page data for the AI Outreach Command Centre surface (Build Order E).
// Server-only readers over the outreach models. No writes, no AI calls, no sends.

import { commandDb } from "@/lib/command/prisma";
import { getExperimentRollup, type ExperimentRollup } from "./metrics";

export type ExperimentListItem = {
  id: string;
  title: string;
  status: string;
  primaryMetric: string | null;
  createdAt: Date;
  reviewDate: Date | null;
  hypothesis: string | null;
  rationale: string | null;
  targetSegment: unknown;
  exclusions: unknown;
  strategistReasoning: string | null;
  reviewerCritique: string | null;
  strategistRevision: string | null;
  finalConclusion: string | null;
  reviewOutcome: string | null;
  reviewerResult: unknown;
  feasibility: unknown;
  originalProposal: unknown;
  secondaryMetrics: unknown;
  sampleSize: number | null;
  allocationPct: number | null;
  editedAfterReview: boolean;
  lastEditedAt: Date | null;
  humanRejectionReason: string | null;
  reviewerOverrideReason: string | null;
  reviewerOverriddenAt: Date | null;
  approvedAt: Date | null;
  contentHash: string | null;
  variants: { id: string; role: string; name: string; emails: unknown }[];
  modelRuns: {
    purpose: string;
    provider: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    costPence: number;
    createdAt: Date;
  }[];
  rollup: ExperimentRollup | null;
};

export async function listExperimentsWithDetail(): Promise<ExperimentListItem[]> {
  const exps = await commandDb.outreachExperiment.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      primaryMetric: true,
      createdAt: true,
      reviewDate: true,
      hypothesis: true,
      rationale: true,
      targetSegment: true,
      exclusions: true,
      strategistReasoning: true,
      reviewerCritique: true,
      strategistRevision: true,
      finalConclusion: true,
      reviewOutcome: true,
      reviewerResult: true,
      feasibility: true,
      originalProposal: true,
      secondaryMetrics: true,
      sampleSize: true,
      allocationPct: true,
      editedAfterReview: true,
      lastEditedAt: true,
      humanRejectionReason: true,
      reviewerOverrideReason: true,
      reviewerOverriddenAt: true,
      approvedAt: true,
      contentHash: true,
      variants: { select: { id: true, role: true, name: true, emails: true } },
      modelRuns: {
        orderBy: { createdAt: "desc" },
        select: { purpose: true, provider: true, model: true, tokensIn: true, tokensOut: true, costPence: true, createdAt: true },
      },
    },
  });

  const out: ExperimentListItem[] = [];
  for (const e of exps) {
    out.push({ ...e, rollup: await getExperimentRollup(e.id) });
  }
  return out;
}

export type LearningItem = {
  id: string;
  statement: string;
  status: string;
  segment: string | null;
  metric: string | null;
  sampleSize: number | null;
  evidenceSummary: string | null;
  evidenceExperimentIds: string[];
  firstObservedAt: Date;
  lastReviewedAt: Date;
  stillActive: boolean;
};

export async function listLearnings(): Promise<LearningItem[]> {
  return commandDb.outreachLearning.findMany({
    orderBy: [{ stillActive: "desc" }, { lastReviewedAt: "desc" }],
    select: {
      id: true,
      statement: true,
      status: true,
      segment: true,
      metric: true,
      sampleSize: true,
      evidenceSummary: true,
      evidenceExperimentIds: true,
      firstObservedAt: true,
      lastReviewedAt: true,
      stillActive: true,
    },
  });
}

export type CycleListItem = {
  id: string;
  outcome: string;
  failedStage: string | null;
  error: string | null;
  initiatedById: string | null;
  experimentId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  modelRuns: { purpose: string; provider: string; model: string; promptVersion: string | null; tokensIn: number; tokensOut: number; costPence: number }[];
};

// Cycle history: successful AND failed cycles, so failed model runs (which have no
// experiment) remain auditable. Newest first.
export async function listCycles(limit = 50): Promise<CycleListItem[]> {
  return commandDb.strategyCycle.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      outcome: true,
      failedStage: true,
      error: true,
      initiatedById: true,
      experimentId: true,
      startedAt: true,
      finishedAt: true,
      modelRuns: {
        orderBy: { createdAt: "asc" },
        select: { purpose: true, provider: true, model: true, promptVersion: true, tokensIn: true, tokensOut: true, costPence: true },
      },
    },
  });
}

export type EligibilityCounts = {
  eligibleNow: number;
  suppressedOptedOut: number;
  suppressedBounced: number;
  alreadyConverted: number;
};

// Deterministic eligibility counts (application-controlled), counts only, no PII.
export async function getEligibilityCounts(): Promise<EligibilityCounts> {
  const [eligibleNow, optedOut, bounced, converted] = await Promise.all([
    commandDb.prospect.count({
      where: {
        archivedAt: null,
        optedOutAt: null,
        bouncedAt: null,
        convertedAgencyId: null,
        OR: [{ generalEmail: { not: null } }, { contacts: { some: { email: { not: null } } } }],
      },
    }),
    commandDb.prospect.count({ where: { optedOutAt: { not: null } } }),
    commandDb.prospect.count({ where: { bouncedAt: { not: null } } }),
    commandDb.prospect.count({ where: { convertedAgencyId: { not: null } } }),
  ]);
  return { eligibleNow, suppressedOptedOut: optedOut, suppressedBounced: bounced, alreadyConverted: converted };
}

export type AiActivity = {
  totalRuns: number;
  totalCostPence: number;
  totalTokensIn: number;
  totalTokensOut: number;
  recent: {
    purpose: string;
    provider: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    costPence: number;
    createdAt: Date;
  }[];
};

export async function getAiActivity(limit = 50): Promise<AiActivity> {
  const [agg, recent] = await Promise.all([
    commandDb.aiModelRun.aggregate({ _count: { _all: true }, _sum: { costPence: true, tokensIn: true, tokensOut: true } }),
    commandDb.aiModelRun.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { purpose: true, provider: true, model: true, tokensIn: true, tokensOut: true, costPence: true, createdAt: true },
    }),
  ]);
  return {
    totalRuns: agg._count._all,
    totalCostPence: agg._sum.costPence ?? 0,
    totalTokensIn: agg._sum.tokensIn ?? 0,
    totalTokensOut: agg._sum.tokensOut ?? 0,
    recent,
  };
}
