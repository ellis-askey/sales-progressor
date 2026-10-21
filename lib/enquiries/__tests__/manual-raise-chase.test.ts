/**
 * @jest-environment node
 */

// Manual raise chase (the drawer behind Chase on the escalated reminder).
// The contract under test: the manual path writes the SAME EnquiryRaiseChase
// ledger the autopilot reads (one honest count, cadence clock reset), sends to
// the buyer's solicitor with the per-agency CC, and surfaces the missing-email
// seam instead of attempting a send.

jest.mock("@/lib/prisma", () => ({
  prisma: {
    propertyTransaction: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    enquiryRaiseChase: { findFirst: jest.fn(), updateMany: jest.fn() },
  },
}));
jest.mock("@/lib/email", () => ({ sendChainEmail: jest.fn() }));
jest.mock("@/lib/services/solicitor-cc", () => ({ solicitorCcForAgency: jest.fn() }));
jest.mock("@/lib/email/agency-sender", () => ({
  resolveAgencySenderForTransaction: jest.fn().mockResolvedValue({ from: "A <a@x>", replyTo: "a@x" }),
}));
jest.mock("@/lib/email/agent-signature-for-file", () => ({
  resolveAgentSignatureForFile: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/lib/solicitor-confirm/token", () => ({ signSolicitorToken: () => "tok" }));
jest.mock("../chase", () => ({ baseUrl: () => "https://portal.test" }));
jest.mock("../chase-log", () => ({
  logChaseSend: jest.fn().mockResolvedValue(undefined),
  logEnquiryChaseComm: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { sendChainEmail } from "@/lib/email";
import { solicitorCcForAgency } from "@/lib/services/solicitor-cc";
import { loadManualRaiseChaseDraft, sendManualRaiseChase, markRaiseChased } from "../manual-raise-chase";

const db = prisma as unknown as Record<string, Record<string, jest.Mock>>;
const send = sendChainEmail as unknown as jest.Mock;
const cc = solicitorCcForAgency as unknown as jest.Mock;

const TX = {
  id: "tx1",
  propertyAddress: "2 The Courtyard, Rock Lane Farm",
  agencyId: "A",
  assignedUserId: "u1",
  agentUserId: null,
  activeBuyerRoundId: null,
  agency: { name: "Knights Residential", logoPath: null },
  purchaserSolicitorContact: { id: "s1", email: "sol@firm.co.uk", name: "Sam Smith", secondaryEmail: null },
  purchaserSolicitorFirm: { name: "Edwards Willoby & Loch Ltd" },
  vendorSolicitorFirm: { name: "Greene & Greene" },
  contacts: [{ name: "Kim Bowling", roleType: "purchaser", buyerRoundId: null }],
};

beforeEach(() => {
  jest.clearAllMocks();
  db.propertyTransaction.findUnique.mockResolvedValue(TX);
  db.user.findUnique.mockResolvedValue({ name: "Ellis Askey", agencyId: null, phone: null, directMobile: null });
  db.enquiryRaiseChase.findFirst.mockResolvedValue({ nudgeCount: 2, lastNudgedAt: new Date("2026-10-18T09:00:00Z") });
  db.enquiryRaiseChase.updateMany.mockResolvedValue({ count: 1 });
  cc.mockResolvedValue(["assistant@firm.co.uk"]);
  send.mockResolvedValue(undefined);
});

it("draft carries the solicitor recipient, the per-agency CC and the shared nudge history", async () => {
  const d = await loadManualRaiseChaseDraft("tx1");
  expect(d.ok).toBe(true);
  if (!d.ok) return;
  expect(d.recipientEmail).toBe("sol@firm.co.uk");
  expect(d.firmName).toBe("Edwards Willoby & Loch Ltd");
  expect(d.cc).toEqual(["assistant@firm.co.uk"]);
  expect(d.nudgeCount).toBe(2);
  expect(d.subject.length).toBeGreaterThan(0);
  expect(d.bodyText.length).toBeGreaterThan(0);
});

it("no solicitor email → the seam, never a send attempt", async () => {
  db.propertyTransaction.findUnique.mockResolvedValue({
    ...TX,
    purchaserSolicitorContact: { id: "s1", email: null, name: "Sam Smith", secondaryEmail: null },
  });
  const d = await loadManualRaiseChaseDraft("tx1");
  expect(d).toEqual({ ok: false, reason: "no_solicitor_email" });
  const res = await sendManualRaiseChase("tx1", {}, "u1");
  expect(res.ok).toBe(false);
  expect(send).not.toHaveBeenCalled();
});

it("send goes to the solicitor with CC and stamps the SHARED ledger (count + clock + target)", async () => {
  const res = await sendManualRaiseChase("tx1", { subject: "Edited subject", bodyText: "Edited body" }, "u1");
  expect(res.ok).toBe(true);
  const mail = send.mock.calls[0][0];
  expect(mail.to).toBe("sol@firm.co.uk");
  expect(mail.cc).toEqual(["assistant@firm.co.uk"]);
  expect(mail.subject).toBe("Edited subject");
  const stamp = db.enquiryRaiseChase.updateMany.mock.calls[0][0];
  expect(stamp.where).toEqual({ transactionId: "tx1", closedAt: null });
  expect(stamp.data.lastTarget).toBe("buyer_solicitor");
  expect(stamp.data.nudgeCount).toEqual({ increment: 1 });
  expect(stamp.data.lastNudgedAt).toBeInstanceOf(Date);
});

it("mark chased (no email) stamps the same ledger", async () => {
  await markRaiseChased("tx1");
  expect(send).not.toHaveBeenCalled();
  const stamp = db.enquiryRaiseChase.updateMany.mock.calls[0][0];
  expect(stamp.data.nudgeCount).toEqual({ increment: 1 });
  expect(stamp.data.lastTarget).toBe("buyer_solicitor");
});
