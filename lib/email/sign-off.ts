// One rule for sign-offs, shared by every chase send path: an email ends with
// exactly one sign-off — never two, never none.
//
// Backstory: our chase templates always prepended "Best regards," before the
// agent's signature. That's right for the built-in signature (it carries no
// sign-off of its own) and for a pasted signature that's just a name/contact
// block, but it double-ups for an agent whose pasted signature already opens
// with "Best regards," / "Kind regards," etc. The manual send paths had the
// opposite bug: they skipped our sign-off for any pasted signature, so a
// block-only signature went out with no sign-off at all.
//
// `signatureHasSignOff` settles it with one question, asked of the signature
// itself (no need to know which "mode" produced it): does it already open with
// a sign-off? If yes, we add nothing. If no, we add ours. An image-only
// signature counts as "already has one" — the sign-off, if any, lives in the
// image where we can't read it, so we don't risk stacking text above it.

// Recognised sign-off openers, normalised (lowercase, trailing punctuation
// stripped). Add to this list rather than special-casing a send path.
const SIGN_OFFS = new Set([
  "best regards",
  "kind regards",
  "kindest regards",
  "warm regards",
  "warmest regards",
  "regards",
  "best wishes",
  "warm wishes",
  "with best wishes",
  "many thanks",
  "thanks",
  "thanks so much",
  "thank you",
  "with thanks",
  "yours sincerely",
  "yours faithfully",
  "yours truly",
  "yours",
  "sincerely",
  "best",
  "all the best",
  "cheers",
  "warmly",
  "take care",
  "speak soon",
  "talk soon",
  "with gratitude",
  "respectfully",
]);

// Turn a snippet of signature HTML (or plain text) into its first visible line,
// with block tags treated as line breaks so "<p>Best regards,</p>…" reduces to
// "Best regards,".
function firstVisibleLine(sig: string): string {
  const text = sig
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'");
  return text
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.length > 0) ?? "";
}

/**
 * True when a signature already opens with a sign-off, so the app must NOT add
 * its own. Looks only at the first short line, so a block that leads with a name
 * or job title is never a false positive. An image-only / empty-text signature
 * is treated as already having one (its sign-off, if any, is inside the image).
 */
export function signatureHasSignOff(sig: string | null | undefined): boolean {
  if (!sig) return false;
  const first = firstVisibleLine(sig);
  if (!first) return true; // image-only or otherwise textless — don't stack ours on top
  if (first.length > 30) return false; // a real sign-off is a short phrase, not a block line
  const norm = first.toLowerCase().replace(/[,.!:;–—-]+$/g, "").trim();
  return SIGN_OFFS.has(norm);
}

/**
 * True when the app should prepend its own sign-off before `sig`. The inverse of
 * `signatureHasSignOff` for a present signature; when there's no signature at
 * all the caller still wants the sign-off (it heads the name/agency fallback).
 */
export function shouldAddSignOff(sig: string | null | undefined): boolean {
  return !signatureHasSignOff(sig);
}
