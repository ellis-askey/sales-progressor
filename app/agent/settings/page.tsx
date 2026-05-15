import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SendingAddressesSection } from "@/components/verified-emails/SendingAddressesSection";
import { TeamManagement } from "@/components/agent/TeamManagement";
import { ProfileForm } from "@/components/agent/ProfileForm";
import { ThemePicker } from "@/components/agent/ThemePicker";
import { AccountDangerZone } from "@/components/agent/AccountDangerZone";
import { InviteDirector } from "@/components/agent/InviteDirector";
import { getAgentTheme, getMobileAgentTheme } from "@/lib/agent/themes";
import { getAgencyDirectorStatus } from "@/lib/agency/director-status";

export default async function AgentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const session = await requireSession();
  const { verified } = await searchParams;
  const isDirector = session.user.role === "director";

  const [userRecord, pendingInvitations] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, agentPreferences: true },
    }),
    isDirector
      ? prisma.negotiatorInvitation.findMany({
          where: { agencyId: session.user.agencyId, cancelledAt: null, acceptedAt: null },
          select: { id: true, negotiatorName: true, negotiatorEmail: true, expiresAt: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const currentTheme = getAgentTheme(userRecord?.agentPreferences);
  const currentMobileTheme = getMobileAgentTheme(userRecord?.agentPreferences);

  const directorStatus = session.user.agencyId
    ? await getAgencyDirectorStatus(session.user.agencyId)
    : { hasDirector: true, director: null };

  const showInviteDirector =
    session.user.role === "negotiator" && !directorStatus.hasDirector;

  const rawLatestInvitation = showInviteDirector
    ? await prisma.directorInvitation.findFirst({
        where: {
          agencyId: session.user.agencyId,
          invitedByUserId: session.user.id,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          directorName: true,
          directorEmail: true,
          expiresAt: true,
          acceptedAt: true,
          createdAt: true,
        },
      })
    : null;

  // Serialise Dates to ISO strings before passing to the Client Component.
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
      <PageHeader title="Settings" subtitle="Manage your account and team preferences." />
      <div className="px-4 md:px-8 py-2 md:py-4 space-y-5">

        {/* Row 1: Profile (left) + Sending addresses (right) */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[58fr_42fr] items-start">

          <div className="glass-card p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-slate-900/80 mb-1">My profile</h2>
              <p className="text-xs text-slate-900/50">Update your name, email and phone number.</p>
            </div>
            <ProfileForm
              initialName={session.user.name ?? ""}
              initialEmail={session.user.email ?? ""}
              initialPhone={userRecord?.phone ?? ""}
              role={session.user.role}
            />
          </div>

          <div className="glass-card p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-slate-900/80 mb-1">Sending addresses</h2>
              <p className="text-xs text-slate-900/50">
                Verify a work email address to send emails to clients directly from the dashboard.
                Emails appear as coming from you — not a generic system address.
              </p>
            </div>
            <SendingAddressesSection initialVerified={verified === "1"} />
          </div>

        </div>

        {/* Invite director — negotiators only, when agency has no director */}
        {showInviteDirector && (
          <InviteDirector latestInvitation={latestInvitation} />
        )}

        {/* Branch theme */}
        <ThemePicker currentTheme={currentTheme} currentMobileTheme={currentMobileTheme} />

        {/* Team — directors only */}
        {isDirector && (
          <div className="glass-card p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-slate-900/80 mb-1">Team</h2>
              <p className="text-xs text-slate-900/50">
                Manage your negotiators. Create accounts, control file visibility, and remove access.
              </p>
            </div>
            <TeamManagement
              currentUserId={session.user.id}
              pendingInvitations={pendingInvitations.map((inv) => ({
                ...inv,
                expiresAt: inv.expiresAt.toISOString(),
                createdAt: inv.createdAt.toISOString(),
              }))}
            />
          </div>
        )}

        {/* Account / danger zone */}
        <AccountDangerZone userEmail={session.user.email ?? ""} />

      </div>
    </>
  );
}
