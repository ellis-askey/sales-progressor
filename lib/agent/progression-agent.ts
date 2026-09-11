// The progression agent orchestrator (SHADOW MODE).
//
// One inbound email → one AgentRun. The agent reasons with read-only tools,
// then submits an assessment. We classify each proposed action against the SAME
// deterministic business rules a real write would face (e.g. milestone
// prerequisites) and record it as an AgentAction with a shadow outcome. NOTHING
// is executed: no milestone is completed, no note is written, no email is sent.
//
// To preserve the existing review surface, we still create a MilestoneProposal
// exactly where the pre-agent interpreter would have (a confirm proposal for a
// proposed milestone confirmation; otherwise a note proposal for relevant
// content), linked back to the run.
//
// Everything the orchestrator touches is injected via ProgressionAgentDeps, so
// the loop + classification + proposal logic is unit-testable with no database.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import {
  AnthropicReasoningProvider,
  type AgentToolSchema,
  type ReasoningProvider,
} from "@/lib/agent/provider";
import { runToolLoop, type LoopLimits, type ToolDispatch } from "@/lib/agent/loop";
import {
  buildAgentToolContext,
  buildReadTools,
  loadMilestoneFacts,
  type MilestoneFacts,
  type ToolContext,
} from "@/lib/agent/tools";
import { parseAssessment, parseAssessmentFromText } from "@/lib/agent/assessment";
import { classifyAction } from "@/lib/agent/classify";
import { AGENT_SYSTEM_PROMPT, PROMPT_VERSION, SUBMIT_ASSESSMENT_TOOL, buildInitialUserPrompt } from "@/lib/agent/prompt";

export const DEFAULT_LIMITS: LoopLimits = { maxIterations: 6, maxWallMs: 25_000, maxTokens: 800 };

export type InboundAgentMessage = {
  id: string; // the inbound OutboundMessage id
  transactionId: string;
  agencyId: string | null;
  subject: string | null;
  content: string;
  from: string | null;
};

export type AgentRunSummary = {
  status: "completed" | "failed" | "skipped";
  skippedReason?: "duplicate" | "no_transaction";
  runId?: string;
  outcome?: "proposed" | "no_action" | "error";
  proposalCreated: boolean;
};

// ── Injectable store (the only place writes happen; none mutate a transaction) ─

export type CreateRunInput = {
  transactionId: string; agencyId: string | null; triggerMessageId: string;
  provider: string; model: string; promptVersion: string;
};
export type FinishRunPatch = {
  status: "completed" | "failed";
  outcome: "proposed" | "no_action" | "error";
  understood?: string; changed?: string; waitingOn?: string; nextExpected?: string;
  reasoningSummary?: string; confidence?: string; humanAttention?: boolean;
  toolCallCount: number; tokensIn: number; tokensOut: number; errorMessage?: string;
};
export type RecordActionInput = {
  agentRunId: string; actionType: string; input: unknown; confidence: string | null;
  outcome: string; blockedReason: string | null; evidence: string | null;
  evidenceMessageId: string | null; targetType: string | null; targetRef: string | null;
  milestoneProposalId: string | null;
};
export type CreateConfirmProposalInput = {
  transactionId: string; agencyId: string | null; sourceMessageId: string; agentRunId: string;
  milestoneCode: string; milestoneDefinitionId: string; summary: string; confidence: string;
  emailFrom: string | null; emailSubject: string | null; emailSnippet: string | null;
};
export type CreateNoteProposalInput = {
  transactionId: string; agencyId: string | null; sourceMessageId: string; agentRunId: string;
  noteText: string; summary: string; confidence: string;
  emailFrom: string | null; emailSubject: string | null; emailSnippet: string | null;
};

export interface AgentRunStore {
  createRun(input: CreateRunInput): Promise<{ id: string } | null>; // null when triggerMessageId already exists (dedupe)
  finishRun(id: string, patch: FinishRunPatch): Promise<void>;
  recordAction(input: RecordActionInput): Promise<void>;
  lookupMilestoneDefinitionId(code: string): Promise<string | null>;
  createConfirmProposal(input: CreateConfirmProposalInput): Promise<{ id: string }>;
  createNoteProposal(input: CreateNoteProposalInput): Promise<{ id: string }>;
}

export type ProgressionAgentDeps = {
  provider: ReasoningProvider;
  loadContext(transactionId: string): Promise<ToolContext | null>;
  loadMilestoneFacts(ctx: ToolContext): Promise<MilestoneFacts>;
  buildTools(ctx: ToolContext, facts: MilestoneFacts): { schemas: AgentToolSchema[]; dispatch: ToolDispatch };
  store: AgentRunStore;
  prereqs: Record<string, string[]>;
  limits?: LoopLimits;
  now?: () => number;
};

