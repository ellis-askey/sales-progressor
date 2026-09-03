// Async server component for the Reminders tab on the file detail page.
// Fetches the reminder logs + milestone codes (for the completedCodes
// filter) and renders RemindersSection.
//
// The AutomatedEmailsCardAsync preview card was retired here on 2026-09-02
// (chase-consolidation D4): its next-chase view + edit/skip live in the Chase
// timeline tab, its pause pill re-homed to that tab's header, and its
// not-yet-started forecast stays in the full /agent/automated-emails log. The
// card was duplicating the timeline. See docs/active/chase-consolidation/00-spec.md.
//
// Reports the actionable-reminders count up to the tabs strip via
// TabBadgeReporter.

import type { TransactionStatus } from "@prisma/client";
import { getMilestonesCached, getReminderLogsCached } from "@/lib/services/cached-fetchers";
import { countActionable } from "@/lib/reminders/classify";
import { RemindersSection } from "@/components/reminders/RemindersSection";
import { TabBadgeReporter } from "@/components/transaction/TabBadgeReporter";
import type { SolicitorRef } from "@/lib/services/chase-recipients";

type ContactProp = {
  id: string;
  name: string;
  roleType: string;
  email?: string | null;
  phone?: string | null;
  portalToken?: string | null;
  unsubscribedAt?: Date | null;
};

type Props = {
  transactionId: string;
  agencyId: string;
  propertyAddress: string;
  transactionStatus: TransactionStatus;
  contacts: ContactProp[];
  // The file's solicitors, so the chase drawer can offer them as recipients.
  // Resolved from the vendor/purchaser solicitor FK columns on the page.
  vendorSolicitor?: SolicitorRef | null;
  purchaserSolicitor?: SolicitorRef | null;
};

export async function RemindersPanel({
  transactionId,
  agencyId,
  propertyAddress,
  transactionStatus,
  contacts,
  vendorSolicitor = null,
  purchaserSolicitor = null,
}: Props) {
  const [reminderLogs, milestoneData] = await Promise.all([
    getReminderLogsCached(transactionId, agencyId).catch(() => []),
    getMilestonesCached(transactionId, agencyId).catch(() => null),
  ]);

  const completedMilestoneCodes = new Set(
    [...(milestoneData?.vendor ?? []), ...(milestoneData?.purchaser ?? [])]
      .filter((m) => m.isComplete || m.isNotRequired)
      .map((m) => m.code),
  );

  const onHold = transactionStatus === "on_hold";
  const actionableCount = onHold ? 0 : countActionable(reminderLogs, new Date());

  return (
    <div className="space-y-4">
      <TabBadgeReporter tabKey="reminders" count={actionableCount} />
      <RemindersSection
        transactionId={transactionId}
        reminderLogs={reminderLogs}
        contacts={contacts}
        vendorSolicitor={vendorSolicitor}
        purchaserSolicitor={purchaserSolicitor}
        propertyAddress={propertyAddress}
        completedMilestoneCodes={completedMilestoneCodes}
        transactionStatus={transactionStatus}
      />
    </div>
  );
}
