// Persist one AiModelRun per AI call, for the cost + audit trail. Best-effort:
// a logging failure never breaks the caller (the AI work already happened).

import { commandDb } from "@/lib/command/prisma";
import type { AIPurpose, AIUsage } from "./provider";
import { estimateCostPence, hasRate } from "./pricing";

export async function recordModelRun(args: {
  purpose: AIPurpose;
  provider: string;
  model: string;
  usage: AIUsage;
  promptVersion?: string | null;
  experimentId?: string | null;
}): Promise<{ id: string | null; costPence: number }> {
  const costPence = estimateCostPence(args.model, args.usage);
  if (!hasRate(args.model)) {
    // Surface unpriced models so the pricing table can be kept current; cost = 0.
    console.warn(`[outreach/ai] no price for model "${args.model}" — logged costPence=0`);
  }
  try {
    const run = await commandDb.aiModelRun.create({
      data: {
        purpose: args.purpose,
        provider: args.provider,
        model: args.model,
        promptVersion: args.promptVersion ?? null,
        tokensIn: args.usage.inputTokens,
        tokensOut: args.usage.outputTokens,
        costPence,
        experimentId: args.experimentId ?? null,
      },
      select: { id: true },
    });
    return { id: run.id, costPence };
  } catch (e) {
    console.error("[outreach/ai] recordModelRun failed:", e);
    return { id: null, costPence };
  }
}
