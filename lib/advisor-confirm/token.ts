import crypto from "crypto";

// Signed, stateless portal-link token for a mortgage advisor on ONE sale.
// Encodes {transactionId, side} and HMAC-signs it so the link is unguessable and
// can't be tampered to point at another file. Mirrors lib/solicitor-confirm/token.ts
// (no DB row needed).
//
// side = "purchaser" (the buyer's own mortgage advisor) | "vendor" (the seller's
// onward-purchase advisor). Scoped to a transaction + side, never to a broker
// globally, so an advisor who handles many of our files can't open the wrong one.

export type AdvisorSide = "vendor" | "purchaser";

// Signing key. MUST be the real app secret — no hard-coded fallback, so a
// missing/empty NEXTAUTH_SECRET makes links fail to sign/verify (fail CLOSED)
// rather than becoming forgeable with a known constant.
function tokenSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET must be set to sign mortgage-advisor portal links");
  return s;
}

// Links are valid for ~30 days from issue. Every chase email (Phase 3) mints a
// fresh one, so an active file always has a working link; a stale or forwarded
// link stops working after the window.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function signAdvisorToken(transactionId: string, side: AdvisorSide): string {
  const body = Buffer.from(`${transactionId}.${side}.${Date.now()}`).toString("base64url");
  const sig = crypto.createHmac("sha256", tokenSecret()).update(body).digest("base64url").slice(0, 20);
  return `${body}.${sig}`;
}

export function verifyAdvisorToken(token: string): { transactionId: string; side: AdvisorSide } | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", tokenSecret()).update(body).digest("base64url").slice(0, 20);
  // Constant-time compare.
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  const [transactionId, side, issuedAtStr] = Buffer.from(body, "base64url").toString().split(".");
  if (!transactionId || (side !== "vendor" && side !== "purchaser")) return null;

  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > MAX_AGE_MS) return null;

  return { transactionId, side: side as AdvisorSide };
}
