// Cleans an ingested inbound email body down to just the new message, for the
// file Activity timeline. Conservative on purpose — the full original is always
// kept alongside (providerWebhookData.raw), so nothing is lost and cleaning is
// reversible. Body arrives as plain text (Graph is asked for text; IMAP prefers
// the text/plain part), so this is line-based, not HTML parsing.
//
// Jobs:
//   1. Remove inline junk in place — cid image tokens, Office alt-text — without
//      truncating the surrounding message.
//   2. Cut the quoted history and any social/brand signature block — everything
//      from the earliest marker downward.
//   2b. Cut at the SIGN-OFF ("Kind regards" / "Thanks" / "Regards" …) — the
//      universal boundary between the message and the signature. Everything below
//      (name, firm, social block, address, feedback prompt, legal footer) goes in
//      one move, which is far more robust than enumerating every footer variant.
//      The sender's name already shows in the timeline header, so losing it from
//      the body costs nothing. (Changed 2026-10-16 — we used to KEEP the sign-off;
//      the clutter below it outweighed the value of keeping it.)
//   3. Cut a trailing legal/confidentiality footer and the "-- " signature delim
//      (the fallback for emails that have no sign-off at all).
//
// Guarding against a false cut: the sign-off must be the WHOLE line (so a mid-
// sentence "thanks"/"regards" never matches); single-word sign-offs cut only when
// what follows reads like a signature, not continued conversation; we never cut to
// an empty message; and the full original is always kept (providerWebhookData.raw),
// so an over-cut is one "show original" click away.

// Cut markers — truncate the body from the earliest match downward.
const CUT_MARKERS: RegExp[] = [
  // "On 3 Sep 2026, at 11:01, Asim Haque <…> wrote:" and the dash-wrapped,
  // colon-less variant "---- On Fri, 11 Sep 2026 … wrote ----" (Zoho/Apple/Outlook).
  /^\s*-*\s*On .+\bwrote\b\s*:?\s*-*\s*$/im,
  /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/im, // "-----Original Message-----"
  /^\s*-{2,}\s*Forwarded message\s*-{2,}\s*$/im, // "----- Forwarded message -----"
  /^\s*_{10,}\s*$/m, // Outlook underscore divider between message and quote
  /^\s*Begin forwarded message:\s*$/im,
  /^\s*From:\s.+\r?\n(?:\s*Sent:\s.+\r?\n)?\s*To:\s/im, // Outlook "From:/Sent:/To:" header block
  /^\s*>{1,}\s?.*$/m, // ">" quoted line
  // Signature/social block: a line that starts with a brand/icon bracket token
  // (the clutter below a sign-off — "[icon] 01442…", "[facebook]<…>", etc.).
  /^\s*\[(?:icon|facebook|instagram|linkedin|twitter|googlemaps|youtube|tiktok|logo)\]/im,
];

// Inline tokens to strip in place (do NOT truncate — these appear mid-message).
const INLINE_JUNK: RegExp[] = [
  /\[cid:[^\]]*\]/gi, // inline-image content-id refs, incl. "…__inline__img__src"
  /\[image:[^\]]*\]/gi, // "[image: logo.png]" style alt tokens
  // Office-generated image alt-text, e.g.
  // "[A yellow circle … Description automatically generated with medium confidence]".
  /\[[^\]]*(?:Description automatically generated|with (?:low|medium|high) confidence)[^\]]*\]/gi,
];

const FOOTER_MARKER =
  /\n[ \t]*(IMPORTANT[:\-]|DISCLAIMER|CONFIDENTIALITY|Please consider the environment|This (?:e-?mail|message|email)(?: and any (?:attachments|files))? (?:is|are|may be) (?:confidential|intended|privileged)|The (?:contents|information) (?:of|in|contained in) this (?:e-?mail|message))/i;

// The standard RFC 3676 signature delimiter: a line that is exactly "-- ".
const SIG_DELIM = /\r?\n-- \r?\n/;

// ── Sign-off cut ─────────────────────────────────────────────────────────────
// Unambiguous sign-offs: never used mid-email, so cut on the first whole-line
// match that has real content above it.
const SIGNOFF_UNAMBIGUOUS = new Set([
  "kind regards", "kindest regards", "warm regards", "warmest regards",
  "best regards", "best wishes", "with best wishes", "with kind regards",
  "yours sincerely", "yours faithfully", "yours truly",
]);
// Guarded sign-offs: also crop up mid-sentence, so cut only when the tail below
// reads like a signature rather than the message continuing.
const SIGNOFF_GUARDED = new Set([
  "regards", "thanks", "thank you", "many thanks", "thanks again",
  "thanks so much", "thanks very much", "with thanks", "cheers", "best",
  "all the best", "speak soon", "talk soon", "ta",
]);

