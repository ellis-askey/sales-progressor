import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAgentMilestoneActivity, resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";

// Bell feed = the same "completed step" activity shown on the Updates page
// (/agent/comms), scoped through the canonical visibility resolver so every
// role sees the right files:
//   director / negotiator → their agency's files
//   sales_progressor      → their assigned files
//   admin / superadmin     → all files
//
// Returns the latest items for the dropdown menu + a count of how many are
// newer than the caller's last-read timestamp (the `after` param) for the
// unread badge. Rewritten 2026-08-09: was a bare count keyed on raw agencyId,
// which was wrong for internal staff (agencyId = null).

const MENU_LIMIT = 12;

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const after = req.nextUrl.searchParams.get("after");
  const since = after ? new Date(after) : new Date(0);

  const role = session.user.role;
  const isInternalStaff = role === "admin" || role === "sales_progressor" || role === "viewer";
  const isAdmin = hasAdminPowers(session);
  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, role, isAdmin)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const milestones = await getAgentMilestoneActivity(vis, false);

  // Newest first.
  const sorted = [...milestones].sort(
    (a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime(),
  );

  const items = sorted.slice(0, MENU_LIMIT).map((m) => ({
    id: m.id,
    txId: m.transaction.id,
    address: m.transaction.propertyAddress,
    milestoneName: m.milestoneDefinition.name,
    side: m.milestoneDefinition.side,
    confirmedByPortal: m.confirmedByPortal,
    at: (m.completedAt ?? new Date()).toISOString(),
  }));

  // Unread = everything newer than the last-read stamp (across the full set,
  // not just the menu slice, so the badge is accurate even past 12).
  const count = sorted.filter((m) => new Date(m.completedAt ?? 0) > since).length;

  return NextResponse.json({ count, items });
}
