/**
 * @jest-environment node
 *
 * PATCH /api/solicitor-handlers/[id] — per-agency CC write (Fix 1).
 *
 * The route now writes the CALLER agency's OWN override (never the shared row),
 * so it can't affect another agency's CC — the cross-agency issue is closed by
 * construction. It refuses to override the solicitor's own gospel value, and
 * requires an agency user.
 */

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    solicitorContact: { findUnique: jest.fn() },
    solicitorContactAgencyOverride: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

import { PATCH } from "@/app/api/solicitor-handlers/[id]/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const mockSession = getServerSession as jest.Mock;
const p = prisma as any;
const HANDLER_ID = "handler_123";
const params = Promise.resolve({ id: HANDLER_ID });

function agencyUser(agencyId: string) {
  return { user: { id: `u_${agencyId}`, role: "negotiator", agencyId, email: `${agencyId}@example.com` } };
}
function req(body: unknown) {
  return { json: async () => body } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  p.solicitorContact.findUnique.mockResolvedValue({ id: HANDLER_ID, name: "Jane", phone: null, email: "jane@firm.com", secondaryEmail: null });
  p.solicitorContactAgencyOverride.upsert.mockResolvedValue({});
  p.solicitorContactAgencyOverride.findUnique.mockResolvedValue({ secondaryEmail: "assistant@firm.com" });
});

describe("PATCH /api/solicitor-handlers/[id] — per-agency override", () => {
  it("rejects unauthenticated callers", async () => {
    mockSession.mockResolvedValue(null);
    const res = await PATCH(req({ secondaryEmail: "a@b.com" }), { params });
    expect(res.status).toBe(401);
    expect(p.solicitorContactAgencyOverride.upsert).not.toHaveBeenCalled();
  });

  it("rejects a malformed email before touching anything", async () => {
    mockSession.mockResolvedValue(agencyUser("A"));
    const res = await PATCH(req({ secondaryEmail: "not-an-email" }), { params });
    expect(res.status).toBe(400);
    expect(p.solicitorContactAgencyOverride.upsert).not.toHaveBeenCalled();
  });

  it("404s when the handler doesn't exist", async () => {
    mockSession.mockResolvedValue(agencyUser("A"));
    p.solicitorContact.findUnique.mockResolvedValue(null);
    const res = await PATCH(req({ secondaryEmail: "a@b.com" }), { params });
    expect(res.status).toBe(404);
  });

  it("403s internal staff with no agency to attach the override to", async () => {
    mockSession.mockResolvedValue({ user: { id: "sp1", role: "admin", agencyId: null, email: "ops@tsp.com" } });
    const res = await PATCH(req({ secondaryEmail: "a@b.com" }), { params });
    expect(res.status).toBe(403);
    expect(p.solicitorContactAgencyOverride.upsert).not.toHaveBeenCalled();
  });

  it("writes the agency's own override and returns the effective CC", async () => {
    mockSession.mockResolvedValue(agencyUser("A"));
    const res = await PATCH(req({ secondaryEmail: "Assistant@firm.com" }), { params });
    expect(res.status).toBe(200);
    expect(p.solicitorContactAgencyOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agencyId_solicitorContactId: { agencyId: "A", solicitorContactId: HANDLER_ID } },
      }),
    );
    const body = await res.json();
    expect(body.secondaryEmail).toBe("assistant@firm.com");
  });

  it("409s when the solicitor's own value is gospel (agency cannot override)", async () => {
    mockSession.mockResolvedValue(agencyUser("A"));
    p.solicitorContact.findUnique.mockResolvedValue({ id: HANDLER_ID, name: "Jane", phone: null, email: "jane@firm.com", secondaryEmail: "sarah.pa@firm.com" });
    const res = await PATCH(req({ secondaryEmail: "agencyA@x.com" }), { params });
    expect(res.status).toBe(409);
    expect(p.solicitorContactAgencyOverride.upsert).not.toHaveBeenCalled();
  });
});
