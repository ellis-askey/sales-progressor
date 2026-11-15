/**
 * @jest-environment node
 *
 * Native messaging feature gate (Phase 0). Proves the gate FAILS CLOSED: with
 * no / empty / invalid env the allowlists are empty and nothing is exposed, and
 * there are no hardcoded id fallbacks. Also proves client activation is
 * independent of (and in Phase 0 strictly narrower than) staff pilot access.
 */

import {
  canUseMessages,
  fileInMessagesPilot,
  clientMessagingActive,
  messagesPilotStaffIds,
  messagesPilotTransactionIds,
  messagesClientActiveTransactionIds,
} from "@/lib/agency-features/messages";

const ENV_KEYS = [
  "MESSAGES_PILOT_STAFF_IDS",
  "MESSAGES_PILOT_TRANSACTION_IDS",
  "MESSAGES_CLIENT_ACTIVE_TX_IDS",
] as const;

const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function session(id: string | undefined) {
  return { user: { id } } as any;
}

describe("messaging gate: fail closed", () => {
  it("enables nothing when no env vars are set", () => {
    expect(messagesPilotStaffIds().size).toBe(0);
    expect(messagesPilotTransactionIds().size).toBe(0);
    expect(messagesClientActiveTransactionIds().size).toBe(0);
    expect(canUseMessages(session("u1"))).toBe(false);
    expect(fileInMessagesPilot("t1")).toBe(false);
    expect(clientMessagingActive("t1")).toBe(false);
  });

  it("treats empty / whitespace / comma-only values as empty", () => {
    process.env.MESSAGES_PILOT_STAFF_IDS = "  ,  , ";
    process.env.MESSAGES_PILOT_TRANSACTION_IDS = "";
    expect(messagesPilotStaffIds().size).toBe(0);
    expect(canUseMessages(session("u1"))).toBe(false);
    expect(fileInMessagesPilot("t1")).toBe(false);
  });

  it("grants staff access only to an allowlisted user id", () => {
    process.env.MESSAGES_PILOT_STAFF_IDS = "u1, u2";
    expect(canUseMessages(session("u1"))).toBe(true);
    expect(canUseMessages(session("u2"))).toBe(true);
    expect(canUseMessages(session("u3"))).toBe(false);
    expect(canUseMessages(session(undefined))).toBe(false);
    expect(canUseMessages(null)).toBe(false);
    expect(canUseMessages(undefined)).toBe(false);
  });

  it("gates a file strictly by transaction id", () => {
    process.env.MESSAGES_PILOT_TRANSACTION_IDS = "t1,t2";
    expect(fileInMessagesPilot("t1")).toBe(true);
    expect(fileInMessagesPilot("t2")).toBe(true);
    expect(fileInMessagesPilot("t3")).toBe(false);
    expect(fileInMessagesPilot(null)).toBe(false);
    expect(fileInMessagesPilot(undefined)).toBe(false);
  });

  it("client activation requires BOTH lists; empty client list (Phase 0) = off", () => {
    process.env.MESSAGES_PILOT_TRANSACTION_IDS = "t1";
    // Phase 0: client list empty → clients see nothing even on a pilot file.
    expect(clientMessagingActive("t1")).toBe(false);

    // A tx on the client list but NOT the pilot list is still off.
    process.env.MESSAGES_CLIENT_ACTIVE_TX_IDS = "t9";
    expect(clientMessagingActive("t9")).toBe(false);

    // On BOTH lists → clients activated.
    process.env.MESSAGES_CLIENT_ACTIVE_TX_IDS = "t1";
    expect(clientMessagingActive("t1")).toBe(true);
    // Staff pilot access is unaffected by the client list either way.
    expect(fileInMessagesPilot("t1")).toBe(true);
  });
});
