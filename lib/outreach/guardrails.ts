// Hard, application-owned guardrails on AI-generated challenger copy (Build Order
// F). These are NOT model-controlled: any violation fails the cycle closed (no
// experiment persisted). The primary personalisation guarantee is that copy only
// interpolates allow-listed placeholders; this also catches inferred claims,
// banned voice, and the "outsource" lead.

import { ALLOWED_PERSONALISATION_FIELDS, findForbiddenInferredClaims } from "./segments";

export const REVIEW_OUTCOMES = ["sound", "needs_revision", "reject"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];
export function isValidReviewOutcome(v: unknown): v is ReviewOutcome {
  return typeof v === "string" && (REVIEW_OUTCOMES as readonly string[]).includes(v);
}

export type CopyViolation = { step: number; field: "subject" | "body"; kind: string; detail: string };

export type ChallengerStep = { stepIndex: number; subject: string; body: string; gapDays: number };

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function scanText(text: string, step: number, field: "subject" | "body"): CopyViolation[] {
  const out: CopyViolation[] = [];

  // 1. Only allow-listed personalisation placeholders.
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) {
    const token = m[1];
    if (!(ALLOWED_PERSONALISATION_FIELDS as ReadonlySet<string>).has(token)) {
      out.push({ step, field, kind: "disallowed_placeholder", detail: `{{${token}}} is not an allow-listed field` });
    }
  }

  // 2. No inferred/unsupported attribute claims.
  for (const claim of findForbiddenInferredClaims(text)) {
    out.push({ step, field, kind: "inferred_claim", detail: `forbidden attribute phrase: "${claim}"` });
  }

  // 3. Voice: no em dashes, no exclamation marks (Law 21 / client-facing rules).
  if (text.includes("—")) out.push({ step, field, kind: "em_dash", detail: "em dash not allowed" });
  if (text.includes("!")) out.push({ step, field, kind: "exclamation", detail: "exclamation mark not allowed in client-facing copy" });

  // 4. Do not lead with / use "outsource" as positioning.
  if (/\boutsourc/i.test(text)) out.push({ step, field, kind: "outsource_word", detail: '"outsource" must not be used as positioning' });

  return out;
}

// Validate a challenger's ordered steps. Returns every violation found; the
// orchestrator treats any non-empty result as a hard fail (cycle aborts).
export function validateChallengerCopy(steps: ChallengerStep[]): { ok: boolean; violations: CopyViolation[] } {
  const violations: CopyViolation[] = [];
  for (const s of steps) {
    violations.push(...scanText(s.subject ?? "", s.stepIndex, "subject"));
    violations.push(...scanText(s.body ?? "", s.stepIndex, "body"));
  }
  return { ok: violations.length === 0, violations };
}
