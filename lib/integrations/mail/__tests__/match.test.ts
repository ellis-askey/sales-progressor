/**
 * @jest-environment node
 */

// Pure-function coverage for the provider-neutral matcher. No DB: we hand it a
// prebuilt index + folder hints (exactly what buildIndex / buildFolderHints
// produce) and assert which single file each message resolves to. This is the
// shared core every connector (Outlook, IMAP, Gmail) relies on.

import { matchMessage, type Index } from "../match";
import type { IngestMessage } from "../types";

const MAILBOX = "agent@myagency.co.uk";

function msg(partial: Partial<IngestMessage>): IngestMessage {
  return {
    id: "m1",
    subject: "",
    from: "",
    fromName: null,
    to: [],
    cc: [],
    receivedDateTime: new Date(0).toISOString(),
    bodyPreview: "",
    body: "",
    folder: "",
    conversationId: null,
    internetMessageId: null,
    inReplyTo: null,
    references: null,
    ...partial,
  };
}

function index(emailToTx: Record<string, string[]>, txAddress: Record<string, string> = {}): Index {
  return {
    emailToTx: new Map(Object.entries(emailToTx).map(([k, v]) => [k.toLowerCase(), new Set(v)])),
    txAddress: new Map(Object.entries(txAddress)),
  };
}

describe("matchMessage", () => {
  it("matches on a single known participant", () => {
    const res = matchMessage(
      msg({ from: "solicitor@law.co.uk", to: [MAILBOX] }),
      MAILBOX,
      index({ "solicitor@law.co.uk": ["tx1"] }),
      new Map(),
    );
    expect(res.txId).toBe("tx1");
  });

  it("ignores the mailbox's own address", () => {
    const res = matchMessage(
      msg({ from: MAILBOX, to: ["solicitor@law.co.uk"] }),
      MAILBOX,
      index({ "solicitor@law.co.uk": ["tx1"], [MAILBOX]: ["txWrong"] }),
      new Map(),
    );
    expect(res.txId).toBe("tx1");
  });

  it("breaks a two-file tie by the folder the email is filed in", () => {
    const res = matchMessage(
      msg({ from: "shared@broker.co.uk", folder: "118 Hadley Grange" }),
      MAILBOX,
      index({ "shared@broker.co.uk": ["tx1", "tx2"] }),
      new Map([["118 hadley grange", "tx2"]]),
    );
    expect(res.txId).toBe("tx2");
  });

  it("breaks a two-file tie by a postcode in the subject when no folder hint", () => {
    const res = matchMessage(
      msg({ from: "shared@broker.co.uk", subject: "Re: sale AL1 2CD" }),
      MAILBOX,
      index(
        { "shared@broker.co.uk": ["tx1", "tx2"] },
        { tx1: "1 High St, AL9 9ZZ", tx2: "5 Mill Rd, AL1 2CD" },
      ),
      new Map(),
    );
    expect(res.txId).toBe("tx2");
  });

  it("stays ambiguous (no match) when a tie can't be broken, returning candidates", () => {
    const res = matchMessage(
      msg({ from: "shared@broker.co.uk", subject: "no postcode here" }),
      MAILBOX,
      index({ "shared@broker.co.uk": ["tx1", "tx2"] }),
      new Map(),
    );
    expect(res.txId).toBeNull();
    expect(res.candidates.sort()).toEqual(["tx1", "tx2"]);
  });

  it("falls back to the folder when no participant is known", () => {
    const res = matchMessage(
      msg({ from: "stranger@nowhere.com", folder: "8 Brambling Crescent" }),
      MAILBOX,
      index({}),
      new Map([["8 brambling crescent", "tx3"]]),
    );
    expect(res.txId).toBe("tx3");
  });

  it("resolves a forward via the party named inside the body when the envelope is unknown", () => {
    const res = matchMessage(
      msg({
        from: "colleague@myagency.co.uk", // forwarder, not on any file
        to: [MAILBOX],
        subject: "Fwd: your sale",
        body: "Begin forwarded message:\nFrom: solicitor@law.co.uk\nTo: someone@else.com",
      }),
      MAILBOX,
      index({ "solicitor@law.co.uk": ["tx1"] }),
      new Map(),
    );
    expect(res.txId).toBe("tx1");
  });

  it("returns no match and no candidates when nothing is known", () => {
    const res = matchMessage(
      msg({ from: "stranger@nowhere.com", subject: "hello" }),
      MAILBOX,
      index({}),
      new Map(),
    );
    expect(res.txId).toBeNull();
    expect(res.candidates).toEqual([]);
  });
});
