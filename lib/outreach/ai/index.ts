// Public entry point for the outreach AI layer.
//
// runStructured() is the ONE call the orchestrator (Build Order F) uses: it asks
// a provider for JSON, validates it against a zod schema, retries once with the
// validation errors fed back, logs an AiModelRun (cost + tokens) for every
// attempt, and either returns typed data or throws AIValidationError (fail safe —
// nothing downstream acts on unvalidated model output).
//
// getStrategist() -> Claude Opus. getReviewer() -> OpenAI. Both server-side only.

import { z, type ZodType } from "zod";
import { ClaudeProvider, DEFAULT_STRATEGIST_MODEL } from "./claude";
import { OpenAIProvider } from "./openai";
import { AIValidationError } from "./errors";
import { recordModelRun } from "./usage";
import type { AIProvider, AIPurpose, AIUsage } from "./provider";

export type { AIProvider, AIPurpose, AIUsage } from "./provider";
export { AIProviderError, AIValidationError, AIMissingKeyError } from "./errors";
export { ClaudeProvider } from "./claude";
export { OpenAIProvider } from "./openai";

export function getStrategist(): AIProvider {
  return new ClaudeProvider(process.env.OUTREACH_STRATEGIST_MODEL ?? DEFAULT_STRATEGIST_MODEL);
}

export function getReviewer(): AIProvider {
  // Model + reasoning_effort come from env defaults inside OpenAIProvider
  // (OPENAI_REVIEWER_MODEL=gpt-5.5, OPENAI_REASONING_EFFORT=high).
  return new OpenAIProvider();
}

// Convert a zod schema to a JSON Schema shaped for OpenAI strict Structured
// Outputs (every object closed + all properties required). Returns undefined if
// conversion fails, in which case providers fall back to JSON mode + zod only.
function zodToStrictJsonSchema(
  schema: ZodType,
  name: string,
): { name: string; schema: Record<string, unknown> } | undefined {
  try {
    const js = z.toJSONSchema(schema) as Record<string, unknown>;
    delete (js as Record<string, unknown>).$schema;
    enforceStrict(js);
    return { name, schema: js };
  } catch {
    return undefined;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function enforceStrict(node: any): void {
  if (!node || typeof node !== "object") return;
  if (node.type === "object" && node.properties && typeof node.properties === "object") {
    node.additionalProperties = false;
    node.required = Object.keys(node.properties);
    for (const k of Object.keys(node.properties)) enforceStrict(node.properties[k]);
  }
  if (node.type === "array" && node.items) enforceStrict(node.items);
  for (const key of ["anyOf", "allOf", "oneOf"]) {
    if (Array.isArray(node[key])) node[key].forEach(enforceStrict);
  }
}

// Pull the first balanced-looking JSON object out of a model response, tolerating
// stray prose or code fences the model may add despite instructions.
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("no JSON object found in response");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

export type StructuredRunResult<T> = {
  data: T;
  usage: AIUsage; // last attempt
  costPence: number; // summed across attempts
  runId: string | null; // last AiModelRun id
  provider: string;
  model: string;
};

export async function runStructured<T>(opts: {
  provider: AIProvider;
  purpose: AIPurpose;
  schema: ZodType<T>;
  system: string;
  prompt: string;
  maxTokens?: number;
  experimentId?: string | null;
  cycleId?: string | null;
  promptVersion?: string | null;
  maxAttempts?: number; // default 2 (one corrective retry)
}): Promise<StructuredRunResult<T>> {
  const attempts = Math.max(1, opts.maxAttempts ?? 2);
  const jsonInstruction =
    "\n\nRespond with a single valid JSON object only (no prose, no markdown).";
  // Derived once: enables OpenAI's native json_schema Structured Outputs. Claude
  // ignores it and relies on the JSON instruction; zod validates either way.
  const jsonSchema = zodToStrictJsonSchema(opts.schema, "outreach_response");

  let totalCost = 0;
  let lastRunId: string | null = null;
  let lastText = "";
  let lastIssues: unknown;
  let lastErrMsg = "";

  for (let attempt = 0; attempt < attempts; attempt++) {
    const system =
      attempt === 0
        ? opts.system + jsonInstruction
        : `${opts.system}${jsonInstruction}\n\nYour previous response was rejected: ${lastErrMsg}. Return corrected JSON that matches the required schema exactly.`;

    const res = await opts.provider.structuredGenerate({
      system,
      prompt: opts.prompt,
      maxTokens: opts.maxTokens,
      jsonSchema,
    });

    // Log every attempt for cost + audit, even if it later fails validation.
    const logged = await recordModelRun({
      purpose: opts.purpose,
      provider: res.provider,
      model: res.model,
      usage: res.usage,
      promptVersion: opts.promptVersion,
      experimentId: opts.experimentId,
      cycleId: opts.cycleId,
    });
    totalCost += logged.costPence;
    lastRunId = logged.id;
    lastText = res.text;

    try {
      const json = extractJson(res.text);
      const parsed = opts.schema.parse(json);
      return {
        data: parsed,
        usage: res.usage,
        costPence: totalCost,
        runId: lastRunId,
        provider: res.provider,
        model: res.model,
      };
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastIssues = (e as any)?.issues ?? undefined;
      lastErrMsg = e instanceof Error ? e.message.slice(0, 300) : "invalid output";
    }
  }

  throw new AIValidationError(
    `Model output failed validation after ${attempts} attempt(s): ${lastErrMsg}`,
    opts.provider.name,
    lastText,
    lastIssues,
  );
}
