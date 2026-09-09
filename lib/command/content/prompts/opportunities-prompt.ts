import { memoryKindLabel, type ClaimClassId } from "@/lib/command/content/brand-taxonomy";
import { OPPORTUNITY_KINDS } from "@/lib/command/content/opportunity-kinds";
import type { BrandProfile, MemoryEntry } from "@/lib/command/content/brand";

// Brand-opportunities prompt (docs/active/content-brand/SPEC.md, Phase 2.1). One
// call that proposes reputation-building MOVES beyond individual posts, grounded
// in Ellis's positioning + what he genuinely thinks + what he's recently posted.
// Never invents his opinions; never names an agency or customer.

const VALID_KINDS = new Set<string>(OPPORTUNITY_KINDS);
const VALID_EFFORT = new Set(["low", "medium", "high"]);
const VALID_HORIZON = new Set(["now", "soon", "ongoing"]);
const VALID_CLAIMS: ClaimClassId[] = ["verified_fact", "ellis_opinion", "inference", "unverified"];

export type ParsedOpportunity = {
  kind: string;
  title: string;
  rationale: string;
  suggestedAction: string;
  audience: string[];
  effort: string | null;
  horizon: string | null;
  brandFit: string | null;
  claimClass: ClaimClassId;
};

export function buildOpportunitiesSystemPrompt(profile: BrandProfile | null, memory: MemoryEntry[]): string {
  const positioning = profile
    ? [
        profile.primaryIdentity && `Identity: ${profile.primaryIdentity}`,
        profile.credibility && `Credibility: ${profile.credibility}`,
        profile.associations && `Wants to be known for: ${profile.associations}`,
        profile.desiredReputation && `Desired reputation: ${profile.desiredReputation}`,
        profile.targetAudiences.length ? `Audiences: ${profile.targetAudiences.join(", ")}` : "",
      ].filter(Boolean).join("\n")
    : "Positioning not set yet.";

  const approved = memory.filter((m) => m.status === "approved");
  const expertise = approved.filter((m) => ["expertise", "opinion", "belief", "passion", "frustration"].includes(m.kind));
  const avoid = approved.filter((m) => m.kind === "avoid_topic");

  const expertiseBlock = expertise.length ? expertise.map((m) => `- (${memoryKindLabel(m.kind)}) ${m.body}`).join("\n") : "None recorded yet.";
  const avoidBlock = avoid.length ? avoid.map((m) => `- ${m.body}`).join("\n") : "None.";

  return `You are Ellis Askey's personal PR and brand strategist. Ellis is the founder of Sales Progressor, a UK estate-agency sales-progression product. Your job is to spot REPUTATION-BUILDING OPPORTUNITIES that go beyond a single social post: positions to establish, articles or series to start, case studies, press or podcast angles, or a live debate worth weighing in on.

ELLIS'S POSITIONING
${positioning}

WHAT ELLIS GENUINELY KNOWS AND THINKS (approved; lean on these, never invent past them)
${expertiseBlock}

OFF-LIMITS
${avoidBlock}

WHAT MAKES A GOOD OPPORTUNITY
- It builds Ellis towards what he wants to be known for.
- It plays to genuine expertise, especially expertise he rarely talks about.
- It is specific and actionable, not "post more about property".
- It suits his credibility (he worked inside sales progression; he is not a generic pundit).

HARD RULES
- Never attribute an opinion to Ellis that isn't in his approved memory. Frame positions as ones he "could establish", not ones he already holds.
- Never name a specific agency, customer or person.
- This is Sales Progressor's own vantage point. Never extrapolate its data into claims about the whole UK market.
- No fake precision, no invented metrics, no manufactured controversy.
- If positioning and memory are thin, propose fewer, safer opportunities rather than inventing a persona.

kind is one of: comment (weigh in on a live debate), position (establish a stance), article (a longer piece), series (a recurring theme), press (pitch a story), podcast (an interview angle), case_study.

Respond with STRICT JSON only, no prose, no code fence: an array of up to 6 objects:
[{
  "kind": "position",
  "title": "short, concrete",
  "rationale": "why this builds his reputation, 1-2 sentences",
  "suggestedAction": "the concrete next move",
  "audience": ["who it reaches"],
  "effort": "low | medium | high",
  "horizon": "now | soon | ongoing",
  "brandFit": "one line, or null",
  "claimClass": "verified_fact | ellis_opinion | inference | unverified"
}]`;
}

export function buildOpportunitiesUserMessage(recentTopics: string[], openThoughts: string[]): string {
  const posted = recentTopics.length
    ? recentTopics.map((t) => `- ${t}`).join("\n")
    : "Nothing posted yet.";
  const thoughts = openThoughts.length
    ? openThoughts.map((t) => `- ${t}`).join("\n")
    : "None saved.";
  return `WHAT ELLIS HAS RECENTLY POSTED ABOUT (avoid repeating; look for gaps and threads worth pulling)
${posted}

UNUSED THOUGHTS ELLIS HAS SAVED (raw material he might build on)
${thoughts}

Propose the reputation-building opportunities now.`;
}

export function parseOpportunities(raw: string): ParsedOpportunity[] {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(s.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .filter((o) => typeof o.title === "string" && (o.title as string).trim() && VALID_KINDS.has(String(o.kind)))
    .slice(0, 6)
    .map((o) => ({
      kind: String(o.kind),
      title: String(o.title).trim(),
      rationale: typeof o.rationale === "string" ? o.rationale.trim() : "",
      suggestedAction: typeof o.suggestedAction === "string" ? o.suggestedAction.trim() : "",
      audience: Array.isArray(o.audience) ? (o.audience as unknown[]).map(String).slice(0, 6) : [],
      effort: VALID_EFFORT.has(String(o.effort)) ? String(o.effort) : null,
      horizon: VALID_HORIZON.has(String(o.horizon)) ? String(o.horizon) : null,
      brandFit: typeof o.brandFit === "string" && o.brandFit.trim() ? o.brandFit.trim() : null,
      claimClass: VALID_CLAIMS.includes(o.claimClass as ClaimClassId) ? (o.claimClass as ClaimClassId) : "inference",
    }));
}
