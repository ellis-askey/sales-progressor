/**
 * @jest-environment node
 *
 * Progression-business identity resolver (Phase 1). Proves the load-bearing
 * invariant: a null progressionBusinessId resolves to TSP, an explicit id
 * resolves to THAT business, and an unknown explicit id NEVER silently falls
 * back to TSP (which would leak an external file's identity).
 */
jest.mock("@/lib/prisma", () => ({
  prisma: {
    progressionBusiness: { findFirst: jest.fn(), findUnique: jest.fn() },
  },
}));

import {
  getProgressionBusinessForTransaction,
  getTspBusiness,
  isTspBusiness,
} from "@/lib/progression/business";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

const TSP = {
  id: "progression_business_tsp",
  name: "The Sales Progressor",
  isTsp: true,
  contactWhatsapp: "+447508862929",
  senderEmail: "ellis@thesalesprogressor.co.uk",
  senderDomain: "thesalesprogressor.co.uk",
};
const SARAH = {
  id: "biz_sarah",
  name: "Sarah Ltd",
  isTsp: false,
  contactWhatsapp: null,
  senderEmail: null,
  senderDomain: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  p.progressionBusiness.findFirst.mockResolvedValue(TSP);
  p.progressionBusiness.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.id === SARAH.id) return SARAH;
    if (where.id === TSP.id) return TSP;
    return null;
  });
});

describe("getProgressionBusinessForTransaction", () => {
  it("null progressionBusinessId resolves to the TSP business", async () => {
    const b = await getProgressionBusinessForTransaction({ progressionBusinessId: null });
    expect(b.id).toBe(TSP.id);
    expect(b.isTsp).toBe(true);
    // Null must NOT trigger a per-id lookup — it is TSP by definition.
    expect(p.progressionBusiness.findUnique).not.toHaveBeenCalled();
  });

  it("an explicit external id resolves to THAT business, never TSP", async () => {
    const b = await getProgressionBusinessForTransaction({ progressionBusinessId: SARAH.id });
    expect(b.id).toBe(SARAH.id);
    expect(b.isTsp).toBe(false);
  });

  it("an unknown explicit id throws rather than silently resolving to TSP", async () => {
    await expect(
      getProgressionBusinessForTransaction({ progressionBusinessId: "biz_ghost" }),
    ).rejects.toThrow(/unknown progressionBusinessId/);
  });
});

describe("getTspBusiness", () => {
  it("throws a clear seed error when no TSP row exists", async () => {
    p.progressionBusiness.findFirst.mockResolvedValue(null);
    await expect(getTspBusiness()).rejects.toThrow(/seed/i);
  });
});

describe("isTspBusiness", () => {
  it("treats null as TSP", async () => {
    expect(await isTspBusiness(null)).toBe(true);
    expect(await isTspBusiness(undefined)).toBe(true);
  });

  it("is true for the TSP row id and false for an external id", async () => {
    expect(await isTspBusiness(TSP.id)).toBe(true);
    expect(await isTspBusiness(SARAH.id)).toBe(false);
  });
});
