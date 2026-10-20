// Multi-tenant isolation guard for the Automated-emails surface.
//
// This resolver was the ONE agent-app surface that ignored the TSP wall: its
// admin/hybrid branch returned {} (every file platform-wide, incl. external
// progression businesses). Fixed 2026-10-20 to mirror the other internal
// surfaces (TSP's own outsourced book only). These tests lock that in.

// access-scope → agent-session pulls React cache / next-auth, unavailable under
// jest's node env; mock it like the other multi-tenant suites.
jest.mock("@/lib/agent-session", () => ({
  hasAdminPowers: jest.fn(() => false),
  hasSuperAdminPowers: jest.fn(() => false),
}));

import { buildTxWhere } from "@/lib/services/automated-emails-scope";
import { TSP_ONLY_TX_WHERE } from "@/lib/security/access-scope";

describe("automated-emails buildTxWhere: multi-tenant isolation", () => {
  it("admin / hybrid founder sees ONLY TSP's own outsourced book (external + self-managed walled off)", () => {
    const w = buildTxWhere({ role: "sales_progressor", userId: "ellis", agencyId: null, hasAdminPowers: true });
    // Outsourced (TSP's own progressed files), demo excluded, and the TSP-only
    // wall applied — so external progression businesses' files never appear.
    expect(w.serviceType).toBe("outsourced");
    expect(w.isDemo).toBe(false);
    expect(w.AND).toEqual(TSP_ONLY_TX_WHERE.AND);
    // CRUCIALLY: not an empty (unfiltered) where.
    expect(Object.keys(w).length).toBeGreaterThan(0);
  });

  it("a TSP internal progressor (no admin powers) sees only their assigned files", () => {
    const w = buildTxWhere({ role: "sales_progressor", userId: "prog1", agencyId: null });
    expect(w.assignedUserId).toBe("prog1");
    expect(w.AND).toBeUndefined();
  });

  it("a director sees only their own agency's self-managed files", () => {
    const w = buildTxWhere({ role: "director", userId: "d1", agencyId: "ag1" });
    expect(w.agencyId).toBe("ag1");
    expect(w.serviceType).toBe("self_managed");
  });

  it("a negotiator sees only their own self-managed files in their agency", () => {
    const w = buildTxWhere({ role: "negotiator", userId: "n1", agencyId: "ag1" });
    expect(w.agencyId).toBe("ag1");
    expect(w.agentUserId).toBe("n1");
    expect(w.serviceType).toBe("self_managed");
  });
});
