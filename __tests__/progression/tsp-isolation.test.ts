// Data-isolation boundary: TSP's own "see everything" (admin/superadmin = scope
// "all") must NEVER include an EXTERNAL progression business's files. External
// files are exactly progressionBusinessId != a TSP business; TSP's own files are
// null (or the seeded isTsp row). These assert the access-scope helpers carry the
// TSP-only exclusion so the two businesses can't contaminate each other.

// access-scope imports hasAdminPowers (→ session → next-auth), which jest can't
// parse. The helpers under test don't use it, so mock it away to load the module.
jest.mock("@/lib/agent-session", () => ({ hasAdminPowers: jest.fn(() => false) }));

import {
  getAccessScope,
  canReadTransaction,
  scopeTransactionWhere,
  scopeOwnershipWhere,
  scopeChaseTaskWhere,
  scopeReminderLogWhere,
  TSP_ONLY_TX_WHERE,
  type AccessScope,
} from "@/lib/security/access-scope";
import type { Session } from "next-auth";

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

describe("external-business isolation (reverse + cross-business directions)", () => {
  const BIZ_A = { kind: "business", businessId: "ext-biz-A" } as const;

  it("canReadTransaction: an external business CAN read its OWN file", () => {
    expect(
      canReadTransaction(BIZ_A, { agencyId: "a1", assignedUserId: null, progressionBusinessId: "ext-biz-A" }),
    ).toBe(true);
  });

  it("canReadTransaction: an external business CANNOT read a TSP file (null business)", () => {
    expect(
      canReadTransaction(BIZ_A, { agencyId: "a1", assignedUserId: null, progressionBusinessId: null }),
    ).toBe(false);
  });

  it("canReadTransaction: an external business CANNOT read ANOTHER external business's file", () => {
    expect(
      canReadTransaction(BIZ_A, { agencyId: "a1", assignedUserId: null, progressionBusinessId: "ext-biz-B" }),
    ).toBe(false);
  });

  it("scopeOwnershipWhere('business') is keyed to the OWN business id only", () => {
    expect(scopeOwnershipWhere(BIZ_A, "tx1")).toEqual({ id: "tx1", progressionBusinessId: "ext-biz-A" });
  });
});

describe("Business member see-all vs see-own (getAccessScope)", () => {
  function session(user: Record<string, unknown>): Session {
    return {
      user: {
        id: "u1", role: "sales_progressor", agencyId: null,
        progressionBusinessId: null, progressionBusinessRole: null, canViewAllFiles: false,
        ...user,
      },
    } as unknown as Session;
  }

  it("owner → the whole business book", () => {
    const s = session({ id: "owner1", progressionBusinessId: "biz1", progressionBusinessRole: "owner", canViewAllFiles: false });
    expect(getAccessScope(s)).toEqual({ kind: "business", businessId: "biz1" });
  });

  it("team member on see-own → only their own assigned files", () => {
    const s = session({ id: "m1", progressionBusinessId: "biz1", progressionBusinessRole: "progressor", canViewAllFiles: false });
    expect(getAccessScope(s)).toEqual({ kind: "assigned", userId: "m1" });
  });

  it("team member granted see-all → the whole business book", () => {
    const s = session({ id: "m2", progressionBusinessId: "biz1", progressionBusinessRole: "progressor", canViewAllFiles: true });
    expect(getAccessScope(s)).toEqual({ kind: "business", businessId: "biz1" });
  });

  it("a TSP progressor (no business) → their own assigned files, unchanged", () => {
    const s = session({ id: "tsp1", progressionBusinessId: null, progressionBusinessRole: null });
    expect(getAccessScope(s)).toEqual({ kind: "assigned", userId: "tsp1" });
  });

  it("fail-closed: a member with an unknown role + false flag is see-own", () => {
    const s = session({ id: "m3", progressionBusinessId: "biz1", progressionBusinessRole: null, canViewAllFiles: false });
    expect(getAccessScope(s)).toEqual({ kind: "assigned", userId: "m3" });
  });
});
