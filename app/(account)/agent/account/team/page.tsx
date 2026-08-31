// app/(account)/agent/account/team/page.tsx
//
// Team tab — Stage 3. Two-branch surface:
//   - Director → full team roster (directors + negotiators + pending
//     negotiator invitations + invite-negotiator inline form)
//   - Negotiator whose agency has no director yet → "Invite your
//     director" (form OR active/expired-invitation card)
//   - Negotiator whose agency already has a director → notFound()
//     (matches the existing /agent/billing director-only posture)
//
// Wiring is identical to the live /agent/settings page:
//   - Director branch: /api/agent/team*, inviteNegotiator,
//     resendNegotiatorInvitation, cancelNegotiatorInvitation
//   - Negotiator branch: inviteDirector, resendInvitation
//
// The legacy page continues to serve both surfaces until Stage 4
// retire — Team now exists in both places by design.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAgencyDirectorStatus } from "@/lib/agency/director-status";
import { TeamManagementPlain } from "@/components/account/v2/TeamManagementPlain";
import { InviteDirectorPlain } from "@/components/account/v2/InviteDirectorPlain";
import { AgencyNameForm } from "@/components/account/v2/AgencyNameForm";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";

export default async function AccountTeamPage() {
  const session = await requireSession();
  const role = session.user.role;
  const agencyId = session.user.agencyId;
  if (!agencyId) notFound();

  // ── Director branch ─────────────────────────────────────────────────
  if (role === "director") {
    const [agency, pendingInvitations] = await Promise.all([
      prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } }),
      prisma.negotiatorInvitation.findMany({
        where: { agencyId, cancelledAt: null, acceptedAt: null },
        select: {
          id: true,
          negotiatorName: true,
          negotiatorEmail: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const HAIRLINE = "0.5px solid rgba(0,0,0,0.08)";

    return (
      <>
        <AccountPageHeader
          title="Agency & team"
          subtitle="Manage your agency details, team members and access."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Agency name editor — director-only */}
        <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Agency name
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              Visible on chase emails, invoices, and the file headers your clients see.
            </p>
          </div>
          <AgencyNameForm initialName={agency?.name ?? ""} />
        </section>

        <div style={{ borderTop: HAIRLINE }} />

        {/* Team management */}
        <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Team
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              Manage your negotiators. Create accounts, control file visibility, and remove access.
            </p>
          </div>
          <TeamManagementPlain
            currentUserId={session.user.id}
            pendingInvitations={pendingInvitations.map((inv) => ({
              ...inv,
              expiresAt: inv.expiresAt.toISOString(),
              createdAt: inv.createdAt.toISOString(),
            }))}
          />
        </section>
        </div>
      </>
    );
  }

  // ── Negotiator branch ───────────────────────────────────────────────
  if (role === "negotiator") {
    const directorStatus = await getAgencyDirectorStatus(agencyId);
    if (directorStatus.hasDirector) notFound();

    const rawLatestInvitation = await prisma.directorInvitation.findFirst({
      where: { agencyId, invitedByUserId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        directorName: true,
        directorEmail: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
      },
    });
    const latestInvitation = rawLatestInvitation
      ? {
          id: rawLatestInvitation.id,
          directorName: rawLatestInvitation.directorName,
          directorEmail: rawLatestInvitation.directorEmail,
          expiresAt: rawLatestInvitation.expiresAt.toISOString(),
          acceptedAt: rawLatestInvitation.acceptedAt?.toISOString() ?? null,
          createdAt: rawLatestInvitation.createdAt.toISOString(),
        }
      : null;

    return (
      <>
        <AccountPageHeader
          title="Team"
          subtitle="Bring your director onto Sales Progressor to unlock the full team view."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
            Invite your director
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Bring your director onto Sales Progressor, they&apos;ll be able to see all of your
            active sales.
          </p>
        </div>
        <InviteDirectorPlain latestInvitation={latestInvitation} />
        </div>
      </>
    );
  }

  // Any other role (internal staff with agencyId — unusual) gets 404.
  notFound();
}
