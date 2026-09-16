// Pure helper (no imapflow / server-only imports) so it's unit-testable in
// isolation. Locates the Sent mailbox for Sent-Items capture (Phase 2).

// The subset of an imapflow ListResponse this needs. ListResponse is structurally
// compatible (has path + optional specialUse).
export type MailboxInfo = { path: string; specialUse?: string | false };

// Prefers the RFC 6154 SPECIAL-USE `\Sent` flag (locale-independent). Only when
// that's absent does it fall back to a conservative leaf-name match, so we never
// grab an unrelated nested folder. Returns the mailbox path, or null.
const SENT_LEAF = /^(sent|sent items|sent mail)$/i;
export function findSentMailbox(boxes: MailboxInfo[]): string | null {
  const special = boxes.find((b) => b.specialUse === "\\Sent");
  if (special) return special.path;
  const named = boxes.find((b) => SENT_LEAF.test((b.path.split("/").pop() ?? b.path).trim()));
  return named ? named.path : null;
}
