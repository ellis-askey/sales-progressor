// Voice-learning prompt (docs/active/content-brand/SPEC.md, Phase 3.3). Analyses
// how Ellis edits AI drafts into his final version and distils the repeated
// patterns into a short, plain-English profile. Anti-overfit is built into the
// instructions: only patterns seen across MULTIPLE edits are reported.

export type EditPair = { baseline: string; final: string };
export type VoiceCharacteristic = { id: string; text: string };

export function buildVoiceLearningPrompt(pairs: EditPair[], dismissed: string[]): { system: string; user: string } {
  const dismissedBlock = dismissed.length
    ? `\n\nDo NOT report any of these, which have been marked wrong before:\n${dismissed.map((d) => `- ${d}`).join("\n")}`
    : "";

  const system = `You analyse how Ellis edits AI-drafted social posts into his own final version, to learn his voice. You are given pairs of (AI draft, Ellis's final).

Report ONLY patterns that show up across MULTIPLE edits. Never report a one-off change from a single edit. If a pattern appears once, ignore it.

Look for repeated behaviour such as:
- words or phrases he consistently removes or replaces
- how he tends to open a post
- how he tends to end (does he cut CTAs, questions, sign-offs?)
- sentence length and rhythm
- how strongly he states opinions
- formatting habits (paragraphing, lists)
- humour patterns
- terms he naturally uses

Each characteristic must be a short, plain, specific sentence a writer could act on. No vague generalities. If there is not enough repeated signal, return fewer items rather than inventing them.${dismissedBlock}

Respond with STRICT JSON only, no prose, no code fence: an array of up to 8 short strings.`;

  const user = pairs
    .map((p, i) => `EDIT ${i + 1}\nAI draft:\n"""\n${p.baseline}\n"""\n\nEllis's final:\n"""\n${p.final}\n"""`)
    .join("\n\n----\n\n");

  return { system, user };
}

export function parseCharacteristics(raw: string): VoiceCharacteristic[] {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(s.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return (arr as unknown[])
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((text, i) => ({ id: String(i), text }));
}
