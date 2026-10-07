// /agent/settings/notifications — the member's own email + push notification
// preferences (both per-user) plus the silenced-files picker (audit P3), so a
// business can mute the automated client emails on a specific sale — the same
// capability an agency has on its own files.
//
// The file list is business-scoped via getAccessScope → scopeTransactionWhere
// (owner/see-all → the whole business book; see-own → their assigned files), which
// is exactly the reachability pauseClientEmails / resumeClientEmails enforce
// server-side, so the picker can't silence anything the viewer can't act on.

import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessMember } from "@/lib/services/progression-clients";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { getNotificationPrefs } from "@/lib/agent/notification-prefs";
import { EmailNotificationsSectionPlain } from "@/components/account/v2/EmailNotificationsSectionPlain";
import { SilencedFilesSectionPlain } from "@/components/account/v2/SilencedFilesSectionPlain";
import { MobilePushSection } from "@/components/agent/settings/MobilePushSection";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";

export default async function BusinessNotificationsPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const member = await resolveBusinessMember(session);
  if (!member) notFound();

  const scope = getAccessScope(session);
  const [notificationPrefs, silencedFilesRaw, pushDevicesRaw] = await Promise.all([
    getNotificationPrefs(session.user.id),
    prisma.propertyTransaction.findMany({
      where: { ...scopeTransactionWhere(scope), status: { in: ["active", "on_hold"] } },
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

  const silencedFiles = silencedFilesRaw
    .filter((f) => f.clientEmailsPaused)
    .map((f) => ({ id: f.id, propertyAddress: f.propertyAddress, pausedAt: f.pausedAt, pausedByName: f.pausedBy?.name ?? null }));
  const silenceableFiles = silencedFilesRaw
    .filter((f) => !f.clientEmailsPaused)
    .map((f) => ({ id: f.id, propertyAddress: f.propertyAddress }));

  const pushDevices = pushDevicesRaw.map((d) => ({
    id: d.id, endpoint: d.endpoint, userAgent: d.userAgent, lastUsedAt: d.lastUsedAt, createdAt: d.createdAt,
  }));

  return (
    <>
      <AccountPageHeader
        title="Notifications"
        subtitle="Choose how and when Sales Progressor notifies you."
        backLabel="Back to progression"
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
