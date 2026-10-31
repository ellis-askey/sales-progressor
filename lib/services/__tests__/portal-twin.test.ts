/**
 * @jest-environment node
 */

// Person-tie matcher for the onward portal mirror (docs/active/onward-portal-mirror.md).

import { matchTwinByEmail, matchTwinByName, matchTwin } from "@/lib/services/portal-twin";

const c = (id: string, email: string | null, portalToken: string | null = `tok-${id}`) => ({ id, email, portalToken });
const cn = (id: string, name: string, portalToken: string | null = `tok-${id}`) => ({ id, name, portalToken });
const cf = (id: string, email: string | null, name: string, portalToken: string | null = `tok-${id}`) => ({ id, email, name, portalToken });

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

describe("matchTwinByName", () => {
  test("unambiguous title-stripped match (the Achillea case)", () => {
    // "Mr Mario Achillea" on the sale ties to "Mario Achillea" on the purchase.
    expect(matchTwinByName("Mr Mario Achillea", [cn("a", "Mario Achillea"), cn("b", "Koula Achillea")]))
      .toEqual({ contactId: "a", portalToken: "tok-a" });
  });

  test("case- and whitespace-insensitive", () => {
    expect(matchTwinByName("  mario   ACHILLEA ", [cn("a", "Mario Achillea")]))
      .toEqual({ contactId: "a", portalToken: "tok-a" });
  });

  test("a lone first name or bare surname is too weak → null", () => {
    expect(matchTwinByName("Mario", [cn("a", "Mario")])).toBeNull();
    expect(matchTwinByName("Achillea", [cn("a", "Achillea")])).toBeNull();
    expect(matchTwinByName("Mr Stevens", [cn("a", "Mr Stevens")])).toBeNull();
  });

  test("more than one same-name match → null (ambiguous)", () => {
    expect(matchTwinByName("John Smith", [cn("a", "John Smith"), cn("b", "John Smith")])).toBeNull();
  });

  test("no match → null", () => {
    expect(matchTwinByName("Mario Achillea", [cn("a", "Hannah Goddard")])).toBeNull();
  });
});

describe("matchTwin (email first, then name)", () => {
  test("prefers an email match even when a different name also matches", () => {
    expect(matchTwin(
      { email: "mario@x.com", name: "Mario Achillea" },
      [cf("a", "mario@x.com", "Someone Else"), cf("b", null, "Mario Achillea")],
    )).toEqual({ contactId: "a", portalToken: "tok-a" });
  });

  test("falls back to name when there's no email match", () => {
    expect(matchTwin(
      { email: "mario@x.com", name: "Mr Mario Achillea" },
      [cf("a", "different@x.com", "Mario Achillea")],
    )).toEqual({ contactId: "a", portalToken: "tok-a" });
  });

  test("no email, name ties", () => {
    expect(matchTwin(
      { email: null, name: "Mario Achillea" },
      [cf("a", null, "Mario Achillea")],
    )).toEqual({ contactId: "a", portalToken: "tok-a" });
  });

  test("neither confident → null", () => {
    expect(matchTwin(
      { email: null, name: "Mario" },
      [cf("a", "x@y.com", "Different Person")],
    )).toBeNull();
  });
});
