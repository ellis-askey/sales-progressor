// lib/security/totp.ts
//
// Dep-free TOTP (RFC 6238) + hashed one-time backup codes for two-factor auth.
// Uses node crypto only (no otplib/speakeasy); qrcode renders the otpauth URL
// elsewhere. Authenticator apps (Google Authenticator, 1Password, Authy) speak
// base32 secrets, SHA1, 6 digits, 30s period.

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh base32 TOTP secret (160 bits). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Verify a 6-digit code against the secret, tolerating +/- `window` steps. */
export function verifyTotp(secretBase32: string, token: string, window = 1): boolean {
  const clean = (token ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (timingSafeEqualStr(hotp(secret, counter + w), clean)) return true;
  }
  return false;
}

/** otpauth:// URI for the QR code / manual entry. */
export function otpauthURL(secretBase32: string, accountLabel: string, issuer = "Sales Progressor"): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function normalizeCode(c: string): string {
  return (c ?? "").toLowerCase().replace(/[\s-]/g, "");
}

/** Ten grouped one-time recovery codes (plaintext — shown to the user once). */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

/** Bcrypt-hash backup codes for storage. */
export function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcryptHash(normalizeCode(c), 10)));
}

/**
 * If `input` matches one of the stored (hashed) codes, returns the remaining
 * hashed codes with the used one removed (single-use). Otherwise null.
 */
export async function consumeBackupCode(input: string, hashed: string[]): Promise<string[] | null> {
  const norm = normalizeCode(input);
  if (norm.length < 6) return null;
  for (let i = 0; i < hashed.length; i++) {
    if (await bcryptCompare(norm, hashed[i])) {
      return hashed.filter((_, idx) => idx !== i);
    }
  }
  return null;
}
