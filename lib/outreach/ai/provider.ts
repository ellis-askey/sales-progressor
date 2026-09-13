// AI provider abstraction for the outreach growth engine (Build Order C).
//
// Deliberately separate from lib/agent/provider.ts (that one is the
// progression-agent tool-loop). This one is a simple one-shot request/response
// abstraction with two shapes: free-text generate() and JSON structuredGenerate().
// Both Claude and OpenAI implement it; the orchestrator (Build Order F) talks
// only to this interface, so the strategist/reviewer models can be swapped
// without touching business logic.
//
// Structured output is validated with zod at the runStructured() layer (see
// ./index): a malformed model response fails safe and sends nothing.

export type AIUsage = { inputTokens: number; outputTokens: number };

// What each AI call is for. Recorded on AiModelRun for the audit trail.
export type AIPurpose = "strategist" | "reviewer" | "campaign_gen";

export type AIGenerateResult = {
  text: string;
  usage: AIUsage;
  provider: string; // "anthropic" | "openai"
  model: string;
};

export type GenerateInput = { system: string; prompt: string; maxTokens?: number };

export type StructuredInput = GenerateInput & {
  // Optional JSON Schema enabling native Structured Outputs on providers that
  // support it (OpenAI json_schema, strict). Providers without native support
  // (Claude) IGNORE this and rely on their JSON-only instruction; either way the
  // caller (runStructured) applies zod as the final validation layer. Additive +
  // optional so the interface stays backward-compatible.
  jsonSchema?: { name: string; schema: Record<string, unknown> };
};

export interface AIProvider {
  readonly name: string; // "anthropic" | "openai"
  readonly model: string;

  // Free-text completion.
  generate(input: GenerateInput): Promise<AIGenerateResult>;

  // Completion constrained to a single JSON object. The returned text is raw JSON
  // to be zod-validated by the caller.
  structuredGenerate(input: StructuredInput): Promise<AIGenerateResult>;
}

export const DEFAULT_MAX_TOKENS = 4096;
