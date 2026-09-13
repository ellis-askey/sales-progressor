// OpenAI implementation of AIProvider. Used as the adversarial reviewer in the
// outreach engine. Server-side only; the key is read from OPENAI_API_KEY and is
// never exposed client-side. The client is created lazily so a missing key only
// errors when a call is actually attempted (not at import).
//
// Tuned for the GPT-5.x line: uses max_completion_tokens (GPT-5.x rejects
// max_tokens), a configurable reasoning_effort (default "high" for the critic
// role), and native Structured Outputs (response_format json_schema, strict) when
// a schema is supplied — falling back to JSON mode otherwise. zod remains the
// final application-side validation layer (see runStructured).

import OpenAI from "openai";
import { AIMissingKeyError, AIProviderError } from "./errors";
import {
  DEFAULT_MAX_TOKENS,
  type AIGenerateResult,
  type AIProvider,
  type GenerateInput,
  type StructuredInput,
} from "./provider";

export const DEFAULT_REVIEWER_MODEL = process.env.OPENAI_REVIEWER_MODEL ?? "gpt-5.5";
export const DEFAULT_REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT ?? "high";

let cached: OpenAI | null = null;
function client(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AIMissingKeyError("openai", "OPENAI_API_KEY");
  if (!cached) cached = new OpenAI({ apiKey });
  return cached;
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly model: string;
  readonly reasoningEffort: string;

  constructor(model: string = DEFAULT_REVIEWER_MODEL, reasoningEffort: string = DEFAULT_REASONING_EFFORT) {
    this.model = model;
    this.reasoningEffort = reasoningEffort;
  }

  private async call(
    system: string,
    prompt: string,
    maxTokens: number,
    responseFormat?: Record<string, unknown>,
  ): Promise<AIGenerateResult> {
    try {
      const res = await client().chat.completions.create({
        model: this.model,
        // GPT-5.x uses max_completion_tokens (max_tokens is rejected). This budget
        // covers reasoning tokens too, so keep it generous.
        max_completion_tokens: maxTokens,
        reasoning_effort: this.reasoningEffort,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        ...(responseFormat ? { response_format: responseFormat } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const text = res.choices?.[0]?.message?.content ?? "";
      return {
        text: text.trim(),
        usage: {
          inputTokens: res.usage?.prompt_tokens ?? 0,
          outputTokens: res.usage?.completion_tokens ?? 0,
        },
        provider: this.name,
        model: this.model,
      };
    } catch (e) {
      if (e instanceof AIMissingKeyError) throw e;
      throw new AIProviderError(
        e instanceof Error ? e.message : "OpenAI request failed",
        this.name,
        e,
      );
    }
  }

  generate(input: GenerateInput): Promise<AIGenerateResult> {
    return this.call(input.system, input.prompt, input.maxTokens ?? DEFAULT_MAX_TOKENS);
  }

  structuredGenerate(input: StructuredInput): Promise<AIGenerateResult> {
    // Strongest form: native Structured Outputs against the supplied schema.
    // Without a schema, fall back to JSON mode (still guarantees valid JSON).
    const responseFormat = input.jsonSchema
      ? {
          type: "json_schema",
          json_schema: { name: input.jsonSchema.name, strict: true, schema: input.jsonSchema.schema },
        }
      : { type: "json_object" };
    return this.call(input.system, input.prompt, input.maxTokens ?? DEFAULT_MAX_TOKENS, responseFormat);
  }
}
