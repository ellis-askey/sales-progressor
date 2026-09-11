// Pure helpers for pulling the real party out of a forwarded (or quoted) email.
//
// A forward's OUTER envelope is just the forwarder → you (often the agent, whom
// we don't index), so header-based file-matching finds nothing. The real party
// (the solicitor / client) sits INSIDE the body on the forwarded "From:/To:/Cc:"
// header lines. extractInnerEmails pulls those addresses so a forward can still
// be matched to the right file.

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// A forwarded/quoted header line: "From: …", "To: …", "Cc: …", "Sent by: …",
// allowing a leading ">" quote marker or whitespace.
const FWD_HEADER_LINE = /^[ \t>]*(?:From|To|Cc|Sent by)\s*:\s*(.+)$/gim;

export function extractInnerEmails(body: string | null | undefined): string[] {
  if (!body) return [];
  const out = new Set<string>();
  for (const line of body.matchAll(FWD_HEADER_LINE)) {
    for (const e of line[1].match(EMAIL_RE) ?? []) out.add(e.toLowerCase());
  }
  return [...out];
}

export function looksForwarded(input: { subject?: string | null; body?: string | null }): boolean {
  const s = (input.subject ?? "").toLowerCase().trimStart();
  if (s.startsWith("fw:") || s.startsWith("fwd:")) return true;
  return /begin forwarded message|-{3,}\s*forwarded message|^[ \t>]*from\s*:\s.*@/im.test(input.body ?? "");
}
