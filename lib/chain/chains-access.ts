// Who may see the /agent/chains workspace.
//
// Single source of truth for BOTH the server route guard
// (app/agent/chains/page.tsx) and the sidebar nav item
// (components/layout/AgentShell.tsx), so the two never drift apart.
//
// Access = internal staff (admin / sales_progressor / superadmin — this is their
// surface) OR a customer agency user (director / negotiator) who progresses at
// least one live file themselves (hasSelfManagedFiles — the same self-managed
// gate as Enquiries / Reminders; an all-outsourced agency has the SP team run
// their chains, so it stays hidden for them) OR a named agency user on the email
// allowlist below (kept for anyone we grant access ahead of self-managing).
//
// Pure + client-safe: reuses isInternalStaff from lib/chain/permissions.ts, which
// is already imported by client components (ChainDrawer). hasSelfManagedFiles is
// resolved by the caller (layout / page) and passed in, since it needs a DB read.

import { isInternalStaff } from "@/lib/chain/permissions";

// Named agency users granted early access, by lowercased login email.
export const CHAINS_ALLOWLIST_EMAILS = new Set<string>([
  "taylor@akeman-residential.co.uk", // Taylor Kay, director, Akeman Residential (prod)
]);

export function canSeeChains(
  role?: string | null,
  email?: string | null,
  hasSelfManagedFiles = false,
): boolean {
  if (isInternalStaff(role)) return true;
  if ((role === "director" || role === "negotiator") && hasSelfManagedFiles) return true;
  if (email && CHAINS_ALLOWLIST_EMAILS.has(email.trim().toLowerCase())) return true;
  return false;
}
