/**
 * @jest-environment node
 *
 * Exchange-day emails: slot is claimed BEFORE sending (audit full-audit-2026-10,
 * finding AUTO-002).
 *
 * The old order sent to both solicitors and stamped the slot afterwards with no
 * guard. A stamp failure threw out of the run, left the slot unstamped, and the
 * 15-minute cron re-sent to both solicitors on every tick inside the 2h
 * staleness window. These tests lock the claim-before-send order and the
 * skip-on-failed-claim behaviour.
 */

jest.mock("server-only", () => ({}), { virtual: true });

const calls: string[] = [];

jest.mock("@/lib/prisma", () => ({
  prisma: {
    propertyTransaction: { findMany: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn().mockResolvedValue({ name: "Pat Progressor" }) },
    outboundMessage: { create: jest.fn().mockResolvedValue({}) },
  },
}));
jest.mock("@/lib/email", () => ({ sendEmail: jest.fn() }));
jest.mock("@/lib/services/solicitor-cc", () => ({ solicitorCcForAgency: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/contacts/displayName", () => ({ greetingFirstName: (n: string) => n }));
jest.mock("@/lib/email/agency-sender", () => ({
  resolveAgencySenderForTransaction: jest.fn().mockResolvedValue({ from: "a@x.com", replyTo: "r@x.com" }),
}));
jest.mock("@/lib/services/exchange-day", () => ({ isExchangeDayActive: jest.fn().mockReturnValue(true) }));
jest.mock("@/lib/exchange-day/emails", () => ({
  buildExchangeDaySolicitorEmail: jest.fn().mockReturnValue({ subject: "s", text: "t", html: "<p>t</p>" }),
}));

import { sendDueExchangeDayEmails } from "@/lib/exchange-day/send";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const p = prisma as any;
const mockSend = sendEmail as jest.Mock;

// Exchange day started 08:30 UK; "now" is 09:00 UK, so only the 08:45 morning
// slot is due. Two solicitors on the file.
const startedAt = new Date("2026-10-20T07:30:00Z");
const now = new Date("2026-10-20T08:00:00Z");

const fileFixture = {
  id: "t1",
  propertyAddress: "12 Oak Lane, Testville",
  completionDate: null,
  exchangedAt: null,
  exchangeDayStartedAt: startedAt,
  exchangeDayCancelledAt: null,
  exchangeDayMorningEmailAt: null,
  exchangeDayMiddayEmailAt: null,
  exchangeDayAfternoonEmailAt: null,
  agentUserId: null,
  assignedUserId: "u1",
  agencyId: "a1",
  agency: { name: "Test Agency" },
  assignedUser: { name: "Pat Progressor" },
  vendorSolicitorContact: { id: "c1", name: "Vera Vendor-Sol", email: "v@sols.com", secondaryEmail: null },
  purchaserSolicitorContact: { id: "c2", name: "Bob Buyer-Sol", email: "b@sols.com", secondaryEmail: null },
};

beforeEach(() => {
  jest.clearAllMocks();
  calls.length = 0;
  p.propertyTransaction.findMany.mockResolvedValue([fileFixture]);
  p.propertyTransaction.update.mockImplementation(async () => {
    calls.push("stamp");
    return {};
  });
  mockSend.mockImplementation(async () => {
    calls.push("send");
  });
});

describe("sendDueExchangeDayEmails — claim before send", () => {
  it("stamps the slot before any email leaves", async () => {
    const res = await sendDueExchangeDayEmails(now);
    expect(res).toEqual({ files: 1, emails: 2 });
    expect(calls[0]).toBe("stamp");
    expect(calls).toEqual(["stamp", "send", "send"]);
    expect(p.propertyTransaction.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { exchangeDayMorningEmailAt: now },
    });
  });

  it("a failed stamp means NO send and no throw — the next tick retries", async () => {
    p.propertyTransaction.update.mockRejectedValue(new Error("db down"));
    const res = await sendDueExchangeDayEmails(now);
    expect(mockSend).not.toHaveBeenCalled();
    expect(res).toEqual({ files: 0, emails: 0 });
  });

  it("a failed send never un-claims the slot (missed beats doubled)", async () => {
    mockSend.mockRejectedValue(new Error("sendgrid 500"));
    const res = await sendDueExchangeDayEmails(now);
    expect(p.propertyTransaction.update).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ files: 1, emails: 0 });
  });
});
