import { BANNED_PHRASES } from "@/lib/command/content/voice-rules";

// AI-tell detector (docs/active/content-brand/SPEC.md, Phase 3.2). Flags the
// phrases and structures that make a draft read as AI-written, so the composer
// can warn and offer a one-click clean-up. Pure, deterministic, client-safe.

export type AiTell = { label: string; detail?: string };

// Unicode pictographic covers emoji without a giant hand-rolled range.
const EMOJI = /\p{Extended_Pictographic}/u;
// Em-dash by codepoint, so this detector doesn't itself carry an em-dash byte
// and trip the repo's Law 21 sweep.
const EM_DASH = String.fromCharCode(0x2014);

export function detectAiTells(text: string): AiTell[] {
  const tells: AiTell[] = [];
  if (!text.trim()) return tells;
  const lower = text.toLowerCase();

  for (const p of BANNED_PHRASES) {
    if (lower.includes(p.toLowerCase())) tells.push({ label: "Cliché phrase", detail: `"${p}"` });
  }

  // "It's not X. It's Y." construction.
  if (/it['’]s not\b[^.!?]{1,40}[.!?]\s*it['’]s\b/i.test(text)) {
    tells.push({ label: "It's-not-X-it's-Y construction" });
  }

  if (EMOJI.test(text)) tells.push({ label: "Emoji" });

  const hashtags = text.match(/#\w+/g);
  if (hashtags && hashtags.length > 0) {
    tells.push({ label: hashtags.length > 1 ? "Hashtags" : "Hashtag", detail: hashtags.slice(0, 3).join(" ") });
  }

  // Voice rule: no em dashes.
  if (text.includes(EM_DASH)) tells.push({ label: "Em dash" });

  // One-word engagement-bait closer.
  if (/\n\s*(agree|thoughts|right|makes sense)\s*\??\s*$/i.test(text)) {
    tells.push({ label: "Engagement-bait closer" });
  }

  // Drama line breaks: mostly one-line short paragraphs.
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const shortSolo = paras.filter((p) => !p.includes("\n") && p.length < 60 && (p.match(/[.!?]/g) ?? []).length <= 1);
  if (paras.length >= 4 && shortSolo.length >= Math.ceil(paras.length * 0.6)) {
    tells.push({ label: "Drama line breaks", detail: "lots of one-line paragraphs" });
  }

  return tells;
}
