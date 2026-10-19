/**
 * @jest-environment node
 *
 * resolveOutsourcedWhiteLabelSender — two progression companies at the same agency
 * must never share one sending identity. The agency's shared sender is used ONLY
 * when the agency has a single progressor; otherwise each company's own address
 * (per-link, or its own domain) is required.
 */
jest.mock("@/lib/prisma", () => ({
  prisma: {
    progressionBusinessClient: { findUnique: jest.fn(), count: jest.fn() },
  },
}));

import { resolveOutsourcedWhiteLabelSender } from "@/lib/progression/sender";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

const base = {
  agencyId: "ag1",
  progressionBusinessId: "pb1",
  agencyQuoteSenderEmail: "shared@agency.co.uk",
  agencyQuoteSenderVerified: true,
  business: { senderEmail: "own@biz.co.uk", senderVerified: false, isTsp: false },
};

beforeEach(() => {
  jest.clearAllMocks();
  p.progressionBusinessClient.findUnique.mockResolvedValue(null);
  p.progressionBusinessClient.count.mockResolvedValue(1);
});

describe("resolveOutsourcedWhiteLabelSender", () => {
  it("uses the per-(company, agency) sender when verified — even on a 2+-progressor agency", async () => {
    p.progressionBusinessClient.count.mockResolvedValue(2);
    p.progressionBusinessClient.findUnique.mockResolvedValue({ senderEmail: "jo@agency.co.uk", senderVerified: true });
    expect(await resolveOutsourcedWhiteLabelSender(base)).toBe("jo@agency.co.uk");
  });

  it("ignores an unverified per-link sender", async () => {
    p.progressionBusinessClient.findUnique.mockResolvedValue({ senderEmail: "jo@agency.co.uk", senderVerified: false });
    expect(await resolveOutsourcedWhiteLabelSender(base)).toBe("shared@agency.co.uk"); // single progressor → agency sender
  });

  it("uses the agency sender ONLY when there is a single progressor", async () => {
    p.progressionBusinessClient.count.mockResolvedValue(1);
    expect(await resolveOutsourcedWhiteLabelSender(base)).toBe("shared@agency.co.uk");
  });

  it("does NOT use the shared agency sender on a 2+-progressor agency (no merge)", async () => {
    p.progressionBusinessClient.count.mockResolvedValue(2);
    expect(await resolveOutsourcedWhiteLabelSender(base)).toBeNull();
  });

  it("uses the company's own verified sender when the agency sender can't be used", async () => {
    p.progressionBusinessClient.count.mockResolvedValue(2);
    const r = await resolveOutsourcedWhiteLabelSender({
      ...base,
      business: { senderEmail: "own@biz.co.uk", senderVerified: true, isTsp: false },
    });
    expect(r).toBe("own@biz.co.uk");
  });

  it("returns null when nothing is set up", async () => {
    p.progressionBusinessClient.count.mockResolvedValue(2);
    expect(await resolveOutsourcedWhiteLabelSender({ ...base, agencyQuoteSenderVerified: false })).toBeNull();
  });
});
