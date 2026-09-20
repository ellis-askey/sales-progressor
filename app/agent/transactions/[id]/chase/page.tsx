// File-detail — Chase timeline tab (route segment). Gated: the founder on every
// file, agency users on their own self-managed files. notFound() otherwise so
// the route mirrors the tab's visibility.
import { notFound } from "next/navigation";
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { ChaseTimelinePanel } from "@/components/transaction/ChaseTimelinePanel";

export const unstable_dynamicStaleTime = 300;

export default async function ChaseTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction, isEllis } = await loadFilePageContext(id);
  const showChaseTimeline = isEllis || (!!session.user.agencyId && transaction.serviceType === "self_managed");
  if (!showChaseTimeline) notFound();
  return <ChaseTimelinePanel transactionId={transaction.id} agencyId={session.user.agencyId} />;
}
