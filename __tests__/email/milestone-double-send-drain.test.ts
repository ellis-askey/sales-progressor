/**
 * @jest-environment node
 *
 * Milestone digest double-send protection (audit P1-6, drain side).
 *
 * Both the 5-minute cron (drainMilestoneDigests) and the agent "Send now" button
 * (drainMilestoneDigestsForFile) select sentAt=null rows and send. Before the fix
 * there was no atomic claim, so two overlapping runs could both hand the same
 * group to SendGrid — a duplicate client email. The fix flips sentAt null→now in a
 * single conditional updateMany BEFORE sending; only the run whose claim matches
 * rows proceeds.
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

const dueRow = {
  id: "q1",
  recipientContactId: "c1",
  recipientEmail: "client@x.com",
  sourceId: "t1:VM1",
  payload: { subject: "Step confirmed", text: "body", html: "<p>body</p>", milestoneCode: "VM1", recipientSide: "vendor", address: "1 High St", firstName: "Pat", portalUrl: "https://x/portal/u" },
};

beforeEach(() => {
  jest.clearAllMocks();
  p.outboundEmailQueue.findMany.mockResolvedValue([dueRow]);
  // vendor recipient, not a dead round
  p.contact.findUnique.mockResolvedValue({ roleType: "vendor", buyerRoundId: null, transaction: { activeBuyerRoundId: null } });
});

describe("drainMilestoneDigests atomic claim", () => {
  it("sends when it WINS the claim (updateMany matches the row)", async () => {
    p.outboundEmailQueue.updateMany.mockResolvedValue({ count: 1 });
    const res = await drainMilestoneDigests();
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(res.singleSends).toBe(1);
  });

  it("does NOT send when it LOSES the claim (row already claimed by another run → count 0)", async () => {
    p.outboundEmailQueue.updateMany.mockResolvedValue({ count: 0 });
    const res = await drainMilestoneDigests();
    expect(mockSend).not.toHaveBeenCalled();
    expect(res.singleSends).toBe(0);
  });
});
