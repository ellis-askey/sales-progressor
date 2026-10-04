// app/(business-settings)/layout.tsx
//
// Layout for an external progression-business owner's settings area. Separate
// route group (own layout branch) so it does NOT inherit the agency account
// layout (app/(account)/layout.tsx) or the main agent shell — the agency's
// settings code is never touched, honouring "nothing changes for agencies".
//
// Reuses AccountShell in its "business" variant (business nav + "Owner" caption).
// Owner-gated here once for the whole area: flag + resolveBusinessOwner, the same
// gate the Clients and Team pages use. Pages below also resolve the owner for
// their businessId (defence in depth).
//
// File-tree: pages live at app/(business-settings)/agent/settings/<tab>/page.tsx.
// URLs: /agent/settings/<tab>.

import { notFound } from "next/navigation";
import { resolveAgentSession } from "@/lib/agent-session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessMember } from "@/lib/services/progression-clients";
import { prisma } from "@/lib/prisma";
import { AccountShell } from "@/components/account/chrome/AccountShell";
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";

export default async function BusinessSettingsLayout({ children }: { children: React.ReactNode }) {
  if (!progressionBusinessesEnabled()) notFound();

  const { role, theme, session } = await resolveAgentSession();
  // Admit team members too (not just the owner). Owner-only pages (Business,
  // Emails, Team, Billing) still 404 for a member via their own resolveBusinessOwner
  // guard, and the nav hides those tabs (isOwner below).
  const member = await resolveBusinessMember(session);
  if (!member) notFound();

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true, name: true },
  });
  const displayName = userRecord?.name ?? session.user.name ?? "You";

  return (
    <AccountShell
      role={role}
      agencyHasDirector={true}
      displayName={displayName}
      image={userRecord?.image ?? null}
      theme={theme}
      variant="business"
      roleLabel={member.isOwner ? "Business owner" : "Team member"}
      isOwner={member.isOwner}
    >
      {children}
    </AccountShell>
  );
}
