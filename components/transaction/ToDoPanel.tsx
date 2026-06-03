// Async server component for the To-Do tab on the file detail page.
// Fetches the manual-task lists this tab needs and renders the
// existing ManualTaskList. Mounted under <Suspense> by the page shell
// so the rest of the page can paint without waiting on these queries.
//
// The badge count (open todos) is reported up to the tabs strip via
// the TabBadgeContext bridge — see TabBadgeReporter for the wire-up.

import { listManualTasksCached, listInternalSelfAssignedCached } from "@/lib/services/cached-fetchers";
import { ManualTaskList } from "@/components/todos/ManualTaskList";
import { TabBadgeReporter } from "@/components/transaction/TabBadgeReporter";

type Props = {
  transactionId: string;
  transactionAddress: string;
  agencyId: string;
  serviceType: "self_managed" | "outsourced" | null;
  isInternalStaff: boolean;
  isProgressor: boolean;
  isAdminRole: boolean;
};

export async function ToDoPanel({
  transactionId,
  transactionAddress,
  agencyId,
  serviceType,
  isInternalStaff,
  isProgressor,
  isAdminRole,
}: Props) {
  const [manualTasks, internalManualTasks] = await Promise.all([
    listManualTasksCached(transactionId, agencyId).catch(() => []),
    isInternalStaff
      ? listInternalSelfAssignedCached(transactionId).catch(() => [])
      : Promise.resolve([] as Awaited<ReturnType<typeof listInternalSelfAssignedCached>>),
  ]);

  const openTodoCount = isInternalStaff
    ? manualTasks.filter((t) => t.status === "open" && t.isAgentRequest).length
    : manualTasks.filter((t) => t.status === "open").length;

  return (
    <>
      <TabBadgeReporter tabKey="todos" count={openTodoCount} />
      <ManualTaskList
        initialTasks={manualTasks}
        initialInternalTasks={internalManualTasks}
        transactionId={transactionId}
        transactionAddress={transactionAddress}
        showDone
        showOwnership={serviceType === "outsourced" && !isProgressor && !isAdminRole}
        perspective={isInternalStaff ? "progressor" : "agent"}
      />
    </>
  );
}
