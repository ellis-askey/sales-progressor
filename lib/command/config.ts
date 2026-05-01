/**
 * Validates and exports required command centre env vars.
 * Throws at module load time if any key is missing — fail fast before
 * the server accepts traffic rather than at the first auth attempt.
 */

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val || val.trim() === "") {
    throw new Error(`[command/config] Missing required env var: ${name}`);
  }
  return val.trim();
}

export const TOTP_ENCRYPTION_KEY = requireEnv("ADMIN_TOTP_ENCRYPTION_KEY");
export const AUDIT_HMAC_KEY = requireEnv("ADMIN_AUDIT_HMAC_KEY");

/** Comma-separated CIDR/IP list; empty string = allowlist disabled (allow all). */
export const IP_ALLOWLIST_RAW = process.env.ADMIN_IP_ALLOWLIST ?? "";

/** Parsed list; empty = disabled. */
export const IP_ALLOWLIST: string[] = IP_ALLOWLIST_RAW
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const STEP_UP_MAX_AGE_MS   = 30 * 60 * 1000;   // 30 min
export const IDLE_MAX_AGE_MS      =  8 * 60 * 60 * 1000; // 8 h
export const SESSION_HARD_MAX_MS  = 24 * 60 * 60 * 1000; // 24 h
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;   // 15 min
export const RATE_LIMIT_MAX_FAILS = 5;
