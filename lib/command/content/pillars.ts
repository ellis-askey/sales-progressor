// Content pillars (docs/active/content-brand/SPEC.md, Phase 2.2). Balance
// controls, NOT a rigid calendar: they track the mix of substance across recent
// posts so the feed doesn't become repetitive. Pure data, server- and
// client-safe.

export type Pillar = { id: string; label: string; hint: string };

export const PILLARS: Pillar[] = [
  { id: "observation_opinion", label: "Observations & opinions", hint: "Takes and things noticed." },
  { id: "educational", label: "Useful & educational", hint: "Practical, teachable insight." },
  { id: "data_insight", label: "Data & insights", hint: "Numbers and trends from the work." },
  { id: "product_building", label: "Product & building", hint: "What we're building and why." },
  { id: "founder_bts", label: "Founder & behind the scenes", hint: "The person and the journey." },
  { id: "industry", label: "Industry commentary", hint: "The wider market and profession." },
  { id: "direct_promo", label: "Direct promotion", hint: "Straight product or company push." },
];

export function pillarLabel(id: string): string {
  return PILLARS.find((p) => p.id === id)?.label ?? id;
}

// Map a creation-flow brief (purpose + angle label) to a pillar. The angle is
// the strongest signal; the purpose refines the fallback. Kept deterministic so
// the same brief always lands in the same pillar.
export function pillarForBrief(purposeId: string, angleLabel?: string | null): string {
  const a = (angleLabel ?? "").toLowerCase();
  if (a.includes("data")) return "data_insight";
  if (a.includes("product")) return "product_building";
  if (a.includes("story") || a.includes("personal")) return "founder_bts";
  if (a.includes("useful") || a.includes("educational")) return "educational";
  if (
    a.includes("opinion") || a.includes("observation") || a.includes("contrarian") ||
    a.includes("prediction") || a.includes("question")
  ) {
    return "observation_opinion";
  }

  switch (purposeId) {
    case "explain_tsp":
      return "product_building";
    case "drive_traffic":
    case "generate_leads":
      return "direct_promo";
    case "educate":
    case "demonstrate_expertise":
    case "build_authority":
      return "educational";
    case "humanise":
      return "founder_bts";
    case "increase_awareness":
      return "industry";
    case "challenge_assumption":
    case "generate_discussion":
    default:
      return "observation_opinion";
  }
}
