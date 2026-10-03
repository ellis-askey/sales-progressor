/**
 * @jest-environment node
 *
 * Client lifecycle actions (Phase 2, PR1): rename + remove a client agency.
 * Proves the security + safety gates:
 *  - both are flag-gated and owner-scoped (assertOwnerOfClient).
 *  - rename only works while the client is PENDING (director has no password);
 *    once the agency activates, its name is theirs and the action refuses.
 *  - remove is BLOCKED while the client still has active sales (never orphan
 *    live files); otherwise it unlinks the ProgressionBusinessClient row only.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/session", () => ({ requireSession: jest.fn() }));
jest.mock("@/lib/progression/flags", () => ({ progressionBusinessesEnabled: jest.fn() }));
jest.mock("@/lib/services/progression-clients", () => ({
  assertOwnerOfClient: jest.fn(),
  resolveBusinessOwner: jest.fn(),
  addClientAgency: jest.fn(),
}));
jest.mock("@/lib/emails/client-agent-invite", () => ({ sendClientAgentSetupEmail: jest.fn(), mintClientSetupLink: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: jest.fn() },
    agency: { update: jest.fn() },
    propertyTransaction: { count: jest.fn() },
    progressionBusinessClient: { delete: jest.fn() },
  },
}));

import { renameClientAgencyAction, removeClientAgencyAction } from "@/app/actions/progression-clients";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { assertOwnerOfClient } from "@/lib/services/progression-clients";
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
  it("removes (unlinks) when there are no active sales", async () => {
    p.propertyTransaction.count.mockResolvedValue(0);
    const res = await removeClientAgencyAction("ag1");
    expect(res.ok).toBe(true);
    expect(p.progressionBusinessClient.delete).toHaveBeenCalledWith({
      where: { progressionBusinessId_agencyId: { progressionBusinessId: "biz1", agencyId: "ag1" } },
    });
  });

  it("counts ONLY this business's active files for this agency", async () => {
    p.propertyTransaction.count.mockResolvedValue(0);
    await removeClientAgencyAction("ag1");
    expect(p.propertyTransaction.count).toHaveBeenCalledWith({
      where: { progressionBusinessId: "biz1", agencyId: "ag1", status: "active", isDemo: false },
    });
  });

  it("is BLOCKED when the client still has active sales (no unlink)", async () => {
    p.propertyTransaction.count.mockResolvedValue(3);
    const res = await removeClientAgencyAction("ag1");
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/3 active sales/i) });
    expect(p.progressionBusinessClient.delete).not.toHaveBeenCalled();
  });

  it("rejects a non-owner / non-client before counting anything", async () => {
    (assertOwnerOfClient as jest.Mock).mockResolvedValue(null);
    const res = await removeClientAgencyAction("ag1");
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/isn't one of your clients/i) });
    expect(p.propertyTransaction.count).not.toHaveBeenCalled();
    expect(p.progressionBusinessClient.delete).not.toHaveBeenCalled();
  });

  it("is flag-gated", async () => {
    (progressionBusinessesEnabled as jest.Mock).mockReturnValue(false);
    const res = await removeClientAgencyAction("ag1");
    expect(res.ok).toBe(false);
    expect(p.progressionBusinessClient.delete).not.toHaveBeenCalled();
  });
});
