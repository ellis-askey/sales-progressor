/**
 * @jest-environment node
 *
 * isHybridSuperadmin — the single source of truth for "who skips the Command
 * Centre 2FA/step-up flow". Slice 1 unified this detection (previously the
 * protected layout keyed on `role !== "superadmin"` while the middleware keyed
 * on the email allowlist). This test pins the truth table so the unification
 * is provably behaviour-preserving for every user who can reach the layout:
 *   - a real superadmin → false (still goes through 2FA)
 *   - the one allowlisted hybrid (ellis as SP) → true (skips it, as before)
 *   - anyone else → false (and such a user can't reach the layout anyway)
 */

import { isHybridSuperadmin } from "@/lib/agent-session";
import type { Session } from "next-auth";

function sess(role: string, email: string): Session {
  return { user: { role, email } } as unknown as Session;
}

describe("isHybridSuperadmin", () => {
  it("is false for a real superadmin (unchanged: they still do 2FA)", () => {
    expect(isHybridSuperadmin(sess("superadmin", "admin@thesalesprogressor.co.uk"))).toBe(false);
  });

  it("is true for the allowlisted hybrid founder running as SP", () => {
    expect(isHybridSuperadmin(sess("sales_progressor", "ellis@thesalesprogressor.co.uk"))).toBe(true);
  });

  it("is false for a non-allowlisted non-superadmin", () => {
    expect(isHybridSuperadmin(sess("sales_progressor", "someone@example.com"))).toBe(false);
  });

  it("role wins: a real superadmin is never treated as hybrid even if allowlisted", () => {
    expect(isHybridSuperadmin(sess("superadmin", "ellis@thesalesprogressor.co.uk"))).toBe(false);
  });
});
