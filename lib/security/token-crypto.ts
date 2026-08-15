// lib/security/token-crypto.ts
//
// Reversible encryption for sensitive third-party credentials at rest
// (OAuth access + refresh tokens). Used by the Outlook/Microsoft Graph
// integration; safe for any future integration that stores tokens.
//
// Why this exists alongside lib/command/crypto.ts:
//   - lib/command/crypto.ts is Command-Centre-isolated (Law 8) and scoped to
//     TOTP secrets using AES-256-CBC (no auth tag).
//   - Refresh tokens are long-lived bearer credentials, so we use AES-256-GCM
//     (authenticated encryption — tamper-evident) here.
//   - We deliberately REUSE the already-provisioned key `ADMIN_TOTP_ENCRYPTION_KEY`
//     rather than minting a new secret, so there is nothing new to add to Vercel.
//
// Format of the stored string: `iv_hex:tag_hex:ciphertext_hex`.
// Never log the plaintext or the key. Never expose either to the client.

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit nonce, the standard/recommended size for GCM

function deriveKey(): Buffer {
  const hex = process.env.ADMIN_TOTP_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "[token-crypto] ADMIN_TOTP_ENCRYPTION_KEY is not set; cannot encrypt/decrypt integration tokens"
    );
  }
  const raw = Buffer.from(hex, "hex");
  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `[token-crypto] ADMIN_TOTP_ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${raw.length}`
    );
  }
  return raw;
}

/** Encrypts a secret. Returns `iv_hex:tag_hex:ciphertext_hex`. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** Decrypts a stored secret. Throws if the format is invalid or the data was tampered with. */
export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("[token-crypto] Invalid stored secret format");
  }
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString(
    "utf8"
  );
}
