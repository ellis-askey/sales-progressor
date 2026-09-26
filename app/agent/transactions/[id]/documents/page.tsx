// File-detail — Documents tab (route segment). Renders only when this tab is open.
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { DocumentsPanel } from "@/components/transaction/DocumentsPanel";
import { TabEnter } from "@/components/transaction/TabEnter";

export const unstable_dynamicStaleTime = 300;

export default async function DocumentsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { transaction } = await loadFilePageContext(id);
  return <TabEnter><DocumentsPanel transactionId={transaction.id} /></TabEnter>;
}
