/**
 * @jest-environment node
 *
 * Business sender adoption (Phase 3 PR3b). adoptVerifiedDomainAsBusinessSender is
 * the write that makes a verified business domain drive outbound sender
 * resolution: it fills BOTH senderEmail (updates@<domain>) and senderDomain, but
 * only when blank — never overrides. senderVerified itself is stamped separately
 * by the check-domains cron. Mirrors adoptVerifiedDomainAsAgencySender.
 */
jest.mock("@/lib/email/agent-log", () => ({ sendAgentEmail: jest.fn() }));
jest.mock("@/lib/emails/email-verification", () => ({ buildEmailVerification: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    progressionBusiness: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

import { adoptVerifiedDomainAsBusinessSender } from "@/lib/services/verified-emails";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

beforeEach(() => jest.clearAllMocks());

it("fills a blank sender with updates@<domain> AND the domain", async () => {
  p.progressionBusiness.findUnique.mockResolvedValue({ senderEmail: null, senderDomain: null });
  await adoptVerifiedDomainAsBusinessSender("biz1", "SarahProgression.co.uk");
  expect(p.progressionBusiness.update).toHaveBeenCalledWith({
    where: { id: "biz1" },
    data: { senderEmail: "updates@sarahprogression.co.uk", senderDomain: "sarahprogression.co.uk" },
  });
});

it("does NOT override an existing sender (idempotent)", async () => {
  p.progressionBusiness.findUnique.mockResolvedValue({ senderEmail: "hello@sarahprogression.co.uk", senderDomain: "sarahprogression.co.uk" });
  await adoptVerifiedDomainAsBusinessSender("biz1", "other.co.uk");
  expect(p.progressionBusiness.update).not.toHaveBeenCalled();
});

it("does nothing when the business doesn't exist", async () => {
  p.progressionBusiness.findUnique.mockResolvedValue(null);
  await adoptVerifiedDomainAsBusinessSender("missing", "x.co.uk");
  expect(p.progressionBusiness.update).not.toHaveBeenCalled();
});
