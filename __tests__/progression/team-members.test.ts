/**
 * @jest-environment node
 *
 * Business team-member invite + remove (capstone #2). Owner-gated. Invite creates
 * a pending see-own progressor in the owner's business; remove deactivates them
 * (locks them out) AND unassigns their files so none are orphaned to a user who
 * can no longer log in. The owner can never be removed.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/session", () => ({ requireSession: jest.fn() }));
jest.mock("@/lib/progression/flags", () => ({ progressionBusinessesEnabled: jest.fn(), progressionBillingCollectEnabled: jest.fn() }));
jest.mock("@/lib/emails/teammate-invite", () => ({ sendTeammateSetupEmail: jest.fn() }));
jest.mock("@/lib/services/progression-clients", () => ({
  resolveBusinessOwner: jest.fn(), addClientAgency: jest.fn(), assertOwnerOfClient: jest.fn(),
}));
jest.mock("@/lib/emails/client-agent-invite", () => ({ sendClientAgentSetupEmail: jest.fn(), mintClientSetupLink: jest.fn() }));
jest.mock("@/lib/progression/client-fees", () => ({ parseFeeModel: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(async () => ({ id: "u_new" })), update: jest.fn() },
    progressionBusiness: { findUnique: jest.fn(async () => ({ name: "Biz" })) },
    propertyTransaction: { updateMany: jest.fn() },
    $transaction: jest.fn(async (arr: unknown[]) => arr),
  },
}));

import { inviteTeamMemberAction, removeTeamMemberAction } from "@/app/actions/progression-clients";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

const p = prisma as any;
const session = { user: { id: "u_owner", role: "sales_progressor" } } as unknown as Session;
const owner = { businessId: "biz1", userId: "u_owner" };

beforeAll(() => { jest.spyOn(console, "log").mockImplementation(() => {}); jest.spyOn(console, "error").mockImplementation(() => {}); });
afterAll(() => { (console.log as jest.Mock).mockRestore(); (console.error as jest.Mock).mockRestore(); });

beforeEach(() => {
  jest.clearAllMocks();
  (requireSession as jest.Mock).mockResolvedValue(session);
  (progressionBusinessesEnabled as jest.Mock).mockReturnValue(true);
  (resolveBusinessOwner as jest.Mock).mockResolvedValue(owner);
});

function fd(name?: string, email?: string): FormData {
  const f = new FormData();
  if (name != null) f.append("name", name);
  if (email != null) f.append("email", email);
  return f;
}

describe("inviteTeamMemberAction", () => {
  it("creates a pending see-own progressor in the owner's business", async () => {
    p.user.findUnique.mockResolvedValue(null);
    const res = await inviteTeamMemberAction(fd("Tom", "tom@x.co"));
    expect(res.ok).toBe(true);
    expect(p.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        role: "sales_progressor", agencyId: null, progressionBusinessId: "biz1",
        progressionBusinessRole: "progressor", canViewAllFiles: false, password: null,
      }),
    }));
  });

  it("rejects an email that already has an account", async () => {
    p.user.findUnique.mockResolvedValue({ id: "exists" });
    const res = await inviteTeamMemberAction(fd("Tom", "tom@x.co"));
    expect(res.ok).toBe(false);
    expect(p.user.create).not.toHaveBeenCalled();
  });

  it("rejects a non-owner", async () => {
    (resolveBusinessOwner as jest.Mock).mockResolvedValue(null);
    const res = await inviteTeamMemberAction(fd("Tom", "tom@x.co"));
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/owner/i) });
  });

  it("is flag-gated", async () => {
    (progressionBusinessesEnabled as jest.Mock).mockReturnValue(false);
    expect((await inviteTeamMemberAction(fd("Tom", "tom@x.co"))).ok).toBe(false);
  });
});

describe("removeTeamMemberAction", () => {
  it("deactivates the member AND unassigns their files", async () => {
    p.user.findUnique.mockResolvedValue({ progressionBusinessId: "biz1", progressionBusinessRole: "progressor" });
    const res = await removeTeamMemberAction("m1");
    expect(res.ok).toBe(true);
    expect(p.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "m1" },
      data: expect.objectContaining({ deactivatedAt: expect.any(Date), sessionVersion: { increment: 1 } }),
    }));
    expect(p.propertyTransaction.updateMany).toHaveBeenCalledWith({
      where: { progressionBusinessId: "biz1", assignedUserId: "m1" },
      data: { assignedUserId: null },
    });
  });

  it("refuses to remove the owner", async () => {
    p.user.findUnique.mockResolvedValue({ progressionBusinessId: "biz1", progressionBusinessRole: "owner" });
    const res = await removeTeamMemberAction("m1");
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/owner/i) });
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("refuses a member of another business", async () => {
    p.user.findUnique.mockResolvedValue({ progressionBusinessId: "other", progressionBusinessRole: "progressor" });
    expect((await removeTeamMemberAction("m1")).ok).toBe(false);
    expect(p.user.update).not.toHaveBeenCalled();
  });
});
