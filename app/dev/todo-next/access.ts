import "server-only";

// Founder-only gate for the isolated /dev/todo-next workspace.
//
// This is deliberately NARROWER than `hasSuperAdminPowers` — it admits ONLY the
// founder's own account, not every superadmin. Enforced server-side in both the
// route layout and the page's data fetch. If your TSP login email is not the one
// below, tell me and I'll switch this to your exact user id (session.user.id).
const FOUNDER_EMAILS = ["ellis@thesalesprogressor.co.uk"];

export function isFounder(session: { user?: { email?: string | null } } | null | undefined): boolean {
  const email = session?.user?.email?.toLowerCase().trim();
  return !!email && FOUNDER_EMAILS.includes(email);
}
