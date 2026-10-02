// Data-isolation boundary: TSP's own "see everything" (admin/superadmin = scope
// "all") must NEVER include an EXTERNAL progression business's files. External
// files are exactly progressionBusinessId != a TSP business; TSP's own files are
// null (or the seeded isTsp row). These assert the access-scope helpers carry the
// TSP-only exclusion so the two businesses can't contaminate each other.

// access-scope imports hasAdminPowers (→ session → next-auth), which jest can't
// parse. The helpers under test don't use it, so mock it away to load the module.
jest.mock("@/lib/agent-session", () => ({ hasAdminPowers: jest.fn(() => false) }));

import {
  canReadTransaction,
  scopeTransactionWhere,
  scopeOwnershipWhere,
  scopeChaseTaskWhere,
  scopeReminderLogWhere,
  TSP_ONLY_TX_WHERE,
  type AccessScope,
} from "@/lib/security/access-scope";

const ALL: AccessScope = { kind: "all" };

describe("TSP ↔ external-business isolation (admin 'all' scope)", () => {
  it("canReadTransaction: TSP admin cannot read an external-business file", () => {
    expect(
      canReadTransaction(ALL, { agencyId: "a1", assignedUserId: null, progressionBusinessId: "ext-biz-1" }),
    ).toBe(false);
  });

  it("canReadTransaction: TSP admin CAN read a TSP file (null business)", () => {
    expect(
      canReadTransaction(ALL, { agencyId: "a1", assignedUserId: null, progressionBusinessId: null }),
    ).toBe(true);
  });

  it("scopeTransactionWhere('all') carries the TSP-only exclusion + excludes demos", () => {
    const w = scopeTransactionWhere(ALL);
    expect(w).toMatchObject(TSP_ONLY_TX_WHERE);
    expect(w.isDemo).toBe(false);
  });

  it("scopeOwnershipWhere('all') carries the TSP-only exclusion", () => {
    const w = scopeOwnershipWhere(ALL, "tx1");
    expect(w).toMatchObject(TSP_ONLY_TX_WHERE);
    expect(w.id).toBe("tx1");
  });

  it("scopeChaseTaskWhere('all') nests the TSP-only exclusion on the transaction", () => {
    const w = scopeChaseTaskWhere(ALL, "task1");
    expect(w).toMatchObject({ id: "task1", transaction: TSP_ONLY_TX_WHERE });
  });

  it("scopeReminderLogWhere('all') nests the TSP-only exclusion on the transaction", () => {
    const w = scopeReminderLogWhere(ALL, "log1");
    expect(w).toMatchObject({ id: "log1", transaction: TSP_ONLY_TX_WHERE });
  });

  it("TSP_ONLY_TX_WHERE is AND-wrapped (spread-safe) and matches null OR isTsp", () => {
    const and = TSP_ONLY_TX_WHERE.AND;
    expect(Array.isArray(and)).toBe(true);
    const inner = (and as Array<{ OR?: unknown[] }>)[0];
    expect(inner.OR).toEqual([{ progressionBusinessId: null }, { progressionBusiness: { isTsp: true } }]);
  });

  it("non-admin scopes are unchanged (business + agency stay bounded, no TSP-only AND)", () => {
    const biz = scopeTransactionWhere({ kind: "business", businessId: "ext-biz-1" });
    expect(biz).toEqual({ progressionBusinessId: "ext-biz-1", isDemo: false });
    const agency = scopeTransactionWhere({ kind: "agency", agencyIds: ["a1"] });
    expect(agency).toEqual({ agencyId: { in: ["a1"] } });
  });
});