const NOTE_WORTHY = new Set(["addInternalNote", "setWaitingOn", "createTask", "resolveTask", "escalateToHuman"]);

export async function runProgressionAgent(message: InboundAgentMessage, deps: ProgressionAgentDeps): Promise<AgentRunSummary> {
  const limits = deps.limits ?? DEFAULT_LIMITS;

  let ctx: ToolContext | null;
  try {
    ctx = await deps.loadContext(message.transactionId);
  } catch {
    ctx = null;
  }
  if (!ctx) return { status: "skipped", skippedReason: "no_transaction", proposalCreated: false };

  const run = await deps.store.createRun({
    transactionId: ctx.transactionId,
    agencyId: ctx.agencyId,
    triggerMessageId: message.id,
    provider: deps.provider.name,
    model: deps.provider.model,
    promptVersion: PROMPT_VERSION,
  });
  if (!run) return { status: "skipped", skippedReason: "duplicate", proposalCreated: false };

  try {
    const facts = await deps.loadMilestoneFacts(ctx);
    const tools = deps.buildTools(ctx, facts);
    const schemas = [...tools.schemas, SUBMIT_ASSESSMENT_TOOL];

    const loop = await runToolLoop({
      provider: deps.provider,
      system: AGENT_SYSTEM_PROMPT,
      initialUserText: buildInitialUserPrompt(message, facts),
      tools: schemas,
      dispatch: tools.dispatch,
      limits,
      now: deps.now,
    });
    const usage = loop.usage;

    if (loop.terminatedBy === "provider_error") {
      await deps.store.finishRun(run.id, {
        status: "failed", outcome: "error", humanAttention: true,
        toolCallCount: loop.toolCallCount, tokensIn: usage.inputTokens, tokensOut: usage.outputTokens,
        errorMessage: loop.error ?? "provider error",
      });
      return { status: "failed", runId: run.id, outcome: "error", proposalCreated: false };
    }

    const assessment = loop.assessmentRaw != null ? parseAssessment(loop.assessmentRaw) : parseAssessmentFromText(loop.finalText);
    if (!assessment) {
      await deps.store.recordAction({
        agentRunId: run.id, actionType: "escalateToHuman",
        input: { reason: "no_valid_assessment", terminatedBy: loop.terminatedBy },
        confidence: null, outcome: "flagged", blockedReason: "agent produced no valid assessment",
        evidence: null, evidenceMessageId: message.id, targetType: null, targetRef: null, milestoneProposalId: null,
      });
      await deps.store.finishRun(run.id, {
        status: "completed", outcome: "error", humanAttention: true,
        toolCallCount: loop.toolCallCount, tokensIn: usage.inputTokens, tokensOut: usage.outputTokens,
        errorMessage: `no valid assessment (terminatedBy=${loop.terminatedBy})`,
      });
      return { status: "completed", runId: run.id, outcome: "error", proposalCreated: false };
    }

    const classifyCtx = { confirmableCodes: facts.confirmableSet, doneCodes: facts.doneSet, prereqs: deps.prereqs };
    const classified = assessment.proposedActions.map((a) => classifyAction(a, classifyCtx));
    const snippet = (message.content ?? "").slice(0, 240);

    const hasRealConfirm = classified.some(
      (c) => c.action.actionType === "confirmMilestone" && (c.outcome === "shadow_proposed" || c.outcome === "blocked"),
    );

    // Create proposals first so we can link each AgentAction to the proposal it produced.
    const proposalIdByIndex = new Map<number, string>();
    let proposalCreated = false;

    for (let i = 0; i < classified.length; i++) {
      const c = classified[i];
      if (c.action.actionType === "confirmMilestone" && (c.outcome === "shadow_proposed" || c.outcome === "blocked") && c.targetRef) {
        const defId = await deps.store.lookupMilestoneDefinitionId(c.targetRef);
        if (defId) {
          const p = await deps.store.createConfirmProposal({
            transactionId: ctx.transactionId, agencyId: ctx.agencyId, sourceMessageId: message.id, agentRunId: run.id,
            milestoneCode: c.targetRef, milestoneDefinitionId: defId,
            summary: c.action.evidence ?? assessment.changed ?? assessment.understood ?? "",
            confidence: c.action.confidence,
            emailFrom: message.from, emailSubject: message.subject, emailSnippet: snippet,
          });
          proposalIdByIndex.set(i, p.id);
          proposalCreated = true;
        }
      }
    }

    if (!hasRealConfirm) {
      const primaryIndex = classified.findIndex((c) => c.outcome === "shadow_proposed" && NOTE_WORTHY.has(c.action.actionType));
      if (primaryIndex >= 0) {
        const c = classified[primaryIndex];
        const noteText = c.action.note ?? assessment.changed ?? assessment.understood ?? "";
        const p = await deps.store.createNoteProposal({
          transactionId: ctx.transactionId, agencyId: ctx.agencyId, sourceMessageId: message.id, agentRunId: run.id,
          noteText, summary: assessment.understood || noteText, confidence: assessment.confidence,
          emailFrom: message.from, emailSubject: message.subject, emailSnippet: snippet,
        });
        proposalIdByIndex.set(primaryIndex, p.id);
        proposalCreated = true;
      }
    }

    for (let i = 0; i < classified.length; i++) {
      const c = classified[i];
      await deps.store.recordAction({
        agentRunId: run.id, actionType: c.action.actionType, input: c.action, confidence: c.action.confidence,
        outcome: c.outcome, blockedReason: c.blockedReason, evidence: c.action.evidence,
        evidenceMessageId: message.id, targetType: c.targetType, targetRef: c.targetRef,
        milestoneProposalId: proposalIdByIndex.get(i) ?? null,
      });
    }

    const outcome = proposalCreated ? "proposed" : "no_action";
    await deps.store.finishRun(run.id, {
      status: "completed", outcome,
      understood: assessment.understood, changed: assessment.changed, waitingOn: assessment.waitingOn,
      nextExpected: assessment.nextExpected, reasoningSummary: assessment.understood, confidence: assessment.confidence,
      humanAttention: assessment.humanAttention,
      toolCallCount: loop.toolCallCount, tokensIn: usage.inputTokens, tokensOut: usage.outputTokens,
    });
    return { status: "completed", runId: run.id, outcome, proposalCreated };
  } catch (err) {
    await deps.store
      .finishRun(run.id, {
        status: "failed", outcome: "error", humanAttention: true,
        toolCallCount: 0, tokensIn: 0, tokensOut: 0,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .catch(() => {});
    return { status: "failed", runId: run.id, outcome: "error", proposalCreated: false };
  }
}

// ── Production deps (prisma-backed). None of these methods mutate a transaction. ─

export function createProductionAgentDeps(model?: string): ProgressionAgentDeps {
  const store: AgentRunStore = {
    async createRun(input) {
      try {
        return await prisma.agentRun.create({ data: { ...input, status: "running" }, select: { id: true } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
        throw e;
      }
    },
    async finishRun(id, patch) {
      await prisma.agentRun.update({ where: { id }, data: { ...patch, finishedAt: new Date() } });
    },
    async recordAction(input) {
      await prisma.agentAction.create({
        data: {
          agentRunId: input.agentRunId, actionType: input.actionType,
          input: (input.input ?? {}) as Prisma.InputJsonValue,
          confidence: input.confidence, outcome: input.outcome, blockedReason: input.blockedReason,
          evidence: input.evidence, evidenceMessageId: input.evidenceMessageId,
          targetType: input.targetType, targetRef: input.targetRef, milestoneProposalId: input.milestoneProposalId,
        },
      });
    },
    async lookupMilestoneDefinitionId(code) {
      const d = await prisma.milestoneDefinition.findFirst({ where: { code }, select: { id: true } });
      return d?.id ?? null;
    },
    async createConfirmProposal(input) {
      return prisma.milestoneProposal.create({
        data: {
          transactionId: input.transactionId, agencyId: input.agencyId, sourceMessageId: input.sourceMessageId,
          agentRunId: input.agentRunId, actionType: "confirm", milestoneCode: input.milestoneCode,
          milestoneDefinitionId: input.milestoneDefinitionId, summary: input.summary, confidence: input.confidence,
          emailFrom: input.emailFrom, emailSubject: input.emailSubject, emailSnippet: input.emailSnippet,
        },
        select: { id: true },
      });
    },
    async createNoteProposal(input) {
      return prisma.milestoneProposal.create({
        data: {
          transactionId: input.transactionId, agencyId: input.agencyId, sourceMessageId: input.sourceMessageId,
          agentRunId: input.agentRunId, actionType: "note", noteText: input.noteText, summary: input.summary,
          confidence: input.confidence, emailFrom: input.emailFrom, emailSubject: input.emailSubject,
          emailSnippet: input.emailSnippet,
        },
        select: { id: true },
      });
    },
  };

  return {
    provider: new AnthropicReasoningProvider(model),
    loadContext: buildAgentToolContext,
    loadMilestoneFacts,
    buildTools: buildReadTools,
    store,
    prereqs: DIRECT_PREREQUISITES,
  };
}
