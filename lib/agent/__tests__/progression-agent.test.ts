/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  runProgressionAgent,
  type ProgressionAgentDeps,
  type AgentRunStore,
  type RecordActionInput,
  type InboundAgentMessage,
} from "@/lib/agent/progression-agent";
import type { ProviderStep, ReasoningProvider } from "@/lib/agent/provider";
import type { MilestoneFacts } from "@/lib/agent/tools";

const usage = { inputTokens: 5, outputTokens: 5 };
const submitStep = (assessment: unknown): ProviderStep => ({ kind: "tool_use", text: "", usage, toolCalls: [{ id: "s1", name: "submitAssessment", input: assessment as Record<string, unknown> }] });
const readStep = (name: string): ProviderStep => ({ kind: "tool_use", text: "", usage, toolCalls: [{ id: "r1", name, input: {} }] });
const finalStep = (text: string): ProviderStep => ({ kind: "final", text, usage });

function scriptedProvider(steps: (ProviderStep | Error)[]): { provider: ReasoningProvider; stepCount: () => number } {
  let i = 0;
  const provider: ReasoningProvider = {
    name: "mock",
    model: "mock-1",
    async step() {
      const s = steps[i++];
      if (s instanceof Error) throw s;
      if (!s) throw new Error("no step");
      return s;
    },
  };
  return { provider, stepCount: () => i };
}

type Recorded = { runs: any[]; actions: RecordActionInput[]; proposals: any[]; finished: any[] };
function makeStore(opts: { duplicate?: boolean } = {}): { store: AgentRunStore; rec: Recorded } {
  const rec: Recorded = { runs: [], actions: [], proposals: [], finished: [] };
  const store: AgentRunStore = {
    async createRun(input) {
      if (opts.duplicate) return null;
      const id = "run" + (rec.runs.length + 1);
      rec.runs.push({ id, ...input });
      return { id };
    },
    async finishRun(id, patch) { rec.finished.push({ id, ...patch }); },
    async recordAction(input) { rec.actions.push(input); },
    async lookupMilestoneDefinitionId(code) { return "def_" + code; },
    async createConfirmProposal(input) { const id = "prop" + (rec.proposals.length + 1); rec.proposals.push({ id, kind: "confirm", ...input }); return { id }; },
    async createNoteProposal(input) { const id = "prop" + (rec.proposals.length + 1); rec.proposals.push({ id, kind: "note", ...input }); return { id }; },
  };
  return { store, rec };
}

function makeDeps(provider: ReasoningProvider, store: AgentRunStore, opts: { doneCodes?: string[]; noContext?: boolean; maxIterations?: number } = {}): ProgressionAgentDeps {
  const facts: MilestoneFacts = {
    open: [{ code: "PM13", label: "Search results received" }],
    done: (opts.doneCodes ?? []).map((c) => ({ code: c, label: c })),
    confirmableSet: new Set(["PM13", "PM8", "PM7", "VM7"]),
    doneSet: new Set(opts.doneCodes ?? []),
  };
  return {
    provider,
    loadContext: async () => (opts.noContext ? null : { transactionId: "tx1", agencyId: "ag1", activeBuyerRoundId: null, scope: { kind: "agency", agencyIds: ["ag1"] } }),
    loadMilestoneFacts: async () => facts,
    buildTools: () => ({ schemas: [], dispatch: async () => "{}" }),
    store,
    prereqs: { PM13: ["PM8"] },
    limits: { maxIterations: opts.maxIterations ?? 4, maxWallMs: 10_000, maxTokens: 100 },
  };
}

const MSG: InboundAgentMessage = {
  id: "msg1",
  transactionId: "tx1",
  agencyId: "ag1",
  subject: "Searches",
  content: "Searches have now been returned. We are reviewing these with the contract documentation and will raise any necessary enquiries shortly.",
  from: "solicitor@firm.com",
};

