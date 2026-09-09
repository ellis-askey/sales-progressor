// Composer refine actions (docs/active/content-brand/SPEC.md, Phase 3.1). Each
// is a targeted rewrite the composer can apply to the current draft. Pure data,
// server- and client-safe: the client shows id + label, the refine endpoint
// uses the instruction. Deliberately NOT "professional / casual / funny": these
// steer substance and voice, not a generic tone dial.

export type RefineAction = { id: string; label: string; instruction: string };

export const REFINE_ACTIONS: RefineAction[] = [
  { id: "more_like_me", label: "More like me", instruction: "Rewrite it more strongly in Ellis's own voice: his phrasing, rhythm and directness. Lean on his approved phrases and cut anything that sounds like a marketer wrote it." },
  { id: "more_specific", label: "More specific", instruction: "Make it more specific and concrete. Replace anything vague with precise, real detail from the source. Invent nothing." },
  { id: "stronger", label: "Make the point stronger", instruction: "Make the central point stronger and more direct. Cut the hedging and say the thing plainly." },
  { id: "less_polished", label: "Less polished", instruction: "Make it read like a real person typed it rather than a polished marketing post. Loosen the phrasing and allow a rougher, more human edge." },
  { id: "shorter", label: "Shorter", instruction: "Cut it down. Keep only the words that earn their place. Do not lose the core point." },
  { id: "add_evidence", label: "Add evidence", instruction: "Ground the claim in the supporting evidence provided. Never invent numbers or facts, and never present Sales Progressor's own data as a claim about the whole UK market." },
  { id: "remove_pitch", label: "Remove the sales pitch", instruction: "Strip out the sales pitch. No call to action and no product plug unless it is genuinely essential to the point." },
  { id: "another_opening", label: "Try another opening", instruction: "Rewrite with a completely different opening line and hook, keeping the same core point and voice." },
];

// A dedicated de-AI rewrite, offered only when the AI-tell detector fires (not a
// permanent toolbar button). Handled by getRefineAction like the rest.
export const DE_AI_ACTION: RefineAction = {
  id: "de_ai",
  label: "Clean up AI tells",
  instruction: "Rewrite so it reads like a real person wrote it, not an AI. Remove clichéd phrases, drama line breaks (one-sentence-per-paragraph), emojis, hashtags, em dashes, forced rhetorical questions and engagement-bait closers. Keep the exact point and Ellis's voice.",
};

export function getRefineAction(id: string): RefineAction | undefined {
  return [...REFINE_ACTIONS, DE_AI_ACTION].find((a) => a.id === id);
}

// Promotional intensity: a simple low to high control. Most content should stay
// low. Maps to an instruction the refine + compose prompts respect.
export type PromoIntensity = "low" | "medium" | "high";

export const PROMO_INTENSITY_INSTRUCTION: Record<PromoIntensity, string> = {
  low: "Keep promotion low: no call to action and no product mention unless it is truly essential to the point.",
  medium: "Light promotion is fine: a natural, understated product relevance is acceptable if it fits.",
  high: "Stronger promotion is intended: a clear product or company push is welcome, but keep it credible and specific, never hypey.",
};
