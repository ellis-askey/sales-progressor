// Ring-fence (docs/active/progression-businesses/10-signup-team-billing-spec.md,
// Arc B1). A file progressed by an EXTERNAL progression business must NEVER be
// billed to the client's agency: maybeStampExchange stamps exchangedAt (it did
// exchange) but stops before billedAtExchange, so the agency accrual
// (lib/billing/accrual.ts, which keys on billedAtExchange) never picks it up.
// TSP files (progressionBusinessId = null) and TSP-row files bill as before.

const prismaMock = {
  propertyTransaction: {
    findUnique: jest.fn(),
    updateMany: jest.fn(async (..._a: unknown[]) => ({ count: 1 })),
    count: jest.fn(async (..._a: unknown[]) => 1),
  },
  progressionBusiness: { findFirst: jest.fn(async (..._a: unknown[]) => ({ id: "tsp-id", isTsp: true })) },
  agency: { findUnique: jest.fn(async (..._a: unknown[]) => ({ feeTier: "standard", firstOutsourcedFreeEligible: true })) },
};
jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { maybeStampExchange } from "@/lib/services/billing-trigger";

const base = {
  freeOnExchange: false,
  purchasePrice: 500000,
  isDemo: false,
  serviceType: "outsourced" as const,
  agencyId: "donna-agency",
};

/** Did any updateMany call stamp billedAtExchange (i.e. bill the agency)? */
function dataOf(c: unknown[]): Record<string, unknown> {
  return ((c[0] as { data?: Record<string, unknown> })?.data) ?? {};
}
function billedAgency(): boolean {
  return prismaMock.propertyTransaction.updateMany.mock.calls.some((c) => "billedAtExchange" in dataOf(c));
}
/** Did any updateMany call stamp exchangedAt (i.e. record the exchange)? */
function stampedExchange(): boolean {
  return prismaMock.propertyTransaction.updateMany.mock.calls.some((c) => "exchangedAt" in dataOf(c));
}
/** Did any updateMany call charge the business per-sale? It must NOT at exchange —
 *  TSP's £5 is billed at ADD (createTransaction), not here. */
function chargedBusinessAtExchange(): boolean {
  return prismaMock.propertyTransaction.updateMany.mock.calls.some((c) => "businessPerSaleChargedAt" in dataOf(c));
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.propertyTransaction.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.propertyTransaction.count.mockResolvedValue(1); // "not first outsourced" → bills normally
  prismaMock.progressionBusiness.findFirst.mockResolvedValue({ id: "tsp-id", isTsp: true });
  prismaMock.agency.findUnique.mockResolvedValue({ feeTier: "standard", firstOutsourcedFreeEligible: true });
});

describe("maybeStampExchange: external progression-business ring-fence (B1)", () => {
  it("records the exchange but charges NO ONE at exchange for an external-business file", async () => {
    // The agency is never billed for an external file; and the £5 to TSP is billed
    // when the sale is ADDED (createTransaction), never at exchange.
    prismaMock.propertyTransaction.findUnique.mockResolvedValue({ ...base, progressionBusinessId: "sarah-biz" });
    await maybeStampExchange("tx1", "VM19");
    expect(stampedExchange()).toBe(true);              // it did exchange
    expect(billedAgency()).toBe(false);                // agency never billed for external files
    expect(chargedBusinessAtExchange()).toBe(false);   // the £5 is at ADD, not here
  });

  it("bills normally for a TSP file (progressionBusinessId = null)", async () => {
    prismaMock.propertyTransaction.findUnique.mockResolvedValue({ ...base, progressionBusinessId: null });
    await maybeStampExchange("tx1", "VM19");
    expect(stampedExchange()).toBe(true);
    expect(billedAgency()).toBe(true);
  });

  it("bills normally for a file on the TSP progression-business row", async () => {
    prismaMock.propertyTransaction.findUnique.mockResolvedValue({ ...base, progressionBusinessId: "tsp-id" });
    await maybeStampExchange("tx1", "VM19");
    expect(stampedExchange()).toBe(true);
    expect(billedAgency()).toBe(true);
  });

  it("never queries the TSP row for a null file (common path pays no cost)", async () => {
    prismaMock.propertyTransaction.findUnique.mockResolvedValue({ ...base, progressionBusinessId: null });
    await maybeStampExchange("tx1", "VM19");
    expect(prismaMock.progressionBusiness.findFirst).not.toHaveBeenCalled();
  });
});
