"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { agencyUserHasSelfManagedFiles } from "@/lib/agent/self-managed-nav";
import { computeNavBadgeCounts, type NavBadgeCounts } from "@/lib/agent/nav-badges";

// Refetched by AgentShell on client-side navigation so the nav "needs attention"
// badges stay live — the server layout only recomputes them on a hard load or
// an explicit refresh.
export async function getNavBadgeCountsAction(): Promise<NavBadgeCounts | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const hasSelfManagedFiles = await agencyUserHasSelfManagedFiles(
    session.user.role,
    session.user.id,
    session.user.agencyId,
  );
  return computeNavBadgeCounts(session, hasSelfManagedFiles);
}
