// Async server component for the Reminders tab on the file detail page.
// Fetches the reminder logs + milestone codes (for the completedCodes
// filter) and renders RemindersSection. The AutomatedEmailsCardAsync
// preview card is mounted below in its own Suspense (already deferred
// before this refactor).
//
// Reports the actionable-reminders count up to the tabs strip via
// TabBadgeReporter.

import type { TransactionStatus } from "@prisma/client";
import { getMilestonesCached, getReminderLogsCached } from "@/lib/services/cached-fetchers";
import { countActionable } from "@/lib/reminders/classify";
import { RemindersSection } from "@/components/reminders/RemindersSection";
import { AutomatedEmailsCardAsync } from "@/components/reminders/AutomatedEmailsCardAsync";
import { TabBadgeReporter } from "@/components/transaction/TabBadgeReporter";

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
};

export async function RemindersPanel({
  transactionId,
  agencyId,
  propertyAddress,
  transactionStatus,
  contacts,
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
      {/* Auto-emails preview pinned to the TOP of the tab. Was previously
        * rendered below RemindersSection (legacy of the streaming
        * refactor); moved up so the next-chase summary is the first
        * thing the agent sees on the tab. Suspense fallback={null}
        * means a brief layout shift when it streams in — small card,
        * worth it for the visual hierarchy. */}
      <AutomatedEmailsCardAsync transactionId={transactionId} fileOnHold={onHold} />
      <RemindersSection
        transactionId={transactionId}
        reminderLogs={reminderLogs}
        contacts={contacts}
        propertyAddress={propertyAddress}
        completedMilestoneCodes={completedMilestoneCodes}
        transactionStatus={transactionStatus}
      />
    </div>
  );
}
