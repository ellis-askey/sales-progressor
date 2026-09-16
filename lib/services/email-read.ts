// Phase D1 — the AI "read" of one inbound email. Given a cleaned email and the
// file's OUTSTANDING milestones + onward/related chain steps, Claude Haiku
// suggests which (if any) this email shows has happened (so the agent can
// confirm it in one tap), plus an optional to-do. Suggest-only: nothing is ever
// auto-applied, and every suggestion is grounded — it must reference a milestone
// code or step id that we actually gave it, so it can't invent a step.
//
// The API call is a thin wrapper; the parsing + grounding is a pure function
// (parseEmailReadResult) so it can be unit-tested without the model.

import { callClaude } from "@/lib/anthropic";

export type EmailReadInput = {
  subject: string;
  body: string; // cleaned body (Phase A)
  outstandingMilestones: { code: string; name: string; side: "vendor" | "purchaser" }[];
  onwardSteps: { id: string; name: string }[];
  relatedSteps: { id: string; name: string }[];
};

export type EmailSuggestion =
  | { kind: "milestone"; code: string; label: string; reason: string }
  | { kind: "onward_step"; stepId: string; label: string; reason: string }
  | { kind: "related_step"; stepId: string; label: string; reason: string }
  | { kind: "todo"; title: string; when: string | null; reason: string };

export type EmailReadResult = { summary: string; suggestions: EmailSuggestion[] };

const EMPTY: EmailReadResult = { summary: "", suggestions: [] };

const SYSTEM = `You help a UK estate-agency sales progressor by reading ONE inbound email on a residential property sale and spotting what it means for the file. You NEVER take an action — you only suggest, and the agent decides.

You are given the email plus two things about this specific sale:
- OUTSTANDING STEPS: milestones on this sale that are not yet confirmed, each with a CODE.
- CHAIN STEPS: outstanding steps on the onward purchase and/or related sale in the chain, each with an ID.

From those, produce:
1. "summary": one plain sentence saying what the email is about.
2. "suggestions": zero or more of:
   - Confirm an OUTSTANDING STEP, when the email clearly shows that step has now happened. Use its exact CODE.
   - Confirm a CHAIN STEP, when the email (from a chain agent) shows that step happened on the onward/related property. Use its exact ID.
   - A to-do, for a concrete action the agent should take that isn't one of the steps above (chase, call, send, book) — only when the email calls for it.

Rules:
- ONLY suggest confirming a step that appears in the lists you were given, using its exact code/id. Never invent a code, id, or step that wasn't provided.
- Be conservative. Suggest a confirmation only when the email clearly indicates that specific thing happened. If unsure, leave it out.
- It is fine to return an empty suggestions list. A quiet email ("thanks", "noted", chit-chat) has no suggestions.
- Keep "label" short (what the agent will see) and "reason" one short sentence quoting/paraphrasing the part of the email that justifies it.

Return STRICT JSON only, no markdown, no other text:
{"summary":"...","suggestions":[{"kind":"milestone","code":"PM8","label":"Searches ordered","reason":"..."},{"kind":"onward_step","stepId":"...","label":"...","reason":"..."},{"kind":"related_step","stepId":"...","label":"...","reason":"..."},{"kind":"todo","title":"...","when":"today|tomorrow|monday|next_week|null","reason":"..."}]}`;

function buildUserMessage(input: EmailReadInput): string {
  const ms = input.outstandingMilestones.length
    ? input.outstandingMilestones.map((m) => `- ${m.code} (${m.side}): ${m.name}`).join("\n")
    : "(none)";
  const onward = input.onwardSteps.length
    ? input.onwardSteps.map((s) => `- ${s.id}: ${s.name}`).join("\n")
    : "(none)";
  const related = input.relatedSteps.length
    ? input.relatedSteps.map((s) => `- ${s.id}: ${s.name}`).join("\n")
    : "(none)";
  return [
    `Email subject: ${input.subject || "(no subject)"}`,
    "",
    "Email body:",
    input.body.slice(0, 1500),
    "",
    "OUTSTANDING STEPS on this sale:",
    ms,
    "",
    "CHAIN STEPS — onward purchase:",
    onward,
    "",
    "CHAIN STEPS — related sale:",
    related,
  ].join("\n");
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Pure: parse + ground the model's JSON against the input. Drops any suggestion
// that references a code/id we didn't provide (anti-hallucination). Never throws.
export function parseEmailReadResult(raw: string, input: EmailReadInput): EmailReadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    return EMPTY;
  }
  const obj = parsed as { summary?: unknown; suggestions?: unknown };
  const summary = str(obj?.summary, 300);
  const arr = Array.isArray(obj?.suggestions) ? obj.suggestions : [];

  const codes = new Set(input.outstandingMilestones.map((m) => m.code));
  const onwardIds = new Set(input.onwardSteps.map((s) => s.id));
  const relatedIds = new Set(input.relatedSteps.map((s) => s.id));

  const suggestions: EmailSuggestion[] = [];
  for (const s of arr) {
    const o = s as Record<string, unknown>;
    const kind = o?.kind;
    const reason = str(o?.reason, 300);
    if (kind === "milestone") {
      const code = str(o?.code, 20);
      if (code && codes.has(code)) suggestions.push({ kind, code, label: str(o?.label, 120), reason });
    } else if (kind === "onward_step") {
      const stepId = str(o?.stepId, 60);
      if (stepId && onwardIds.has(stepId)) suggestions.push({ kind, stepId, label: str(o?.label, 120), reason });
    } else if (kind === "related_step") {
      const stepId = str(o?.stepId, 60);
      if (stepId && relatedIds.has(stepId)) suggestions.push({ kind, stepId, label: str(o?.label, 120), reason });
    } else if (kind === "todo") {
      const title = str(o?.title, 120);
      if (title) suggestions.push({ kind, title, when: str(o?.when, 20) || null, reason });
    }
  }
  return { summary, suggestions };
}

// The API wrapper. Best-effort: returns EMPTY on any model/parse failure so a
// read never breaks ingestion.
export async function readEmailForSuggestions(input: EmailReadInput): Promise<EmailReadResult> {
  if (!input.body.trim()) return EMPTY;
  let raw: string;
  try {
    raw = await callClaude(SYSTEM, buildUserMessage(input), 400);
  } catch {
    return EMPTY;
  }
  return parseEmailReadResult(raw, input);
}
