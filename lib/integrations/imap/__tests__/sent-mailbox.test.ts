/**
 * @jest-environment node
 */

import { findSentMailbox, type MailboxInfo } from "../sent-mailbox";

// Minimal ListResponse-shaped fixtures (only the fields findSentMailbox reads).
function box(path: string, specialUse?: string): MailboxInfo {
  return { path, specialUse };
}

describe("findSentMailbox", () => {
  it("prefers the RFC 6154 \\Sent SPECIAL-USE flag, ignoring the display name", () => {
    const boxes = [box("INBOX"), box("Verzonden", "\\Sent"), box("Prullenbak", "\\Trash")];
    expect(findSentMailbox(boxes)).toBe("Verzonden"); // localised name, still found by flag
  });

  it("falls back to a leaf-name match when no SPECIAL-USE is present", () => {
    expect(findSentMailbox([box("INBOX"), box("Sent Items")])).toBe("Sent Items");
    expect(findSentMailbox([box("INBOX"), box("Sent")])).toBe("Sent");
  });

  it("matches Gmail's [Gmail]/Sent Mail by its leaf", () => {
    expect(findSentMailbox([box("INBOX"), box("[Gmail]/Sent Mail")])).toBe("[Gmail]/Sent Mail");
  });

  it("prefers the SPECIAL-USE box even if a same-named folder also exists", () => {
    const boxes = [box("Sent", undefined), box("Real Sent", "\\Sent")];
    expect(findSentMailbox(boxes)).toBe("Real Sent");
  });

  it("does not grab unrelated folders (Drafts, Outbox, a property folder)", () => {
    const boxes = [box("INBOX"), box("Drafts", "\\Drafts"), box("Outbox"), box("8 Brambling Crescent")];
    expect(findSentMailbox(boxes)).toBeNull();
  });

  it("returns null when there is no sent folder at all", () => {
    expect(findSentMailbox([box("INBOX")])).toBeNull();
  });
});
