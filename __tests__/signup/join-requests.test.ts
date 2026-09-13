/**
 * @jest-environment node
 *
 * Request-to-join signup flow (Fix 8). Covers the domain decision + the
 * approve/reject/create service logic. See docs/active/signup-request-to-join/SPEC.md.
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    verifiedDomain: { findMany: jest.fn() },
    agencyJoinRequest: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    user: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock("@/lib/services/notifications", () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/email", () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

import { resolveSignupDestination } from "@/lib/auth/signup-destination";
import { createJoinRequest, approveJoinRequest, rejectJoinRequest } from "@/lib/services/agency-join-requests";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SIGNUP_JOIN_REQUESTS_ENABLED = "true";
  p.$transaction.mockImplementation((cb: any) => cb(p));
});

describe("resolveSignupDestination", () => {
  it("returns new_agency when the feature is disabled", async () => {
    process.env.SIGNUP_JOIN_REQUESTS_ENABLED = "false";
    const d = await resolveSignupDestination("sam@hartwell.co.uk");
    expect(d.kind).toBe("new_agency");
    expect(p.verifiedDomain.findMany).not.toHaveBeenCalled();
  });

  it("returns join_request on exactly one verified-domain match", async () => {
    p.verifiedDomain.findMany.mockResolvedValue([{ agencyId: "A", agency: { name: "Hartwell & Partners" } }]);
    const d = await resolveSignupDestination("Sam@Hartwell.co.uk");
    expect(d).toEqual({ kind: "join_request", agencyId: "A", agencyName: "Hartwell & Partners" });
    // domain is lower-cased for the lookup
    expect(p.verifiedDomain.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { domain: "hartwell.co.uk", status: "verified" } }));
  });

  it("returns new_agency on no match (e.g. a gmail address)", async () => {
    p.verifiedDomain.findMany.mockResolvedValue([]);
    expect((await resolveSignupDestination("sam@gmail.com")).kind).toBe("new_agency");
  });

  it("returns new_agency when the domain is ambiguous (verified by >1 agency)", async () => {
    p.verifiedDomain.findMany.mockResolvedValue([
      { agencyId: "A", agency: { name: "A" } },
      { agencyId: "B", agency: { name: "B" } },
    ]);
    expect((await resolveSignupDestination("sam@shared.co.uk")).kind).toBe("new_agency");
  });
});

describe("createJoinRequest", () => {
  it("is idempotent — returns the existing pending request without creating another", async () => {
    p.agencyJoinRequest.findFirst.mockResolvedValue({ id: "existing" });
    const res = await createJoinRequest({ requesterUserId: "u1", requesterEmail: "s@x.com", requesterName: "Sam", agencyId: "A", requestedRole: "negotiator" });
    expect(res).toEqual({ id: "existing", created: false });
    expect(p.agencyJoinRequest.create).not.toHaveBeenCalled();
  });

  it("creates a pending request and notifies when none exists", async () => {
    p.agencyJoinRequest.findFirst.mockResolvedValue(null);
    p.agencyJoinRequest.create.mockResolvedValue({ id: "new1" });
    p.agencyJoinRequest.findUnique.mockResolvedValue({ id: "new1", agencyId: "A", requesterName: "Sam", requesterEmail: "s@x.com", requestedRole: "negotiator", agency: { name: "Acme" } });
    p.user.findMany.mockResolvedValue([{ id: "dir1", name: "Dee", email: "dee@acme.com" }]);
    const res = await createJoinRequest({ requesterUserId: "u1", requesterEmail: "s@x.com", requesterName: "Sam", agencyId: "A", requestedRole: "negotiator" });
    expect(res).toEqual({ id: "new1", created: true });
    expect(p.agencyJoinRequest.create).toHaveBeenCalled();
  });
});

describe("approveJoinRequest", () => {
  const base = { id: "r1", agencyId: "A", status: "pending", requesterUserId: "u1", requesterName: "Sam", requesterEmail: "s@x.com" };

  it("stamps agencyId + chosen role onto the requester and marks approved", async () => {
    p.agencyJoinRequest.findUnique.mockResolvedValue(base);
    p.user.findFirst.mockResolvedValue({ firmName: "Acme" });
    const res = await approveJoinRequest({ requestId: "r1", decidedByUserId: "dir1", agencyId: "A", role: "negotiator" });
    expect(res).toEqual({ ok: true });
    expect(p.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "u1" }, data: expect.objectContaining({ agencyId: "A", role: "negotiator" }) }));
    expect(p.agencyJoinRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "approved" }) }));
  });

  it("refuses a request that belongs to another agency", async () => {
    p.agencyJoinRequest.findUnique.mockResolvedValue({ ...base, agencyId: "OTHER" });
    const res = await approveJoinRequest({ requestId: "r1", decidedByUserId: "dir1", agencyId: "A", role: "negotiator" });
    expect(res).toEqual({ ok: false, error: expect.stringContaining("Not your agency") });
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("refuses an already-handled request", async () => {
    p.agencyJoinRequest.findUnique.mockResolvedValue({ ...base, status: "approved" });
    const res = await approveJoinRequest({ requestId: "r1", decidedByUserId: "dir1", agencyId: "A", role: "director" });
    expect(res.ok).toBe(false);
    expect(p.user.update).not.toHaveBeenCalled();
  });
});

describe("rejectJoinRequest", () => {
  it("marks rejected and does not touch the user's agency", async () => {
    p.agencyJoinRequest.findUnique.mockResolvedValue({ id: "r1", agencyId: "A", status: "pending", requesterUserId: "u1", requesterName: "Sam", requesterEmail: "s@x.com" });
    const res = await rejectJoinRequest({ requestId: "r1", decidedByUserId: "dir1", agencyId: "A" });
    expect(res).toEqual({ ok: true });
    expect(p.agencyJoinRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "rejected" }) }));
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("refuses another agency's request", async () => {
    p.agencyJoinRequest.findUnique.mockResolvedValue({ id: "r1", agencyId: "OTHER", status: "pending", requesterUserId: "u1", requesterName: "Sam", requesterEmail: "s@x.com" });
    const res = await rejectJoinRequest({ requestId: "r1", decidedByUserId: "dir1", agencyId: "A" });
    expect(res.ok).toBe(false);
  });
});
