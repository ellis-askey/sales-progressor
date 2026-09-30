/**
 * @jest-environment node
 *
 * Self-serve signup helper (Arc S4): creating a progression business makes the
 * signer the OWNER (sales_progressor, agencyId null, progressionBusinessRole
 * owner) bound to a fresh non-TSP business, on both the password and OAuth
 * paths, atomically.
 */
const txMock = {
  progressionBusiness: { create: jest.fn(async (..._a: unknown[]) => ({ id: "biz_new" })) },
  user: {
    create: jest.fn(async (..._a: unknown[]) => ({ id: "u_new" })),
    update: jest.fn(async (..._a: unknown[]) => ({ id: "u_existing" })),
  },
};
jest.mock("@/lib/prisma", () => ({
  prisma: { $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(txMock)) },
}));

import { createProgressionBusinessWithOwner } from "@/lib/auth/create-progression-business-with-owner";

beforeEach(() => jest.clearAllMocks());

describe("createProgressionBusinessWithOwner", () => {
  it("password path: creates a non-TSP business + owner user in one transaction", async () => {
    const res = await createProgressionBusinessWithOwner({
      name: "Sarah Owner",
      email: "Sarah@SarahProgression.co.uk",
      password: "hashed",
      businessName: "Sarah's Progression Co",
    });

    expect(res).toEqual({ userId: "u_new", businessId: "biz_new" });

    expect(txMock.progressionBusiness.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Sarah's Progression Co", isTsp: false } }),
    );

    const userData = (txMock.user.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(userData).toMatchObject({
      role: "sales_progressor",
      agencyId: null,
      progressionBusinessId: "biz_new",
      progressionBusinessRole: "owner",
      email: "sarah@sarahprogression.co.uk", // lowercased + trimmed
      password: "hashed",
    });
    expect(txMock.user.update).not.toHaveBeenCalled();
  });

  it("OAuth path: updates the existing user onto the new business, never creates one", async () => {
    const res = await createProgressionBusinessWithOwner({
      userId: "u_existing",
      name: "Sarah Owner",
      email: "sarah@sarahprogression.co.uk",
      businessName: "Sarah's Progression Co",
    });

    expect(res).toEqual({ userId: "u_existing", businessId: "biz_new" });

    expect(txMock.user.create).not.toHaveBeenCalled();
    expect(txMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u_existing" },
        data: expect.objectContaining({
          role: "sales_progressor",
          agencyId: null,
          progressionBusinessId: "biz_new",
          progressionBusinessRole: "owner",
        }),
      }),
    );
  });
});
