// File-detail — Chase timeline tab (route segment). Gated: the founder on every
// file, agency users on their own self-managed files. notFound() otherwise so
// the route mirrors the tab's visibility.
import { notFound } from "next/navigation";
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { ChaseTimelinePanel } from "@/components/transaction/ChaseTimelinePanel";
import { TabEnter } from "@/components/transaction/TabEnter";
import { fileProgressorLabel } from "@/lib/progression/identity";

export const unstable_dynamicStaleTime = 300;

export default async function ChaseTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction, isEllis, isInternalStaff } = await loadFilePageContext(id);
  // Mirror the tab-visibility gate in layout.tsx exactly (founder; agency on its
  // own self-managed files; internal viewer of an external-progressor file).
  const showChaseTimeline =
    isEllis
    || (!!session.user.agencyId && transaction.serviceType === "self_managed")
    || (isInternalStaff && !!fileProgressorLabel(transaction.progressionBusiness));
  if (!showChaseTimeline) notFound();
  return <TabEnter><ChaseTimelinePanel transactionId={transaction.id} agencyId={session.user.agencyId} /></TabEnter>;
}
