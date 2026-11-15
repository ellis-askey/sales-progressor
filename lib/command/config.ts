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

// ADMIN_IP_ALLOWLIST is read and enforced directly in middleware.ts (the edge
// runtime that gates every /command/* request). The previous parsed exports
// here (IP_ALLOWLIST_RAW / IP_ALLOWLIST) were never imported anywhere, so they
// are removed to avoid a second, divergent copy of the allowlist logic. Do not
// re-add a parse here without a consumer — enforcement lives at the edge.

export const STEP_UP_MAX_AGE_MS   = 30 * 60 * 1000;   // 30 min
export const IDLE_MAX_AGE_MS      =  8 * 60 * 60 * 1000; // 8 h
export const SESSION_HARD_MAX_MS  = 24 * 60 * 60 * 1000; // 24 h
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;   // 15 min
export const RATE_LIMIT_MAX_FAILS = 5;
