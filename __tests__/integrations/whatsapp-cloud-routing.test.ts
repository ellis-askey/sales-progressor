// Matching-ladder tests (Phase 2, REBUILD_PLAN §C3/§H): a conversation is only
// auto-attached when its sender matches exactly ONE live sale; several sales →
// candidates queue; unknown → queue. Plus thread-key parsing and phone cores.

import { threadKeyFromMessage, previewFromMessage, last9, chooseAssignment, ledgerUpdateForWaStatus, waRankOfLedgerStatus } from "@/lib/integrations/whatsapp-cloud/routing";
import { statusAdvances } from "@/lib/integrations/whatsapp-cloud/signature";

describe("threadKeyFromMessage", () => {
  const value = {
    contacts: [{ wa_id: "447700900123", profile: { name: "Jane Buyer" } }],
    messages: [],
  };

  it("direct message → the sender's wa_id + profile name", () => {
    const key = threadKeyFromMessage(value, { id: "wamid.1", from: "447700900123", type: "text" });
    expect(key).toEqual({ kind: "direct", waId: "447700900123", displayName: "Jane Buyer" });
  });

  it("group message → the group id, regardless of individual sender", () => {
    const key = threadKeyFromMessage(value, { id: "wamid.2", from: "447700900123", type: "text", group_id: "g-123" });
    expect(key).toEqual({ kind: "group", waId: "g-123", displayName: null });
  });

  it("no sender → null (never a junk thread)", () => {
    expect(threadKeyFromMessage(value, { id: "wamid.3", type: "text" })).toBeNull();
  });
});

describe("previewFromMessage", () => {
  it("text body for texts, bracketed type otherwise", () => {
    expect(previewFromMessage({ type: "text", text: { body: "Searches are back" } })).toBe("Searches are back");
    expect(previewFromMessage({ type: "image" })).toBe("[image]");
  });
});

describe("last9 phone core", () => {
  it("matches UK-formatted numbers to wa_ids", () => {
    expect(last9("447508862929")).toBe("508862929");
    expect(last9("07508 862929")).toBe("508862929");
    expect(last9("+44 7508-862929")).toBe("508862929");
    expect(last9("447508862929")).toBe(last9("07508862929"));
  });
  it("rejects too-short values", () => {
    expect(last9("12345")).toBeNull();
    expect(last9(null)).toBeNull();
  });
});

describe("chooseAssignment — the accuracy rule", () => {
  it("one live sale → auto-assign, side from the contact's role", () => {
    const d = chooseAssignment([{ contactId: "c1", transactionId: "t1", roleType: "purchaser" }]);
    expect(d).toMatchObject({ state: "auto", transactionId: "t1", side: "BUYER", contactIds: ["c1"] });
  });

  it("vendor role → SELLER side; joint vendors on one sale still auto", () => {
    const d = chooseAssignment([
      { contactId: "c1", transactionId: "t1", roleType: "vendor" },
      { contactId: "c2", transactionId: "t1", roleType: "vendor" },
    ]);
    expect(d).toMatchObject({ state: "auto", transactionId: "t1", side: "SELLER" });
  });

  it("non-client role (solicitor) → assigns the sale but no side guess", () => {
    const d = chooseAssignment([{ contactId: "c1", transactionId: "t1", roleType: "solicitor" }]);
    expect(d).toMatchObject({ state: "auto", transactionId: "t1", side: null });
  });

  it("same person on TWO live sales → queued with both as candidates, never guessed", () => {
    const d = chooseAssignment([
      { contactId: "c1", transactionId: "t1", roleType: "vendor" },
      { contactId: "c2", transactionId: "t2", roleType: "purchaser" },
    ]);
    expect(d.state).toBe("needs_assigning");
    expect(d.candidates).toEqual(["t1", "t2"]);
    expect(d.transactionId).toBeNull();
  });

  it("unknown sender → queued with no candidates", () => {
    const d = chooseAssignment([]);
    expect(d).toMatchObject({ state: "needs_assigning", transactionId: null, candidates: [] });
  });
});

describe("ledger status mapping (Phase 3)", () => {
  it("maps WhatsApp lifecycle to ledger status + timestamp column", () => {
    expect(ledgerUpdateForWaStatus("sent")).toEqual({ status: "sent", stampField: "sentAt" });
    expect(ledgerUpdateForWaStatus("delivered")).toEqual({ status: "delivered", stampField: "deliveredAt" });
    expect(ledgerUpdateForWaStatus("read")).toEqual({ status: "opened", stampField: "openedAt" });
    expect(ledgerUpdateForWaStatus("failed")).toEqual({ status: "failed", stampField: "failedAt" });
    expect(ledgerUpdateForWaStatus("played")).toBeNull();
  });

  it("advance-only holds across the ledger's opened≙read rename", () => {
    // Row already at opened (read): a late delivered must not regress it…
    expect(statusAdvances(waRankOfLedgerStatus("opened"), "delivered")).toBe(false);
    // …but a failure still lands, and sent → read advances.
    expect(statusAdvances(waRankOfLedgerStatus("opened"), "failed")).toBe(true);
    expect(statusAdvances(waRankOfLedgerStatus("sent"), "read")).toBe(true);
  });
});
