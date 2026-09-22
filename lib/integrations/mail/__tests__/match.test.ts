/**
 * @jest-environment node
 */

import { matchMessage, matchesAddressStart, type Index } from "../match";
import type { IngestMessage } from "../types";

const baseMsg = (over: Partial<IngestMessage>): IngestMessage => ({
  id: "1", subject: "", from: "", fromName: null, to: [], cc: [],
  receivedDateTime: new Date(0).toISOString(), bodyPreview: "", body: "",
  folder: "", webLink: null, conversationId: null, internetMessageId: null,
  inReplyTo: null, references: null, ...over,
});

// sol@firm.com acts on two files; buyer@x.com only on txA.
const index: Index = {
  emailToTx: new Map([
    ["sol@firm.com", new Set(["txA", "txB"])],
    ["buyer@x.com", new Set(["txA"])],
  ]),
  txAddress: new Map([
    ["txA", "8 Brambling Crescent, Tring, HP23 4DS"],
    ["txB", "2 Evans Way, Tring, HP23 5UJ"],
  ]),
};

const MAILBOX = "me@agency.com";

describe("matchMessage", () => {
  it("folder is authoritative — wins over a participant who's on another file", () => {
    const hints = new Map([["8 brambling crescent", "txA"]]);
    const msg = baseMsg({ from: "sol@firm.com", folder: "8 Brambling Crescent" });
    expect(matchMessage(msg, MAILBOX, index, hints)).toEqual({ txId: "txA", candidates: ["txA", "txB"] });
  });

  it("folder wins even when no participant matches", () => {
    const hints = new Map([["8 brambling crescent", "txA"]]);
    const msg = baseMsg({ from: "stranger@x.com", folder: "8 Brambling Crescent" });
    expect(matchMessage(msg, MAILBOX, index, hints)).toEqual({ txId: "txA", candidates: ["txA"] });
  });

  it("single participant match that NAMES the file (street) → files it", () => {
    const msg = baseMsg({ from: "buyer@x.com", subject: "Re: 8 Brambling Crescent" });
    expect(matchMessage(msg, MAILBOX, index, new Map())).toEqual({ txId: "txA", candidates: ["txA"] });
  });

  it("single participant match that names the file by postcode → files it", () => {
    const msg = baseMsg({ from: "buyer@x.com", subject: "quick update", body: "regarding HP23 4DS please" });
    expect(matchMessage(msg, MAILBOX, index, new Map())).toEqual({ txId: "txA", candidates: ["txA"] });
  });

  it("REGRESSION: participant on ONE file, but email is about a DIFFERENT property → not filed", () => {
    // The 2026-09 cross-file leak. buyer@x.com is a party on exactly one file
    // (txA), but this email is about a different property (a separate deal the
    // same person is involved in). Old code filed it on txA purely because the
    // party matched; now, since the email names none of that party's files, it
    // goes to review instead of being silently misfiled.
    const msg = baseMsg({ from: "buyer@x.com", subject: "Re: Lease of 45 High Street Hoddesdon" });
    const r = matchMessage(msg, MAILBOX, index, new Map());
    expect(r.txId).toBeNull();
    expect(r.candidates).toEqual(["txA"]);
  });

  it("REGRESSION: shared solicitor, email about a different property → review, not a guess", () => {
    const msg = baseMsg({ from: "sol@firm.com", subject: "Re: Assignment of Lease – 45 High Street" });
    const r = matchMessage(msg, MAILBOX, index, new Map());
    expect(r.txId).toBeNull();
    expect(new Set(r.candidates)).toEqual(new Set(["txA", "txB"]));
  });

  it("chain-aware: an email naming the file's ONWARD purchase files onto the sale file", () => {
    // txA (8 Brambling Crescent) is buying onward to 26 Tamarisk Way. buyer@x.com
    // is on txA. An email about 26 Tamarisk Way names none of txA's OWN address,
    // but it's in txA's chain → still files onto txA, not the review tray.
    const chainIndex: Index = { ...index, txChainAddresses: new Map([["txA", ["26 Tamarisk Way, Weston Turville, HP22 5ZB"]]]) };
    const msg = baseMsg({ from: "buyer@x.com", subject: "Re: 26 Tamarisk Way — searches back" });
    expect(matchMessage(msg, MAILBOX, chainIndex, new Map())).toEqual({ txId: "txA", candidates: ["txA"] });
  });

  it("multiple participants, no folder — disambiguated by a subject postcode", () => {
    const msg = baseMsg({ from: "sol@firm.com", subject: "Re: HP23 5UJ replies" });
    expect(matchMessage(msg, MAILBOX, index, new Map())).toEqual({ txId: "txB", candidates: ["txA", "txB"] });
  });

  it("multiple participants, no folder, no postcode → review (null)", () => {
    const r = matchMessage(baseMsg({ from: "sol@firm.com" }), MAILBOX, index, new Map());
    expect(r.txId).toBeNull();
    expect(new Set(r.candidates)).toEqual(new Set(["txA", "txB"]));
  });

  it("nothing matches → null, no candidates", () => {
    expect(matchMessage(baseMsg({ from: "stranger@x.com" }), MAILBOX, index, new Map())).toEqual({ txId: null, candidates: [] });
  });
});

describe("matchesAddressStart", () => {
  it("matches the first line / start of the address", () => {
    expect(matchesAddressStart("8 Brambling Crescent", "8 Brambling Crescent, Tring, HP23 4DS")).toBe(true);
    expect(matchesAddressStart("2 Evans Way", "2 Evans Way, Tring")).toBe(true);
  });
  it("rejects a house-number substring (2 vs 12)", () => {
    expect(matchesAddressStart("2 Evans Way", "12 Evans Way, Tring")).toBe(false);
  });
  it("rejects a mid-string match", () => {
    expect(matchesAddressStart("Tring", "8 Brambling Crescent, Tring")).toBe(false);
  });
});
