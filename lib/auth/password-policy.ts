// Shared password policy. One place decides whether a password is allowed, so
// the rule can't drift across the many sign-up / reset / invite call sites.
//
// Rules:
//   - minimum length (MIN_PASSWORD_LENGTH)
//   - rejected if it appears in a known breach corpus, checked against the
//     HaveIBeenPwned range API using k-anonymity: only the first 5 characters
//     of the SHA-1 hash ever leave the server, never the password or full hash.

import crypto from "crypto";

export const MIN_PASSWORD_LENGTH = 10;

export type PasswordCheck = { ok: true } | { ok: false; error: string };

/** Length-only check (synchronous). */
export function checkPasswordLength(password: string): PasswordCheck {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  return { ok: true };
}

/**
 * Full check: length, then a HaveIBeenPwned breach lookup. The breach call is
 * best-effort: if HIBP can't be reached we do NOT block the user (fail open),
 * so a third-party outage can never lock sign-ups. The length rule always holds.
 */
export async function validatePassword(password: string): Promise<PasswordCheck> {
  const lengthCheck = checkPasswordLength(password);
  if (!lengthCheck.ok) return lengthCheck;

  try {
    const sha1 = crypto.createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return { ok: true };
    const text = await res.text();
    const breached = text.split("\n").some((line) => {
      const [hashSuffix, count] = line.trim().split(":");
      return hashSuffix === suffix && Number(count) > 0;
    });
    if (breached) {
      return { ok: false, error: "That password has appeared in a known data breach. Please choose another." };
    }
  } catch {
    // Network error → fail open; the length rule above still applied.
  }
  return { ok: true };
}
