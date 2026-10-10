/**
 * @jest-environment node
 *
 * Outsource intro email signatory (critique C). The welcome email must sign off
 * with the progressor the file is ASSIGNED to — the same name the client sees on
 * every later milestone update (portal.ts uses tx.assignedUser.name) — falling
 * back to the file creator when the file isn't assigned yet.
 */
jest.mock("@/lib/prisma", () => ({
  prisma: {
    propertyTransaction: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    verifiedDomain: { findFirst: jest.fn(async () => null) },
    userVerifiedEmail: { findFirst: jest.fn(async () => null) },
    contact: { updateMany: jest.fn(async () => ({ count: 1 })) },
  },
}));
jest.mock("@/lib/email/outboundQueue", () => ({ enqueueEmail: jest.fn(async () => {}) }));
jest.mock("@/lib/emails/working-hours", () => ({ deliverAtInsideWorkingWindow: () => new Date("2026-10-09T10:00:00Z") }));

import { sendOutsourceIntroForTransaction } from "@/lib/emails/send-outsource-intro";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/lib/email/outboundQueue";

const p = prisma as any;

function txWith(assignedUserName: string | null) {
  return {
    id: "tx1",
    propertyAddress: "1 Test Street",
    agencyId: "ag1",
    agency: { name: "Donna Agency" },
    progressionBusiness: null,
    serviceType: "outsourced",
    assignedUser: assignedUserName ? { name: assignedUserName } : null,
    contacts: [
      { id: "c1", name: "Jo Buyer", email: "jo@x.co", roleType: "purchaser", portalToken: "tok1", outsourceIntroSentAt: null, unsubscribedAt: null },
    ],
  };
}

beforeAll(() => { jest.spyOn(console, "error").mockImplementation(() => {}); });
afterAll(() => { (console.error as jest.Mock).mockRestore(); });

beforeEach(() => {
  jest.clearAllMocks();
  p.verifiedDomain.findFirst.mockResolvedValue(null);
  p.userVerifiedEmail.findFirst.mockResolvedValue(null);
  p.contact.updateMany.mockResolvedValue({ count: 1 });
  // The file's creator (passed as creatorUserId) — the fallback signatory.
  p.user.findUnique.mockResolvedValue({ id: "u_sarah", name: "Sarah Owner", email: "sarah@x.co" });
});

describe("outsource intro signatory", () => {
  it("signs off with the assigned progressor when the file has one", async () => {
    p.propertyTransaction.findUnique.mockResolvedValue(txWith("Tom Progressor"));
    await sendOutsourceIntroForTransaction("tx1", "u_sarah");
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    const payload = (enqueueEmail as jest.Mock).mock.calls[0][0].payload;
    expect(payload.from).toContain("Tom Progressor, Donna Agency"); // From line
    expect(payload.text).toContain("Tom Progressor");                // sign-off
    expect(payload.text).not.toContain("Sarah Owner");               // not the creator
  });

  it("falls back to the creator when the file is unassigned", async () => {
    p.propertyTransaction.findUnique.mockResolvedValue(txWith(null));
    await sendOutsourceIntroForTransaction("tx1", "u_sarah");
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    const payload = (enqueueEmail as jest.Mock).mock.calls[0][0].payload;
    expect(payload.from).toContain("Sarah Owner, Donna Agency");
    expect(payload.text).toContain("Sarah Owner");
  });
});
