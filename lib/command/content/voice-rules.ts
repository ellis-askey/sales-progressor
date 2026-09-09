// Ellis's voice rules + the anti-AI banned list (docs/active/content-brand/
// SPEC.md, Phase 1.4). Applied when generating a post, and reused by the Phase 3
// AI-tell detector. Pure data.

// Positive voice guidance, injected into the composer's system prompt.
export const VOICE_GUIDANCE = [
  "Plain English. Conversational but intelligent, without trying to sound clever.",
  "Direct. State strong opinions plainly when they are genuinely held.",
  "Specific over vague. Concrete situations from UK property, not generic SaaS talk.",
  "Sounds like someone who actually works inside sales progression, not a marketer.",
  "Do not over-explain basic estate agency to estate agents.",
  "Natural, occasional humour where it fits. Never forced.",
  "Not every post is a list. Not every post ends with a question or a CTA. Not every post mentions the product.",
  'Use "I" for Ellis\'s personal observations and "we" for the company. Never imply Ellis personally experienced something that is actually aggregated data.',
  "Never manufacture vulnerability, founder-struggle stories, quotes, or customer conversations.",
  "No em dashes. No exclamation marks in client-facing copy.",
].join("\n");

// Phrases and structures that read as AI-written. The composer is told to avoid
// them; the Phase 3 detector flags drafts that slip through.
export const BANNED_PHRASES: string[] = [
  "Here's the thing",
  "Let that sink in",
  "Game changer",
  "In today's fast-paced",
  "It's not X. It's Y",
  "I learned an important lesson today",
  "Nobody talks about this",
  "Unpopular opinion",
  "Read that again",
  "Agree?",
];

export const BANNED_STRUCTURES: string[] = [
  "Artificial cliff-hanger line breaks.",
  "One sentence per paragraph purely for drama.",
  "Unnecessary emojis or irrelevant hashtags.",
  "Forced three-item lists.",
  "Generic motivational conclusions.",
  "Forced rhetorical questions and manufactured controversy.",
];

// A compact block for the system prompt.
export function antiAiRulesBlock(): string {
  return [
    "AVOID these AI tells entirely (phrases):",
    BANNED_PHRASES.map((p) => `  - "${p}"`).join("\n"),
    "AVOID these structures:",
    BANNED_STRUCTURES.map((s) => `  - ${s}`).join("\n"),
  ].join("\n");
}
