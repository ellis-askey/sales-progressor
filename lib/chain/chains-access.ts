// Who may see the /agent/chains workspace during the controlled rollout.
//
// Single source of truth for BOTH the server route guard
// (app/agent/chains/page.tsx) and the sidebar nav item
// (components/layout/AgentShell.tsx), so the two never drift apart.
//
// Access = internal staff (admin / sales_progressor / superadmin — this is their
// surface) OR a named agency user on the email allowlist below. We key the
// allowlist on login email, not user/agency id, because email is stable across
// staging and prod whereas ids differ per environment.
//
// Pure + client-safe: reuses isInternalStaff from lib/chain/permissions.ts, which
// is already imported by client components (ChainDrawer).

import { isInternalStaff } from "@/lib/chain/permissions";

// Named agency users granted early access, by lowercased login email.
export const CHAINS_ALLOWLIST_EMAILS = new Set<string>([
  "taylor@akeman-residential.co.uk", // Taylor Kay, director, Akeman Residential (prod)
]);

export function canSeeChains(role?: string | null, email?: string | null): boolean {
  if (isInternalStaff(role)) return true;
  if (email && CHAINS_ALLOWLIST_EMAILS.has(email.trim().toLowerCase())) return true;
  return false;
}
