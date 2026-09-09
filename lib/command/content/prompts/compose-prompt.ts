import { buildSystemPrompt } from "@/lib/command/content/prompts/system-prompt";
import { VOICE_GUIDANCE, antiAiRulesBlock } from "@/lib/command/content/voice-rules";
import { memoryKindLabel } from "@/lib/command/content/brand-taxonomy";
import type { BrandProfile, MemoryEntry } from "@/lib/command/content/brand";
import type { Channel } from "@/lib/command/content/channels";

// Composer prompts for the guided creation flow (docs/active/content-brand/
// SPEC.md, Phase 1.4). The system prompt extends the existing voice-calibrated
// prompt with Ellis's brand positioning + approved memory + the anti-AI rules.
// The user message states the fully-decided brief (source, purpose, angle,
// point, format) so the model writes to a clear point, not from a bare topic.

export type ComposeBrief = {
  source: string;
  purposeLabel: string;
  purposeHint: string;
  angleLabel: string;
  point: string;
  formatLabel: string;
  formatNote: string;
  evidence?: string | null;
  claimNote?: string | null;
};

export async function buildComposeSystemPrompt(profile: BrandProfile | null, memory: MemoryEntry[]): Promise<string> {
  const base = await buildSystemPrompt(); // thesis + voice samples

  const positioning = profile
    ? [
        profile.primaryIdentity && `Identity: ${profile.primaryIdentity}`,
        profile.personality && `Personality: ${profile.personality}`,
        profile.associations && `Known for: ${profile.associations}`,
      ].filter(Boolean).join("\n")
    : "";

  const approved = memory.filter((m) => m.status === "approved");
  const opinions = approved.filter((m) => ["opinion", "belief", "expertise", "passion", "frustration"].includes(m.kind));
  const avoid = approved.filter((m) => m.kind === "avoid_topic");
  const phrasesLiked = approved.filter((m) => m.kind === "phrase_used").map((m) => m.body);
  const phrasesDisliked = approved.filter((m) => m.kind === "phrase_disliked").map((m) => m.body);

  const brandBlock = [
    positioning && `ELLIS'S POSITIONING\n${positioning}`,
    opinions.length && `WHAT ELLIS GENUINELY THINKS (lean on these, never contradict or invent past them)\n${opinions.map((m) => `- (${memoryKindLabel(m.kind)}) ${m.body}`).join("\n")}`,
    avoid.length && `NEVER WRITE ABOUT (off-limits)\n${avoid.map((m) => `- ${m.body}`).join("\n")}`,
    phrasesLiked.length && `Words that sound like Ellis: ${phrasesLiked.join("; ")}`,
    phrasesDisliked.length && `Words to avoid: ${phrasesDisliked.join("; ")}`,
  ].filter(Boolean).join("\n\n");

  const rules = [
    "VOICE",
    VOICE_GUIDANCE,
    "",
    antiAiRulesBlock(),
    "",
    "HONESTY",
    "Only state as fact what is genuinely supported. If the point is an opinion, write it as Ellis's opinion, not as established fact. Never present Sales Progressor's own data as a claim about the whole UK market.",
  ].join("\n");

  return [base, brandBlock, rules].filter(Boolean).join("\n\n");
}

export function buildComposeUserMessage(brief: ComposeBrief, channel: Channel): string {
  const evidence = brief.evidence ? `\n\nEVIDENCE (Sales Progressor's own data; keep claims to what it actually shows):\n${brief.evidence}` : "";
  const claim = brief.claimNote ? `\n\nCLAIM CHECK: ${brief.claimNote}` : "";

  return `
Write TWO distinct drafts of a ${brief.formatLabel} on the point below. Label them exactly as:

VARIANT_1_START
[first draft here]
VARIANT_1_END

VARIANT_2_START
[second draft here]
VARIANT_2_END

WHAT THIS IS ABOUT (the source):
${brief.source}

WHY WE'RE POSTING (purpose): ${brief.purposeLabel}. ${brief.purposeHint}

THE ANGLE: ${brief.angleLabel}
THE POINT TO MAKE (this is the argument; everything serves it):
${brief.point}

FORMAT: ${brief.formatLabel}. ${brief.formatNote}
Channel rules (${channel.label}):
${channel.formatNotes}
Character limit: ${channel.charLimit}. Both variants must be under it.${evidence}${claim}

The two variants must be genuinely different: a different opening and a different structure, both making the same core point. The reader should have to choose.

Write only the two variants. No commentary, no labels beyond the VARIANT markers.
`.trim();
}
