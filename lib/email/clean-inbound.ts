// Cleans an ingested inbound email body down to just the new message, for the
// file Activity timeline. Conservative on purpose — the full original is always
// kept alongside (providerWebhookData.raw), so nothing is lost and cleaning is
// reversible. Body arrives as plain text (Graph is asked for text; IMAP prefers
// the text/plain part), so this is line-based, not HTML parsing.
//
// Three jobs:
//   1. Remove inline junk in place — cid image tokens, Office alt-text — without
//      truncating the surrounding message.
//   2. Cut the quoted history and any social/brand signature block — everything
//      from the earliest marker downward.
//   3. Cut a trailing legal/confidentiality footer and the "-- " signature delim.
//
// It deliberately KEEPS a normal sign-off ("Kind regards, Sara") — that reads as
// part of the message. The signature CUT targets the icon/social token block that
// sits below a sign-off, so the human line stays and the clutter goes.

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
