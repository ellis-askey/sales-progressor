import { memoryKindLabel } from "@/lib/command/content/brand-taxonomy";
import type { BrandProfile, MemoryEntry } from "@/lib/command/content/brand";

// Brand-review prompt (docs/active/content-brand/SPEC.md, Phase 2.3). One call
// that reviews where Ellis's public brand stands, like a PR consultant looking
// over the last stretch of activity. Grounded in his positioning + memory +
// what he's actually posted. Never invents opinions, never extrapolates Sales
// Progressor's data to the whole UK market, no fake precision.

export type ParsedReview = {
  summary: string;
  leanInto: string[];
  overused: string[];
  breakout: string[];
  underusedExpertise: string[];
};

export function buildBrandReviewSystemPrompt(profile: BrandProfile | null, memory: MemoryEntry[]): string {
  const positioning = profile
    ? [
        profile.primaryIdentity && `Identity: ${profile.primaryIdentity}`,
        profile.associations && `Wants to be known for: ${profile.associations}`,
        profile.desiredReputation && `Desired reputation: ${profile.desiredReputation}`,
        profile.quarterFocus && `Focus this quarter: ${profile.quarterFocus}`,
      ].filter(Boolean).join("\n")
    : "Positioning not set yet.";

  const approved = memory.filter((m) => m.status === "approved");
  const expertise = approved.filter((m) => ["expertise", "passion", "opinion", "belief", "frustration"].includes(m.kind));
  const expertiseBlock = expertise.length ? expertise.map((m) => `- (${memoryKindLabel(m.kind)}) ${m.body}`).join("\n") : "None recorded yet.";

  return `You are Ellis Askey's personal PR and brand strategist. Ellis is the founder of Sales Progressor, a UK estate-agency sales-progression product. Review where his public brand stands and advise on the next stretch, the way a good consultant would in a weekly check-in.

ELLIS'S POSITIONING
${positioning}

WHAT ELLIS GENUINELY KNOWS AND THINKS (approved memory)
${expertiseBlock}

HOW TO REVIEW
- leanInto: themes that are working or reinforce what he wants to be known for. Lean into these.
- overused: themes that are getting stale or too frequent (especially anything too product-heavy).
- breakout: themes with genuine potential he hasn't leaned on yet.
- underusedExpertise: things he clearly knows well but rarely talks about.
- summary: a short, honest read of what he is currently becoming known for, based only on the evidence given.

HARD RULES
- Base everything on the positioning, memory and posting history provided. Do not invent opinions, expertise, or a persona.
- Never name a specific agency, customer or person.
- Never extrapolate Sales Progressor's own data into a claim about the whole UK market.
- No fake metrics or precision. If the history is thin, say so in the summary and keep the lists short and grounded in his stated expertise.

Respond with STRICT JSON only, no prose, no code fence:
{
  "summary": "2-3 honest sentences",
  "leanInto": ["theme"],
  "overused": ["theme"],
  "breakout": ["theme"],
  "underusedExpertise": ["theme"]
}`;
}

export function buildBrandReviewUserMessage(
  recentPosts: Array<{ topicSeed: string; pillar: string | null }>,
  balanceSummary: string,
  thoughts: string[],
): string {
  const posts = recentPosts.length
    ? recentPosts.map((p) => `- [${p.pillar ?? "uncategorised"}] ${p.topicSeed}`).join("\n")
    : "Nothing published yet.";
  const th = thoughts.length ? thoughts.map((t) => `- ${t}`).join("\n") : "None saved.";

  return `WHAT ELLIS HAS RECENTLY WORKED ON / POSTED (with content pillar)
${posts}

RECENT BALANCE ACROSS PILLARS
${balanceSummary}

UNUSED THOUGHTS HE'S SAVED
${th}

Write the review now.`;
}

export function parseBrandReview(raw: string): ParsedReview | null {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const list = (v: unknown): string[] => (Array.isArray(v) ? (v as unknown[]).map(String).map((x) => x.trim()).filter(Boolean).slice(0, 8) : []);
  return {
    summary: typeof j.summary === "string" ? j.summary.trim() : "",
    leanInto: list(j.leanInto),
    overused: list(j.overused),
    breakout: list(j.breakout),
    underusedExpertise: list(j.underusedExpertise),
  };
}
