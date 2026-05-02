import type { Tone } from "@/lib/command/content/tones";
import type { Channel } from "@/lib/command/content/channels";

export function buildDraftUserMessage(
  topic: string,
  tone: Tone,
  channel: Channel
): string {
  const positiveList = tone.positiveRules
    .map((r, i) => `  ${i + 1}. ${r}`)
    .join("\n");
  const negativeList = tone.negativeRules
    .map((r, i) => `  ${i + 1}. ${r}`)
    .join("\n");

  return `
Write TWO distinct drafts of a ${channel.label} post on the following topic. Label them exactly as:

VARIANT_1_START
[first draft here]
VARIANT_1_END

VARIANT_2_START
[second draft here]
VARIANT_2_END

TOPIC: ${topic}

CHANNEL: ${channel.label}
Format rules for this channel:
${channel.formatNotes}
Character limit: ${channel.charLimit} characters. Both variants must be under this limit.

TONE: ${tone.label}
${tone.description}

DO (apply all):
${positiveList}

DO NOT (apply all):
${negativeList}

The two variants should feel meaningfully different — different angle, different opening line, different structure. Not just the same post with different words. The reader should genuinely have to choose.

Write only the two variants. No commentary, no labels beyond the VARIANT markers, no meta-text.
`.trim();
}

export function parseVariants(raw: string): { variant1: string; variant2: string } {
  const v1Match = raw.match(/VARIANT_1_START\s*([\s\S]*?)\s*VARIANT_1_END/);
  const v2Match = raw.match(/VARIANT_2_START\s*([\s\S]*?)\s*VARIANT_2_END/);

  const variant1 = v1Match?.[1]?.trim() ?? "";
  const variant2 = v2Match?.[1]?.trim() ?? "";

  if (!variant1 || !variant2) {
    // Fallback: split on blank line if markers are missing
    const halves = raw.split(/\n{3,}/);
    return {
      variant1: (halves[0] ?? raw).trim(),
      variant2: (halves[1] ?? "").trim() || raw.trim(),
    };
  }

  return { variant1, variant2 };
}
