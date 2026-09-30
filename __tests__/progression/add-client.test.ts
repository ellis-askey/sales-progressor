/**
 * @jest-environment node
 *
 * Progression-business client management (Phase 4a). Proves adding a client
 * creates the agency + pending director + the link, grants NO transaction
 * access (creates no transaction, never touches progressionBusinessId on any
 * file), and that the action is flag- and owner-gated.
 */
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    progressionBusinessClient: { create: jest.fn() },
    propertyTransaction: { create: jest.fn(), groupBy: jest.fn() },
  },
}));
jest.mock("@/lib/auth/create-director-with-agency", () => ({
  createDirectorWithAgency: jest.fn(async () => ({ userId: "u_donna", agencyId: "ag_donna" })),
}));
jest.mock("@/lib/session", () => ({ requireSession: jest.fn() }));
jest.mock("@/lib/progression/flags", () => ({ progressionBusinessesEnabled: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { resolveBusinessOwner, addClientAgency } from "@/lib/services/progression-clients";
import { addClientAgencyAction } from "@/app/actions/progression-clients";
import { prisma } from "@/lib/prisma";
import { createDirectorWithAgency } from "@/lib/auth/create-director-with-agency";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import type { Session } from "next-auth";

const p = prisma as any;
const createAgency = createDirectorWithAgency as jest.Mock;

const sess = (id: string): Session => ({ user: { id } } as Session);
const fakeForm = (o: Record<string, string>): FormData =>
  ({ get: (k: string) => o[k] ?? null } as unknown as FormData);

beforeEach(() => jest.clearAllMocks());

describe("resolveBusinessOwner", () => {
  it("returns the business for an owner", async () => {
    p.user.findUnique.mockResolvedValue({ progressionBusinessId: "biz_sarah", progressionBusinessRole: "owner" });
    expect(await resolveBusinessOwner(sess("u_sarah"))).toEqual({ businessId: "biz_sarah", userId: "u_sarah" });
  });
  it("returns null for a non-owner member (progressor)", async () => {
    p.user.findUnique.mockResolvedValue({ progressionBusinessId: "biz_sarah", progressionBusinessRole: "progressor" });
    expect(await resolveBusinessOwner(sess("u_emp"))).toBeNull();
  });
  it("returns null for a non-member", async () => {
    p.user.findUnique.mockResolvedValue({ progressionBusinessId: null, progressionBusinessRole: null });
    expect(await resolveBusinessOwner(sess("u_agent"))).toBeNull();
  });
});

describe("addClientAgency", () => {
  const owner = { businessId: "biz_sarah", userId: "u_sarah" };

  it("creates the agency + pending director + link, and creates NO transaction", async () => {
    p.user.findUnique.mockResolvedValue(null); // email not taken
    const res = await addClientAgency({
      owner, agentName: "Donna Smith", agentEmail: "Donna@eXp.com", agencyName: "Donna Smith @ eXp",
    });
    expect(res).toEqual({ ok: true, agencyId: "ag_donna", userId: "u_donna" });
    // Reuses the canonical creator with role director and no password (pending).
    expect(createAgency).toHaveBeenCalledWith(
      expect.objectContaining({ role: "director", agencyName: "Donna Smith @ eXp", email: "donna@exp.com" }),
    );
    expect(createAgency).not.toHaveBeenCalledWith(expect.objectContaining({ password: expect.anything() }));
    // The link ties the business to the new agency.
    expect(p.progressionBusinessClient.create).toHaveBeenCalledWith({
      data: { progressionBusinessId: "biz_sarah", agencyId: "ag_donna" },
    });
    // Zero transaction access: adding a client never creates or tags a transaction.
    expect(p.propertyTransaction.create).not.toHaveBeenCalled();
  });

  it("rejects an email that already has an account and creates nothing", async () => {
    p.user.findUnique.mockResolvedValue({ id: "u_exists" });
    const res = await addClientAgency({
      owner, agentName: "Donna", agentEmail: "taken@exp.com", agencyName: "Donna @ eXp",
    });
    expect(res.ok).toBe(false);
    expect(createAgency).not.toHaveBeenCalled();
    expect(p.progressionBusinessClient.create).not.toHaveBeenCalled();
  });
});

describe("addClientAgencyAction gating", () => {
  const form = fakeForm({ agentName: "Donna", agentEmail: "donna@exp.com", agencyName: "Donna @ eXp" });

  it("is blocked when the feature flag is off (service never runs)", async () => {
    (progressionBusinessesEnabled as jest.Mock).mockReturnValue(false);
    const res = await addClientAgencyAction(form);
    expect(res.ok).toBe(false);
    expect(requireSession).not.toHaveBeenCalled();
    expect(createAgency).not.toHaveBeenCalled();
  });

  it("is blocked for a non-owner even with the flag on", async () => {
    (progressionBusinessesEnabled as jest.Mock).mockReturnValue(true);
    (requireSession as jest.Mock).mockResolvedValue(sess("u_agent"));
    p.user.findUnique.mockResolvedValue({ progressionBusinessId: null, progressionBusinessRole: null });
    const res = await addClientAgencyAction(form);
    expect(res).toEqual({ ok: false, error: expect.stringContaining("owner") });
    expect(createAgency).not.toHaveBeenCalled();
  });

  it("lets an owner add a client when enabled", async () => {
    (progressionBusinessesEnabled as jest.Mock).mockReturnValue(true);
    (requireSession as jest.Mock).mockResolvedValue(sess("u_sarah"));
    // First lookup: owner resolution. Second: email-taken check (null = free).
    p.user.findUnique
      .mockResolvedValueOnce({ progressionBusinessId: "biz_sarah", progressionBusinessRole: "owner" })
      .mockResolvedValueOnce(null);
    const res = await addClientAgencyAction(form);
    expect(res).toEqual({ ok: true });
    expect(p.progressionBusinessClient.create).toHaveBeenCalledWith({
      data: { progressionBusinessId: "biz_sarah", agencyId: "ag_donna" },
    });
  });
});
