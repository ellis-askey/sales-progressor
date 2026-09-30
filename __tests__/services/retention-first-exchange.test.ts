// Gating for the two exchange celebration emails:
//   maybeFireFirstExchangeEmail       — self-managed only, never internal staff
//   maybeFireFirstOutsourcedFreeEmail — outsourced first-free, agency agent,
//                                        never internal, deduped per agency
// prisma + the email sender are mocked; buildRetentionEmail runs for real (pure).

const prismaMock = {
  user: { findUnique: jest.fn() },
  propertyTransaction: { findFirst: jest.fn(), findUnique: jest.fn() },
  retentionEmailLog: { findFirst: jest.fn(), create: jest.fn(async () => ({ id: "log1" })) },
};
jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const sendAgentEmail = jest.fn(async (..._args: unknown[]) => ({}));
jest.mock("@/lib/email/agent-log", () => ({ sendAgentEmail: (...a: unknown[]) => sendAgentEmail(...a) }));
jest.mock("@/lib/supabase-storage", () => ({ getSignedUrl: jest.fn(async () => null) }));

import { maybeFireFirstExchangeEmail, maybeFireFirstOutsourcedFreeEmail } from "@/lib/services/retention";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret";
  process.env.NEXTAUTH_URL = "https://portal.example.com";
});

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.retentionEmailLog.findFirst.mockResolvedValue(null); // no prior send by default
});

const sentKeys = () => sendAgentEmail.mock.calls.map((c) => (c[0] as { meta?: { emailKey?: string } }).meta?.emailKey);

describe("maybeFireFirstOutsourcedFreeEmail", () => {
  const OUTSOURCED_FREE = {
    id: "tx1",
    propertyAddress: "7 East Flint, Hemel Hempstead, HP1 2LS",
    serviceType: "outsourced",
    firstOutsourcedFree: true,
    agencyId: "agency1",
    agentUser: { id: "agent1", email: "gemma@agency.co.uk", name: "Gemma Chapman", agencyId: "agency1", role: "director" },
  };

  it("sends first_outsourced_free to the agency agent when the file is a free first outsourced exchange", async () => {
    prismaMock.propertyTransaction.findUnique.mockResolvedValue(OUTSOURCED_FREE);
    await maybeFireFirstOutsourcedFreeEmail("tx1");
    expect(sendAgentEmail).toHaveBeenCalledTimes(1);
    expect(sentKeys()).toEqual(["first_outsourced_free"]);
    expect((sendAgentEmail.mock.calls[0][0] as { to: string }).to).toBe("gemma@agency.co.uk");
  });

  it("does NOT send when the confirmer/agent is internal staff", async () => {
    prismaMock.propertyTransaction.findUnique.mockResolvedValue({
      ...OUTSOURCED_FREE,
      agentUser: { ...OUTSOURCED_FREE.agentUser, role: "sales_progressor", email: "ellis@thesalesprogressor.co.uk" },
    });
    await maybeFireFirstOutsourcedFreeEmail("tx1");
    expect(sendAgentEmail).not.toHaveBeenCalled();
  });

  it("does NOT send when the file was not stamped firstOutsourcedFree (billed / not first)", async () => {
    prismaMock.propertyTransaction.findUnique.mockResolvedValue({ ...OUTSOURCED_FREE, firstOutsourcedFree: false });
    await maybeFireFirstOutsourcedFreeEmail("tx1");
    expect(sendAgentEmail).not.toHaveBeenCalled();
  });

  it("does NOT send for a self-managed file", async () => {
    prismaMock.propertyTransaction.findUnique.mockResolvedValue({ ...OUTSOURCED_FREE, serviceType: "self_managed" });
    await maybeFireFirstOutsourcedFreeEmail("tx1");
    expect(sendAgentEmail).not.toHaveBeenCalled();
  });

  it("does NOT send twice for the same agency (per-agency dedup)", async () => {
    prismaMock.propertyTransaction.findUnique.mockResolvedValue(OUTSOURCED_FREE);
    prismaMock.retentionEmailLog.findFirst.mockResolvedValue({ id: "existing" });
    await maybeFireFirstOutsourcedFreeEmail("tx1");
    expect(sendAgentEmail).not.toHaveBeenCalled();
    // dedup keyed on agency + emailKey
    expect(prismaMock.retentionEmailLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agencyId: "agency1", emailKey: "first_outsourced_free" } }),
    );
  });
});

describe("maybeFireFirstExchangeEmail (self-managed only)", () => {
  const DIRECTOR = { id: "agent1", email: "gemma@agency.co.uk", name: "Gemma Chapman", agencyId: "agency1", role: "director" };

  it("sends first_exchange for a self-managed file confirmed by an agency agent", async () => {
    prismaMock.user.findUnique.mockResolvedValue(DIRECTOR);
    prismaMock.propertyTransaction.findFirst.mockResolvedValue({ id: "tx1", propertyAddress: "12 Oak Ave", serviceType: "self_managed" });
    await maybeFireFirstExchangeEmail("agent1", "tx1");
    expect(sentKeys()).toEqual(["first_exchange"]);
  });

  it("does NOT send for an outsourced file", async () => {
    prismaMock.user.findUnique.mockResolvedValue(DIRECTOR);
    prismaMock.propertyTransaction.findFirst.mockResolvedValue({ id: "tx1", propertyAddress: "12 Oak Ave", serviceType: "outsourced" });
    await maybeFireFirstExchangeEmail("agent1", "tx1");
    expect(sendAgentEmail).not.toHaveBeenCalled();
  });

  it("does NOT send when the confirmer is internal staff", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...DIRECTOR, role: "sales_progressor", email: "ellis@thesalesprogressor.co.uk" });
    await maybeFireFirstExchangeEmail("ellis", "tx1");
    expect(sendAgentEmail).not.toHaveBeenCalled();
    // short-circuits before the transaction lookup
    expect(prismaMock.propertyTransaction.findFirst).not.toHaveBeenCalled();
  });
});
