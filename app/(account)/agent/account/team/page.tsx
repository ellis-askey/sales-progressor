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
import { JoinRequestsPlain } from "@/components/account/v2/JoinRequestsPlain";
import { listPendingJoinRequests } from "@/lib/services/agency-join-requests";
import { InviteDirectorPlain } from "@/components/account/v2/InviteDirectorPlain";
import { AgencyNameForm } from "@/components/account/v2/AgencyNameForm";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { TeamListViewPlain } from "@/components/account/v2/TeamListViewPlain";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import { UserPlus, UsersThree } from "@phosphor-icons/react/dist/ssr";

export default async function AccountTeamPage() {
  const session = await requireSession();
  const role = session.user.role;
  const agencyId = session.user.agencyId;
  if (!agencyId) notFound();

  // ── Director branch ─────────────────────────────────────────────────
  if (role === "director") {
    const [agency, negotiatorInvitations, directorInvitations, joinRequests] = await Promise.all([
      prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true, logoPath: true, logoTileColor: true } }),
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
      prisma.directorInvitation.findMany({
        where: { agencyId, cancelledAt: null, acceptedAt: null },
        select: {
          id: true,
          directorName: true,
          directorEmail: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      listPendingJoinRequests(agencyId),
    ]);

    // Both invitation types render in one pending list, tagged by role so the
    // row can show the right badge and route resend/cancel to the right action.
    const pendingInvitations = [
      ...directorInvitations.map((inv) => ({
        id: inv.id,
        name: inv.directorName,
        email: inv.directorEmail,
        role: "director" as const,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
      ...negotiatorInvitations.map((inv) => ({
        id: inv.id,
        name: inv.negotiatorName,
        email: inv.negotiatorEmail,
        role: "negotiator" as const,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return (
      <>
        <AccountPageHeader
          title="Agency & team"
          subtitle="Manage your agency details, team members and access."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <AgencyNameForm
            initialName={agency?.name ?? ""}
            initialLogoUrl={getAgencyLogoUrl(agency?.logoPath)}
            initialTileColor={agency?.logoTileColor ?? null}
          />
          {joinRequests.length > 0 && (
            <JoinRequestsPlain
              requests={joinRequests.map((r) => ({
                id: r.id,
                requesterName: r.requesterName,
                requesterEmail: r.requesterEmail,
                requestedRole: r.requestedRole === "director" ? "director" : "negotiator",
                createdAt: r.createdAt.toISOString(),
              }))}
            />
          )}
          <TeamManagementPlain
            currentUserId={session.user.id}
            pendingInvitations={pendingInvitations}
          />
        </div>
      </>
    );
  }

  // ── Negotiator branch ───────────────────────────────────────────────
  if (role === "negotiator") {
    const directorStatus = await getAgencyDirectorStatus(agencyId);

    // Agency already has a director → read-only team roster. The negotiator sees
    // everyone on their team (photos, emails, job title, mobile) but gets none of
    // the management controls — that stays with directors.
    if (directorStatus.hasDirector) {
      const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { firmName: true } });
      const members = await prisma.user.findMany({
        where: { agencyId, role: { in: ["director", "negotiator"] }, ...(me?.firmName ? { firmName: me.firmName } : {}) },
        select: {
          id: true, name: true, email: true, role: true, canViewAllFiles: true,
          image: true, imageFocusX: true, imageFocusY: true, jobTitle: true, directMobile: true,
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      });
      const directors = members.filter((m) => m.role === "director");
      const negotiators = members.filter((m) => m.role === "negotiator");

      return (
        <>
          <AccountPageHeader title="Your team" subtitle="Everyone you work with at your agency." />
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <AccountCard
              icon={<UsersThree size={18} weight="bold" />}
              title="Your team"
              subtitle="View only. Your director manages who's on the team and what they can see."
            >
              <TeamListViewPlain directors={directors} negotiators={negotiators} currentUserId={session.user.id} readOnly />
            </AccountCard>
          </div>
        </>
      );
    }

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
          subtitle="Bring your director onto Sales Progressor to unlock your full team view."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <AccountCard
            icon={<UserPlus size={18} weight="bold" />}
            title="Invite your director"
            subtitle="Invite your director to Sales Progressor so they can see all of your active sales."
          >
            <InviteDirectorPlain latestInvitation={latestInvitation} />
          </AccountCard>
        </div>
      </>
    );
  }

  // Any other role (internal staff with agencyId — unusual) gets 404.
  notFound();
}
