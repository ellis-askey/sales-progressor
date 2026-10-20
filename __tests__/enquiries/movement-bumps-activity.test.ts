/**
 * @jest-environment node
 *
 * Enquiry movements count on the file's activity clock (audit full-audit-2026-10,
 * finding DATA-004; confirmed rule 2026-10-20: activity = a human did something
 * or the other side responded).
 *
 * The hub's quiet-files KPI, the health pill and the risk score read
 * PropertyTransaction.lastActivityAt. Logged enquiry movements (progressor
 * updates AND solicitor replies via /s/) previously never bumped it, so a file
 * being actively worked through enquiries could show as stalled/at-risk.
 */

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({
  prisma: {
    enquiryTracker: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    enquiryMovement: { create: jest.fn().mockResolvedValue({}) },
    propertyTransaction: { update: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockResolvedValue([]),
  },
}));

import { logEnquiryMovement } from "@/lib/enquiries/tracker";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("logEnquiryMovement — activity clock", () => {
  it("a logged movement bumps the file's lastActivityAt", async () => {
    p.enquiryTracker.findUnique.mockResolvedValue({ id: "tr1", closedAt: null, openedAt: new Date("2026-10-01T09:00:00Z") });
    const ok = await logEnquiryMovement({ transactionId: "t1", note: "Replies to 4 of 6 in" });
    expect(ok).toBe(true);
    expect(p.propertyTransaction.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { lastActivityAt: expect.any(Date) },
    });
  });

  it("a closed tracker logs nothing and bumps nothing", async () => {
    p.enquiryTracker.findUnique.mockResolvedValue({ id: "tr1", closedAt: new Date(), openedAt: new Date() });
    const ok = await logEnquiryMovement({ transactionId: "t1", note: "late note" });
    expect(ok).toBe(false);
    expect(p.propertyTransaction.update).not.toHaveBeenCalled();
  });
});
