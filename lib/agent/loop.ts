// Bounded tool-calling loop. Provider-neutral and pure (provider + tool dispatch
// are injected), so it is fully unit-testable with a scripted mock provider.
//
// Safety properties:
//   - hard cap on iterations and wall-clock time → cannot loop forever
//   - a provider error terminates cleanly (never throws to the caller)
//   - a tool error is fed back to the model as a tool_result and the loop
//     continues (a single flaky tool never crashes the run)
//   - terminates as soon as the model calls submitAssessment (the terminal tool)

import type { AgentMessage, AgentToolSchema, ProviderUsage, ReasoningProvider } from "@/lib/agent/provider";

export const SUBMIT_TOOL_NAME = "submitAssessment";

export type LoopLimits = { maxIterations: number; maxWallMs: number; maxTokens: number };

export type ToolDispatch = (name: string, input: Record<string, unknown>) => Promise<string>;

export type LoopResult = {
  assessmentRaw: unknown | null; // the submitAssessment input, if the model submitted one
  finalText: string | null; // the model's final text, if it stopped without submitting
  usage: ProviderUsage;
  toolCallCount: number;
  iterations: number;
  terminatedBy: "submit" | "final" | "max_iterations" | "timeout" | "provider_error";
  error: string | null;
};

export async function runToolLoop(opts: {
  provider: ReasoningProvider;
  system: string;
  initialUserText: string;
  tools: AgentToolSchema[]; // must include the submitAssessment schema
  dispatch: ToolDispatch; // handles the READ tools (not submitAssessment)
  limits: LoopLimits;
  now?: () => number;
}): Promise<LoopResult> {
  const now = opts.now ?? (() => Date.now());
  const started = now();
  const messages: AgentMessage[] = [{ role: "user", text: opts.initialUserText }];
  const usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 };
  let toolCallCount = 0;
  let iterations = 0;

  const done = (partial: Partial<LoopResult> & Pick<LoopResult, "terminatedBy">): LoopResult => ({
    assessmentRaw: null,
    finalText: null,
    error: null,
    ...partial,
    usage,
    toolCallCount,
    iterations,
  });

  while (iterations < opts.limits.maxIterations) {
    if (now() - started > opts.limits.maxWallMs) return done({ terminatedBy: "timeout" });
    iterations++;

    let step;
    try {
      step = await opts.provider.step({
        system: opts.system,
        messages,
        tools: opts.tools,
        maxTokens: opts.limits.maxTokens,
      });
    } catch (err) {
      return done({ terminatedBy: "provider_error", error: err instanceof Error ? err.message : String(err) });
    }

    usage.inputTokens += step.usage.inputTokens;
    usage.outputTokens += step.usage.outputTokens;

    if (step.kind === "final") {
      return done({ terminatedBy: "final", finalText: step.text });
    }

    // tool_use: record the assistant turn, then handle the calls.
    messages.push({ role: "assistant", text: step.text || undefined, toolCalls: step.toolCalls });

    const submit = step.toolCalls.find((c) => c.name === SUBMIT_TOOL_NAME);
    if (submit) {
      return done({ terminatedBy: "submit", assessmentRaw: submit.input });
    }

    for (const call of step.toolCalls) {
      toolCallCount++;
      let content: string;
      let isError = false;
      try {
        content = await opts.dispatch(call.name, call.input);
      } catch (err) {
        content = JSON.stringify({ error: err instanceof Error ? err.message : "tool error" });
        isError = true;
      }
      messages.push({ role: "tool_result", toolCallId: call.id, content, isError });
    }
  }

  return done({ terminatedBy: "max_iterations" });
}
