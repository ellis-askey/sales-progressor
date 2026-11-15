/**
 * @jest-environment node
 *
 * Unread-count logic (Phase 0). Proves unread = the OTHER party's messages
 * strictly after the viewer's read cursor; the viewer's own messages never
 * count; a null cursor means everything from the other party is unread.
 */

import { unreadCount } from "@/lib/services/messaging/unread";

const d = (iso: string) => new Date(iso);

const thread = [
  { createdAt: d("2026-11-14T09:00:00Z"), senderKind: "client" as const },
  { createdAt: d("2026-11-14T10:00:00Z"), senderKind: "staff" as const },
  { createdAt: d("2026-11-14T11:00:00Z"), senderKind: "client" as const },
];

describe("unreadCount", () => {
  it("null cursor: all of the other party's messages are unread", () => {
    expect(unreadCount(thread, "staff", null)).toBe(2); // two client messages
    expect(unreadCount(thread, "client", null)).toBe(1); // one staff message
  });

  it("counts only other-party messages strictly after the cursor", () => {
    expect(unreadCount(thread, "staff", d("2026-11-14T09:30:00Z"))).toBe(1); // 11:00 client only
    expect(unreadCount(thread, "staff", d("2026-11-14T11:00:00Z"))).toBe(0); // nothing strictly after
  });

  it("a viewer's own messages never count", () => {
    const allMine = [
      { createdAt: d("2026-11-14T12:00:00Z"), senderKind: "client" as const },
      { createdAt: d("2026-11-14T13:00:00Z"), senderKind: "client" as const },
    ];
    expect(unreadCount(allMine, "client", null)).toBe(0);
  });

  it("empty thread is zero unread", () => {
    expect(unreadCount([], "staff", null)).toBe(0);
  });
});
