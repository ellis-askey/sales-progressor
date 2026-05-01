/**
 * Minimal RFC 6238 TOTP implementation.
 * Uses only Node.js built-in crypto — no third-party OTP library.
 */
import crypto from "crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let out = "";
  for (let i = 0; i < bytes.length; i += 5) {
    const b = [bytes[i], bytes[i + 1] ?? 0, bytes[i + 2] ?? 0, bytes[i + 3] ?? 0, bytes[i + 4] ?? 0];
    out += BASE32[(b[0] >> 3) & 0x1f];
    out += BASE32[((b[0] & 0x07) << 2) | (b[1] >> 6)];
    out += BASE32[(b[1] >> 1) & 0x1f];
    out += BASE32[((b[1] & 0x01) << 4) | (b[2] >> 4)];
    out += BASE32[((b[2] & 0x0f) << 1) | (b[3] >> 7)];
    out += BASE32[(b[3] >> 2) & 0x1f];
    out += BASE32[((b[3] & 0x03) << 3) | (b[4] >> 5)];
    out += BASE32[b[4] & 0x1f];
  }
  return out;
}

function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=/g, "");
  const vals = Array.from(clean).map((c) => BASE32.indexOf(c));
  const bytes: number[] = [];
  for (let i = 0; i < vals.length; i += 8) {
    const v = vals;
    bytes.push(((v[i] & 0x1f) << 3) | ((v[i + 1] ?? 0) >> 2));
    bytes.push((((v[i + 1] ?? 0) & 0x03) << 6) | ((v[i + 2] ?? 0) << 1) | ((v[i + 3] ?? 0) >> 4));
    bytes.push((((v[i + 3] ?? 0) & 0x0f) << 4) | ((v[i + 4] ?? 0) >> 1));
    bytes.push((((v[i + 4] ?? 0) & 0x01) << 7) | ((v[i + 5] ?? 0) << 2) | ((v[i + 6] ?? 0) >> 3));
    bytes.push((((v[i + 6] ?? 0) & 0x07) << 5) | ((v[i + 7] ?? 0) & 0x1f));
  }
  // Trim padding zeros introduced by the loop
  return Buffer.from(bytes.slice(0, Math.floor((clean.length * 5) / 8)));
}

function totpAt(secret: string, step: number): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      (hmac[offset + 1] << 16) |
      (hmac[offset + 2] << 8) |
      hmac[offset + 3]) %
    1_000_000;
  return String(code).padStart(6, "0");
}

/** Verifies a 6-digit TOTP code, allowing ±1 time-step drift. */
export function verifyTotp(token: string, secret: string): boolean {
  const step = Math.floor(Date.now() / 1000 / 30);
  for (const s of [step - 1, step, step + 1]) {
    if (totpAt(secret, s) === token) return true;
  }
  return false;
}

/** Returns an otpauth:// URI for QR code generation. */
export function totpKeyUri(account: string, issuer: string, secret: string): string {
  return (
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
    `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
  );
}
