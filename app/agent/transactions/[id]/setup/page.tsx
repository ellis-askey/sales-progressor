// File-detail — File setup tab (route segment). Renders only when this tab is open.
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { FileSetupChecklist } from "@/components/transaction/FileSetupChecklist";
import { getFileSetup } from "@/lib/services/file-setup";
import { TabEnter } from "@/components/transaction/TabEnter";

export const unstable_dynamicStaleTime = 300;

export default async function FileSetupTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { transaction } = await loadFilePageContext(id);
  const fileSetup = await getFileSetup(transaction.id).catch(() => null);
  return <TabEnter><FileSetupChecklist summary={fileSetup} /></TabEnter>;
}
