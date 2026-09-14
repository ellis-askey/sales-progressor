// The bounded strategy cycle (Build Order F): Claude strategist proposes ONE
// experiment, GPT-5.5 adversarially reviews it, and Claude revises ONCE — but only
// when the review actually asks for changes. Invariant: max 3 model calls, never a
// 4th. A "sound" review with zero actionable objections skips the revision (2
// calls). It PERSISTS a proposal (draft on reject, else awaiting_approval) with two
// frozen variants (incumbent control snapshot + challenger). It NEVER assigns
// prospects, NEVER sends, NEVER launches, NEVER writes learnings. Provider or
// validation failure fails closed: no experiment is created.
//
// The models receive only the aggregated, PII-free context. Sample feasibility is
// computed deterministically in app code (feasibility.ts). Personalisation and
// voice are enforced by app-code guardrails (guardrails.ts).

import { z } from "zod";
import { getStrategist, getReviewer, runStructured, type AIProvider } from "./ai";
import { buildOutreachContext, serializeContext } from "./context";
import { validateChallengerCopy, type CopyViolation } from "./guardrails";
import { computeFeasibility, type Feasibility } from "./feasibility";
import { outcomeForStage, type CycleStage } from "./approval";
import { DEFAULT_SEQUENCE, FLOW_SENDER_NAME, buildStepDraft } from "@/lib/prospects/flow";
import { commandDb } from "@/lib/command/prisma";

const METRICS = ["reply", "interested", "converted", "activated_agency"] as const;
const DIMENSIONS = ["source", "branch_structure", "contact_history", "region"] as const;
const PLACEHOLDERS = { firstName: "{{firstName}}", agencyName: "{{agencyName}}", senderName: FLOW_SENDER_NAME };

export const PROMPT_VERSIONS = { strategist: "strategist-v1", reviewer: "reviewer-v1", revision: "revision-v1" } as const;

const SegmentFilterSchema = z.object({ dimension: z.enum(DIMENSIONS), values: z.array(z.string()) });
// Explicit targeting: everyone eligible, or a specific segment. "all_eligible" is
// a first-class kind, never a fake source value.
const TargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all_eligible") }),
  z.object({ kind: z.literal("segment"), dimension: z.enum(DIMENSIONS), values: z.array(z.string()) }),
]);
const StepSchema = z.object({ stepIndex: z.number().int(), subject: z.string(), body: z.string(), gapDays: z.number().int() });

const ProposalSchema = z.object({
  title: z.string(),
  hypothesis: z.string(),
  rationale: z.string(),
  targetSegment: TargetSchema,
  exclusions: z.array(SegmentFilterSchema),
  sampleSizeRecommendation: z.number().int(),
  allocationPct: z.number().int(),
  primaryMetric: z.enum(METRICS),
  secondaryMetrics: z.array(z.enum(METRICS)),
  reviewConditions: z.object({ minPerVariant: z.number().int(), reviewAfterDays: z.number().int() }),
  challenger: z.object({ steps: z.array(StepSchema) }),
  strategistReasoning: z.string(),
});
export type Proposal = z.infer<typeof ProposalSchema>;

