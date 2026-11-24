// Per-business agent-demo launcher token.
//
// The stable, shareable link each external sales-progression business sends to
// agents. An HMAC-signed `<businessId>.<sig>` so no storage/migration is needed
// for v1: the businessId is not a secret (the signature prevents forgery). A
// stored per-business nonce for independent rotation can come with the
// Command-Centre control (Phase 6). See docs/active/agent-demo/SPEC.md.

import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.AGENT_DEMO_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("No secret available for the agent-demo launch token");
  return s;
}

function sign(businessId: string): string {
  return createHmac("sha256", secret()).update(`agent-demo:${businessId}`).digest("base64url");
}

export function signDemoLaunchToken(businessId: string): string {
  return `${Buffer.from(businessId, "utf8").toString("base64url")}.${sign(businessId)}`;
}

/** Verify a launcher token and return the businessId, or null if invalid/forged. */
export function verifyDemoLaunchToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let businessId: string;
  try {
    businessId = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!businessId) return null;
  const expected = sign(businessId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return businessId;
}
