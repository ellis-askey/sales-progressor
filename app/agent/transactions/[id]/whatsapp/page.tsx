// File-detail — WhatsApp tab (route segment). Internal team only (our team
// progresses these files over WhatsApp; customer agencies have no capture).
// Phase 4 (whatsapp-rebuild): when the official Cloud number is configured,
// this tab also carries its live conversations for the file — send + real
// delivery ticks — above the legacy captured history (parallel run, §E).
import { notFound } from "next/navigation";
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { WhatsAppPanel } from "@/components/transaction/WhatsAppPanel";
import { WhatsAppCloudPanel } from "@/components/transaction/WhatsAppCloudPanel";
import { TabEnter } from "@/components/transaction/TabEnter";
import { fileProgressorLabel } from "@/lib/progression/identity";
import { isCloudConfigured } from "@/lib/integrations/whatsapp-cloud/config";
import { getFileThreads, getThreadMessages, type ThreadSummary, type ThreadMessage } from "@/lib/services/whatsapp-cloud-inbox";

export const unstable_dynamicStaleTime = 300;

export default async function WhatsAppTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction, isInternalTeam } = await loadFilePageContext(id);
  // Internal team only, and never on an external progression-business file (its
  // WhatsApp isn't captured into TSP's pipeline). Mirrors the tab gate in layout.
  if (!isInternalTeam || fileProgressorLabel(transaction.progressionBusiness)) notFound();

  let threads: ThreadSummary[] = [];
  let initialThread: ThreadSummary | null = null;
  let initialMessages: ThreadMessage[] = [];
  if (isCloudConfigured()) {
    threads = await getFileThreads(session, transaction.id).catch(() => []);
    if (threads.length > 0) {
      const first = await getThreadMessages(session, threads[0].id).catch(() => null);
      if (first) {
        initialThread = first.thread;
        initialMessages = first.messages;
      }
    }
  }

  return (
    <TabEnter stage>
      {threads.length > 0 && (
        <div data-bloom><WhatsAppCloudPanel threads={threads} initialThread={initialThread} initialMessages={initialMessages} /></div>
      )}
      <div data-bloom><WhatsAppPanel transactionId={transaction.id} agencyId={session.user.agencyId} /></div>
    </TabEnter>
  );
}
