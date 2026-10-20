// Phase 1 (agent-facing WhatsApp) — matching hardening.
// Pure-function tests for the group → property matcher. No DB.
// See docs/active/whatsapp-agent-facing/SPEC.md §"Phase 1".

import { parseGroupName, firstLineAddress, narrowingNeedle, chooseTransaction } from "@/lib/integrations/whatsapp/match";

describe("parseGroupName", () => {
  it("parses 'Sale of {address}' as SELLER", () => {
    expect(parseGroupName("Sale of 118 Hadley Grange")).toEqual({
      side: "SELLER",
      address: "118 Hadley Grange",
    });
  });

  it("parses 'Purchase of {address}' as BUYER", () => {
    expect(parseGroupName("Purchase of 8 Brambling Crescent")).toEqual({
      side: "BUYER",
      address: "8 Brambling Crescent",
    });
  });

  it("is case-insensitive and trims the address remainder", () => {
    // The caller passes an already-trimmed name (ingest.ts trims groupName first),
    // so parseGroupName is anchored at the start; it still trims the address tail.
    expect(parseGroupName("sALE oF  12 Oak Road  ")).toEqual({
      side: "SELLER",
      address: "12 Oak Road",
    });
  });

  it("requires a trimmed name; leading whitespace is the caller's job to strip", () => {
    expect(parseGroupName("  Sale of 12 Oak Road")).toBeNull();
  });

  it("keeps a full address (with commas) as the remainder", () => {
    expect(parseGroupName("Purchase of 8 Brambling Crescent, Sometown, AB1 2CD")).toEqual({
      side: "BUYER",
      address: "8 Brambling Crescent, Sometown, AB1 2CD",
    });
  });

  it("returns null for non-property group names", () => {
    expect(parseGroupName("Family")).toBeNull();
    expect(parseGroupName("Office banter")).toBeNull();
    expect(parseGroupName("118 Hadley Grange")).toBeNull(); // no Sale of / Purchase of prefix
    expect(parseGroupName("Sale of")).toBeNull(); // prefix but no address
    expect(parseGroupName("Saleof 118 Hadley Grange")).toBeNull(); // needs the space
    expect(parseGroupName("")).toBeNull();
  });
});

describe("firstLineAddress", () => {
  it("reduces a full address to its normalised first line", () => {
    expect(firstLineAddress("118 Hadley Grange, Sometown, AB1 2CD")).toBe("118 hadley grange");
  });

  it("leaves a first-line-only address as the same normalised value", () => {
    expect(firstLineAddress("118 Hadley Grange")).toBe("118 hadley grange");
  });

  it("collapses internal whitespace and trims", () => {
    expect(firstLineAddress("  118   Hadley  Grange  ,  Sometown ")).toBe("118 hadley grange");
  });

  it("full-address and first-line-only forms reduce to the same key", () => {
    expect(firstLineAddress("8 Brambling Crescent, Sometown, AB1 2CD")).toBe(
      firstLineAddress("8 Brambling Crescent"),
    );
  });
});

describe("chooseTransaction", () => {
  const row = (id: string, status: string, propertyAddress: string) => ({ id, status, propertyAddress });

  it("matches a single exact first-line", () => {
    const rows = [row("t1", "active", "118 Hadley Grange, Sometown, AB1 2CD")];
    expect(chooseTransaction(firstLineAddress("118 Hadley Grange"), rows)).toBe("t1");
  });

  it("matches when the group carried the full address", () => {
    const rows = [row("t1", "active", "118 Hadley Grange, Sometown, AB1 2CD")];
    const parsed = parseGroupName("Sale of 118 Hadley Grange, Sometown, AB1 2CD")!;
    expect(chooseTransaction(firstLineAddress(parsed.address), rows)).toBe("t1");
  });

  it("does NOT let '18 High St' mis-hit '118 High St' (the substring bug)", () => {
    // A DB substring pre-filter would surface this row; exact first-line refine rejects it.
    const rows = [row("t1", "active", "118 High Street, Sometown, AB1 2CD")];
    expect(chooseTransaction(firstLineAddress("18 High Street"), rows)).toBeNull();
  });

  it("prefers the single live file over a draft shadow twin", () => {
    const rows = [
      row("draft1", "draft", "118 Hadley Grange, Sometown, AB1 2CD"),
      row("live1", "active", "118 Hadley Grange, Sometown, AB1 2CD"),
    ];
    expect(chooseTransaction(firstLineAddress("118 Hadley Grange"), rows)).toBe("live1");
  });

  it("returns null when two live files share the first line (genuinely ambiguous)", () => {
    const rows = [
      row("live1", "active", "1 Flat Court, Sometown"),
      row("live2", "on_hold", "1 Flat Court, Othertown"),
    ];
    expect(chooseTransaction(firstLineAddress("1 Flat Court"), rows)).toBeNull();
  });

  it("returns null when nothing matches the first line", () => {
    const rows = [row("t1", "active", "9 Elm Avenue, Sometown")];
    expect(chooseTransaction(firstLineAddress("118 Hadley Grange"), rows)).toBeNull();
  });

  it("returns null on no candidates", () => {
    expect(chooseTransaction(firstLineAddress("118 Hadley Grange"), [])).toBeNull();
  });
});

