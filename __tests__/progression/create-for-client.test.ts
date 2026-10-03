/**
 * @jest-environment node
 *
 * Create-sale-for-client (Phase 5). Proves the security gates on the new
 * createTransactionAction branch: it is flag-gated, member-gated (any member of
 * the progression business, not only the owner), and the chosen agency must be
 * one of the actor's own clients. These throw before any file is created, so a
 * progression business can never create a file into an agency it has no client
 * relationship with.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/server", () => ({ after: (fn: () => void) => { void fn; } }));
jest.mock("@/lib/session", () => ({ requireSession: jest.fn() }));
jest.mock("@/lib/progression/flags", () => ({ progressionBusinessesEnabled: jest.fn() }));
jest.mock("@/lib/services/progression-clients", () => ({ resolveBusinessMember: jest.fn() }));
jest.mock("@/lib/agent-session", () => ({ hasAdminPowers: jest.fn(() => false) }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    progressionBusinessClient: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
    propertyTransaction: { findMany: jest.fn(async () => []) },
    contact: { createMany: jest.fn() },
  },
}));
jest.mock("@/lib/services/transactions", () => ({
  createTransaction: jest.fn(async () => ({ id: "tx_new", activeBuyerRoundId: null })),
  checkOutsourcedHandoverReadiness: jest.fn(() => ({ ready: true, missing: [] })),
  handoverReadinessMessage: jest.fn(() => "missing"),
}));
jest.mock("@/lib/services/handover-readiness", () => ({
  solicitorPairViolation: jest.fn(() => false),
  solicitorHandlerRequiredMessage: jest.fn(() => "handler required"),
}));

import { createTransactionAction } from "@/app/actions/transactions";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessMember } from "@/lib/services/progression-clients";
import { createTransaction } from "@/lib/services/transactions";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

const p = prisma as any;
const sarahSession = { user: { id: "u_sarah", role: "sales_progressor", agencyId: "", email: "sarah@x.co" } } as unknown as Session;

const baseInput = {
  propertyAddress: "1 Test Street, BS1 4PN",
  purchasePrice: null,
  tenure: null,
  purchaseType: null,
  notes: null,
  progressedBy: "progressor" as const,
  contacts: [],
  vendorSolicitorFirmId: null,
  vendorSolicitorContactId: null,
  purchaserSolicitorFirmId: null,
  purchaserSolicitorContactId: null,
  clientAgencyId: "ag_donna",
};

// The happy path runs the real post-create side effects (reminders + intro
// email) against a partial prisma mock; they are fire-and-forget and catch
// their own errors, so we just silence the expected error logging here.
beforeAll(() => { jest.spyOn(console, "error").mockImplementation(() => {}); });
afterAll(() => { (console.error as jest.Mock).mockRestore(); });

beforeEach(() => {
  jest.clearAllMocks();
  (requireSession as jest.Mock).mockResolvedValue(sarahSession);
  (progressionBusinessesEnabled as jest.Mock).mockReturnValue(true);
  (resolveBusinessMember as jest.Mock).mockResolvedValue({ businessId: "biz_sarah", userId: "u_sarah" });
  p.progressionBusinessClient.findUnique.mockResolvedValue({ id: "link_1" });
  p.user.findFirst.mockResolvedValue({ id: "u_donna" });
});

describe("createTransactionAction: create-for-client gates", () => {
  it("throws when the feature flag is off (no file created)", async () => {
    (progressionBusinessesEnabled as jest.Mock).mockReturnValue(false);
    await expect(createTransactionAction(baseInput)).rejects.toThrow(/not enabled/i);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("throws when the actor is not a progression-business member", async () => {
    (resolveBusinessMember as jest.Mock).mockResolvedValue(null);
    await expect(createTransactionAction(baseInput)).rejects.toThrow(/member/i);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("throws when the chosen agency is NOT one of the actor's clients", async () => {
    p.progressionBusinessClient.findUnique.mockResolvedValue(null);
    await expect(createTransactionAction(baseInput)).rejects.toThrow(/not one of your clients/i);
    expect(createTransaction).not.toHaveBeenCalled();
  });
});

describe("createTransactionAction: create-for-client ownership", () => {
  it("tags the file to the actor's business, the client agency, its director, and the actor", async () => {
    await createTransactionAction(baseInput);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: "ag_donna",              // owned by the client agency
        agentUserId: "u_donna",            // attributed to its director
        progressionBusinessId: "biz_sarah", // tagged to the actor's business (access boundary)
        assignedUserId: "u_sarah",         // assigned to the creating progressor
        progressedBy: "progressor",        // -> serviceType outsourced
      }),
    );
  });

  it("only checks the member's OWN business link (no cross-business lookup)", async () => {
    await createTransactionAction(baseInput);
    expect(p.progressionBusinessClient.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { progressionBusinessId_agencyId: { progressionBusinessId: "biz_sarah", agencyId: "ag_donna" } },
      }),
    );
  });
});
