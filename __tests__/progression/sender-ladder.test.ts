// Client-facing sender ladder (docs/active/progression-sender-ladder/PLAN.md).
// Invariant under test: a progression company's own domain NEVER faces clients
// in From or Reply-To, and below the provisioned tiers Reply-To is the
// per-file capture alias, not the progressor's login email.

jest.mock("@/lib/prisma", () => ({
  prisma: {
    progressionBusinessClient: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    verifiedDomain: { findFirst: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/email/reply-capture", () => ({ resolveReplyCaptureAddress: jest.fn() }));

import { prisma } from "@/lib/prisma";
import { resolveReplyCaptureAddress } from "@/lib/email/reply-capture";
import { resolveOutsourcedClientSender, mintedLocalPart } from "@/lib/progression/sender";

const db = prisma as unknown as Record<string, Record<string, jest.Mock>>;
const capture = resolveReplyCaptureAddress as unknown as jest.Mock;

const INPUT = {
  transactionId: "tx1",
  agencyId: "A",
  progressionBusinessId: "B",
  agencyQuoteSenderEmail: null as string | null,
  agencyQuoteSenderVerified: false,
  assignedUser: { name: "Jo Saunders", email: "jo@keytocompletion.co.uk" },
};

beforeEach(() => {
  jest.clearAllMocks();
  db.progressionBusinessClient.findUnique.mockResolvedValue(null);
  db.progressionBusinessClient.findMany.mockResolvedValue([]);
  db.progressionBusinessClient.count.mockResolvedValue(1);
  db.verifiedDomain.findFirst.mockResolvedValue(null);
  db.user.findMany.mockResolvedValue([]);
  capture.mockResolvedValue("reply+abc123@reply.salesprogressorapp.co.uk");
});

describe("mintedLocalPart", () => {
  it("first name, lowercased and cleaned", () => {
    expect(mintedLocalPart("Jo Saunders", false)).toBe("jo");
    expect(mintedLocalPart("Anne-Marie O'Neill", false)).toBe("annemarie");
  });
  it("clash appends the surname initial", () => {
    expect(mintedLocalPart("Jo Saunders", true)).toBe("jo.s");
  });
  it("no usable name falls back safely", () => {
    expect(mintedLocalPart(null, false)).toBe("progression");
  });
});

describe("resolveOutsourcedClientSender", () => {
  it("tier 1: provisioned per-company sender is From AND Reply-To", async () => {
    db.progressionBusinessClient.findUnique.mockResolvedValue({
      senderEmail: "salesprogression@nakedagents.co.uk",
      senderVerified: true,
    });
    const r = await resolveOutsourcedClientSender(INPUT);
    expect(r.tier).toBe(1);
    expect(r.from).toBe("salesprogression@nakedagents.co.uk");
    expect(r.replyTo).toBe("salesprogression@nakedagents.co.uk");
    expect(r.visibleEmail).toBe("salesprogression@nakedagents.co.uk");
  });

  it("tier 2: agency sender used only when it is the single progressor's", async () => {
    db.progressionBusinessClient.count.mockResolvedValue(1);
    const r = await resolveOutsourcedClientSender({
      ...INPUT,
      agencyQuoteSenderEmail: "jo@fearnmalone.co.uk",
      agencyQuoteSenderVerified: true,
    });
    expect(r.tier).toBe(2);
    expect(r.from).toBe("jo@fearnmalone.co.uk");
    expect(r.replyTo).toBe("jo@fearnmalone.co.uk");
  });

  it("multi-progressor agency NEVER borrows the agency sender (the Annie rule)", async () => {
    db.progressionBusinessClient.count.mockResolvedValue(2);
    const r = await resolveOutsourcedClientSender({
      ...INPUT,
      agencyQuoteSenderEmail: "annie@knight-residential.co.uk",
      agencyQuoteSenderVerified: true,
    });
    expect(r.from).not.toContain("annie");
    expect(r.replyTo).not.toContain("annie");
  });

  it("tier 3: authenticated agency domain mints a per-company From; Reply-To is the capture alias", async () => {
    db.verifiedDomain.findFirst.mockResolvedValue({ domain: "knight-residential.co.uk" });
    const r = await resolveOutsourcedClientSender(INPUT);
    expect(r.tier).toBe(3);
    expect(r.from).toBe("jo.updates@knight-residential.co.uk");
    expect(r.replyTo).toBe("reply+abc123@reply.salesprogressorapp.co.uk");
    expect(r.visibleEmail).toBe("jo.updates@knight-residential.co.uk");
  });

  it("tier 3 clash: another company's member shares the first name → surname initial", async () => {
    db.verifiedDomain.findFirst.mockResolvedValue({ domain: "knight-residential.co.uk" });
    db.progressionBusinessClient.findMany.mockResolvedValue([
      { progressionBusinessId: "B" },
      { progressionBusinessId: "OTHER" },
    ]);
    db.user.findMany.mockResolvedValue([{ name: "Jo Bloggs" }]);
    const r = await resolveOutsourcedClientSender(INPUT);
    expect(r.from).toBe("jo.s.updates@knight-residential.co.uk");
  });

  it("tier 4: nothing verified → platform From, capture Reply-To — NEVER the login email", async () => {
    const r = await resolveOutsourcedClientSender(INPUT);
    expect(r.tier).toBe(4);
    expect(r.from).toBe("updates@thesalesprogressor.co.uk");
    expect(r.replyTo).toBe("reply+abc123@reply.salesprogressorapp.co.uk");
    expect(r.replyTo).not.toContain("keytocompletion");
    expect(r.visibleEmail).toBe("updates@thesalesprogressor.co.uk");
  });

  it("environment regression safety: capture domain unset → login email as last resort", async () => {
    capture.mockResolvedValue(null);
    const r = await resolveOutsourcedClientSender(INPUT);
    expect(r.replyTo).toBe("jo@keytocompletion.co.uk");
  });

  it("the business's own domain never enters the ladder at any tier", async () => {
    for (const domainRow of [null, { domain: "knight-residential.co.uk" }]) {
      db.verifiedDomain.findFirst.mockResolvedValue(domainRow);
      const r = await resolveOutsourcedClientSender(INPUT);
      expect(r.from).not.toContain("keytocompletion");
      expect(r.visibleEmail).not.toContain("keytocompletion");
    }
  });
});
