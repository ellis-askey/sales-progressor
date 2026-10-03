/**
 * @jest-environment node
 *
 * Client lifecycle actions (Phase 2, PR1): rename + remove a client agency.
 * Proves the security + safety gates:
 *  - both are flag-gated and owner-scoped (assertOwnerOfClient).
 *  - rename only works while the client is PENDING (director has no password);
 *    once the agency activates, its name is theirs and the action refuses.
 *  - remove is BLOCKED while the client still has active sales (never orphan
 *    live files); otherwise it ARCHIVES the ProgressionBusinessClient (sets
 *    removedAt) rather than deleting it, and reinstate clears removedAt.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/session", () => ({ requireSession: jest.fn() }));
jest.mock("@/lib/progression/flags", () => ({ progressionBusinessesEnabled: jest.fn() }));
jest.mock("@/lib/services/progression-clients", () => ({
  assertOwnerOfClient: jest.fn(),
  resolveBusinessOwner: jest.fn(),
  addClientAgency: jest.fn(),
}));
// updateBusinessIdentityAction resolves the owner via resolveBusinessOwner.
jest.mock("@/lib/emails/client-agent-invite", () => ({ sendClientAgentSetupEmail: jest.fn(), mintClientSetupLink: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: jest.fn() },
    agency: { update: jest.fn() },
    propertyTransaction: { count: jest.fn() },
    progressionBusinessClient: { update: jest.fn() },
    progressionBusiness: { update: jest.fn() },
  },
}));

import { renameClientAgencyAction, removeClientAgencyAction, reinstateClientAgencyAction, updateBusinessIdentityAction } from "@/app/actions/progression-clients";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { assertOwnerOfClient, resolveBusinessOwner } from "@/lib/services/progression-clients";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

const p = prisma as any;
const session = { user: { id: "u_owner", role: "sales_progressor" } } as unknown as Session;
const owner = { businessId: "biz1", userId: "u_owner" };

beforeAll(() => { jest.spyOn(console, "log").mockImplementation(() => {}); });
afterAll(() => { (console.log as jest.Mock).mockRestore(); });

beforeEach(() => {
  jest.clearAllMocks();
  (requireSession as jest.Mock).mockResolvedValue(session);
  (progressionBusinessesEnabled as jest.Mock).mockReturnValue(true);
  (assertOwnerOfClient as jest.Mock).mockResolvedValue(owner);
  (resolveBusinessOwner as jest.Mock).mockResolvedValue(owner);
});

describe("renameClientAgencyAction", () => {
  it("renames while the client is pending (director has no password)", async () => {
    p.user.findFirst.mockResolvedValue({ password: null });
    const res = await renameClientAgencyAction("ag1", "  New Name  ");
    expect(res.ok).toBe(true);
    expect(p.agency.update).toHaveBeenCalledWith({ where: { id: "ag1" }, data: { name: "New Name" } });
  });

  it("refuses once the agency has activated (director has a password)", async () => {
    p.user.findFirst.mockResolvedValue({ password: "hashed" });
    const res = await renameClientAgencyAction("ag1", "New Name");
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/manage their agency name/i) });
    expect(p.agency.update).not.toHaveBeenCalled();
  });

  it("rejects a non-owner / non-client (assertOwnerOfClient null)", async () => {
    (assertOwnerOfClient as jest.Mock).mockResolvedValue(null);
    const res = await renameClientAgencyAction("ag1", "New Name");
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/isn't one of your clients/i) });
    expect(p.agency.update).not.toHaveBeenCalled();
  });

  it("rejects an empty name", async () => {
    p.user.findFirst.mockResolvedValue({ password: null });
    const res = await renameClientAgencyAction("ag1", "   ");
    expect(res.ok).toBe(false);
    expect(p.agency.update).not.toHaveBeenCalled();
  });

  it("is flag-gated", async () => {
    (progressionBusinessesEnabled as jest.Mock).mockReturnValue(false);
    const res = await renameClientAgencyAction("ag1", "New Name");
    expect(res.ok).toBe(false);
  });
});

describe("removeClientAgencyAction", () => {
  it("archives (sets removedAt) when there are no active sales", async () => {
    p.propertyTransaction.count.mockResolvedValue(0);
    const res = await removeClientAgencyAction("ag1");
    expect(res.ok).toBe(true);
    expect(p.progressionBusinessClient.update).toHaveBeenCalledWith({
      where: { progressionBusinessId_agencyId: { progressionBusinessId: "biz1", agencyId: "ag1" } },
      data: { removedAt: expect.any(Date) },
    });
  });

  it("counts ONLY this business's active files for this agency", async () => {
    p.propertyTransaction.count.mockResolvedValue(0);
    await removeClientAgencyAction("ag1");
    expect(p.propertyTransaction.count).toHaveBeenCalledWith({
      where: { progressionBusinessId: "biz1", agencyId: "ag1", status: "active", isDemo: false },
    });
  });

  it("is BLOCKED when the client still has active sales (no archive)", async () => {
    p.propertyTransaction.count.mockResolvedValue(3);
    const res = await removeClientAgencyAction("ag1");
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/3 active sales/i) });
    expect(p.progressionBusinessClient.update).not.toHaveBeenCalled();
  });

  it("rejects a non-owner / non-client before counting anything", async () => {
    (assertOwnerOfClient as jest.Mock).mockResolvedValue(null);
    const res = await removeClientAgencyAction("ag1");
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/isn't one of your clients/i) });
    expect(p.propertyTransaction.count).not.toHaveBeenCalled();
    expect(p.progressionBusinessClient.update).not.toHaveBeenCalled();
  });

  it("is flag-gated", async () => {
    (progressionBusinessesEnabled as jest.Mock).mockReturnValue(false);
    const res = await removeClientAgencyAction("ag1");
    expect(res.ok).toBe(false);
    expect(p.progressionBusinessClient.update).not.toHaveBeenCalled();
  });
});

describe("reinstateClientAgencyAction", () => {
  it("clears removedAt (owner)", async () => {
    const res = await reinstateClientAgencyAction("ag1");
    expect(res.ok).toBe(true);
    expect(p.progressionBusinessClient.update).toHaveBeenCalledWith({
      where: { progressionBusinessId_agencyId: { progressionBusinessId: "biz1", agencyId: "ag1" } },
      data: { removedAt: null },
    });
  });

  it("rejects a non-owner / non-client", async () => {
    (assertOwnerOfClient as jest.Mock).mockResolvedValue(null);
    const res = await reinstateClientAgencyAction("ag1");
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/isn't one of your clients/i) });
    expect(p.progressionBusinessClient.update).not.toHaveBeenCalled();
  });

  it("is flag-gated", async () => {
    (progressionBusinessesEnabled as jest.Mock).mockReturnValue(false);
    const res = await reinstateClientAgencyAction("ag1");
    expect(res.ok).toBe(false);
    expect(p.progressionBusinessClient.update).not.toHaveBeenCalled();
  });
});

describe("updateBusinessIdentityAction", () => {
  it("saves the business name + short name (owner)", async () => {
    const res = await updateBusinessIdentityAction("  Hamptons Progression  ", "  Hamptons  ");
    expect(res.ok).toBe(true);
    expect(p.progressionBusiness.update).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: { name: "Hamptons Progression", shortName: "Hamptons" },
    });
  });

  it("clears the short name to null when blank", async () => {
    await updateBusinessIdentityAction("Hamptons Progression", "   ");
    expect(p.progressionBusiness.update).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: { name: "Hamptons Progression", shortName: null },
    });
  });

  it("rejects a non-owner (resolveBusinessOwner null)", async () => {
    (resolveBusinessOwner as jest.Mock).mockResolvedValue(null);
    const res = await updateBusinessIdentityAction("Hamptons", "");
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/owner/i) });
    expect(p.progressionBusiness.update).not.toHaveBeenCalled();
  });

  it("rejects an empty business name", async () => {
    const res = await updateBusinessIdentityAction("   ", "");
    expect(res.ok).toBe(false);
    expect(p.progressionBusiness.update).not.toHaveBeenCalled();
  });

  it("rejects a short name over 40 chars", async () => {
    const res = await updateBusinessIdentityAction("Hamptons Progression", "x".repeat(41));
    expect(res.ok).toBe(false);
    expect(p.progressionBusiness.update).not.toHaveBeenCalled();
  });

  it("is flag-gated", async () => {
    (progressionBusinessesEnabled as jest.Mock).mockReturnValue(false);
    const res = await updateBusinessIdentityAction("Hamptons", "");
    expect(res.ok).toBe(false);
    expect(p.progressionBusiness.update).not.toHaveBeenCalled();
  });
});
