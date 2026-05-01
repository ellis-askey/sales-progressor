/**
 * Step-up cookie helpers for command centre auth.
 *
 * Cookie name: command_session
 * Wire format: base64url(JSON payload) + "." + hex(HMAC-SHA256(base64url_payload, AUDIT_HMAC_KEY))
 *
 * Payload fields:
 *   issuedAt   — unix ms when the 24h hard session started
 *   lastSeenAt — unix ms of the most recent request (refreshed in layout)
 *   stepUpAt   — unix ms when TOTP was last verified
 */

import crypto from "crypto";
import { AUDIT_HMAC_KEY } from "./config";

export const COOKIE_NAME = "command_session";

export interface CommandSessionPayload {
  issuedAt: number;
  lastSeenAt: number;
  stepUpAt: number;
}

function hmac(data: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(AUDIT_HMAC_KEY, "hex"))
    .update(data)
    .digest("hex");
}

function toBase64Url(s: string): string {
  return Buffer.from(s).toString("base64url");
}

function fromBase64Url(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function signSession(payload: CommandSessionPayload): string {
  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${hmac(encoded)}`;
}

/** Returns the payload if the signature is valid, null otherwise. */
export function verifySession(cookie: string): CommandSessionPayload | null {
  const dot = cookie.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = hmac(encoded);
  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
    return null;
  }
  try {
    return JSON.parse(fromBase64Url(encoded)) as CommandSessionPayload;
  } catch {
    return null;
  }
}
