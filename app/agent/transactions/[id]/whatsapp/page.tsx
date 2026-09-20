// File-detail — WhatsApp tab (route segment). Internal team only (our team
// progresses these files over WhatsApp; customer agencies have no capture).
import { notFound } from "next/navigation";
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { WhatsAppPanel } from "@/components/transaction/WhatsAppPanel";

export const unstable_dynamicStaleTime = 300;

export default async function WhatsAppTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction, isInternalTeam } = await loadFilePageContext(id);
  if (!isInternalTeam) notFound();
  return <WhatsAppPanel transactionId={transaction.id} agencyId={session.user.agencyId} />;
}
