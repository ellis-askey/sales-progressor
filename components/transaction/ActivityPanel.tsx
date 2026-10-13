// Async server component for the Activity tab on the file detail page.
// Fetches the activity timeline + MOS document signed URL (chained,
// since the URL needs the doc record) and renders the ActivityTab.

import { getActivityTimelineCached } from "@/lib/services/cached-fetchers";
import { prisma } from "@/lib/prisma";
import { ActivityTab } from "@/components/activity/ActivityTab";

type ContactProp = {
  id: string;
  name: string;
  roleType: string;
  email?: string | null;
  phone?: string | null;
};

type SolicitorContact = {
  id: string;
  name: string;
  phone?: string | null;
};

type Props = {
  transactionId: string;
  agencyId: string;
  isInternalStaff: boolean;
  isProgressor: boolean;
  isAdminRole: boolean;
  // True for a progression-business member — enables the note composer's
  // "Private to my team" option.
  canMarkPrivate: boolean;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  contacts: ContactProp[];
  vendorSolicitor: SolicitorContact | null;
  purchaserSolicitor: SolicitorContact | null;
};

export async function ActivityPanel({
  transactionId,
  agencyId,
  isInternalStaff,
  isProgressor,
  isAdminRole,
  canMarkPrivate,
  currentUserId,
  currentUserName,
  currentUserRole,
  contacts,
  vendorSolicitor,
  purchaserSolicitor,
}: Props) {
  // MOS doc + signed URL chain. Same shape as the page used to do,
  // just relocated into the panel that consumes it.
  const [activityEntries, mosDocBundle, me, emailConn] = await Promise.all([
    getActivityTimelineCached(transactionId, agencyId).catch(() => []),
    (async () => {
      const doc = await prisma.transactionDocument.findFirst({
        where: { transactionId, source: "mos" },
        select: { storagePath: true },
        orderBy: { createdAt: "asc" },
      }).catch(() => null);
      if (!doc) return null;
      const { getSignedUrl } = await import("@/lib/supabase-storage");
      const url = await getSignedUrl(doc.storagePath, 86400).catch(() => null);
      return url;
    })(),
    // Current user's avatar — session doesn't carry it, so the optimistic
    // note render can show the real picture instead of the fallback SVG.
    prisma.user.findUnique({ where: { id: currentUserId }, select: { image: true } }).catch(() => null),
    // Mailbox connected? Then sent email is ingested automatically, so the
    // manual "Log an email" option is hidden in the composer.
    prisma.imapConnection.findFirst({ where: { userId: currentUserId }, select: { id: true } }).catch(() => null),
  ]);

  return (
    <div className="space-y-4">
      <ActivityTab
        entries={activityEntries}
        transactionId={transactionId}
        mosDocUrl={mosDocBundle}
        currentUserId={isProgressor ? currentUserId : undefined}
        contacts={contacts}
        solicitors={[
          ...(vendorSolicitor ? [{ id: vendorSolicitor.id, name: vendorSolicitor.name, role: "Vendor solicitor", phone: vendorSolicitor.phone ?? null }] : []),
          ...(purchaserSolicitor ? [{ id: purchaserSolicitor.id, name: purchaserSolicitor.name, role: "Purchaser solicitor", phone: purchaserSolicitor.phone ?? null }] : []),
        ]}
        canPasteChat={isProgressor || isAdminRole}
        emailConnected={!!emailConn}
        canMarkPrivate={canMarkPrivate}
        currentUserName={currentUserName}
        currentUserImage={me?.image ?? null}
        currentUserRole={currentUserRole}
      />
      {/* isInternalStaff fed for future use; currently parallel to ActivityTab's
        * own surface guards. Kept in the props shape to mirror the page's
        * historical role-flag set. */}
      {isInternalStaff ? null : null}
    </div>
  );
}
