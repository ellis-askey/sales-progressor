import { buildComposeSystemPrompt } from "@/lib/command/content/prompts/compose-prompt";
import type { BrandProfile, MemoryEntry } from "@/lib/command/content/brand";

// Platform-adaptation prompt (docs/active/content-brand/SPEC.md, Phase 4.1).
// Reuses the composer's voice + brand + anti-AI system prompt so adaptations
// stay on-voice, then asks for genuinely different platform expressions of one
// core post, never a copy-paste.

export type Adaptation = { platform: string; treatment: string | null; text: string; mediaHint: string | null };

const VALID_PLATFORMS = new Set(["linkedin", "instagram", "facebook"]);
const VALID_TREATMENTS = new Set(["text", "static", "carousel", "screenshot", "data_graphic", "short_video"]);

export async function buildAdaptSystemPrompt(profile: BrandProfile | null, memory: MemoryEntry[]): Promise<string> {
  const base = await buildComposeSystemPrompt(profile, memory);
  return `${base}

You are now adapting one core post into platform-specific versions. Rules:
- Do NOT copy the same caption across platforms. Each should read like it was written for that platform.
- LinkedIn: the fullest, most considered version of the thought, in Ellis's professional voice.
- Instagram: visual-first. A shorter caption, plus recommend a treatment from: static, carousel, screenshot, data_graphic, short_video. Add a one-line mediaHint on what the visual should show. Never a wall of text.
- Facebook: a more conversational, plain-spoken take. Not a LinkedIn clone.
- Keep the same core point and the same honesty (no invented facts, no UK-market extrapolation from Sales Progressor's own data).`;
}

export function buildAdaptUserMessage(coreText: string): string {
  return `Here is the core post:\n"""\n${coreText}\n"""\n\nProduce the three platform versions. Respond with STRICT JSON only, no code fence:\n{\n  "linkedin": { "text": "..." },\n  "instagram": { "text": "...", "treatment": "static | carousel | screenshot | data_graphic | short_video", "mediaHint": "one line on the visual" },\n  "facebook": { "text": "..." }\n}`;
}

export function parseAdaptations(raw: string): Adaptation[] {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return [];
  }

  const out: Adaptation[] = [];
  for (const platform of ["linkedin", "instagram", "facebook"]) {
    const v = j[platform];
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!text || !VALID_PLATFORMS.has(platform)) continue;
    const treatment = typeof o.treatment === "string" && VALID_TREATMENTS.has(o.treatment) ? o.treatment : platform === "instagram" ? "static" : null;
    const mediaHint = typeof o.mediaHint === "string" && o.mediaHint.trim() ? o.mediaHint.trim() : null;
    out.push({ platform, treatment, text, mediaHint });
  }
  return out;
}
