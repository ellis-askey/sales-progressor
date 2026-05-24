import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SendingAddressesSection } from "@/components/verified-emails/SendingAddressesSection";
import { TeamManagement } from "@/components/agent/TeamManagement";
import { ProfileForm } from "@/components/agent/ProfileForm";
import { ThemePicker } from "@/components/agent/ThemePicker";
import { AccountDangerZone } from "@/components/agent/AccountDangerZone";
import { InviteDirector } from "@/components/agent/InviteDirector";
import { EmailNotificationsSection } from "@/components/agent/settings/EmailNotificationsSection";
import { SilencedFilesSection } from "@/components/agent/settings/SilencedFilesSection";
import { MobilePushSection } from "@/components/agent/settings/MobilePushSection";
import { getAgentTheme, getMobileAgentTheme } from "@/lib/agent/themes";
import { getAgencyDirectorStatus } from "@/lib/agency/director-status";
import { getNotificationPrefs } from "@/lib/agent/notification-prefs";

export default async function AgentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const session = await requireSession();
  const { verified } = await searchParams;
  const isDirector = session.user.role === "director";

  const [userRecord, pendingInvitations, notificationPrefs, silencedFilesRaw, pushDevicesRaw] = await Promise.all([
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
    getNotificationPrefs(session.user.id),
    // Scope of the silenced-files surface:
    //   directors -> every self-managed agency file
    //   negotiators -> files they own (assignedUserId OR agentUserId = self)
    // pauseClientEmails server action already enforces the same access scope,
    // so the picker can't silence anything the user shouldn't reach.
    prisma.propertyTransaction.findMany({
      where: {
        serviceType: "self_managed",
        status: { in: ["active", "on_hold"] },
        ...(session.user.agencyId ? { agencyId: session.user.agencyId } : {}),
        ...(isDirector
          ? {}
          : { OR: [{ assignedUserId: session.user.id }, { agentUserId: session.user.id }] }),
      },
      select: {
        id: true,
        propertyAddress: true,
        clientEmailsPaused: true,
        pausedAt: true,
        pausedBy: { select: { name: true } },
      },
      orderBy: { propertyAddress: "asc" },
    }),
    prisma.agentPushSubscription.findMany({
      where: { userId: session.user.id },
      select: { id: true, endpoint: true, userAgent: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const currentTheme = getAgentTheme(userRecord?.agentPreferences);
  const currentMobileTheme = getMobileAgentTheme(userRecord?.agentPreferences);

  const silencedFiles = silencedFilesRaw
    .filter((f) => f.clientEmailsPaused)
    .map((f) => ({
      id: f.id,
      propertyAddress: f.propertyAddress,
      pausedAt: f.pausedAt,
      pausedByName: f.pausedBy?.name ?? null,
    }));
  const silenceableFiles = silencedFilesRaw
    .filter((f) => !f.clientEmailsPaused)
    .map((f) => ({ id: f.id, propertyAddress: f.propertyAddress }));

  // userAgent + lastUsedAt are now persisted (Phase B). The client component
  // parses the UA string into "Chrome on Mac" — pass it raw rather than
  // re-implementing the parser here. Older rows have userAgent=null and fall
  // back to the generic label client-side.
  const pushDevices = pushDevicesRaw.map((d) => ({
    id: d.id,
    endpoint: d.endpoint,
    userAgent: d.userAgent,
    lastUsedAt: d.lastUsedAt,
    createdAt: d.createdAt,
  }));

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

        {/* Email notifications — per-user opt-outs for every automated agent email */}
        <EmailNotificationsSection initialPrefs={notificationPrefs} />

        {/* Silenced files — bulk lens on per-file clientEmailsPaused */}
        <SilencedFilesSection
          initialSilenced={silencedFiles}
          silenceable={silenceableFiles}
        />

        {/* Mobile push notifications — device list + per-event toggles */}
        <MobilePushSection
          initialPrefs={notificationPrefs}
          initialDevices={pushDevices}
        />

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
