/**
 * @jest-environment node
 *
 * Progression-business access boundary (Phase 2a). Proves the primitive:
 *   1. getAccessScope derives the right scope per user type. A business OWNER (or a
 *      team member granted see-all) gets {kind:"business"}; a see-own member gets
 *      {kind:"assigned"}. agency/assigned roles unchanged.
 *   2. The scope->where helpers emit progressionBusinessId filters for a business
 *      scope; 'all' is scoped to TSP's own files (isolation); assigned/agency
 *      unchanged.
 *   3. canReadTransaction enforces the fixture isolation matrix - Sarah cannot
 *      read TSP files, another business's files, or a client's self-progressed
 *      files, and a TSP admin cannot read an external business's files, purely from
 *      the transaction tag (no UI involved).
 *
 * Fixture matrix mirrors docs/active/progression-businesses/00-spec.md.
 */
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import {
  getAccessScope,
  scopeTransactionWhere,
  scopeOwnershipWhere,
  scopeChaseTaskWhere,
  scopeReminderLogWhere,
  canReadTransaction,
  TSP_ONLY_TX_WHERE,
  type AccessScope,
} from "@/lib/security/access-scope";

const HYBRID_ADMIN_EMAIL = "ellis@thesalesprogressor.co.uk"; // lib/security/hybrid-emails.ts

function makeSession(u: {
  id?: string;
  email?: string;
  role: UserRole;
  agencyId?: string;
  progressionBusinessId?: string | null;
  progressionBusinessRole?: "owner" | "progressor" | null;
  canViewAllFiles?: boolean;
}): Session {
  return {
    user: {
      id: u.id ?? "u_1",
      name: "Test User",
      email: u.email ?? "user@example.com",
      role: u.role,
      agencyId: u.agencyId ?? "",
      firmName: null,
      needsSignupCompletion: false,
      progressionBusinessId: u.progressionBusinessId ?? null,
      progressionBusinessRole: u.progressionBusinessRole ?? null,
      canViewAllFiles: u.canViewAllFiles ?? false,
    },
  } as Session;
}

describe("getAccessScope - derivation per user type", () => {
  it("admin and superadmin get {kind:'all'} (platform operator)", () => {
    expect(getAccessScope(makeSession({ role: "admin" }))).toEqual({ kind: "all" });
    expect(getAccessScope(makeSession({ role: "superadmin" }))).toEqual({ kind: "all" });
  });

  it("a TSP progressor (sales_progressor, no business) gets {kind:'assigned'} - UNCHANGED", () => {
    const scope = getAccessScope(
      makeSession({ id: "u_tsp_prog", role: "sales_progressor", progressionBusinessId: null }),
    );
    expect(scope).toEqual({ kind: "assigned", userId: "u_tsp_prog" });
  });

  it("an external business OWNER gets the whole book {kind:'business'}", () => {
    const scope = getAccessScope(
      makeSession({ id: "u_sarah", role: "sales_progressor", progressionBusinessId: "biz_sarah", progressionBusinessRole: "owner" }),
    );
    expect(scope).toEqual({ kind: "business", businessId: "biz_sarah" });
  });

  it("an external business team member with see-all granted gets {kind:'business'}", () => {
    const scope = getAccessScope(
      makeSession({ id: "u_t", role: "sales_progressor", progressionBusinessId: "biz_sarah", progressionBusinessRole: "progressor", canViewAllFiles: true }),
    );
    expect(scope).toEqual({ kind: "business", businessId: "biz_sarah" });
  });

  it("an external business team member without see-all gets see-own {kind:'assigned'} (fail-closed)", () => {
    const scope = getAccessScope(
      makeSession({ id: "u_t", role: "sales_progressor", progressionBusinessId: "biz_sarah", progressionBusinessRole: "progressor", canViewAllFiles: false }),
    );
    expect(scope).toEqual({ kind: "assigned", userId: "u_t" });
  });

  it("director and negotiator get {kind:'agency'} - UNCHANGED", () => {
    expect(getAccessScope(makeSession({ role: "director", agencyId: "ag_donna" }))).toEqual({
      kind: "agency",
      agencyIds: ["ag_donna"],
    });
    expect(getAccessScope(makeSession({ role: "negotiator", agencyId: "ag_james" }))).toEqual({
      kind: "agency",
      agencyIds: ["ag_james"],
    });
  });

  it("platform operator ALWAYS wins: a hybrid-admin with a business id is still {kind:'all'}", () => {
    // Defensive ordering check - hasAdminPowers is evaluated before the business
    // branch, so a hybrid sales_progressor never gets narrowed to a business.
    const scope = getAccessScope(
      makeSession({
        role: "sales_progressor",
        email: HYBRID_ADMIN_EMAIL,
        progressionBusinessId: "biz_sarah",
      }),
    );
    expect(scope).toEqual({ kind: "all" });
  });
});

