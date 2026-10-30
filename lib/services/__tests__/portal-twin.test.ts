/**
 * @jest-environment node
 */

// Person-tie matcher for the onward portal mirror (docs/active/onward-portal-mirror.md).

import { matchTwinByEmail } from "@/lib/services/portal-twin";

const c = (id: string, email: string | null, portalToken: string | null = `tok-${id}`) => ({ id, email, portalToken });

describe("matchTwinByEmail", () => {
  test("unambiguous email match → returns that contact + token", () => {
    expect(matchTwinByEmail("mario@x.com", [c("a", "mario@x.com"), c("b", "koula@x.com")]))
      .toEqual({ contactId: "a", portalToken: "tok-a" });
  });

  test("match is case- and whitespace-insensitive", () => {
    expect(matchTwinByEmail("  Mario@X.COM ", [c("a", "mario@x.com")]))
      .toEqual({ contactId: "a", portalToken: "tok-a" });
  });

  test("no source email → null (can't strongly tie)", () => {
    expect(matchTwinByEmail(null, [c("a", "mario@x.com")])).toBeNull();
    expect(matchTwinByEmail("   ", [c("a", "mario@x.com")])).toBeNull();
  });

  test("no matching candidate → null", () => {
    expect(matchTwinByEmail("mario@x.com", [c("a", "someone@y.com")])).toBeNull();
  });

  test("more than one match → null (ambiguous, don't guess)", () => {
    expect(matchTwinByEmail("mario@x.com", [c("a", "mario@x.com"), c("b", "mario@x.com")])).toBeNull();
  });

  test("candidate with null email is ignored", () => {
    expect(matchTwinByEmail("mario@x.com", [c("a", null), c("b", "mario@x.com")]))
      .toEqual({ contactId: "b", portalToken: "tok-b" });
  });

  test("carries a null token through (read-only neighbour with no token yet)", () => {
    expect(matchTwinByEmail("mario@x.com", [c("a", "mario@x.com", null)]))
      .toEqual({ contactId: "a", portalToken: null });
  });
});
