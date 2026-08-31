// app/(account)/layout.tsx
//
// Layout for the Account area. Route-group escape (lives at the app root) so
// pages under it don't inherit app/agent/layout.tsx + AgentShell. Redesign
// (2026-08-31): the shell mirrors the agent shell's shape — a fixed sidebar
// with the Sales Progressor logo at the top, the Account nav in the middle
// (agent-rail interaction), and the signed-in user at the bottom. On tablet /
// mobile the sidebar becomes an off-canvas drawer opened from a slim top bar.
// The chrome lives in AccountShell (a client component, for the drawer state);
// this layout just resolves the session + user and renders the page as its
// children.
//
// File-tree: pages live at app/(account)/agent/account/<tab>/page.tsx.
// URLs: /agent/account/<tab>. Layout inheritance: app/layout.tsx + this.

import { resolveAgentSession } from "@/lib/agent-session";
import { getAgencyDirectorStatus } from "@/lib/agency/director-status";
import { prisma } from "@/lib/prisma";
import { AccountShell } from "@/components/account/chrome/AccountShell";
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { role, theme, session } = await resolveAgentSession();

  // Negotiators need this so the nav can hide/show the Team tab.
  let agencyHasDirector = true;
  if (role === "negotiator" && session.user.agencyId) {
    const ds = await getAgencyDirectorStatus(session.user.agencyId);
    agencyHasDirector = ds.hasDirector;
  }

  // Avatar for the sidebar user chip (falls back to initials).
  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true, name: true },
  });
  const displayName = userRecord?.name ?? session.user.name ?? "You";

  return (
    <AccountShell
      role={role}
      agencyHasDirector={agencyHasDirector}
      displayName={displayName}
      image={userRecord?.image ?? null}
      theme={theme}
    >
      {children}
    </AccountShell>
  );
}
