// Brand-memory taxonomy (docs/active/content-brand/SPEC.md, Phase 1.2). Shared
// by the read service, the Brand UI, and later the AI suggestion + voice-model
// phases, so the vocabulary lives in exactly one place. Pure data, server- and
// client-safe.

export type MemoryKindId =
  | "opinion"
  | "belief"
  | "anecdote"
  | "phrase_used"
  | "phrase_disliked"
  | "expertise"
  | "passion"
  | "position_change"
  | "frustration"
  | "humour"
  | "avoid_topic"
  | "successful_post"
  | "rejected_idea";

export const MEMORY_KINDS: Array<{ id: MemoryKindId; label: string; hint: string }> = [
  { id: "opinion", label: "Opinion", hint: "A view you've genuinely expressed." },
  { id: "belief", label: "Recurring belief", hint: "A theme you keep coming back to." },
  { id: "expertise", label: "Area of expertise", hint: "Something you can credibly speak on." },
  { id: "passion", label: "Genuine passion", hint: "A subject you actually care about." },
  { id: "frustration", label: "Recurring frustration", hint: "Something that genuinely annoys you." },
  { id: "anecdote", label: "Anecdote", hint: "A story you're happy to use publicly." },
  { id: "phrase_used", label: "Phrase you use", hint: "Words that sound like you." },
  { id: "phrase_disliked", label: "Phrase you dislike", hint: "Words to keep out of your posts." },
  { id: "humour", label: "Humour style", hint: "The kind of joke that lands as you." },
  { id: "position_change", label: "Changed your mind", hint: "A view you've since revised." },
  { id: "avoid_topic", label: "Won't discuss publicly", hint: "Off-limits. Never post about this." },
  { id: "successful_post", label: "Post that worked", hint: "A published post worth learning from." },
  { id: "rejected_idea", label: "Rejected idea", hint: "Something we decided against saying." },
];

export function memoryKindLabel(id: string): string {
  return MEMORY_KINDS.find((k) => k.id === id)?.label ?? id;
}

export type ClaimClassId = "verified_fact" | "ellis_opinion" | "inference" | "unverified";
export type ClaimTone = "good" | "info" | "watch" | "bad";

export const CLAIM_CLASSES: Array<{ id: ClaimClassId; label: string; tone: ClaimTone; hint: string }> = [
  { id: "verified_fact", label: "Verified fact", tone: "good", hint: "Backed by evidence we can point to." },
  { id: "ellis_opinion", label: "Your opinion", tone: "info", hint: "A view you hold, stated as yours." },
  { id: "inference", label: "Inference", tone: "watch", hint: "A reasonable read, not a proven fact." },
  { id: "unverified", label: "Unverified", tone: "bad", hint: "Not established, so never present as fact." },
];

export function claimClass(id: string): { label: string; tone: ClaimTone } {
  const c = CLAIM_CLASSES.find((x) => x.id === id);
  return c ? { label: c.label, tone: c.tone } : { label: id, tone: "info" };
}

export const MEMORY_STATUSES = ["approved", "suggested", "rejected"] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];
