import { pillarLabel } from "@/lib/command/content/pillars";
import type { BrandProfile } from "@/lib/command/content/brand";

// Proposed-week prompt (docs/active/content-brand/SPEC.md, Phase 5.2). Proposes a
// varied, grounded week of content from what Ellis already has: his brand, the
// inbox, and the recent balance. Never invents opinions or fills the week with
// noise; fewer, better slots beat a full but empty calendar.

export type PlanSlot = { day: string; pillar: string; idea: string; sourceIndex: number | null };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const VALID_PILLARS = new Set(["observation_opinion", "educational", "data_insight", "product_building", "founder_bts", "industry", "direct_promo"]);

export function buildWeeklyPlanPrompt(
  profile: BrandProfile | null,
  balanceSummary: string,
  inboxItems: Array<{ observation: string }>,
): { system: string; user: string } {
  const positioning = profile
    ? [profile.associations && `Known for: ${profile.associations}`, profile.quarterFocus && `This quarter: ${profile.quarterFocus}`].filter(Boolean).join("\n")
    : "Positioning not set yet.";

  const system = `You are Ellis Askey's content strategist planning his week. Propose a SHORT, varied week of posts (3 to 4 slots, not every day) grounded only in what he already has.

Rules:
- Vary the content pillars across the week. Use the balance summary to avoid leaning on an overused pillar.
- Prefer ideas that come from the inbox items provided; reference the item by its number.
- Never invent an opinion or a personal story. If an idea would need a view he hasn't expressed, keep it to an observation or a question.
- Spread the slots across different days. Lighter/personal content suits later in the week.
- Fewer, genuinely good slots beat filling every day.

Pillars are: observation_opinion, educational, data_insight, product_building, founder_bts, industry, direct_promo.

Respond with STRICT JSON only, no code fence: an array of up to 4 objects:
[{ "day": "Tuesday", "pillar": "educational", "idea": "a specific one-line idea", "sourceIndex": 0 }]
Use sourceIndex to point at the inbox item number the idea came from, or null if it did not come from one.`;

  const inboxBlock = inboxItems.length
    ? inboxItems.map((it, i) => `${i}. ${it.observation}`).join("\n")
    : "No inbox items right now.";

  const user = `ELLIS'S POSITIONING\n${positioning}\n\nRECENT BALANCE\n${balanceSummary}\n\nINBOX ITEMS (reference by number)\n${inboxBlock}\n\nPropose the week now.`;

  return { system, user };
}

export function parseWeeklyPlan(raw: string): PlanSlot[] {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = s.indexOf("[");
  const b = s.lastIndexOf("]");
  if (a === -1 || b === -1) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(s.slice(a, b + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return (arr as unknown[])
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .filter((o) => DAYS.includes(String(o.day)) && typeof o.idea === "string" && (o.idea as string).trim())
    .slice(0, 4)
    .map((o) => ({
      day: String(o.day),
      pillar: VALID_PILLARS.has(String(o.pillar)) ? String(o.pillar) : "observation_opinion",
      idea: String(o.idea).trim(),
      sourceIndex: typeof o.sourceIndex === "number" ? o.sourceIndex : null,
    }));
}

export { pillarLabel };
