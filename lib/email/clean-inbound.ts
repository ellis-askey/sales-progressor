// Cleans an ingested inbound email body down to just the new message, for the
// file Activity timeline. Two jobs, conservative on purpose (the full original is
// always kept alongside so nothing is lost and cleaning is reversible):
//
//   1. Cut the quoted history — everything from the first reply/forward marker
//      downward ("On … wrote:", an Outlook "From:/Sent:/To:" header block,
//      "-----Original Message-----", the long underscore divider, "Begin
//      forwarded message:", or ">"-quoted lines).
//   2. Cut a trailing legal/confidentiality footer ("IMPORTANT: … confidential")
//      and the standard "-- " signature delimiter.
//
// It deliberately KEEPS a normal sign-off ("Kind regards, Sara") — that reads as
// part of the message, not clutter. Signature contact-blocks without a "-- "
// delimiter may remain; tune later if needed. Body arrives as plain text (Graph
// is asked for text), so this is line-based, not HTML parsing.

const QUOTE_MARKERS: RegExp[] = [
  /^\s*On .+ wrote:\s*$/m, // "On 3 Sep 2026, at 11:01, Asim Haque wrote:"
  /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/im, // "-----Original Message-----"
  /^\s*_{10,}\s*$/m, // Outlook underscore divider between message and quote
  /^\s*Begin forwarded message:\s*$/im,
  /^\s*From:\s.+\r?\n(?:\s*Sent:\s.+\r?\n)?\s*To:\s/im, // Outlook "From:/Sent:/To:" header block
  /^\s*>{1,}\s?.*$/m, // ">" quoted line
];

const FOOTER_MARKER =
  /\n[ \t]*(IMPORTANT[:\-]|DISCLAIMER|CONFIDENTIALITY|Please consider the environment|This (?:e-?mail|message|email)(?: and any (?:attachments|files))? (?:is|are|may be) (?:confidential|intended|privileged)|The (?:contents|information) (?:of|in|contained in) this (?:e-?mail|message))/i;

// The standard RFC 3676 signature delimiter: a line that is exactly "-- ".
const SIG_DELIM = /\r?\n-- \r?\n/;

export function cleanIngestedEmail(raw: string | null | undefined): string {
  if (!raw) return "";
  let text = raw.replace(/\r\n/g, "\n");

  // 1. Cut at the earliest quote/forward marker.
  let cutAt = text.length;
  for (const re of QUOTE_MARKERS) {
    const m = re.exec(text);
    if (m && m.index < cutAt) cutAt = m.index;
  }
  text = text.slice(0, cutAt);

  // 2. Cut a legal/confidentiality footer and the "-- " signature delimiter.
  const footer = FOOTER_MARKER.exec(text);
  if (footer) text = text.slice(0, footer.index);
  const sig = SIG_DELIM.exec(text);
  if (sig) text = text.slice(0, sig.index);

  // 3. Tidy: collapse runs of blank lines, trim.
  return text.replace(/\n{3,}/g, "\n\n").trim();
}
