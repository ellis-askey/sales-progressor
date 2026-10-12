// Pure-function tests for the Cloud API webhook security + idempotency
// helpers (Phase 1, docs/active/whatsapp-rebuild/REBUILD_PLAN.md §C3/§H:
// signature verification, duplicate-tolerant event identity, out-of-order
// status protection).

import crypto from "crypto";
import {
  verifyMetaSignature,
  messageDedupKey,
  statusDedupKey,
  statusAdvances,
  statusRank,
} from "@/lib/integrations/whatsapp-cloud/signature";

const SECRET = "test-app-secret";

function sign(body: string, secret = SECRET): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyMetaSignature", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("accepts a correctly signed payload", () => {
    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    expect(verifyMetaSignature(body, sign(body, "other-secret"), SECRET)).toBe(false);
  });

  it("rejects a tampered body", () => {
    expect(verifyMetaSignature(body + " ", sign(body), SECRET)).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    expect(verifyMetaSignature(body, null, SECRET)).toBe(false);
    expect(verifyMetaSignature(body, "", SECRET)).toBe(false);
    expect(verifyMetaSignature(body, "md5=abc", SECRET)).toBe(false);
    expect(verifyMetaSignature(body, "sha256=nothex!!", SECRET)).toBe(false);
  });
});

describe("event identity keys", () => {
  it("message events dedup on wamid; status events on wamid+status", () => {
    expect(messageDedupKey("wamid.ABC")).toBe("msg:wamid.ABC");
    expect(statusDedupKey("wamid.ABC", "delivered")).toBe("status:wamid.ABC:delivered");
    // The same message's delivered + read are distinct events; a redelivered
    // `delivered` webhook collides with itself and no-ops.
    expect(statusDedupKey("wamid.ABC", "read")).not.toBe(statusDedupKey("wamid.ABC", "delivered"));
  });
});

describe("status ordering (out-of-order webhook protection)", () => {
  it("only ever advances", () => {
    expect(statusAdvances(null, "sent")).toBe(true);
    expect(statusAdvances("sent", "delivered")).toBe(true);
    expect(statusAdvances("delivered", "read")).toBe(true);
    // Late lower-rank statuses never regress the state.
    expect(statusAdvances("read", "delivered")).toBe(false);
    expect(statusAdvances("delivered", "sent")).toBe(false);
  });

  it("failed is terminal and outranks everything", () => {
    expect(statusAdvances("read", "failed")).toBe(true);
    expect(statusAdvances("failed", "delivered")).toBe(false);
    expect(statusRank("failed")).toBeGreaterThan(statusRank("read"));
  });

  it("unknown statuses never advance over known ones", () => {
    expect(statusAdvances("sent", "mystery")).toBe(false);
  });
});
