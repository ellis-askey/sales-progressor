// Platforms + visual treatments (docs/active/content-brand/SPEC.md, Phase 4).
// Pure data, server- and client-safe.

export const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", note: "The fullest version of the thought." },
  { id: "instagram", label: "Instagram", note: "Visual-first. Shorter caption plus a treatment." },
  { id: "facebook", label: "Facebook", note: "More conversational, not a LinkedIn clone." },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]["id"];

export function platformLabel(id: string): string {
  return PLATFORMS.find((p) => p.id === id)?.label ?? id;
}

// Visual treatments an Instagram (or image-led) post can take.
export const TREATMENT_LABELS: Record<string, string> = {
  text: "Text",
  static: "Branded static",
  carousel: "Carousel",
  screenshot: "Product screenshot",
  data_graphic: "Data graphic",
  short_video: "Short video",
};

export function treatmentLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return TREATMENT_LABELS[id] ?? id;
}
