// Shared server context for the agent file-detail surface.
//
// 2026-09-20 perf (Layer 1 of the file-page load overhaul): the file page was
// one monolithic route that rendered EVERY tab's async server component on open,
// firing ~9 tab queries + sidebar + Overview at once and saturating the DB
// connection pool. It's now a shared layout (the shell) + one route segment per
// tab, so opening a file only renders Overview and other tabs load on click.
//
// The shell layout and every tab segment need the same trunk: the session, the
// access-scoped transaction, and the role flags derived from them. This helper
// resolves that trunk once. It's wrapped in React.cache so the layout and the
// active tab's page — which render in the SAME request on a cold load — share a
// single execution (and a single transaction query). On a soft tab navigation
// only the new segment renders, so it re-resolves the trunk for that request
// alone: one transaction query instead of the old eleven.

import { cache } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAccessScope } from "@/lib/security/access-scope";
import { getTransactionCached, getTransactionByScopeCached } from "@/lib/services/cached-fetchers";

type FileTransaction = NonNullable<Awaited<ReturnType<typeof getTransactionCached>>>;
type FileSession = Awaited<ReturnType<typeof requireSession>>;

export type FilePageContext = {
  session: FileSession;
  transaction: FileTransaction;
  agencyId: string | null;
  isInternalStaff: boolean;
  isProgressor: boolean;
  isAdminRole: boolean;
  isEllis: boolean;
  isInternalTeam: boolean;
  isDirectorRole: boolean;
  isAgentRole: boolean;
};

// Resolve the session + access-scoped transaction + role flags for a file.
// Calls notFound() when the file doesn't exist or the viewer can't see it —
// exactly the guards the old page.tsx applied inline, now in one place.
export const loadFilePageContext = cache(async (id: string): Promise<FilePageContext> => {
  const session = await requireSession();

  const isInternalStaff =
    session.user.role === "admin" ||
    session.user.role === "sales_progressor" ||
    session.user.role === "viewer";
  const isProgressor = session.user.role === "sales_progressor";
  const isAdminRole = hasAdminPowers(session);
  const isEllis = session.user.email === "ellis@thesalesprogressor.co.uk";
  const isInternalTeam = isInternalStaff || session.user.role === "superadmin";
  const txScope = isInternalStaff ? getAccessScope(session) : null;

  const transaction = isInternalStaff
    ? await getTransactionByScopeCached(id, txScope!)
    : await getTransactionCached(id, session.user.agencyId);

  if (!transaction) notFound();

  const isDirectorRole = session.user.role === "director";
  const isAgentRole = isDirectorRole || session.user.role === "negotiator";
  // Agent ownership: director sees all agency files; negotiator only their own.
  // Internal staff are already scoped by getTransactionByScope above.
  if (!isInternalStaff && !isDirectorRole && transaction.agentUserId !== session.user.id) notFound();

  return {
    session,
    transaction,
    agencyId: session.user.agencyId,
    isInternalStaff,
    isProgressor,
    isAdminRole,
    isEllis,
    isInternalTeam,
    isDirectorRole,
    isAgentRole,
  };
});
