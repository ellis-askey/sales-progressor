// Who may connect/use their own email mailbox (Outlook + IMAP) from the agent app:
//   - agency users (director / negotiator), and
//   - external progression-business members (owner or team).
// TSP internal staff (admin / TSP sales_progressor with no business) manage mail
// from the Command Centre, not here. progressionBusinessId is non-null ONLY for an
// external business (TSP members are null), so that check cleanly excludes TSP.
//
// Edge-safe: no imports, just reads user.{role, progressionBusinessId}. Used by
// every /api/integrations/{outlook,imap}/* route and by the sync cron.

export function canUseAgentMailbox(user: {
  role?: string | null;
  progressionBusinessId?: string | null;
}): boolean {
  if (user.role === "director" || user.role === "negotiator") return true;
  if (user.role === "sales_progressor" && user.progressionBusinessId) return true;
  return false;
}
