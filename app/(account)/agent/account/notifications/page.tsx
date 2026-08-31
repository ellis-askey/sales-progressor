// app/(account)/agent/account/notifications/page.tsx
//
// Notifications tab — Stage 4. Both roles. Three sections, all
// re-housed from the legacy /agent/settings page with wiring preserved:
//
//   1. Email notifications        — EmailNotificationsSectionPlain
//                                    (clone of EmailNotificationsSection)
//   2. Mobile push notifications  — MobilePushSection reused AS-IS
//                                    (heavy iOS-PWA detection + state
//                                    machine; "don't restructure" per
//                                    Stage 4 brief)
//   3. Silenced files             — SilencedFilesSectionPlain (clone of
//                                    SilencedFilesSection). Homed here
//                                    per the Stage 0 inventory decision
//                                    — same mental model as the email
//                                    and push prefs (suppressing
//                                    automated outbound emails).
//
// Silenced-files query is role-scoped exactly the way the legacy page
// scopes it: directors see every self-managed agency file; negotiators
// see only files they own (assignedUserId OR agentUserId = self). The
// pauseClientEmails / resumeClientEmails server actions enforce the
// same scope server-side, so the picker can't silence anything the
// viewer shouldn't reach.
//
// The legacy /agent/settings page continues to render all three
// sections identically — Stage 4 is copy-into-Account, not move-out.
// Stage 5 retires the old surface.

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getNotificationPrefs } from "@/lib/agent/notification-prefs";
import { EmailNotificationsSectionPlain } from "@/components/account/v2/EmailNotificationsSectionPlain";
import { SilencedFilesSectionPlain } from "@/components/account/v2/SilencedFilesSectionPlain";
import { MobilePushSection } from "@/components/agent/settings/MobilePushSection";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";

export default async function AccountNotificationsPage() {
  const session = await requireSession();
  const isDirector = session.user.role === "director";

  const [notificationPrefs, silencedFilesRaw, pushDevicesRaw] = await Promise.all([
    getNotificationPrefs(session.user.id),
    // Same role-scoping as the legacy /agent/settings page (verbatim):
    //   directors → every self-managed file in their agency
    //   negotiators → files they own (assignedUserId OR agentUserId = self)
    // pauseClientEmails / resumeClientEmails server actions enforce the
    // same access scope, so the picker can't silence anything the user
    // shouldn't reach.
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
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

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

  const pushDevices = pushDevicesRaw.map((d) => ({
    id: d.id,
    endpoint: d.endpoint,
    userAgent: d.userAgent,
    lastUsedAt: d.lastUsedAt,
    createdAt: d.createdAt,
  }));

  return (
    <>
      <AccountPageHeader
        title="Notifications"
        subtitle="Choose how and when Sales Progressor gets your attention."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <EmailNotificationsSectionPlain initialPrefs={notificationPrefs} />
        <MobilePushSection initialPrefs={notificationPrefs} initialDevices={pushDevices} />
        <SilencedFilesSectionPlain
          initialSilenced={silencedFiles}
          silenceable={silenceableFiles}
        />
      </div>
    </>
  );
}
