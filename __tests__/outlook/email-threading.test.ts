/**
 * PR1 — Email threading, inbound (Data Optionality capture-now).
 *
 * Proves the Graph→OutlookMessage mapping now surfaces the threading metadata
 * we previously discarded: conversationId, internetMessageId, and the In-Reply-To
 * / References headers pulled (case-insensitively) from internetMessageHeaders.
 * Also proves the fields degrade to null when Graph omits them — the columns are
 * nullable and capture-only, so a missing header must never throw or fabricate.
 *
 * This is the pure extraction layer that lib/integrations/outlook/sync.ts writes
 * onto OutboundMessage. No DB, no network. `server-only` is stubbed so the
 * server-guarded module imports under jsdom.
 */

jest.mock("server-only", () => ({}), { virtual: true });

import { mapGraphMessage, type GraphMessageRaw } from "@/lib/integrations/outlook/config";

describe("Outlook inbound threading metadata", () => {
  it("extracts conversationId, internetMessageId, In-Reply-To and References", () => {
    const raw: GraphMessageRaw = {
      id: "AAMkAGgraphIdFolderCopy1",
      subject: "Re: 12 Oak Lane — enquiries",
      from: { emailAddress: { address: "solicitor@example.com", name: "A Solicitor" } },
      toRecipients: [{ emailAddress: { address: "agent@agency.co.uk" } }],
      ccRecipients: [],
      receivedDateTime: "2026-09-12T09:30:00Z",
      bodyPreview: "Replies attached",
      body: { contentType: "text", content: "Replies attached." },
      webLink: "https://outlook.office.com/mail/x",
      conversationId: "CONV-abc123",
      internetMessageId: "<reply-msg-1@example.com>",
      // Header casing intentionally mixed to prove case-insensitive lookup.
      internetMessageHeaders: [
        { name: "in-reply-to", value: "<our-chase-42@thesalesprogressor.co.uk>" },
        { name: "References", value: "<root@x> <our-chase-42@thesalesprogressor.co.uk>" },
        { name: "X-Other", value: "ignored" },
      ],
    };

    const msg = mapGraphMessage(raw, "12 Oak Lane");

    expect(msg.conversationId).toBe("CONV-abc123");
    expect(msg.internetMessageId).toBe("<reply-msg-1@example.com>");
    expect(msg.inReplyTo).toBe("<our-chase-42@thesalesprogressor.co.uk>");
    expect(msg.references).toBe("<root@x> <our-chase-42@thesalesprogressor.co.uk>");
    // Existing behaviour unchanged.
    expect(msg.from).toBe("solicitor@example.com");
    expect(msg.subject).toBe("Re: 12 Oak Lane — enquiries");
  });

  it("returns null threading fields when Graph omits them (older/plain messages)", () => {
    const raw: GraphMessageRaw = {
      id: "AAMkAGnoThreading",
      subject: "Plain message",
      from: { emailAddress: { address: "someone@example.com" } },
      toRecipients: [],
      ccRecipients: [],
      receivedDateTime: "2026-09-12T10:00:00Z",
      body: { content: "hi" },
      // conversationId / internetMessageId / internetMessageHeaders all absent
    };

    const msg = mapGraphMessage(raw, "Inbox");

    expect(msg.conversationId).toBeNull();
    expect(msg.internetMessageId).toBeNull();
    expect(msg.inReplyTo).toBeNull();
    expect(msg.references).toBeNull();
  });

  it("returns null for a header that is not present but keeps the ones that are", () => {
    const raw: GraphMessageRaw = {
      id: "AAMkAGpartial",
      subject: "Fwd: docs",
      from: { emailAddress: { address: "x@y.com" } },
      receivedDateTime: "2026-09-12T11:00:00Z",
      body: { content: "docs" },
      conversationId: "CONV-partial",
      internetMessageId: "<fwd-1@y.com>",
      internetMessageHeaders: [{ name: "References", value: "<root@y.com>" }],
    };

    const msg = mapGraphMessage(raw, "Inbox");

    expect(msg.conversationId).toBe("CONV-partial");
    expect(msg.internetMessageId).toBe("<fwd-1@y.com>");
    expect(msg.inReplyTo).toBeNull(); // no In-Reply-To header
    expect(msg.references).toBe("<root@y.com>");
  });
});
