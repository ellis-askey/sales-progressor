/**
 * @jest-environment node
 *
 * Invite-to-move service (docs/active/invite-to-move/SPEC.md). Covers the safety
 * gate + the auto-move vs support-queue branch + the consent guard.
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    negotiatorInvitation: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
    propertyTransaction: { count: jest.fn() },
    agency: { findUnique: jest.fn(), update: jest.fn() },
    agencyMoveRequest: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock("@/lib/services/notifications", () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/email", () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

import { evaluateMoveSafety, acceptMoveInvite } from "@/lib/services/agency-moves";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const p = prisma as any;

const future = new Date(Date.now() + 7 * 24 * 3600 * 1000);
const past = new Date(Date.now() - 1000);

function invite(overrides: any = {}) {
  return {
    id: "inv1",
    agencyId: "TARGET",
    invitedByUserId: "dir1",
    negotiatorEmail: "sam@stray.co.uk",
    acceptedAt: null,
    cancelledAt: null,
    expiresAt: future,
    agency: { name: "Hartwell" },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  p.$transaction.mockImplementation((arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(p)));
  // inviter firmName lookup + default mover; individual tests override the mover.
  p.user.findUnique.mockResolvedValue({ firmName: "Hartwell" });
  // Prisma writes that the service .catch()es directly must resolve to a promise.
  p.negotiatorInvitation.update.mockResolvedValue(undefined);
  p.agencyMoveRequest.create.mockResolvedValue({ id: "mr1" });
});

describe("evaluateMoveSafety", () => {
  it("is safe only when the agency is solo AND has zero sales", async () => {
    p.propertyTransaction.count.mockResolvedValue(0);
    p.user.count.mockResolvedValue(0);
    expect((await evaluateMoveSafety("u1", "A")).safe).toBe(true);
  });
  it("is unsafe when there are sales", async () => {
    p.propertyTransaction.count.mockResolvedValue(3);
    p.user.count.mockResolvedValue(0);
    const s = await evaluateMoveSafety("u1", "A");
    expect(s.safe).toBe(false);
    expect(s.salesCount).toBe(3);
  });
  it("is unsafe when there are other staff", async () => {
    p.propertyTransaction.count.mockResolvedValue(0);
    p.user.count.mockResolvedValue(2);
    expect((await evaluateMoveSafety("u1", "A")).safe).toBe(false);
  });
});

describe("acceptMoveInvite — guards", () => {
  it("refuses when the signed-in email doesn't match the invite", async () => {
    p.negotiatorInvitation.findUnique.mockResolvedValue(invite());
    const res = await acceptMoveInvite({ token: "t", sessionUserId: "u1", sessionEmail: "someone@else.com" });
    expect(res).toEqual({ ok: false, error: expect.stringContaining("different email") });
    expect(p.user.update).not.toHaveBeenCalled();
  });
  it("refuses an expired invite", async () => {
    p.negotiatorInvitation.findUnique.mockResolvedValue(invite({ expiresAt: past }));
    const res = await acceptMoveInvite({ token: "t", sessionUserId: "u1", sessionEmail: "sam@stray.co.uk" });
    expect(res.ok).toBe(false);
  });
  it("refuses an already-used invite", async () => {
    p.negotiatorInvitation.findUnique.mockResolvedValue(invite({ acceptedAt: new Date() }));
    const res = await acceptMoveInvite({ token: "t", sessionUserId: "u1", sessionEmail: "sam@stray.co.uk" });
    expect(res.ok).toBe(false);
  });
});

describe("acceptMoveInvite — auto move (safe)", () => {
  it("moves the sole member, archives the empty shell, consumes the invite", async () => {
    p.negotiatorInvitation.findUnique.mockResolvedValue(invite());
    p.user.findUnique
      .mockResolvedValueOnce({ id: "u1", email: "sam@stray.co.uk", name: "Sam", agencyId: "STRAY" }) // the mover
      .mockResolvedValue({ firmName: "Hartwell" }); // inviter firmName
    p.propertyTransaction.count.mockResolvedValue(0);
    p.user.count.mockResolvedValue(0);

    const res = await acceptMoveInvite({ token: "t", sessionUserId: "u1", sessionEmail: "Sam@Stray.co.uk" });

    expect(res).toEqual({ ok: true, outcome: "moved", agencyName: "Hartwell" });
    expect(p.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "u1" }, data: expect.objectContaining({ agencyId: "TARGET", role: "negotiator" }) }));
    expect(p.agency.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "STRAY" }, data: expect.objectContaining({ archivedAt: expect.any(Date) }) }));
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("acceptMoveInvite — support path (unsafe)", () => {
  it("moves nothing, queues a move request, emails support", async () => {
    p.negotiatorInvitation.findUnique.mockResolvedValue(invite());
    p.user.findUnique
      .mockResolvedValueOnce({ id: "u1", email: "sam@stray.co.uk", name: "Sam", agencyId: "STRAY" })
      .mockResolvedValue({ firmName: "Hartwell" });
    p.propertyTransaction.count.mockResolvedValue(4); // real sales -> unsafe
    p.user.count.mockResolvedValue(0);
    p.agencyMoveRequest.findFirst.mockResolvedValue(null);
    p.agency.findUnique.mockResolvedValue({ name: "Stray Agency" });

    const res = await acceptMoveInvite({ token: "t", sessionUserId: "u1", sessionEmail: "sam@stray.co.uk" });

    expect(res).toEqual({ ok: true, outcome: "flagged", agencyName: "Hartwell" });
    expect(p.user.update).not.toHaveBeenCalled(); // nothing moved
    expect(p.agency.update).not.toHaveBeenCalled(); // shell not archived
    expect(p.agencyMoveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fromAgencyId: "STRAY", toAgencyId: "TARGET", salesCount: 4 }) }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "support@thesalesprogressor.co.uk" }));
  });
});

describe("acceptMoveInvite — plain join (no current agency)", () => {
  it("attaches the user without archiving anything", async () => {
    p.negotiatorInvitation.findUnique.mockResolvedValue(invite());
    p.user.findUnique
      .mockResolvedValueOnce({ id: "u1", email: "sam@stray.co.uk", name: "Sam", agencyId: null })
      .mockResolvedValue({ firmName: "Hartwell" });

    const res = await acceptMoveInvite({ token: "t", sessionUserId: "u1", sessionEmail: "sam@stray.co.uk" });

    expect(res).toEqual({ ok: true, outcome: "moved", agencyName: "Hartwell" });
    expect(p.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ agencyId: "TARGET" }) }));
    expect(p.agency.update).not.toHaveBeenCalled();
  });
});
