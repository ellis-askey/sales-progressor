// lib/email/unsubscribe.ts
// HMAC-SHA256 signed unsubscribe tokens. No expiry — set UNSUBSCRIBE_SECRET in Vercel env.
// Subject format:  "user:{userId}"      → sets User.emailUnsubscribedAt
//                  "invite:{linkId}"    → sets ChainLink.inviteUnsubscribedAt
//                  "contact:{contactId}" → sets Contact.unsubscribedAt (A3, client-chase arc)
//                  "prospect:{prospectId}" → sets Prospect.optedOutAt + halts flow (AI Outreach)

import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  // Prefer the dedicated secret; fall back to the app secret (always set in
  // production, required by NextAuth) so these links are NEVER signed with an
  // empty key. Fail CLOSED if neither is present rather than issuing forgeable
  // tokens — a missing secret must break signing, not remove the lock.
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("UNSUBSCRIBE_SECRET or NEXTAUTH_SECRET must be set to sign unsubscribe links");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload, "utf8").digest("hex");
}

function b64Encode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function b64Decode(s: string): string | null {
  try {
    return Buffer.from(s, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function generateUnsubscribeToken(subject: string): string {
  const payload = b64Encode(subject);
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) return null;
  return b64Decode(payload);
}

// ─── URL builders ──────────────────────────────────────────────────────────────

const portalBase = () =>
  process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

export function buildUserUnsubscribeUrl(userId: string): string {
  const token = generateUnsubscribeToken(`user:${userId}`);
  return `${portalBase()}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function buildInviteUnsubscribeUrl(chainLinkId: string): string {
  const token = generateUnsubscribeToken(`invite:${chainLinkId}`);
  return `${portalBase()}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}

// Used by client-chase emails (vendor / purchaser / solicitor / broker
// contacts). Clicking sets Contact.unsubscribedAt. A5 wires this URL into
// emails enqueued for Contact recipients; A3 (this commit) provides only
// the URL builder + endpoint handler.
export function buildContactUnsubscribeUrl(contactId: string): string {
  const token = generateUnsubscribeToken(`contact:${contactId}`);
  return `${portalBase()}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}

// Cold-outreach prospects (AI Outreach engine). Clicking, or a one-click POST
// from the List-Unsubscribe header, sets Prospect.optedOutAt and halts any
// running flow so we stop cold-emailing them.
export function buildProspectUnsubscribeUrl(prospectId: string): string {
  const token = generateUnsubscribeToken(`prospect:${prospectId}`);
  return `${portalBase()}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}

// "Pause for a week" one-click link in chase emails (audit #11). Reuses the
// same signed-token mechanism; clicking sets Contact.chasesPausedUntil to a
// week out, pausing only chases (not real updates), then auto-resuming.
export function buildContactPauseUrl(contactId: string): string {
  const token = generateUnsubscribeToken(`pause:${contactId}`);
  return `${portalBase()}/api/pause-chases?t=${encodeURIComponent(token)}`;
}
