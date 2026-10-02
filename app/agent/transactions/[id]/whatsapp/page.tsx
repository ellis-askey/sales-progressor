// File-detail — WhatsApp tab (route segment). Internal team only (our team
// progresses these files over WhatsApp; customer agencies have no capture).
import { notFound } from "next/navigation";
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { WhatsAppPanel } from "@/components/transaction/WhatsAppPanel";
import { TabEnter } from "@/components/transaction/TabEnter";
import { fileProgressorLabel } from "@/lib/progression/identity";

export const unstable_dynamicStaleTime = 300;

export default async function WhatsAppTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction, isInternalTeam } = await loadFilePageContext(id);
  // Internal team only, and never on an external progression-business file (its
  // WhatsApp isn't captured into TSP's pipeline). Mirrors the tab gate in layout.
  if (!isInternalTeam || fileProgressorLabel(transaction.progressionBusiness)) notFound();
  return <TabEnter><WhatsAppPanel transactionId={transaction.id} agencyId={session.user.agencyId} /></TabEnter>;
}
