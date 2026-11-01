// Migrate Sale — agency allowlist gate (feature for Boardwalk Property Co).
//
// Ships DARK: MIGRATE_SALE_AGENCY_IDS is a comma-separated list of DB agency
// ids. Empty / unset (the default) means the feature is off for EVERY agency,
// so nothing is exposed until the real Boardwalk agency id is added to the env
// var — no code change, no redeploy of logic, and no risk if the agency does
// not exist yet (an id that matches nothing simply never gates anything on).
//
// This is the SINGLE gate shared by the nav entry, the page, and every server
// endpoint, so they can never drift. Pattern mirrors lib/command/config.ts
// (ADMIN_IP_ALLOWLIST) + lib/progression/flags.ts ("ships dark").
//
// Gating is by agencyId, never by agency NAME (names are user-editable and
// collide). Internal staff carry agencyId = "" (empty string, never a real
// agency — see lib/security/access-scope.ts), so they are naturally excluded.

import type { Session } from "next-auth";

// Parsed once per process. Trim + drop blanks so stray spaces/commas are safe.
export function migrateSaleAgencyIds(): Set<string> {
  const raw = process.env.MIGRATE_SALE_AGENCY_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

// True only for a signed-in user whose own agency is on the allowlist.
// An empty allowlist (default) returns false for everyone.
export function canMigrateSale(session: Session | null | undefined): boolean {
  const agencyId = session?.user?.agencyId;
  if (!agencyId) return false; // "" for internal staff, undefined when unauthenticated
  return migrateSaleAgencyIds().has(agencyId);
}
