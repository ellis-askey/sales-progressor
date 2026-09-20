// File-detail — To-Do tab (route segment). Renders only when this tab is open.
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { ToDoPanel } from "@/components/transaction/ToDoPanel";

export const unstable_dynamicStaleTime = 300;

export default async function TodosTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction, isInternalStaff, isProgressor, isAdminRole } = await loadFilePageContext(id);
  return (
    <ToDoPanel
      transactionId={transaction.id}
      transactionAddress={transaction.propertyAddress}
      agencyId={session.user.agencyId}
      serviceType={transaction.serviceType ?? null}
      isInternalStaff={isInternalStaff}
      isProgressor={isProgressor}
      isAdminRole={isAdminRole}
    />
  );
}
