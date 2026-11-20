/**
 * @jest-environment node
 *
 * Global Command Centre search endpoint — superadmin gating, bounded reads,
 * result shape, and the live-vs-archived file filter. Read-only (no mutations).
 */

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/agent-session", () => ({
  hasSuperAdminPowers: (s: { user?: { role?: string } }) => s?.user?.role === "superadmin",
}));
jest.mock("@/lib/command/prisma", () => ({
  commandDb: {
    agency: { findMany: jest.fn() },
    progressionBusiness: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    propertyTransaction: { findMany: jest.fn() },
  },
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/command/search/route";
import { getServerSession } from "next-auth";
import { commandDb } from "@/lib/command/prisma";

const gss = getServerSession as jest.Mock;
const db = commandDb as unknown as {
  agency: { findMany: jest.Mock };
  progressionBusiness: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
  propertyTransaction: { findMany: jest.Mock };
};

function req(qs: string) {
  return new NextRequest(`http://local/api/command/search${qs}`);
}
function superadmin() { gss.mockResolvedValue({ user: { id: "s1", role: "superadmin", email: "a@b.c" } }); }

beforeEach(() => {
  jest.clearAllMocks();
  db.agency.findMany.mockResolvedValue([]);
  db.progressionBusiness.findMany.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([]);
  db.propertyTransaction.findMany.mockResolvedValue([]);
});

describe("GET /api/command/search", () => {
  it("rejects a non-superadmin with 403 and runs no queries", async () => {
    gss.mockResolvedValue({ user: { id: "d1", role: "director", email: "d@a.com" } });
    const res = await GET(req("?q=ashford"));
    expect(res.status).toBe(403);
    expect(db.agency.findMany).not.toHaveBeenCalled();
  });

  it("returns empty + runs no queries for a query under 2 chars", async () => {
    superadmin();
    const res = await GET(req("?q=a"));
    const body = await res.json();
    expect(body).toEqual({ agencies: [], businesses: [], people: [], files: [] });
    expect(db.propertyTransaction.findMany).not.toHaveBeenCalled();
  });

  it("searches all four entities (bounded) and maps the result shape", async () => {
    superadmin();
    db.agency.findMany.mockResolvedValue([{ id: "ag1", name: "Ashford Homes", modeProfile: "self_progressed" }]);
    db.progressionBusiness.findMany.mockResolvedValue([{ id: "b1", name: "Ash Progression", shortName: null, stripeSubscriptionId: "sub_1" }]);
    db.user.findMany.mockResolvedValue([{ id: "u1", name: "Ash Smith", email: "ash@x.com", role: "director", agency: { name: "Ashford Homes" }, progressionBusiness: null }]);
    db.propertyTransaction.findMany.mockResolvedValue([{ id: "t1", propertyAddress: "12 Ash Lane", status: "active", agency: { name: "Ashford Homes" } }]);

    const res = await GET(req("?q=ash"));
    const body = await res.json();

    expect(body.agencies[0]).toEqual({ id: "ag1", name: "Ashford Homes", mode: "self_progressed" });
    expect(body.businesses[0]).toEqual({ id: "b1", name: "Ash Progression", shortName: null, subscribed: true });
    expect(body.people[0]).toEqual({ id: "u1", name: "Ash Smith", email: "ash@x.com", role: "director", org: "Ashford Homes" });
    expect(body.files[0]).toEqual({ id: "t1", address: "12 Ash Lane", status: "active", agencyName: "Ashford Homes" });
    // Bounded reads.
    for (const m of [db.agency, db.progressionBusiness, db.user, db.propertyTransaction]) {
      expect(m.findMany.mock.calls[0][0].take).toBe(6);
    }
  });

  it("defaults files to live statuses; adds completed+withdrawn when archived=1; never draft", async () => {
    superadmin();
    await GET(req("?q=lane"));
    const liveWhere = db.propertyTransaction.findMany.mock.calls[0][0].where;
    expect(liveWhere.status).toEqual({ in: ["active", "on_hold"] });
    expect(liveWhere.isDemo).toBe(false);

    jest.clearAllMocks();
    db.propertyTransaction.findMany.mockResolvedValue([]);
    superadmin();
    await GET(req("?q=lane&archived=1"));
    const archivedWhere = db.propertyTransaction.findMany.mock.calls[0][0].where;
    expect(archivedWhere.status).toEqual({ in: ["active", "on_hold", "completed", "withdrawn"] });
    expect(archivedWhere.status.in).not.toContain("draft"); // drafts are never surfaced
    expect(archivedWhere.isDemo).toBe(false);
  });

  it("never selects sensitive fields — subscription is a boolean, not the Stripe id", async () => {
    superadmin();
    db.progressionBusiness.findMany.mockResolvedValue([{ id: "b1", name: "B", shortName: null, stripeSubscriptionId: "sub_SECRET" }]);
    const res = await GET(req("?q=be"));
    const body = await res.json();
    // The raw Stripe subscription id must not leak; only a boolean is exposed.
    expect(JSON.stringify(body)).not.toContain("sub_SECRET");
    expect(body.businesses[0].subscribed).toBe(true);
    // The business select asks only for id/name/shortName/stripeSubscriptionId.
    const sel = db.progressionBusiness.findMany.mock.calls[0][0].select;
    expect(Object.keys(sel).sort()).toEqual(["id", "name", "shortName", "stripeSubscriptionId"]);
  });
});
