// Local palette for the public solicitor portal (/s/[token]). A restrained,
// professional skin — cool neutrals, navy ink, white cards, soft shadows —
// deliberately distinct from the warm consumer client portal (no glass/warmth)
// and from the utilitarian chase email. Kept inline (like /quote's `A`) because
// the page renders outside any app shell, with no theme variables loaded.

export const S = {
  // Ink
  ink: "#0f2740",
  inkSoft: "#33475b",
  muted: "#66788f",
  faint: "#8a99ac",

  // Page + surfaces
  bgTop: "#e9eef6",
  bgBottom: "#f5f8fc",
  card: "#ffffff",
  cardBorder: "rgba(15,39,64,0.09)",
  cardShadow: "0 1px 2px rgba(15,39,64,0.05), 0 12px 30px rgba(15,39,64,0.06)",
  nested: "#f5f8fc",
  nestedBorder: "#e6edf5",
  line: "#e9eef5",

  // Primary (navy) + a professional blue accent
  primary: "#0f2740",
  accent: "#2f5fd0",
  accentTint: "rgba(47,95,208,0.08)",
  accentBorder: "rgba(47,95,208,0.35)",

  // Feedback
  success: "#2f7d4f",
  successBg: "rgba(47,125,79,0.09)",
  danger: "#c0392b",
} as const;