// Loosened matching (founder-approved 2026-10-19): trailing extra words and
// street-type abbreviations tolerated; the 18/118 safety and the Saint-"St"
// case must survive.
describe("chooseTransaction — loosened rules", () => {
  const row = (id: string, status: string, propertyAddress: string) => ({ id, status, propertyAddress });

  it("matches a group with trailing extra words and no comma", () => {
    const rows = [row("t1", "active", "5 James Drive, Tring, HP23 4AB")];
    const parsed = parseGroupName("Sale of 5 James Drive Progression")!;
    expect(chooseTransaction(firstLineAddress(parsed.address), rows)).toBe("t1");
  });

  it("matches a street-type abbreviation as the last word", () => {
    const rows = [row("t1", "active", "5 James Drive, Tring, HP23 4AB")];
    expect(chooseTransaction(firstLineAddress("5 James Dr"), rows)).toBe("t1");
  });

  it("matches an abbreviation with a trailing dot", () => {
    const rows = [row("t1", "active", "12 Oak Road, Sometown")];
    expect(chooseTransaction(firstLineAddress("12 Oak Rd."), rows)).toBe("t1");
  });

  it("matches a mid-line abbreviation followed by extra words", () => {
    const rows = [row("t1", "active", "5 James Drive, Tring, HP23 4AB")];
    expect(chooseTransaction(firstLineAddress("5 James Dr Progression"), rows)).toBe("t1");
  });

  it("matches the other direction: abbreviated file, written-out group", () => {
    const rows = [row("t1", "active", "5 James Dr, Tring")];
    expect(chooseTransaction(firstLineAddress("5 James Drive"), rows)).toBe("t1");
  });

  it("still refuses '18 High St' against '118 High Street' (first token differs)", () => {
    const rows = [row("t1", "active", "118 High Street, Sometown")];
    expect(chooseTransaction(firstLineAddress("18 High St"), rows)).toBeNull();
  });

  it("does not let a file prefix-match inside a longer word (St vs Street boundary)", () => {
    // File "9 Elm St" must not claim group "9 Elm Stable Mews" — "st" ≡ "street",
    // not "stable".
    const rows = [row("t1", "active", "9 Elm St, Sometown")];
    expect(chooseTransaction(firstLineAddress("9 Elm Stable Mews"), rows)).toBeNull();
  });

  it("keeps 'St' meaning Saint matching a literal 'St' on the file", () => {
    const rows = [row("t1", "active", "5 St James Drive, Sometown")];
    expect(chooseTransaction(firstLineAddress("5 St James Dr"), rows)).toBe("t1");
  });

  it("prefers the most specific file when one first line extends another", () => {
    const rows = [
      row("base", "active", "5 James Drive, Tring"),
      row("east", "active", "5 James Drive East, Tring"),
    ];
    expect(chooseTransaction(firstLineAddress("5 James Drive East"), rows)).toBe("east");
    expect(chooseTransaction(firstLineAddress("5 James Drive"), rows)).toBe("base");
    // Extra words that match no specific file fall back to the base file.
    expect(chooseTransaction(firstLineAddress("5 James Drive Progression"), rows)).toBe("base");
  });

  it("still refuses when two live files tie at the same specificity", () => {
    const rows = [
      row("live1", "active", "1 Flat Court, Sometown"),
      row("live2", "on_hold", "1 Flat Court, Othertown"),
    ];
    expect(chooseTransaction(firstLineAddress("1 Flat Court Progression"), rows)).toBeNull();
  });
});

describe("narrowingNeedle", () => {
  it("takes the first two tokens of the parsed first line", () => {
    expect(narrowingNeedle(firstLineAddress("5 James Drive Progression"))).toBe("5 james");
  });

  it("handles a single-token address", () => {
    expect(narrowingNeedle(firstLineAddress("Hillcrest"))).toBe("hillcrest");
  });
});
