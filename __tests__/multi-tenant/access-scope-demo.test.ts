/**
 * @jest-environment node
 *
 * Agent-demo sandbox access boundary (Phase 1). Proves the isolation core for the
 * public, no-login agent demo: a demo guest session is hard-limited to EXACTLY its
 * sandbox's transaction ids and can see or touch nothing else — not another demo
 * sandbox, not a real file, not by guessing an id.
 *
 * See docs/active/agent-demo/SPEC.md (constraint B, layer 5).
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
  type AccessScope,
} from "@/lib/security/access-scope";

// A demo guest session. `demoSandboxTransactionIds` is the only thing that makes
// it a demo session; everything else is set to deliberately-hostile values to
// prove demo detection wins and cannot be escalated.
function makeDemoSession(u: {
  demoSandboxTransactionIds?: string[] | null;
  role?: UserRole;
  progressionBusinessId?: string | null;
  canViewAllFiles?: boolean;
}): Session {
  return {
    user: {
      id: "demo_guest",
      name: "Demo Visitor",
      email: "visitor@example.com",
      role: u.role ?? "negotiator",
      agencyId: "ag_demo",
      firmName: null,
      needsSignupCompletion: false,
      progressionBusinessId: u.progressionBusinessId ?? null,
      progressionBusinessRole: null,
      canViewAllFiles: u.canViewAllFiles ?? false,
      demoSandboxTransactionIds: u.demoSandboxTransactionIds,
    },
  } as Session;
}

const SANDBOX = ["d1", "d2", "d3"]; // the chain of demo files this visitor owns

describe("getAccessScope - demo session derivation", () => {
  it("a session carrying sandbox ids resolves to {kind:'demo'}", () => {
    expect(getAccessScope(makeDemoSession({ demoSandboxTransactionIds: SANDBOX }))).toEqual({
      kind: "demo",
      transactionIds: SANDBOX,
    });
  });

  it("CANNOT escalate: demo is detected FIRST, even with superadmin role + a business id + see-all", () => {
    // If the ordering were wrong, this would resolve to {kind:'platform'} (god) or
    // {kind:'business'}. It must stay {kind:'demo'}.
    const scope = getAccessScope(
      makeDemoSession({
        demoSandboxTransactionIds: SANDBOX,
        role: "superadmin",
        progressionBusinessId: "biz_real",
        canViewAllFiles: true,
      }),
    );
    expect(scope).toEqual({ kind: "demo", transactionIds: SANDBOX });
  });

  it("an empty or absent sandbox list is NOT a demo session (falls through to normal scoping)", () => {
    expect(getAccessScope(makeDemoSession({ demoSandboxTransactionIds: [] })).kind).not.toBe("demo");
    expect(getAccessScope(makeDemoSession({ demoSandboxTransactionIds: null })).kind).not.toBe("demo");
    expect(getAccessScope(makeDemoSession({ demoSandboxTransactionIds: undefined })).kind).not.toBe("demo");
  });
});

describe("scope → where helpers bound every query to the sandbox", () => {
  const demo: AccessScope = { kind: "demo", transactionIds: SANDBOX };

  it("scopeTransactionWhere: only this sandbox's demo files (id allow-list AND isDemo)", () => {
    expect(scopeTransactionWhere(demo)).toEqual({ id: { in: SANDBOX }, isDemo: true });
  });

  it("scopeOwnershipWhere: an in-sandbox id resolves; an out-of-sandbox id yields a no-match where", () => {
    // In-sandbox: the AND is satisfiable.
    expect(scopeOwnershipWhere(demo, "d2")).toEqual({
      AND: [{ id: "d2" }, { id: { in: SANDBOX } }],
      isDemo: true,
    });
    // Out-of-sandbox (another sandbox's file, or a real file): the AND requires the
    // id to be BOTH "x9" AND one of SANDBOX, which no row can satisfy — Prisma
    // returns nothing. The shape still carries the allow-list, never a bare id.
    expect(scopeOwnershipWhere(demo, "x9")).toEqual({
      AND: [{ id: "x9" }, { id: { in: SANDBOX } }],
      isDemo: true,
    });
  });

  it("scopeChaseTaskWhere / scopeReminderLogWhere route through the sandbox tx allow-list", () => {
    expect(scopeChaseTaskWhere(demo, "task_1")).toEqual({
      id: "task_1",
      transaction: { id: { in: SANDBOX }, isDemo: true },
    });
    expect(scopeReminderLogWhere(demo, "log_1")).toEqual({
      id: "log_1",
      transaction: { id: { in: SANDBOX }, isDemo: true },
    });
  });
});

describe("canReadTransaction - demo isolation matrix", () => {
  const demo: AccessScope = { kind: "demo", transactionIds: SANDBOX };

  it("reads ONLY files whose id is in the sandbox", () => {
    expect(canReadTransaction(demo, { id: "d1", agencyId: "ag_demo", assignedUserId: null })).toBe(true);
    expect(canReadTransaction(demo, { id: "d3", agencyId: "ag_demo", assignedUserId: null })).toBe(true);
  });

  it("cannot read another sandbox's file, a real file, or an id it wasn't given", () => {
    // Another demo sandbox's file (same synthetic demo agency, different id).
    expect(canReadTransaction(demo, { id: "other_sandbox_1", agencyId: "ag_demo", assignedUserId: null })).toBe(false);
    // A real customer file — even if its agency/business/assignee looked tempting.
    expect(canReadTransaction(demo, { id: "real_tx", agencyId: "ag_real", assignedUserId: "demo_guest", progressionBusinessId: null })).toBe(false);
  });

  it("fails closed when id was not selected", () => {
    expect(canReadTransaction(demo, { agencyId: "ag_demo", assignedUserId: null })).toBe(false);
  });
});
