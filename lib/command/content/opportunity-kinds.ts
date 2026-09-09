// Brand-opportunity kinds (docs/active/content-brand/SPEC.md, Phase 2.1). Pure
// data, server- and client-safe, so both the builder/prompt and the client UI
// share one vocabulary.

export const OPPORTUNITY_KINDS = ["comment", "position", "article", "series", "press", "podcast", "case_study"] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const OPPORTUNITY_KIND_LABELS: Record<string, string> = {
  comment: "Weigh in",
  position: "Establish a position",
  article: "Write an article",
  series: "Start a series",
  press: "Pitch to press",
  podcast: "Podcast angle",
  case_study: "Case study",
};

// Kinds that become a single post, so the flow can draft them directly. The
// rest (press, podcast, case_study) are bigger moves, not one post.
export const DRAFTABLE_KINDS = new Set<string>(["comment", "position", "article", "series"]);
