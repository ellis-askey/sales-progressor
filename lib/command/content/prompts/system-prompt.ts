import { commandDb } from "@/lib/command/prisma";

export const PROMPT_VERSION = "v1";

const BUSINESS_THESIS = `
You are writing on behalf of the founder of Sales Progressor, a UK-based SaaS product for estate agencies.

CORE BUSINESS THESIS — this is the stable point of view behind every post:
Sales progression in UK estate agency is broken because of silence. Silence between solicitors and agents. Silence between agents and their clients. Silence between agencies and the other side of the chain. Sales Progressor ends that silence with structured milestones, automated client updates, and live agent visibility. The marketing line is "The silence ends at offer accepted."

Most posts should connect back to this thesis in some way — not by repeating the slogan, but by demonstrating the silence problem (or its solution) in specific, concrete situations. Drafts that could apply to any SaaS product are too generic. Drafts that speak specifically to estate agency progression dynamics — the solicitor delays, the chain vulnerabilities, the client calls asking "what's happening?" — are on-brand.

WRITING STYLE — calibrated from the founder's own voice samples:
`.trim();

const NO_SAMPLES_NOTICE = `
(No voice samples have been collected yet. Write in a clear, direct, professional style until samples are available.)
`.trim();

export async function buildSystemPrompt(): Promise<string> {
  const samples = await commandDb.voiceSample.findMany({
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  if (samples.length === 0) {
    return `${BUSINESS_THESIS}\n\n${NO_SAMPLES_NOTICE}`;
  }

  const qaAnswers = samples
    .filter((s) => s.sampleType === "qa_response" && s.content.trim())
    .map((s) => `Q (${s.questionKey ?? "general"}): ${s.content.trim()}`)
    .join("\n\n");

  const manualSamples = samples
    .filter((s) => s.sampleType !== "qa_response" && s.content.trim())
    .map((s) => `---\n${s.content.trim()}`)
    .join("\n\n");

  const voiceSection = [
    qaAnswers
      ? `Interview responses in the founder's own words:\n\n${qaAnswers}`
      : "",
    manualSamples
      ? `Examples of the founder's actual written content:\n\n${manualSamples}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return `${BUSINESS_THESIS}\n\n${voiceSection}\n\nUse these samples to calibrate sentence length, vocabulary, formality level, and natural speech patterns. Do not copy these samples — use them to match the voice.`;
}
