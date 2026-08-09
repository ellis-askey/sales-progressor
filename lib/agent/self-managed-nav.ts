import { prisma } from "@/lib/prisma";

// Founder rule 2026-08-09: the Reminders (work-queue) and Auto-emails
// pages are self-progression surfaces. They only apply to an agency that
// progresses at least one live file itself — agencies that outsource
// everything have those files chased by the SP team, so they don't need
// the pages (they keep the per-file Reminders tab regardless).
//
// Single source of truth for both the nav visibility (AgentShell via the
// layout) and the page-level access guards (work-queue + automated-emails
// pages) so they can never disagree.
//
//   - Internal staff (admin / sales_progressor / superadmin / viewer):
//     always true — unaffected by this rule.
//   - director:   agency-wide — any active/on-hold self-managed file.
//   - negotiator: their own — an active/on-hold self-managed file assigned
//     to them.
//
// Gated on active/on-hold (not completed/withdrawn) so a file that has
// already closed doesn't unlock an otherwise-empty page.
export async function agencyUserHasSelfManagedFiles(
  role: string,
  userId: string,
  agencyId: string | null,
): Promise<boolean> {
  if (role !== "director" && role !== "negotiator") return true;
  const count = await prisma.propertyTransaction.count({
    where: {
      serviceType: "self_managed",
      status: { in: ["active", "on_hold"] },
      ...(role === "director"
        ? { agencyId: agencyId ?? "__none__" }
        : { agentUserId: userId }),
    },
  });
  return count > 0;
}