describe("scope -> where helpers", () => {
  const business: AccessScope = { kind: "business", businessId: "biz_sarah" };

  it("scopeTransactionWhere filters a business scope by progressionBusinessId (demo excluded)", () => {
    expect(scopeTransactionWhere(business)).toEqual({
      progressionBusinessId: "biz_sarah",
      isDemo: false,
    });
  });

  it("scopeTransactionWhere: 'all' is scoped to TSP's own files; assigned/agency unchanged", () => {
    // TSP admin ('all') is now bounded to TSP's own files (null progressionBusinessId
    // or the seeded TSP business) so external businesses' files never leak onto a TSP
    // list. assigned/agency are untouched.
    expect(scopeTransactionWhere({ kind: "all" })).toEqual({ isDemo: false, ...TSP_ONLY_TX_WHERE });
    expect(scopeTransactionWhere({ kind: "assigned", userId: "u_x" })).toEqual({
      assignedUserId: "u_x",
      isDemo: false,
    });
    expect(scopeTransactionWhere({ kind: "agency", agencyIds: ["ag_x"] })).toEqual({
      agencyId: { in: ["ag_x"] },
    });
  });

  it("scopeOwnershipWhere binds a business scope to the tx tag", () => {
    expect(scopeOwnershipWhere(business, "tx_1")).toEqual({
      id: "tx_1",
      progressionBusinessId: "biz_sarah",
    });
  });

  it("scopeChaseTaskWhere / scopeReminderLogWhere route through the tx tag", () => {
    expect(scopeChaseTaskWhere(business, "task_1")).toEqual({
      id: "task_1",
      transaction: { progressionBusinessId: "biz_sarah" },
    });
    expect(scopeReminderLogWhere(business, "log_1")).toEqual({
      id: "log_1",
      transaction: { progressionBusinessId: "biz_sarah" },
    });
  });
});

describe("canReadTransaction - fixture isolation matrix", () => {
  // Only the fields canReadTransaction reads.
  const T1 = { agencyId: "ag_donna", assignedUserId: null, progressionBusinessId: null }; // Donna self
  const T2 = { agencyId: "ag_donna", assignedUserId: "u_sarah_owner", progressionBusinessId: "biz_sarah" }; // Donna->Sarah
  const T3 = { agencyId: "ag_donna", assignedUserId: "u_tsp_prog", progressionBusinessId: null }; // Donna->TSP
  const T4 = { agencyId: "ag_james", assignedUserId: "u_sarah_prog2", progressionBusinessId: "biz_sarah" }; // James->Sarah
  const T5 = { agencyId: "ag_james", assignedUserId: null, progressionBusinessId: null }; // James self
  const T6 = { agencyId: "ag_unrelated", assignedUserId: "u_tsp_prog", progressionBusinessId: null }; // Unrelated->TSP
  const T7 = { agencyId: "ag_other", assignedUserId: "u_other_prog", progressionBusinessId: "biz_other" }; // Other business
  const ALL = { T1, T2, T3, T4, T5, T6, T7 };

  const sarah: AccessScope = { kind: "business", businessId: "biz_sarah" };
  const other: AccessScope = { kind: "business", businessId: "biz_other" };
  const tspProg: AccessScope = { kind: "assigned", userId: "u_tsp_prog" };
  const tspAdmin: AccessScope = { kind: "all" };
  const donna: AccessScope = { kind: "agency", agencyIds: ["ag_donna"] };
  const james: AccessScope = { kind: "agency", agencyIds: ["ag_james"] };

  function readable(scope: AccessScope): string[] {
    return Object.entries(ALL)
      .filter(([, tx]) => canReadTransaction(scope, tx))
      .map(([k]) => k)
      .sort();
  }

  it("Sarah's business sees ONLY its own tagged files (T2, T4)", () => {
    expect(readable(sarah)).toEqual(["T2", "T4"]);
  });

  it("Sarah cannot read TSP files, another business, or a client's self-progressed file", () => {
    expect(canReadTransaction(sarah, T3)).toBe(false); // TSP
    expect(canReadTransaction(sarah, T6)).toBe(false); // TSP (unrelated agency)
    expect(canReadTransaction(sarah, T7)).toBe(false); // other business
    expect(canReadTransaction(sarah, T1)).toBe(false); // Donna self-progressed (client link grants nothing)
    expect(canReadTransaction(sarah, T5)).toBe(false); // James self-progressed
  });

  it("the other business sees only its own file (T7)", () => {
    expect(readable(other)).toEqual(["T7"]);
  });

  it("a TSP progressor sees only files assigned to them (T3, T6), not Sarah's or another business's", () => {
    expect(readable(tspProg)).toEqual(["T3", "T6"]);
  });

  it("a TSP admin sees only TSP's own files (null business), never an external business's", () => {
    // Isolation: T2/T4 (Sarah) and T7 (other business) are external -> hidden from TSP.
    // T1/T3/T5/T6 all have null progressionBusinessId (TSP) -> visible.
    expect(readable(tspAdmin)).toEqual(["T1", "T3", "T5", "T6"]);
    expect(canReadTransaction(tspAdmin, T2)).toBe(false); // Sarah's file
    expect(canReadTransaction(tspAdmin, T7)).toBe(false); // another business's file
  });

  it("Donna (agency) sees all her agency's files incl. ones she handed out (T1, T2, T3), not James's or Sarah's other client", () => {
    expect(readable(donna)).toEqual(["T1", "T2", "T3"]);
    expect(canReadTransaction(donna, T4)).toBe(false); // Sarah's OTHER client (James)
  });

  it("James sees only his agency's files (T4, T5) - never Donna's", () => {
    expect(readable(james)).toEqual(["T4", "T5"]);
  });

  it("a business scope fails closed when the tx tag is not selected (undefined !== businessId)", () => {
    expect(canReadTransaction(sarah, { agencyId: "ag_donna", assignedUserId: null })).toBe(false);
  });
});
