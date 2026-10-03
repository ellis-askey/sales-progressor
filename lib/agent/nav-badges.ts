// Shared computation for the agent-app nav "needs attention" badge counts.
// Used by the server layout (first paint) and by getNavBadgeCountsAction (the
// client refetch on navigation, so the numbers stay live). Every count is a
// "your move" figure — things sitting in your court right now — never a raw
// total of what's in a section.

import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import { getAccessScope } from "@/lib/security/access-scope";
import { canSeeChains } from "@/lib/chain/chains-access";
import { countAgentDueOrOverdue } from "@/lib/services/manual-tasks";
import { countReviewsDue } from "@/lib/services/reviews";
import { countEscalatedEnquiries } from "@/lib/services/enquiries";
import { countChainsNeedsSetup } from "@/lib/services/chains";
import { countCompletionsToday, resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { getHubAttentionItems } from "@/lib/services/hub";

export type NavBadgeCounts = { todo: number; enquiries: number; reminders: number; chains: number; completions: number };

export async function computeNavBadgeCounts(session: Session, hasSelfManagedFiles: boolean): Promise<NavBadgeCounts> {
  const role = session.user.role as UserRole;
  const scope = getAccessScope(session);
  const isAgencyUser = role === "director" || role === "negotiator";
  const showSelfPages = isAgencyUser ? hasSelfManagedFiles : true;
  const isInternal = role === "admin" || role === "sales_progressor" || role === "superadmin";
  const isAdmin = role === "admin" || role === "superadmin";

  const vis = isInternal
    ? resolveInternalVisibility(session.user.id, role, isAdmin, session.user.progressionBusinessId)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const [todoBase, reviews, enquiries, chains, completions, reminders] = await Promise.all([
    role === "admin" ? Promise.resolve(0) : countAgentDueOrOverdue(session.user.id, session.user.agencyId, role, scope),
    role === "admin" ? Promise.resolve(0) : countReviewsDue(scope).catch(() => 0),
    showSelfPages ? countEscalatedEnquiries(scope).catch(() => 0) : Promise.resolve(0),
    canSeeChains(role, session.user.email, hasSelfManagedFiles) ? countChainsNeedsSetup(scope).catch(() => 0) : Promise.resolve(0),
    countCompletionsToday(vis).catch(() => 0),
    // The "Reminders" badge links to the Reminders page, which shows reminders
    // only. getHubAttentionItems also carries synthetic "exchange date passed"
    // items (id "xovr-<txId>") that belong on the Hub's own "Exchange dates
    // passed" section, not a reminder — counting them made the badge disagree
    // with the page (critique 2026-10-01). Count reminder-backed items only.
    role !== "admin" && showSelfPages
      ? getHubAttentionItems(vis).then((a) => a.filter((i) => !i.id.startsWith("xovr-")).length).catch(() => 0)
      : Promise.resolve(0),
  ]);

  return { todo: todoBase + reviews, enquiries, reminders, chains, completions };
}
