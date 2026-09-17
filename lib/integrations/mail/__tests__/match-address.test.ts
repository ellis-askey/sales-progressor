/**
 * @jest-environment node
 */

import { matchByAddress, firstLineAppears, type AddressEntry } from "../match";

function entry(txId: string, firstLine: string, postcode?: string): AddressEntry {
  return { txId, firstLine: firstLine.toLowerCase(), postcodes: new Set(postcode ? [postcode.toUpperCase().replace(/\s+/g, "")] : []) };
}

describe("firstLineAppears (house-number-safe)", () => {
  it("matches the address at a word boundary", () => {
    expect(firstLineAppears("re: 26 the copse, hertford", "26 the copse")).toBe(true);
  });
  it("does NOT match 2 inside 12 (the house-number-substring trap)", () => {
    expect(firstLineAppears("update on 12 evans way", "2 evans way")).toBe(false);
    expect(firstLineAppears("update on 12 evans way", "12 evans way")).toBe(true);
  });
});

describe("matchByAddress", () => {
  const index = [
    entry("tx-copse", "26 the copse", "SG13 7TX"),
    entry("tx-flint", "7 east flint", "HP1 2LS"),
    entry("tx-evans2", "2 evans way", "AL1 1AA"),
    entry("tx-evans12", "12 evans way", "AL1 1BB"),
  ];

  it("strong-matches on postcode + first line together", () => {
    const text = 'Client confirmed "Buyer has received the survey report" at 26 The Copse, Hertford, SG13 7TX';
    expect(matchByAddress(text, index)).toEqual(["tx-copse"]);
  });

  it("matches by first line alone when it is unique (no postcode in the email)", () => {
    expect(matchByAddress("quick update on 7 East Flint please", index)).toEqual(["tx-flint"]);
  });

  it("never confuses 2 Evans Way with 12 Evans Way", () => {
    // Email names 12 Evans Way; must resolve to tx-evans12 only.
    expect(matchByAddress("re 12 Evans Way, AL1 1BB", index)).toEqual(["tx-evans12"]);
    // Email names 2 Evans Way; must resolve to tx-evans2 only.
    expect(matchByAddress("re 2 Evans Way, AL1 1AA", index)).toEqual(["tx-evans2"]);
  });

  it("returns nothing when the email names no held property", () => {
    expect(matchByAddress("newsletter: the biggest business event for founders", index)).toEqual([]);
    expect(matchByAddress("2 deployments failed for staging", index)).toEqual([]);
  });

  it("returns [] for empty text or empty index", () => {
    expect(matchByAddress("", index)).toEqual([]);
    expect(matchByAddress("26 The Copse SG13 7TX", [])).toEqual([]);
  });
});
