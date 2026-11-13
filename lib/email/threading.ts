// Email threading — agency allowlist gate (ships DARK, for Boardwalk first).
//
// EMAIL_THREADING_AGENCY_IDS is a comma-separated list of DB agency ids. Empty /
// unset (the default) means threading is off for EVERY agency, so nothing
// changes for anyone until the real Boardwalk agency id is added to the env var
// — no code change, no logic redeploy, and an id that matches nothing simply
// never gates anything on.
//
// When OFF for an agency, manual sends behave exactly as before: no Message-ID
// header is stamped and no threading key is stored. When ON, each manual send
// carries a stable RFC Message-ID (header + stored `internetMessageId`) so a
// later email can continue the conversation (Stage 2+).
//
// Gating is by agencyId, never by agency NAME (names are user-editable and
// collide). Internal staff carry agencyId = "" (never a real agency), so they
// are naturally excluded. Pattern mirrors lib/agency-features/migrate-sale.ts.

// Parsed per call. Trim + drop blanks so stray spaces/commas are safe.
export function emailThreadingAgencyIds(): Set<string> {
  const raw = process.env.EMAIL_THREADING_AGENCY_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

// True only when the sale's owning agency is on the allowlist. An empty
// allowlist (default) returns false for everyone.
export function isEmailThreadingEnabled(agencyId: string | null | undefined): boolean {
  if (!agencyId) return false; // "" for internal staff, null/undefined otherwise
  return emailThreadingAgencyIds().has(agencyId);
}
