/**
 * @jest-environment node
 *
 * Email send truthfulness (audit P1-5).
 *
 * Synchronous client emails previously used `sendEmail(...).catch(() => {})` and
 * then recorded a "sent" comms row regardless of outcome — so a SendGrid
 * rejection (or a malformed address) showed in the activity feed / "last
 * contacted" as a successful send. Every such site now gates its record on
 * trySendClientEmail, which returns true only when the send actually resolved.
 *
 * These tests prove the guarantee at the shared mechanism: a failed send never
 * reports success, and never throws out of the helper (so the caller's "record
 * only on true" branch is the single source of truth).
 */

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/command/events/write", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(),
  isNonDeliverableRecipient: jest.fn(() => false),
}));

import { trySendClientEmail } from "@/lib/services/portal";
import { sendEmail } from "@/lib/email";

const mockSend = sendEmail as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("trySendClientEmail — never reports a failed send as sent", () => {
  it("returns true when the send resolves", async () => {
    mockSend.mockResolvedValue(undefined);
    const ok = await trySendClientEmail({ to: "client@example.com", subject: "s", text: "t" } as any);
    expect(ok).toBe(true);
  });

  it("returns false (and does not throw) when SendGrid rejects", async () => {
    mockSend.mockRejectedValue(new Error("SendGrid 550 rejected"));
    const ok = await trySendClientEmail(
      { to: "bad@recipient", subject: "Contracts exchanged", text: "t" } as any,
      { transactionId: "tx1", subject: "Contracts exchanged" },
    );
    expect(ok).toBe(false);
  });

  it("returns false when the address is malformed and SendGrid throws", async () => {
    mockSend.mockRejectedValue(new Error("invalid to address"));
    const ok = await trySendClientEmail({ to: "not-an-email", subject: "s", text: "t" } as any);
    expect(ok).toBe(false);
  });
});
