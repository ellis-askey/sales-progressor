// Phase F2 — pull a phone number out of an email's signature so we can offer to
// add it to a contact that's missing one. Pure logic (no I/O), unit-tested.
//
// This is deliberately conservative: it only returns a number that validates as
// a real UK phone. The result is always shown to the agent as a suggestion to
// confirm — never written silently — so a stray match costs one dismissal, not a
// wrong number on a contact.

import { normalizePhone } from "@/lib/utils";

// Words that commonly label a phone number in a signature. A number sitting right
// after one of these is almost certainly the sender's, so it wins over a bare
// number found elsewhere.
const PHONE_LABEL = /(?:tel|telephone|phone|mob(?:ile)?|cell|call|direct|dd|dir|t|m|d)\s*[:.]?\s*$/i;

// A UK-phone-shaped run of characters: starts +44 / 0044 / 0, then digits with
// the usual spacing/bracket noise. Validated properly below — this just finds
// candidates.
const PHONE_TOKEN = /(?:\+44\s?|0044\s?|\(?0)[\d\s().-]{8,}\d/g;

// Reduce a candidate to bare digits in local 0-leading form, or null if it isn't
// a valid UK number (mirrors the validity gate inside normalizePhone).
function toLocalDigits(candidate: string): string | null {
  let digits = candidate.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+44")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("0044")) digits = "0" + digits.slice(4);
  if (!/^0[1-9]\d{8,9}$/.test(digits)) return null;
  return digits;
}

/**
 * Returns the sender's phone number from a signature in canonical form, or null.
 * Prefers a number that's labelled ("M: 07…", "Tel 020…"); otherwise takes the
 * last valid number in the text (signatures sit at the bottom). De-dupes so the
 * same number labelled and repeated doesn't confuse the pick.
 */
export function extractSignaturePhone(body: string): string | null {
  if (!body) return null;

  let labelled: string | null = null;
  const valid: string[] = [];

  for (const m of body.matchAll(PHONE_TOKEN)) {
    const raw = m[0];
    const local = toLocalDigits(raw);
    if (!local) continue;
    valid.push(local);

    // Is there a phone label immediately before this match on the same line?
    const start = m.index ?? 0;
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const before = body.slice(lineStart, start);
    if (labelled === null && PHONE_LABEL.test(before)) labelled = local;
  }

  const chosen = labelled ?? (valid.length ? valid[valid.length - 1]! : null);
  return chosen ? normalizePhone(chosen) : null;
}