const confirmAssessment = {
  understood: "The solicitor says searches are back and enquiries will follow.",
  changed: "Search results received.",
  waitingOn: "buyer's solicitor",
  nextExpected: "enquiries raised",
  humanAttention: false,
  confidence: "high",
  proposedActions: [{ actionType: "confirmMilestone", milestoneCode: "PM13", confidence: "high", evidence: "searches have now been returned" }],
};

describe("runProgressionAgent (shadow mode)", () => {
  it("creates exactly one run and proposes a confirm for a genuinely completed step", async () => {
    const { provider } = scriptedProvider([submitStep(confirmAssessment)]);
    const { store, rec } = makeStore();
    const res = await runProgressionAgent(MSG, makeDeps(provider, store, { doneCodes: ["PM7", "PM8"] }));

    expect(res.status).toBe("completed");
    expect(res.outcome).toBe("proposed");
    expect(rec.runs).toHaveLength(1);
    expect(rec.proposals).toHaveLength(1);
    expect(rec.proposals[0].kind).toBe("confirm");
    expect(rec.proposals[0].milestoneCode).toBe("PM13");

    const confirmAction = rec.actions.find((a) => a.actionType === "confirmMilestone");
    expect(confirmAction?.outcome).toBe("shadow_proposed");
    expect(confirmAction?.milestoneProposalId).toBe(rec.proposals[0].id);
    expect(confirmAction?.evidenceMessageId).toBe("msg1");
  });

  it("records BLOCKED (not applied) when a proposed confirm's prerequisites are unmet — and still preserves the review proposal", async () => {
    const { provider } = scriptedProvider([submitStep(confirmAssessment)]);
    const { store, rec } = makeStore();
    const res = await runProgressionAgent(MSG, makeDeps(provider, store, { doneCodes: ["PM7"] })); // PM8 missing

    expect(res.status).toBe("completed");
    const confirmAction = rec.actions.find((a) => a.actionType === "confirmMilestone");
    expect(confirmAction?.outcome).toBe("blocked");
    expect(confirmAction?.blockedReason).toContain("PM8");
    // Existing review behaviour preserved: the proposal is still created.
    expect(rec.proposals).toHaveLength(1);
  });

  it("does not treat a future intention as a completed event", async () => {
    // The model correctly proposes doNothing for the "will raise enquiries" part.
    const { provider } = scriptedProvider([submitStep({ ...confirmAssessment, changed: "", proposedActions: [{ actionType: "doNothing", confidence: "high" }] })]);
    const { store, rec } = makeStore();
    const res = await runProgressionAgent(MSG, makeDeps(provider, store, { doneCodes: ["PM7", "PM8"] }));

    expect(res.outcome).toBe("no_action");
    expect(res.proposalCreated).toBe(false);
    expect(rec.proposals).toHaveLength(0);
    expect(rec.actions.find((a) => a.actionType === "doNothing")?.outcome).toBe("no_action");
  });

  it("matches the searches example: confirm PM13 only; no PM14; the note does not spawn a second proposal", async () => {
    const { provider } = scriptedProvider([
      submitStep({
        ...confirmAssessment,
        proposedActions: [
          { actionType: "confirmMilestone", milestoneCode: "PM13", confidence: "high", evidence: "searches have now been returned" },
          { actionType: "addInternalNote", note: "Reviewing searches with contract docs; enquiries to follow.", confidence: "medium", evidence: "will raise enquiries shortly" },
        ],
      }),
    ]);
    const { store, rec } = makeStore();
    await runProgressionAgent(MSG, makeDeps(provider, store, { doneCodes: ["PM7", "PM8"] }));

    expect(rec.proposals).toHaveLength(1); // only the PM13 confirm proposal
    expect(rec.proposals[0].milestoneCode).toBe("PM13");
    expect(rec.actions.some((a) => a.targetRef === "PM14")).toBe(false); // never proposes enquiries-raised
    const note = rec.actions.find((a) => a.actionType === "addInternalNote");
    expect(note?.outcome).toBe("shadow_proposed");
    expect(note?.milestoneProposalId).toBeNull(); // note recorded, but no extra proposal (a confirm already exists)
  });

  it("creates a note proposal (not a confirm) when only note-worthy content is proposed", async () => {
    const { provider } = scriptedProvider([submitStep({ ...confirmAssessment, proposedActions: [{ actionType: "addInternalNote", note: "General update, no step completed.", confidence: "medium" }] })]);
    const { store, rec } = makeStore();
    const res = await runProgressionAgent(MSG, makeDeps(provider, store, { doneCodes: ["PM7", "PM8"] }));

    expect(res.outcome).toBe("proposed");
    expect(rec.proposals).toHaveLength(1);
    expect(rec.proposals[0].kind).toBe("note");
    expect(rec.actions.find((a) => a.actionType === "addInternalNote")?.milestoneProposalId).toBe(rec.proposals[0].id);
  });

  it("fails safe on a malformed model response (no assessment) — error outcome, no proposal", async () => {
    const { provider } = scriptedProvider([finalStep("this is not JSON and never submits")]);
    const { store, rec } = makeStore();
    const res = await runProgressionAgent(MSG, makeDeps(provider, store));

    expect(res.status).toBe("completed");
    expect(res.outcome).toBe("error");
    expect(rec.proposals).toHaveLength(0);
    expect(rec.actions.some((a) => a.actionType === "escalateToHuman" && a.outcome === "flagged")).toBe(true);
  });

  it("marks the run failed on a provider error without throwing (Outlook sync stays safe)", async () => {
    const { provider } = scriptedProvider([new Error("api down")]);
    const { store, rec } = makeStore();
    const res = await runProgressionAgent(MSG, makeDeps(provider, store));

    expect(res.status).toBe("failed");
    expect(res.outcome).toBe("error");
    expect(rec.proposals).toHaveLength(0);
    expect(rec.finished.some((f) => f.status === "failed")).toBe(true);
  });

  it("is idempotent: a duplicate trigger message is skipped and does nothing", async () => {
    const { provider, stepCount } = scriptedProvider([submitStep(confirmAssessment)]);
    const { store, rec } = makeStore({ duplicate: true });
    const res = await runProgressionAgent(MSG, makeDeps(provider, store, { doneCodes: ["PM7", "PM8"] }));

    expect(res.status).toBe("skipped");
    expect(res.skippedReason).toBe("duplicate");
    expect(rec.actions).toHaveLength(0);
    expect(rec.proposals).toHaveLength(0);
    expect(stepCount()).toBe(0); // the model was never even consulted
  });

  it("skips when the transaction is not accessible (no cross-file leakage)", async () => {
    const { provider } = scriptedProvider([submitStep(confirmAssessment)]);
    const { store, rec } = makeStore();
    const res = await runProgressionAgent(MSG, makeDeps(provider, store, { noContext: true }));

    expect(res.status).toBe("skipped");
    expect(res.skippedReason).toBe("no_transaction");
    expect(rec.runs).toHaveLength(0);
  });

  it("is bounded end-to-end: a model that never submits yields an error outcome, not a hang", async () => {
    const { provider } = scriptedProvider(Array.from({ length: 20 }, () => readStep("getMilestones")));
    const { store, rec } = makeStore();
    const res = await runProgressionAgent(MSG, makeDeps(provider, store, { maxIterations: 3 }));

    expect(res.outcome).toBe("error");
    expect(res.proposalCreated).toBe(false);
    expect(rec.finished.some((f) => f.outcome === "error")).toBe(true);
  });

  it("the store exposes only non-mutating audit/proposal methods — there is no transaction-write or email path", () => {
    const { store } = makeStore();
    expect(Object.keys(store).sort()).toEqual(
      ["createConfirmProposal", "createNoteProposal", "createRun", "finishRun", "lookupMilestoneDefinitionId", "recordAction"].sort(),
    );
  });
});
