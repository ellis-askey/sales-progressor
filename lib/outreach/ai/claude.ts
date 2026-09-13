// Claude implementation of AIProvider. Reuses the shared anthropic client
// (lib/anthropic.ts). Used as the strategist in the outreach engine.

import { anthropic } from "@/lib/anthropic";
import { AIProviderError } from "./errors";
import {
  DEFAULT_MAX_TOKENS,
  type AIGenerateResult,
  type AIProvider,
  type GenerateInput,
  type StructuredInput,
} from "./provider";

export const DEFAULT_STRATEGIST_MODEL = "claude-opus-4-8";

const JSON_ONLY_SUFFIX =
  "\n\nReturn ONLY a single valid JSON object. No prose, no markdown, no code fences.";

export class ClaudeProvider implements AIProvider {
  readonly name = "anthropic";
  readonly model: string;

  constructor(model: string = DEFAULT_STRATEGIST_MODEL) {
    this.model = model;
  }

  private async call(system: string, prompt: string, maxTokens: number): Promise<AIGenerateResult> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await anthropic.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      });
      const blocks: unknown[] = Array.isArray(res?.content) ? res.content : [];
      let text = "";
      for (const b of blocks) {
        const block = b as { type?: string; text?: string };
        if (block.type === "text" && typeof block.text === "string") text += block.text;
      }
      return {
        text: text.trim(),
        usage: {
          inputTokens: res?.usage?.input_tokens ?? 0,
          outputTokens: res?.usage?.output_tokens ?? 0,
        },
        provider: this.name,
        model: this.model,
      };
    } catch (e) {
      throw new AIProviderError(
        e instanceof Error ? e.message : "Claude request failed",
        this.name,
        e,
      );
    }
  }

  generate(input: GenerateInput): Promise<AIGenerateResult> {
    return this.call(input.system, input.prompt, input.maxTokens ?? DEFAULT_MAX_TOKENS);
  }

  // Claude has no native json_schema mode here; it ignores input.jsonSchema and
  // relies on the JSON-only instruction. Downstream zod validation is the gate.
  // Behaviour is unchanged from the pre-Structured-Outputs implementation.
  structuredGenerate(input: StructuredInput): Promise<AIGenerateResult> {
    return this.call(input.system + JSON_ONLY_SUFFIX, input.prompt, input.maxTokens ?? DEFAULT_MAX_TOKENS);
  }
}
