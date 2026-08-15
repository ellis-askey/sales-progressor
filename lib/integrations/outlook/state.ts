// lib/integrations/outlook/state.ts
//
// OAuth `state` handling for the Outlook connect flow. Protects against CSRF
// and account-linking attacks: the state is a random nonce, and we stash a
// signed copy — bound to the connecting user's id — in an httpOnly cookie.
// On callback we require (a) the cookie signature to verify, (b) the cookie's
// user id to match the current session, and (c) the returned `state` to equal
// the nonce. Anything else is rejected.

import "server-only";
import crypto from "crypto";

export const OUTLOOK_STATE_COOKIE = "sp_outlook_oauth_state";
export const OUTLOOK_STATE_MAX_AGE_SECONDS = 600; // 10 minutes

function signingKey(): Buffer {
  const hex = process.env.ADMIN_TOTP_ENCRYPTION_KEY;
  if (!hex) throw new Error("[outlook/state] ADMIN_TOTP_ENCRYPTION_KEY is not set");
  return Buffer.from(hex, "hex");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", signingKey()).update(payload).digest("hex");
}

/**
 * Creates a fresh state. Returns the `state` value to send to Microsoft and the
 * `cookieValue` to store in the httpOnly state cookie.
 */
export function createOutlookState(userId: string): { state: string; cookieValue: string } {
  const nonce = crypto.randomBytes(32).toString("hex");
  const payload = `${userId}.${nonce}`;
  return { state: nonce, cookieValue: `${payload}.${sign(payload)}` };
}

/**
 * Validates the returned `state` against the stored cookie for the given user.
 * Uses constant-time comparison. Returns true only on a full match.
 */
export function verifyOutlookState(
  cookieValue: string | undefined,
  returnedState: string | undefined,
  userId: string
): boolean {
  if (!cookieValue || !returnedState) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [cookieUserId, nonce, sig] = parts;

  const expectedSig = sign(`${cookieUserId}.${nonce}`);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  if (cookieUserId !== userId) return false;

  const nonceBuf = Buffer.from(nonce);
  const stateBuf = Buffer.from(returnedState);
  if (nonceBuf.length !== stateBuf.length) return false;
  return crypto.timingSafeEqual(nonceBuf, stateBuf);
}
