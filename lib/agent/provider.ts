// Provider abstraction for the progression agent's tool-calling loop.
//
// The loop and the tool layer are provider-neutral: they speak the small
// AgentMessage / AgentToolSchema / ProviderStep vocabulary below. Only the
// adapter here knows Anthropic's wire format, so swapping providers later means
// writing one more adapter — the agent's business logic never changes.
//
// This abstraction is for the progression-agent path ONLY. It deliberately does
// not touch the existing callClaude()/anthropic usages elsewhere in TSP.

import { anthropic } from "@/lib/anthropic";

// A JSON-schema tool definition the model can call.
export type AgentToolSchema = {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
};

export type AgentToolCall = { id: string; name: string; input: Record<string, unknown> };

// Provider-neutral conversation turns. tool_result rows are folded into a single
// provider "user" turn by each adapter as required.
export type AgentMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text?: string; toolCalls?: AgentToolCall[] }
  | { role: "tool_result"; toolCallId: string; content: string; isError?: boolean };

export type ProviderUsage = { inputTokens: number; outputTokens: number };

export type ProviderStep =
  | { kind: "tool_use"; toolCalls: AgentToolCall[]; text: string; usage: ProviderUsage }
  | { kind: "final"; text: string; usage: ProviderUsage };

export interface ReasoningProvider {
  readonly name: string;
  readonly model: string;
  step(input: {
    system: string;
    messages: AgentMessage[];
    tools: AgentToolSchema[];
    maxTokens: number;
  }): Promise<ProviderStep>;
}

// ── Anthropic adapter ──────────────────────────────────────────────────────

export const DEFAULT_AGENT_MODEL = "claude-haiku-4-5-20251001";

// Convert our neutral messages into Anthropic's format. Consecutive tool_result
// rows must live in ONE user turn immediately after the assistant tool_use turn,
// so we coalesce them.
function toAnthropicMessages(messages: AgentMessage[]): { role: "user" | "assistant"; content: unknown }[] {
  const out: { role: "user" | "assistant"; content: unknown }[] = [];
  let pendingToolResults: unknown[] = [];

  const flushToolResults = () => {
    if (pendingToolResults.length > 0) {
      out.push({ role: "user", content: pendingToolResults });
      pendingToolResults = [];
    }
  };

  for (const m of messages) {
    if (m.role === "tool_result") {
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: m.toolCallId,
        content: m.content,
        ...(m.isError ? { is_error: true } : {}),
      });
      continue;
    }
    flushToolResults();
    if (m.role === "user") {
      out.push({ role: "user", content: [{ type: "text", text: m.text }] });
    } else {
      const content: unknown[] = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const tc of m.toolCalls ?? []) {
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
      }
      out.push({ role: "assistant", content });
    }
  }
  flushToolResults();
  return out;
}

export class AnthropicReasoningProvider implements ReasoningProvider {
  readonly name = "anthropic";
  readonly model: string;
  constructor(model: string = DEFAULT_AGENT_MODEL) {
    this.model = model;
  }

  async step(input: {
    system: string;
    messages: AgentMessage[];
    tools: AgentToolSchema[];
    maxTokens: number;
  }): Promise<ProviderStep> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await anthropic.messages.create({
      model: this.model,
      max_tokens: input.maxTokens,
      system: input.system,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: input.tools as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: toAnthropicMessages(input.messages) as any,
    });

    const usage: ProviderUsage = {
      inputTokens: res?.usage?.input_tokens ?? 0,
      outputTokens: res?.usage?.output_tokens ?? 0,
    };

    const blocks: unknown[] = Array.isArray(res?.content) ? res.content : [];
    const toolCalls: AgentToolCall[] = [];
    let text = "";
    for (const b of blocks) {
      const block = b as { type?: string; text?: string; id?: string; name?: string; input?: unknown };
      if (block.type === "text" && typeof block.text === "string") text += block.text;
      else if (block.type === "tool_use" && block.id && block.name) {
        toolCalls.push({ id: block.id, name: block.name, input: (block.input as Record<string, unknown>) ?? {} });
      }
    }

    if (toolCalls.length > 0) return { kind: "tool_use", toolCalls, text, usage };
    return { kind: "final", text, usage };
  }
}
