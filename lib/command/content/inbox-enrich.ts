import { callClaude } from "@/lib/anthropic";
import type { BrandProfile, MemoryEntry } from "@/lib/command/content/brand";
import { memoryKindLabel, type ClaimClassId } from "@/lib/command/content/brand-taxonomy";
import type { Candidate } from "@/lib/command/content/inbox-sources";

// Inbox enrichment (docs/active/content-brand/SPEC.md, Phase 1.3). Takes a raw,
// anonymised candidate and works out why it's interesting, a few genuinely
// different angles, the likely audience, and a qualitative reach note — all
// checked against Ellis's brand, and honestly claim-classified. It never
// invents Ellis's opinion (angles are options, not attributed views) and never
// extrapolates TSP data to the whole UK market.

export type Angle = { angle: string; point: string };

export type Enrichment = {
  whyInteresting: string;
  brandFit: string | null;
  reachReason: string | null;
  claimClass: ClaimClassId;
  likelyAudience: string[];
  suggestedAngles: Angle[];
};

const VALID_CLAIMS: ClaimClassId[] = ["verified_fact", "ellis_opinion", "inference", "unverified"];

export function buildEnrichmentSystemPrompt(profile: BrandProfile | null, memory: MemoryEntry[]): string {
  const positioning = profile
    ? [
        profile.primaryIdentity && `Identity: ${profile.primaryIdentity}`,
        profile.credibility && `Credibility: ${profile.credibility}`,
        profile.associations && `Known for: ${profile.associations}`,
        profile.targetAudiences.length ? `Audiences: ${profile.targetAudiences.join(", ")}` : "",
      ].filter(Boolean).join("\n")
    : "Positioning not set yet.";

  const approved = memory.filter((m) => m.status === "approved");
  const opinions = approved.filter((m) => ["opinion", "belief", "expertise", "passion", "frustration"].includes(m.kind));
  const avoid = approved.filter((m) => m.kind === "avoid_topic");

  const memoryBlock = opinions.length
    ? opinions.map((m) => `- (${memoryKindLabel(m.kind)}) ${m.body}`).join("\n")
    : "None recorded yet.";
  const avoidBlock = avoid.length ? avoid.map((m) => `- ${m.body}`).join("\n") : "None.";

  return `You are the content strategist for Ellis Askey, founder of Sales Progressor, a UK estate-agency sales-progression product. Your job is to judge whether a real observation is worth Ellis talking about publicly, and to shape HOW he might say it, not to write the post.

ELLIS'S POSITIONING
${positioning}

WHAT ELLIS GENUINELY THINKS (approved brand memory; you may lean on these, never invent new ones)
${memoryBlock}

TOPICS ELLIS WILL NOT DISCUSS PUBLICLY
${avoidBlock}

HARD RULES
- Never attribute an opinion to Ellis that isn't in the brand memory above. Angles are OPTIONS he could take, phrased neutrally ("could argue that…"), not claims about what he believes.
- Classify the observation's core claim honestly as one of: verified_fact (backed by the evidence given), ellis_opinion (matches an approved memory), inference (a reasonable read), unverified (not established). When unsure, use "inference" or "unverified".
- This is Sales Progressor's own data or activity. NEVER extrapolate it into a claim about the whole UK market. Keep claims to what the data actually shows ("across the sales we see", not "across the UK").
- Never name a specific agency, customer or person.
- Suggested angles must be genuinely DIFFERENT things to say (an observation vs an opinion vs a useful insight vs a data point), not reworded hooks.
- A reach note is a short qualitative reason it might land. Never invent a number or an impression estimate.
- If the observation is off-limits or too thin to be worth saying, say so in whyInteresting and return an empty angles array.

Respond with STRICT JSON only, no prose, no code fence:
{
  "whyInteresting": "one or two plain sentences",
  "brandFit": "one sentence on how it fits Ellis's positioning, or null",
  "reachReason": "short qualitative reason it might land, or null",
  "claimClass": "verified_fact | ellis_opinion | inference | unverified",
  "likelyAudience": ["who this reaches"],
  "suggestedAngles": [{ "angle": "Observation | Opinion | Useful | Data | Story | Question", "point": "the actual different point to make" }]
}`;
}

function parseJson(raw: string): unknown {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json object");
  return JSON.parse(s.slice(start, end + 1));
}

// Safe default when the model output can't be parsed — the item still lands,
// honestly marked unverified with no invented angles, rather than being dropped.
function fallback(): Enrichment {
  return {
    whyInteresting: "",
    brandFit: null,
    reachReason: null,
    claimClass: "unverified",
    likelyAudience: [],
    suggestedAngles: [],
  };
}

export async function enrichCandidate(candidate: Candidate, systemPrompt: string): Promise<Enrichment> {
  const evidence = candidate.evidence ? `\n\nEvidence (Sales Progressor's own data):\n${JSON.stringify(candidate.evidence)}` : "";
  const user = `Observation (${candidate.sourceType}):\n${candidate.observation}${evidence}`;

  let raw: string;
  try {
    raw = await callClaude(systemPrompt, user, 900);
  } catch {
    return fallback();
  }

  try {
    const j = parseJson(raw) as Record<string, unknown>;
    const claim = VALID_CLAIMS.includes(j.claimClass as ClaimClassId) ? (j.claimClass as ClaimClassId) : "inference";
    const audience = Array.isArray(j.likelyAudience) ? (j.likelyAudience as unknown[]).map(String).slice(0, 6) : [];
    const angles = Array.isArray(j.suggestedAngles)
      ? (j.suggestedAngles as Array<Record<string, unknown>>)
          .filter((a) => a && typeof a.point === "string" && (a.point as string).trim())
          .map((a) => ({ angle: String(a.angle ?? "Angle"), point: String(a.point) }))
          .slice(0, 6)
      : [];
    return {
      whyInteresting: typeof j.whyInteresting === "string" ? j.whyInteresting.trim() : "",
      brandFit: typeof j.brandFit === "string" && j.brandFit.trim() ? j.brandFit.trim() : null,
      reachReason: typeof j.reachReason === "string" && j.reachReason.trim() ? j.reachReason.trim() : null,
      claimClass: claim,
      likelyAudience: audience,
      suggestedAngles: angles,
    };
  } catch {
    return fallback();
  }
}
