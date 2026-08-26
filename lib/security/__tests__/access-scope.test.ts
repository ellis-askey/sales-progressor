/**
 * @jest-environment node
 */

// Multi-tenant isolation guard (Law 7). These lock the core invariant the whole
// free-agency rollout depends on: an AGENCY-scoped caller can never produce an
// unscoped query, and can never read another agency's transaction. If someone
// later "simplifies" a helper into returning {} for an agency, this fails.

import type { Session } from "next-auth";
import {
  getAccessScope,
  scopeTransactionWhere,
  scopeOwnershipWhere,
  scopeChaseTaskWhere,
  scopeReminderLogWhere,
  canReadTransaction,
  type AccessScope,
} from "@/lib/security/access-scope";

const AGENCY_A = "agency-a";
const AGENCY_B = "agency-b";
const agencyScope: AccessScope = { kind: "agency", agencyIds: [AGENCY_A] };
const assignedScope: AccessScope = { kind: "assigned", userId: "sp-user" };
const allScope: AccessScope = { kind: "all" };

function directorSession(agencyId: string): Session {
  return {
    user: { id: "u1", role: "director", agencyId, email: "dir@agency-a.co.uk" },
    expires: "2099-01-01",
  } as unknown as Session;
}

describe("getAccessScope", () => {
  test("a director resolves to their own single agency", () => {
    expect(getAccessScope(directorSession(AGENCY_A))).toEqual({ kind: "agency", agencyIds: [AGENCY_A] });
  });
});

describe("agency scope always restricts by agencyId (never unscoped)", () => {
  test("scopeTransactionWhere carries the agency filter", () => {
    expect(scopeTransactionWhere(agencyScope)).toEqual({ agencyId: { in: [AGENCY_A] } });
  });
  test("scopeOwnershipWhere carries id + agencyId", () => {
    expect(scopeOwnershipWhere(agencyScope, "tx1")).toEqual({ id: "tx1", agencyId: AGENCY_A });
  });
  test("chase-task + reminder-log guards restrict via the related transaction's agency", () => {
    expect(scopeChaseTaskWhere(agencyScope, "t1")).toEqual({ id: "t1", transaction: { agencyId: AGENCY_A } });
    expect(scopeReminderLogWhere(agencyScope, "r1")).toEqual({ id: "r1", transaction: { agencyId: AGENCY_A } });
  });
  test("none of the agency-scoped wheres are an empty object", () => {
    for (const w of [
      scopeTransactionWhere(agencyScope),
      scopeOwnershipWhere(agencyScope, "tx1"),
      scopeChaseTaskWhere(agencyScope, "t1"),
      scopeReminderLogWhere(agencyScope, "r1"),
    ]) {
      expect(Object.keys(w).length).toBeGreaterThan(0);
    }
  });
});

describe("canReadTransaction denies cross-agency", () => {
  test("agency A cannot read an agency B transaction", () => {
    expect(canReadTransaction(agencyScope, { agencyId: AGENCY_B, assignedUserId: null })).toBe(false);
  });
  test("agency A can read its own transaction", () => {
    expect(canReadTransaction(agencyScope, { agencyId: AGENCY_A, assignedUserId: null })).toBe(true);
  });
  test("an assigned SP user only reads files assigned to them", () => {
    expect(canReadTransaction(assignedScope, { agencyId: AGENCY_B, assignedUserId: "sp-user" })).toBe(true);
    expect(canReadTransaction(assignedScope, { agencyId: AGENCY_B, assignedUserId: "someone-else" })).toBe(false);
  });
  test("admin (all) reads anything", () => {
    expect(canReadTransaction(allScope, { agencyId: AGENCY_B, assignedUserId: null })).toBe(true);
  });
});
