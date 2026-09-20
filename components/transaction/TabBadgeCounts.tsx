// Streams the Reminders + To-Do tab badge counts into the tab bar without
// blocking the file's first paint.
//
// 2026-09-20 (Layer 1): tab panels are now separate route segments that only
// render when their tab is visited, so their in-panel TabBadgeReporter no
// longer fires on open — the counts would sit at 0 until you clicked the tab.
// The layout mounts this tiny async loader under <Suspense> instead: it does
// only the two cheap count queries and pushes the numbers up through the same
// TabBadgeReporter bridge, a beat after the shell paints.

import type { TransactionStatus } from "@prisma/client";
import { getReminderLogsCached, listManualTasksCached } from "@/lib/services/cached-fetchers";
import { countActionable } from "@/lib/reminders/classify";
import { TabBadgeReporter } from "@/components/transaction/TabBadgeReporter";

type Props = {
  transactionId: string;
  agencyId: string;
  transactionStatus: TransactionStatus;
  isInternalStaff: boolean;
};

export async function TabBadgeCounts({ transactionId, agencyId, transactionStatus, isInternalStaff }: Props) {
  const [reminderLogs, manualTasks] = await Promise.all([
    getReminderLogsCached(transactionId, agencyId).catch(() => []),
    listManualTasksCached(transactionId, agencyId).catch(() => []),
  ]);

  const remindersCount = transactionStatus === "on_hold" ? 0 : countActionable(reminderLogs, new Date());
  const todosCount = isInternalStaff
    ? manualTasks.filter((t) => t.status === "open" && t.isAgentRequest).length
    : manualTasks.filter((t) => t.status === "open").length;

  return (
    <>
      <TabBadgeReporter tabKey="reminders" count={remindersCount} />
      <TabBadgeReporter tabKey="todos" count={todosCount} />
    </>
  );
}
