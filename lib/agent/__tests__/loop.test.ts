import { runToolLoop, type LoopLimits } from "@/lib/agent/loop";
import type { ProviderStep, ReasoningProvider } from "@/lib/agent/provider";

const usage = { inputTokens: 1, outputTokens: 1 };
const LIMITS: LoopLimits = { maxIterations: 5, maxWallMs: 10_000, maxTokens: 100 };

function scripted(steps: (ProviderStep | Error)[]): { p: ReasoningProvider; calls: () => number } {
  let i = 0;
  const p: ReasoningProvider = {
    name: "mock",
    model: "m",
    async step() {
      const s = steps[i++];
      if (s instanceof Error) throw s;
      if (!s) throw new Error("exhausted");
      return s;
    },
  };
  return { p, calls: () => i };
}
const submit = (input: Record<string, unknown>): ProviderStep => ({ kind: "tool_use", text: "", usage, toolCalls: [{ id: "s", name: "submitAssessment", input }] });
const readCall = (name: string): ProviderStep => ({ kind: "tool_use", text: "", usage, toolCalls: [{ id: "r", name, input: {} }] });
const final = (text: string): ProviderStep => ({ kind: "final", text, usage });

describe("runToolLoop (bounded tool loop)", () => {
  it("terminates as soon as submitAssessment is called", async () => {
    const { p } = scripted([submit({ hi: 1 })]);
    const r = await runToolLoop({ provider: p, system: "s", initialUserText: "u", tools: [], dispatch: async () => "{}", limits: LIMITS });
    expect(r.terminatedBy).toBe("submit");
    expect(r.assessmentRaw).toEqual({ hi: 1 });
  });

  it("dispatches read tools then submits, counting tool calls", async () => {
    const dispatched: string[] = [];
    const { p } = scripted([readCall("getMilestones"), submit({ ok: true })]);
    const r = await runToolLoop({ provider: p, system: "s", initialUserText: "u", tools: [], dispatch: async (n) => { dispatched.push(n); return "{}"; }, limits: LIMITS });
    expect(dispatched).toEqual(["getMilestones"]);
    expect(r.terminatedBy).toBe("submit");
    expect(r.toolCallCount).toBe(1);
  });

  it("returns final text when the model stops without submitting", async () => {
    const { p } = scripted([final("done")]);
    const r = await runToolLoop({ provider: p, system: "s", initialUserText: "u", tools: [], dispatch: async () => "{}", limits: LIMITS });
    expect(r.terminatedBy).toBe("final");
    expect(r.finalText).toBe("done");
    expect(r.assessmentRaw).toBeNull();
  });

  it("is bounded by maxIterations when the model never submits", async () => {
    const { p } = scripted(Array.from({ length: 10 }, () => readCall("getMilestones")));
    const r = await runToolLoop({ provider: p, system: "s", initialUserText: "u", tools: [], dispatch: async () => "{}", limits: { ...LIMITS, maxIterations: 3 } });
    expect(r.terminatedBy).toBe("max_iterations");
    expect(r.iterations).toBe(3);
  });

  it("terminates cleanly on a provider error (never throws)", async () => {
    const { p } = scripted([new Error("boom")]);
    const r = await runToolLoop({ provider: p, system: "s", initialUserText: "u", tools: [], dispatch: async () => "{}", limits: LIMITS });
    expect(r.terminatedBy).toBe("provider_error");
    expect(r.error).toContain("boom");
  });

  it("feeds a tool error back and keeps going (fails safe)", async () => {
    const { p } = scripted([readCall("getMilestones"), submit({ ok: true })]);
    const r = await runToolLoop({ provider: p, system: "s", initialUserText: "u", tools: [], dispatch: async () => { throw new Error("tool broke"); }, limits: LIMITS });
    expect(r.terminatedBy).toBe("submit"); // a broken tool did not crash the run
  });

  it("is bounded by wall-clock time via the injected clock", async () => {
    let t = 0;
    const { p } = scripted([readCall("x"), readCall("x"), submit({})]);
    const r = await runToolLoop({
      provider: p, system: "s", initialUserText: "u", tools: [],
      dispatch: async () => { t += 100_000; return "{}"; },
      limits: { maxIterations: 10, maxWallMs: 5_000, maxTokens: 100 },
      now: () => t,
    });
    expect(r.terminatedBy).toBe("timeout");
  });
});