// Normalise a line for sign-off comparison: drop trailing punctuation + space,
// lowercase. "Kind regards," → "kind regards".
function signoffKey(line: string): string {
  return line.trim().replace(/[\s,.;:!–—-]+$/u, "").trim().toLowerCase();
}

// Strong signature markers — contact details, firm/legal boilerplate, marketing.
const SIG_MARKER =
  /(?:\bwww\.|https?:\/\/|[\w.+-]+@[\w-]+\.\w|\+?\d[\d ()\-]{7,}\d|authorised|regulated|\bSRA\b|unsubscribe|leave us feedback|consider the environment|solicitors regulation)/i;
// A line that opens a fresh conversational point (the message still going).
const CONVO_OPENER =
  /^(?:also|and|but|can |could |would |will |please\b|i |i'|we |we'|just |one more|sorry|let me know|do you|did you|have you|has |when |what |why |how |where |is |are |if |as |thanks for|further to|following|p\.?s\.?)/i;

// Does the text BELOW a candidate guarded sign-off look like a signature (safe to
// cut) rather than the message continuing?
function tailLooksLikeSignature(tail: string): boolean {
  const t = tail.trim();
  if (!t) return true;                  // sign-off at the very end → a closer; cut
  if (SIG_MARKER.test(t)) return true;  // phone / url / email / SRA / footer → sig
  for (const l of t.split("\n").map((x) => x.trim()).filter(Boolean)) {
    if (CONVO_OPENER.test(l)) return false;              // a fresh point → not a sig
    if (l.length > 50 && /[.?!]$/.test(l)) return false; // a long sentence → not
  }
  return true; // short name / firm / title lines → signature
}

// Char index to cut the body at the sign-off, or -1 for no safe cut.
function signoffCutIndex(text: string): number {
  const lines = text.split("\n");
  const offsets: number[] = [];
  let at = 0;
  for (const l of lines) { offsets.push(at); at += l.length + 1; }

  for (let i = 0; i < lines.length; i++) {
    const key = signoffKey(lines[i]);
    if (!key) continue;
    const unambiguous = SIGNOFF_UNAMBIGUOUS.has(key);
    if (!unambiguous && !SIGNOFF_GUARDED.has(key)) continue;
    // Need real content above, else cutting would empty the message.
    if (!text.slice(0, offsets[i]).trim()) continue;
    if (unambiguous) return offsets[i];
    if (tailLooksLikeSignature(lines.slice(i + 1).join("\n"))) return offsets[i];
    // else: a mid-email "Thanks" / "Regards" — keep scanning for the real one.
  }
  return -1;
}

export function cleanIngestedEmail(raw: string | null | undefined): string {
  if (!raw) return "";
  let text = raw.replace(/\r\n/g, "\n");

  // 1. Remove inline junk tokens in place (cid refs, alt-text) — leaves the
  //    surrounding words intact so the message isn't truncated at an image.
  for (const re of INLINE_JUNK) text = text.replace(re, "");

  // 2. Cut at the earliest quote/forward/signature-block marker.
  let cutAt = text.length;
  for (const re of CUT_MARKERS) {
    const m = re.exec(text);
    if (m && m.index < cutAt) cutAt = m.index;
  }
  text = text.slice(0, cutAt);

  // 2b. Cut at the sign-off (the message/signature boundary). Only when it leaves
  //     real content behind — never cut the body to nothing.
  const soIdx = signoffCutIndex(text);
  if (soIdx > 0 && text.slice(0, soIdx).trim()) {
    text = text.slice(0, soIdx);
  }

  // 3. Cut a legal/confidentiality footer and the "-- " signature delimiter.
  const footer = FOOTER_MARKER.exec(text);
  if (footer) text = text.slice(0, footer.index);
  const sig = SIG_DELIM.exec(text);
  if (sig) text = text.slice(0, sig.index);

  // 4. Tidy: collapse runs of blank lines and stray leftover spaces, trim.
  return text
    .replace(/[ \t]+\n/g, "\n") // trailing spaces left by removed inline tokens
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
