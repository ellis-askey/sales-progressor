// /agent/settings/notifications — the owner's own email + push notification
// preferences (both per-user, reused from the agency Notifications tab).
//
// The agency tab also has a "silenced files" section, but that is scoped to
// self-managed agency files (serviceType self_managed + agencyId) — a concept
// that doesn't apply to a progression business, whose files are outsourced and
// live under its client agencies. Per-file email silencing for a business would
// need a business-scoped picker; deferred (noted in EXTERNAL_SP_BACKLOG). So this
// page is email + push only.

import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { prisma } from "@/lib/prisma";
import { getNotificationPrefs } from "@/lib/agent/notification-prefs";
import { EmailNotificationsSectionPlain } from "@/components/account/v2/EmailNotificationsSectionPlain";
import { MobilePushSection } from "@/components/agent/settings/MobilePushSection";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";

export default async function BusinessNotificationsPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const [notificationPrefs, pushDevicesRaw] = await Promise.all([
    getNotificationPrefs(session.user.id),
    prisma.agentPushSubscription.findMany({
      where: { userId: session.user.id },
      select: { id: true, endpoint: true, userAgent: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pushDevices = pushDevicesRaw.map((d) => ({
    id: d.id, endpoint: d.endpoint, userAgent: d.userAgent, lastUsedAt: d.lastUsedAt, createdAt: d.createdAt,
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
      </div>
    </>
  );
}
