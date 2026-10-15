// "One progression route per agency" guard (lib/progression/outsourcing-mix).
// An agency's outsourced sales must be ALL TSP-managed OR ALL external, never a
// mix of both at once. Self-progress never counts; two DIFFERENT external
// companies together is not a mix.

const prismaMock = {
  propertyTransaction: { findMany: jest.fn() },
  agency: { findUnique: jest.fn(async () => ({ name: "Test Agency" })) },
};
jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
jest.mock("@/lib/email", () => ({ sendEmail: jest.fn(async () => {}) }));

import { wouldMixOutsourcing } from "@/lib/progression/outsourcing-mix";

// Row shapes as the guard selects them.
const external = (businessId: string) => ({ progressionBusinessId: businessId, progressionBusiness: { isTsp: false } });
const tspRow = () => ({ progressionBusinessId: "tsp-id", progressionBusiness: { isTsp: true } });
const tspNull = () => ({ progressionBusinessId: null, progressionBusiness: null });

beforeEach(() => jest.clearAllMocks());

describe("wouldMixOutsourcing", () => {
  it("no live outsourced sales → never a mix", async () => {
    prismaMock.propertyTransaction.findMany.mockResolvedValue([]);
    expect(await wouldMixOutsourcing("ag", "tsp")).toBe(false);
    expect(await wouldMixOutsourcing("ag", "external")).toBe(false);
  });

  it("an incoming external sale clashes with an existing TSP-managed sale (null tag)", async () => {
    prismaMock.propertyTransaction.findMany.mockResolvedValue([tspNull()]);
    expect(await wouldMixOutsourcing("ag", "external")).toBe(true);
  });

  it("an incoming external sale clashes with an existing TSP-row sale (isTsp)", async () => {
    prismaMock.propertyTransaction.findMany.mockResolvedValue([tspRow()]);
    expect(await wouldMixOutsourcing("ag", "external")).toBe(true);
  });

  it("an incoming TSP sale clashes with an existing external sale", async () => {
    prismaMock.propertyTransaction.findMany.mockResolvedValue([external("b1")]);
    expect(await wouldMixOutsourcing("ag", "tsp")).toBe(true);
  });

  it("an incoming external sale does NOT clash with existing external sales, even a different company", async () => {
    prismaMock.propertyTransaction.findMany.mockResolvedValue([external("b1"), external("b2")]);
    expect(await wouldMixOutsourcing("ag", "external")).toBe(false);
  });

  it("an incoming TSP sale does not clash with existing TSP-managed sales", async () => {
    prismaMock.propertyTransaction.findMany.mockResolvedValue([tspNull(), tspRow()]);
    expect(await wouldMixOutsourcing("ag", "tsp")).toBe(false);
  });
});
