import type { DraftChannel } from "@prisma/client";

// Creation-flow taxonomy (docs/active/content-brand/SPEC.md, Phase 1.4). The
// Source -> Purpose -> Angle -> Format steps. Pure data, server- and client-safe.
// Formats map to an existing draft channel so the composer reuses its char limit
// and format notes; visual formats produce the post COPY now, with artwork
// arriving in Phase 4.

export type Purpose = { id: string; label: string; hint: string };

export const PURPOSES: Purpose[] = [
  { id: "build_authority", label: "Build authority", hint: "Show you know how the transaction really works." },
  { id: "generate_discussion", label: "Generate discussion", hint: "Something agents will want to weigh in on." },
  { id: "demonstrate_expertise", label: "Demonstrate expertise", hint: "A specific, credible insight." },
  { id: "increase_awareness", label: "Increase awareness", hint: "Get in front of the right people." },
  { id: "humanise", label: "Humanise you", hint: "The person behind the product." },
  { id: "explain_tsp", label: "Explain what we do", hint: "Make Sales Progressor clearer." },
  { id: "challenge_assumption", label: "Challenge an assumption", hint: "Push back on received wisdom." },
  { id: "educate", label: "Educate", hint: "Teach something genuinely useful." },
  { id: "drive_traffic", label: "Drive traffic", hint: "Move people to the site." },
  { id: "generate_leads", label: "Generate leads", hint: "Start conversations with agencies." },
];

export function getPurpose(id: string): Purpose | undefined {
  return PURPOSES.find((p) => p.id === id);
}

export type AngleType = { id: string; label: string; hint: string };

export const ANGLE_TYPES: AngleType[] = [
  { id: "observation", label: "Observation", hint: "Something you've noticed." },
  { id: "opinion", label: "Opinion", hint: "A view you'll stand behind." },
  { id: "educational", label: "Useful", hint: "A practical, teachable point." },
  { id: "story", label: "Story", hint: "A real, specific moment." },
  { id: "data", label: "Data", hint: "A number that says something." },
  { id: "contrarian", label: "Contrarian", hint: "The unpopular but honest take." },
  { id: "product", label: "Product", hint: "How we approach it in the product." },
  { id: "personal", label: "Personal", hint: "Your own experience (only if genuine)." },
  { id: "prediction", label: "Prediction", hint: "Where this is heading." },
  { id: "question", label: "Question", hint: "Open it up for debate (sparingly)." },
];

export type Format = {
  id: string;
  label: string;
  channelId: DraftChannel;
  note: string;
  visual?: boolean; // artwork lands in Phase 4; copy is produced now
};

export const FORMATS: Format[] = [
  { id: "linkedin_text", label: "LinkedIn post", channelId: "linkedin", note: "The fullest version of the thought." },
  { id: "linkedin_article", label: "Longer article", channelId: "linkedin", note: "A longer, structured piece." },
  { id: "linkedin_data", label: "Data post", channelId: "linkedin", note: "A number-led point.", visual: true },
  { id: "linkedin_carousel", label: "Carousel", channelId: "linkedin", note: "Multi-slide. Copy now, artwork in Phase 4.", visual: true },
  { id: "linkedin_screenshot", label: "Product screenshot", channelId: "linkedin", note: "A screenshot with framing copy.", visual: true },
  { id: "instagram_caption", label: "Instagram post", channelId: "instagram_caption", note: "Visual-first, shorter caption.", visual: true },
  { id: "instagram_reel", label: "Short video", channelId: "instagram_reel_script", note: "A short video script." },
];

export function getFormat(id: string): Format | undefined {
  return FORMATS.find((f) => f.id === id);
}
