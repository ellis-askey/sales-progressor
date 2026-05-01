import crypto from "crypto";
import { TOTP_ENCRYPTION_KEY } from "./config";

const ALGORITHM = "aes-256-cbc";
const KEY_BYTES = 32;

function deriveKey(): Buffer {
  const raw = Buffer.from(TOTP_ENCRYPTION_KEY, "hex");
  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `[command/crypto] ADMIN_TOTP_ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${raw.length}`
    );
  }
  return raw;
}

/** Encrypts a TOTP secret. Returns `iv_hex:ciphertext_hex`. */
export function encryptTotpSecret(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${enc.toString("hex")}`;
}

/** Decrypts a stored TOTP secret. Throws if the format is invalid. */
export function decryptTotpSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 2) {
    throw new Error("[command/crypto] Invalid stored TOTP secret format");
  }
  const iv = Buffer.from(parts[0], "hex");
  const data = Buffer.from(parts[1], "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(), iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
