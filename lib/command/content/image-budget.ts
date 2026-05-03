import { commandDb } from "@/lib/command/prisma";

const DEFAULT_MONTHLY_CAP_PENCE = 5000; // £50

export async function getMonthlyAiImageSpendPence(): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const result = await commandDb.generatedImage.aggregate({
    where: { imageType: "ai_generated", createdAt: { gte: start } },
    _sum: { aiCostCents: true },
  });

  return result._sum.aiCostCents ?? 0;
}

export function getMonthlyCapPence(): number {
  const env = process.env.CONTENT_AI_IMAGE_MONTHLY_BUDGET_PENCE;
  return env ? parseInt(env, 10) : DEFAULT_MONTHLY_CAP_PENCE;
}

const BLOCKED_PROMPT_TERMS = [
  "face", "faces", "person", "people", "human", "woman", "man", "girl", "boy",
  "portrait", "selfie", "real person", "celebrity", "politician",
  "downing street", "parliament", "buckingham", "white house",
];

export function moderateImagePrompt(prompt: string): { ok: boolean; reason?: string } {
  const lower = prompt.toLowerCase();
  const hit = BLOCKED_PROMPT_TERMS.find((t) => lower.includes(t));
  if (hit) {
    return { ok: false, reason: `Prompt contains restricted term: "${hit}". Remove references to people, faces, or real buildings.` };
  }
  return { ok: true };
}