const ObjectionSchema = z.object({
  category: z.string(),
  severity: z.enum(["low", "med", "high"]),
  issue: z.string(),
  recommendation: z.string(),
});
const ReviewSchema = z.object({
  overallAssessment: z.enum(["sound", "needs_revision", "reject"]),
  objections: z.array(ObjectionSchema),
  unsupportedPersonalisation: z.array(z.string()),
  sampleSizeConcern: z.string().nullable(),
  suggestedBetterMetric: z.string().nullable(),
  alternativeInterpretation: z.string().nullable(),
  summary: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;

const RevisionSchema = ProposalSchema.extend({ responseToCritique: z.string() });

// Explicit output shape. Claude has no native json_schema mode here (only OpenAI
// does), so the strategist/revision prompts must spell out the exact JSON shape or
// the model omits fields. zod remains the final gate regardless.
const PROPOSAL_SHAPE = `Return a single JSON object with EXACTLY these keys and types:
{
  "title": string,
  "hypothesis": string,
  "rationale": string,
  "targetSegment": { "kind": "all_eligible" }  OR  { "kind": "segment", "dimension": "source" | "branch_structure" | "contact_history" | "region", "values": string[] },
  "exclusions": [ { "dimension": "source" | "branch_structure" | "contact_history" | "region", "values": string[] } ],
  "sampleSizeRecommendation": integer,
  "allocationPct": integer,
  "primaryMetric": "reply" | "interested" | "converted" | "activated_agency",
  "secondaryMetrics": ("reply" | "interested" | "converted" | "activated_agency")[],
  "reviewConditions": { "minPerVariant": integer, "reviewAfterDays": integer },
  "challenger": { "steps": [ { "stepIndex": integer, "gapDays": integer, "subject": string, "body": string } ] },
  "strategistReasoning": string
}
"exclusions" and "secondaryMetrics" may be empty arrays. Every key is required.`;

const REVIEW_SHAPE = `Return a single JSON object with EXACTLY these keys:
{
  "overallAssessment": "sound" | "needs_revision" | "reject",
  "objections": [ { "category": string, "severity": "low" | "med" | "high", "issue": string, "recommendation": string } ],
  "unsupportedPersonalisation": string[],
  "sampleSizeConcern": string | null,
  "suggestedBetterMetric": string | null,
  "alternativeInterpretation": string | null,
  "summary": string
}
Arrays may be empty; nullable fields must be null when not applicable. Every key is required.`;

const STRATEGIST_SYSTEM = [
  "You are the growth strategist for The Sales Progressor, a UK estate-agency sales-progression product.",
  "Using ONLY the aggregated context provided (you never receive prospect identities), propose exactly ONE outbound experiment.",
  "You author the CHALLENGER only. The control is the current incumbent sequence shown in the context; do not rewrite it.",
  "Target either everyone eligible (targetSegment { kind: 'all_eligible' }) or ONE of the four available segment dimensions (targetSegment { kind: 'segment', dimension, values }). Never invent a segment; if the data does not support a specific segment, use all_eligible.",
  "Optimise toward the deepest reliable objective (an activated agency: a converted agency with at least one genuine sale). Opens and clicks are diagnostic only.",
  "Be honest about small samples. Personalise ONLY with {{firstName}} and {{agencyName}}, and never assert an unsupported fact about a prospect.",
  "Follow the voice rules in the context. No em dashes. No exclamation marks. Do not use the word 'outsource'.",
  "Write the COMPLETE challenger campaign: a subject and body for the initial email, follow-up 1, and follow-up 2 only if justified.",
  "Return output matching the required schema exactly.",
].join(" ") + "\n\n" + PROPOSAL_SHAPE;

const REVIEWER_SYSTEM = [
  "You are an adversarial reviewer of an outbound-experiment proposal for The Sales Progressor.",
  "Your job is to DISPROVE or weaken the proposal, not to agree with it.",
  "Assess: whether the data supports the conclusion; sample size; confounding variables; segmentation validity; whether the challenger actually tests the stated hypothesis; unsupported assumptions; invented or unsupported personalisation; wording risks; a more plausible alternative interpretation of the data; and whether the primary metric is the right one.",
  "Be specific and structured. Set overallAssessment to 'sound' only if there is genuinely nothing that needs changing.",
].join(" ") + "\n\n" + REVIEW_SHAPE;

const REVISION_SYSTEM = [
  "You are the growth strategist for The Sales Progressor. A reviewer has critiqued your proposal.",
  "Produce ONE revised proposal that addresses the critique, in the same schema, plus a short responseToCritique explaining what you changed and why.",
  "This is your only revision. Keep every rule from before (challenger only, allow-listed personalisation only, voice rules, no 'outsource').",
].join(" ") + "\n\n" + PROPOSAL_SHAPE + '\nAlso include a "responseToCritique": string key explaining what you changed and why.';

function reviewerPrompt(contextJson: string, proposal: Proposal): string {
  return `CONTEXT:\n${contextJson}\n\nSTRATEGIST PROPOSAL TO REVIEW:\n${JSON.stringify(proposal)}`;
}
function revisionPrompt(contextJson: string, proposal: Proposal, review: Review): string {
  return `CONTEXT:\n${contextJson}\n\nYOUR ORIGINAL PROPOSAL:\n${JSON.stringify(proposal)}\n\nREVIEWER CRITIQUE:\n${JSON.stringify(review)}`;
}

function summariseViolations(v: CopyViolation[]): string {
  return v.map((x) => `step ${x.step} ${x.field}: ${x.kind} (${x.detail})`).join("; ");
}

export type StrategyCycleResult =
  | {
      ok: true;
      experimentId: string;
      cycleId: string;
      status: string;
      reviewOutcome: string;
      revisionRan: boolean;
      modelCalls: number;
      feasibility: Feasibility;
      proposal: Proposal;
      review: Review;
    }
  | { ok: false; cycleId: string; stage: string; error: string };

export async function runStrategyCycle(opts: {
  actorUserId: string | null;
  strategist?: AIProvider;
  reviewer?: AIProvider;
}): Promise<StrategyCycleResult> {
  const strategist = opts.strategist ?? getStrategist();
  const reviewer = opts.reviewer ?? getReviewer();
  let modelCalls = 0;

  // A StrategyCycle is created up front so EVERY model call (even ones from a
  // cycle that later fails before any experiment exists) is linked via cycleId and
  // stays auditable. finishedAt=null marks it in-progress. Failed-run history is
  // never auto-deleted in production.
  const cycle = await commandDb.strategyCycle.create({
    data: { outcome: "succeeded", initiatedById: opts.actorUserId },
    select: { id: true },
  });
  const cycleId = cycle.id;

  // Finalise the cycle as failed and return a fail result (no experiment). The
  // AiModelRuns are already linked to the cycle via cycleId.
  async function failCycle(stage: CycleStage, error: string): Promise<StrategyCycleResult> {
    await commandDb.strategyCycle.update({
      where: { id: cycleId },
      data: { outcome: outcomeForStage(stage), failedStage: stage, error: error.slice(0, 500), finishedAt: new Date() },
    });
    return { ok: false, cycleId, stage, error };
  }

  const ctx = await buildOutreachContext();
  const { json: contextJson } = serializeContext(ctx);

  // ── 1. Strategist proposal ──
  let proposal: Proposal;
  try {
    const run = await runStructured({
      provider: strategist,
      purpose: "strategist",
      schema: ProposalSchema,
      system: STRATEGIST_SYSTEM,
      prompt: contextJson,
      promptVersion: PROMPT_VERSIONS.strategist,
      cycleId,
    });
    modelCalls++;
    proposal = run.data;
  } catch (e) {
    return failCycle("strategist", e instanceof Error ? e.message : "strategist failed");
  }

  const g1 = validateChallengerCopy(proposal.challenger.steps);
  if (!g1.ok) {
    return failCycle("strategist_guardrail", `Challenger copy failed guardrails: ${summariseViolations(g1.violations)}`);
  }

  // ── 2. Reviewer critique ──
  let review: Review;
  try {
    const run = await runStructured({
      provider: reviewer,
      purpose: "reviewer",
      schema: ReviewSchema,
      system: REVIEWER_SYSTEM,
      prompt: reviewerPrompt(contextJson, proposal),
      promptVersion: PROMPT_VERSIONS.reviewer,
      cycleId,
    });
    modelCalls++;
    review = run.data;
  } catch (e) {
    return failCycle("reviewer", e instanceof Error ? e.message : "reviewer failed");
  }

  // ── 3. Conditional single revision ──
  const needsRevision =
    review.overallAssessment !== "sound" ||
    review.objections.length > 0 ||
    review.unsupportedPersonalisation.length > 0 ||
    !!review.sampleSizeConcern ||
    !!review.suggestedBetterMetric;

  let finalProposal: Proposal = proposal;
  let originalProposal: Proposal | null = null;
  let revisionText: string | null = null;

  if (needsRevision) {
    try {
      const run = await runStructured({
        provider: strategist,
        purpose: "strategist",
        schema: RevisionSchema,
        system: REVISION_SYSTEM,
        prompt: revisionPrompt(contextJson, proposal, review),
        promptVersion: PROMPT_VERSIONS.revision,
        cycleId,
      });
      modelCalls++;
      const g2 = validateChallengerCopy(run.data.challenger.steps);
      if (!g2.ok) {
        return failCycle("revision_guardrail", `Revised challenger failed guardrails: ${summariseViolations(g2.violations)}`);
      }
      originalProposal = proposal;
      revisionText = run.data.responseToCritique;
      const { responseToCritique, ...rest } = run.data;
      void responseToCritique;
      finalProposal = rest;
    } catch (e) {
      return failCycle("revision", e instanceof Error ? e.message : "revision failed");
    }
  }

  // ── 4. Deterministic feasibility (app-owned; model never sees identities) ──
  const feasibility = await computeFeasibility({
    target: finalProposal.targetSegment,
    exclusions: finalProposal.exclusions,
    recommendedSample: finalProposal.sampleSizeRecommendation,
  });

  // ── 5. Frozen control snapshot from the CURRENT incumbent sequence ──
  const controlSteps = DEFAULT_SEQUENCE.map((s, i) => {
    const draft = buildStepDraft(s.templateKey, PLACEHOLDERS);
    return { stepIndex: i, templateKey: s.templateKey, label: s.label, gapDays: s.gapDays, subject: draft?.subject ?? "", body: draft?.body ?? "" };
  });

  // ── 6. Persist (no assignments, no sends, status never running) ──
  const reviewOutcome = review.overallAssessment; // zod-enforced to sound|needs_revision|reject
  const status = reviewOutcome === "reject" ? "draft" : "awaiting_approval";
  const reviewDate = new Date(Date.now() + Math.max(1, finalProposal.reviewConditions.reviewAfterDays) * 86_400_000);

  const experiment = await commandDb.outreachExperiment.create({
    data: {
      title: finalProposal.title,
      status,
      hypothesis: finalProposal.hypothesis,
      rationale: finalProposal.rationale,
      targetSegment: finalProposal.targetSegment,
      exclusions: finalProposal.exclusions,
      sampleSize: finalProposal.sampleSizeRecommendation,
      allocationPct: finalProposal.allocationPct,
      primaryMetric: finalProposal.primaryMetric,
      secondaryMetrics: finalProposal.secondaryMetrics,
      reviewDate,
      strategistReasoning: finalProposal.strategistReasoning,
      reviewerCritique: review.summary,
      reviewerResult: review,
      reviewOutcome,
      strategistRevision: revisionText,
      feasibility,
      originalProposal: originalProposal ?? undefined,
      createdById: opts.actorUserId,
    },
    select: { id: true },
  });

  await commandDb.outreachVariant.create({
    data: { experimentId: experiment.id, role: "control", name: "Current sequence (control)", emails: controlSteps },
  });
  await commandDb.outreachVariant.create({
    data: { experimentId: experiment.id, role: "challenger", name: finalProposal.title.slice(0, 80) || "Challenger", emails: finalProposal.challenger.steps },
  });

  // Link this cycle's model runs to the experiment (they are already linked to the
  // cycle via cycleId), and finalise the cycle as succeeded.
  await commandDb.aiModelRun.updateMany({ where: { cycleId }, data: { experimentId: experiment.id } });
  await commandDb.strategyCycle.update({
    where: { id: cycleId },
    data: { outcome: "succeeded", experimentId: experiment.id, finishedAt: new Date() },
  });

  return {
    ok: true,
    experimentId: experiment.id,
    cycleId,
    status,
    reviewOutcome,
    revisionRan: needsRevision,
    modelCalls,
    feasibility,
    proposal: finalProposal,
    review,
  };
}
