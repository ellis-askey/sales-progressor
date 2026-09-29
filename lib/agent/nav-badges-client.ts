// Client helper for the agent-app nav "needs attention" badges.
//
// The badges refetch on client navigation, but a count also needs to drop the
// moment you clear the work WITHOUT leaving the page (e.g. marking the last
// "needs you" reminder done while sitting on the reminders page). Resolve
// handlers fire refreshNavBadges() after their action resolves; AgentShell
// listens for this event and refetches getNavBadgeCountsAction immediately —
// much faster than a full router.refresh of the route. (critique #11, 2026-09-29)

export const NAV_BADGES_REFRESH_EVENT = "nav-badges:refresh";

export function refreshNavBadges(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NAV_BADGES_REFRESH_EVENT));
  }
}
