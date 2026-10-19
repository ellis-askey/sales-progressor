/**
 * @jest-environment node
 *
 * Retry age-out clock (2026-10-19 fix). The P3 dead-letter bound must run its
 * 24h "give up" clock from scheduledFor (when the row became due), NOT createdAt
 * (when it was enqueued).
 *
 * The bug it guards against: an out-of-hours send is deferred to the next
 * working morning by deliverAtInsideWorkingWindow — over a weekend that is ~58h
 * in the future. Under a createdAt-based cutoff the row is already "too old" the
 * instant it becomes due, so the first drain tick dead-letters it as
 * retry_age_exceeded WITHOUT a single send attempt. This silently dropped 16
 * client intro emails (Key To Completion) + 1 chase (Moves By Wright) in prod.
 *
 * The age-out predicate is identical in both drains
 * (lib/email/milestone-digest-drain.ts and lib/email/outboundQueue.ts); this
 * exercises it via the cleanly-mockable milestone drain.
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    outboundEmailQueue: { findMany: jest.fn(), updateMany: jest.fn() },
    contact: { findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  isContactEmailSuppressed: jest.fn().mockResolvedValue(false),
  isTransientSendError: jest.fn().mockReturnValue(false),
  MAX_SEND_RETRY_MS: 24 * 60 * 60 * 1000,
}));
jest.mock("@/lib/email/agency-sender", () => ({
  resolveAgencySenderForTransaction: jest.fn().mockResolvedValue({
    from: "agency@x.com", replyTo: "reply@x.com", logoUrl: null, tileColor: null, scale: null, align: null, theme: null,
  }),
}));
jest.mock("@/lib/email/logo-header", () => ({ agencyLogoHeaderHtml: jest.fn(() => "") }));
jest.mock("@/lib/services/portal", () => ({ logAutomatedEmail: jest.fn().mockResolvedValue(undefined) }));

import { drainMilestoneDigests } from "@/lib/email/milestone-digest-drain";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const p = prisma as any;
const mockSend = sendEmail as jest.Mock;
const HOUR = 60 * 60 * 1000;

function rowWith(createdAgoMs: number, scheduledAgoMs: number) {
  const now = Date.now();
  return {
    id: "q1",
    recipientContactId: "c1",
    recipientEmail: "client@x.com",
    sourceId: "t1:VM1",
    createdAt: new Date(now - createdAgoMs),
    scheduledFor: new Date(now - scheduledAgoMs),
    payload: { subject: "Step confirmed", text: "body", html: "<p>body</p>", milestoneCode: "VM1", recipientSide: "vendor", address: "1 High St", firstName: "Pat", portalUrl: "https://x/portal/u" },
  };
}

function wasDeadLettered(): boolean {
  return p.outboundEmailQueue.updateMany.mock.calls.some(
    ([arg]: any[]) => arg?.data?.errorMessage === "retry_age_exceeded"
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Win the atomic claim by default, so a fresh row reaches the send.
  p.outboundEmailQueue.updateMany.mockResolvedValue({ count: 1 });
  p.contact.findUnique.mockResolvedValue({
    roleType: "vendor",
    buyerRoundId: null,
    stepConfirmPausedAt: null,
    transaction: { activeBuyerRoundId: null, suppressPortalConfirmEmails: false },
  });
});

describe("drain retry age-out runs from scheduledFor, not createdAt", () => {
  it("normal row (created now, due now) sends and is not dead-lettered", async () => {
    p.outboundEmailQueue.findMany.mockResolvedValue([rowWith(0, 0)]);
    const res = await drainMilestoneDigests();
    expect(wasDeadLettered()).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(res.singleSends).toBe(1);
  });

  it("weekend-deferred row (created 58h ago, due now) SENDS (the regression guard)", async () => {
    // Under the old createdAt-based cutoff this row was 58h old → dead-lettered
    // on arrival with zero send attempts. It must now send.
    p.outboundEmailQueue.findMany.mockResolvedValue([rowWith(58 * HOUR, 0)]);
    const res = await drainMilestoneDigests();
    expect(wasDeadLettered()).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(res.singleSends).toBe(1);
  });

  it("genuinely stuck row (due 25h ago, past the window) is dead-lettered and not sent", async () => {
    p.outboundEmailQueue.findMany.mockResolvedValue([rowWith(26 * HOUR, 25 * HOUR)]);
    const res = await drainMilestoneDigests();
    expect(wasDeadLettered()).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
    expect(res.failed).toBe(1);
  });
});
