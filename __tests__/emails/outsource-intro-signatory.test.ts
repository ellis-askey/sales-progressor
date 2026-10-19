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

// An external (non-TSP) progression business running the file.
const extBiz = {
  name: "Key To Completion", isTsp: false,
  senderEmail: null, senderDomain: null, senderVerified: false, contactWhatsapp: null,
  autoInviteOnAgentAdd: true, autoInviteOnOwnAdd: true,
};

describe("outsource intro FROM + Reply-To", () => {
  // The bug: a single-sender-verified agency (Agency.quoteSenderEmail/Verified)
  // with no full domain auth fell through to updates@thesalesprogressor.co.uk on
  // the welcome email, while every later milestone email correctly used the
  // agency's address. The welcome must honour the single-sender setup too.
  it("uses the agency's verified single-sender address for From AND Reply-To (external)", async () => {
    p.propertyTransaction.findUnique.mockResolvedValue({
      ...txWith("Tom Progressor"),
      agency: { name: "Donna Agency", quoteSenderEmail: "salesprogression@donna.co.uk", quoteSenderVerified: true },
      progressionBusiness: extBiz,
    });
    await sendOutsourceIntroForTransaction("tx1", "u_sarah");
    const payload = (enqueueEmail as jest.Mock).mock.calls[0][0].payload;
    expect(payload.from).toBe("Tom Progressor, Donna Agency <salesprogression@donna.co.uk>");
    expect(payload.replyTo).toBe("salesprogression@donna.co.uk");
  });

  it("falls back to the platform address for From when the agency sender is unverified", async () => {
    p.propertyTransaction.findUnique.mockResolvedValue({
      ...txWith("Tom Progressor"),
      agency: { name: "Donna Agency", quoteSenderEmail: "salesprogression@donna.co.uk", quoteSenderVerified: false },
      progressionBusiness: extBiz,
    });
    await sendOutsourceIntroForTransaction("tx1", "u_sarah");
    const payload = (enqueueEmail as jest.Mock).mock.calls[0][0].payload;
    expect(payload.from).toContain("<updates@thesalesprogressor.co.uk>");
  });

  it("Reply-To falls back to the assigned progressor's email on an external file, never updates@", async () => {
    p.propertyTransaction.findUnique.mockResolvedValue({
      ...txWith("Tom Progressor"),
      agency: { name: "Donna Agency", quoteSenderEmail: null, quoteSenderVerified: false },
      progressionBusiness: extBiz,
      assignedUser: { name: "Tom Progressor", email: "tom@keytocompletion.co.uk" },
    });
    await sendOutsourceIntroForTransaction("tx1", "u_sarah");
    const payload = (enqueueEmail as jest.Mock).mock.calls[0][0].payload;
    expect(payload.replyTo).toBe("tom@keytocompletion.co.uk");
    expect(payload.replyTo).not.toBe("updates@thesalesprogressor.co.uk");
  });

  it("TSP / legacy file (no external business) keeps the creator as Reply-To", async () => {
    p.propertyTransaction.findUnique.mockResolvedValue({
      ...txWith("Tom Progressor"), // progressionBusiness: null → not external
      agency: { name: "Donna Agency", quoteSenderEmail: "salesprogression@donna.co.uk", quoteSenderVerified: true },
    });
    // creator is Sarah Owner <sarah@x.co> (mocked in beforeEach)
    await sendOutsourceIntroForTransaction("tx1", "u_sarah");
    const payload = (enqueueEmail as jest.Mock).mock.calls[0][0].payload;
    expect(payload.replyTo).toBe("sarah@x.co");
  });
});
