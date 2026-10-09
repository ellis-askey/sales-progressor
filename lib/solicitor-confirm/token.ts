import crypto from "crypto";
import type { SolicitorSide } from "./codes";

// Signed, stateless confirm-link token for a solicitor on ONE matter.
// Encodes {transactionId, side} and HMAC-signs it so the link is
// unguessable and can't be tampered to point at another file. No DB row
// needed. (The production feature may swap this for a revocable DB token;
// the shape here is identical to consume.)
//
// The link is scoped to a transaction + a side (vendor's or buyer's
// solicitor) — never to a solicitor firm globally, so a firm that handles
// many of our files can never confirm the wrong one from one link.

// Signing key. MUST be the real app secret — no hard-coded fallback, so a
// missing/empty NEXTAUTH_SECRET makes the links fail to sign/verify (fail CLOSED)
// rather than becoming forgeable with a known constant. NextAuth already requires
// NEXTAUTH_SECRET in production, so this never fires there; it only guards a
// misconfiguration.
function tokenSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET must be set to sign solicitor confirmation links");
  return s;
}

// Links are valid for ~30 days from issue (D5). Every chase email mints a fresh
// one, so an active file always has a working link; a stale or forwarded link
// stops working after the window. This matters now that the page can surface
// the MOS — a leaked old link shouldn't reach documents indefinitely.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function signSolicitorToken(transactionId: string, side: SolicitorSide): string {
  const body = Buffer.from(`${transactionId}.${side}.${Date.now()}`).toString("base64url");
  const sig = crypto.createHmac("sha256", tokenSecret()).update(body).digest("base64url").slice(0, 20);
  return `${body}.${sig}`;
}

export function verifySolicitorToken(
  token: string,
): { transactionId: string; side: SolicitorSide } | null {
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

  // Expiry check. Legacy tokens without an issued-at timestamp fail here and are
  // treated as invalid; the next chase email reissues a fresh one.
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > MAX_AGE_MS) return null;

  return { transactionId, side };
}
