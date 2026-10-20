// File-detail — WhatsApp tab (route segment).
// Pivot 2026-10-18: the tab is open to EVERY file-access role. It shows the
// file's conversation threads (bridge-captured and/or Cloud) read-first.
// 2026-10-20: the old flat panel below is retired as a duplicate — it now only
// renders when the file has PASTED WhatsApp history (the one thing the thread
// panel can't show), so it never repeats the bridge/cloud chats above.
import { prisma } from "@/lib/prisma";
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { WhatsAppPanel } from "@/components/transaction/WhatsAppPanel";
import { WhatsAppCloudPanel } from "@/components/transaction/WhatsAppCloudPanel";
import { TabEnter } from "@/components/transaction/TabEnter";
import { fileProgressorLabel } from "@/lib/progression/identity";
import { getFileThreads, getThreadMessages, type ThreadSummary, type ThreadMessage } from "@/lib/services/whatsapp-cloud-inbox";

export const unstable_dynamicStaleTime = 300;

export default async function WhatsAppTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction, isInternalTeam } = await loadFilePageContext(id);

  const threads: ThreadSummary[] = await getFileThreads(session, transaction.id).catch(() => []);
  let initialThread: ThreadSummary | null = null;
  let initialMessages: ThreadMessage[] = [];
  if (threads.length > 0) {
    const first = await getThreadMessages(session, threads[0].id).catch(() => null);
    if (first) {
      initialThread = first.thread;
      initialMessages = first.messages;
    }
  }

  // Legacy flat panel, now paste-only: show it (internal team, TSP-progressed
  // files) ONLY when this file actually has pasted WhatsApp history, so it never
  // duplicates the thread panel above. Bridge/cloud chats are in the threads.
  const pasteHistoryCount =
    isInternalTeam && !fileProgressorLabel(transaction.progressionBusiness)
      ? await prisma.outboundMessage.count({
          where: { transactionId: transaction.id, method: "whatsapp", importBatchId: { not: null } },
        })
      : 0;
  const showLegacy = pasteHistoryCount > 0;

  return (
    <TabEnter stage>
      {threads.length > 0 && (
        <div data-bloom><WhatsAppCloudPanel threads={threads} initialThread={initialThread} initialMessages={initialMessages} /></div>
      )}
      {threads.length === 0 && !showLegacy && (
        <div
          data-bloom
          style={{ border: "1px solid var(--agent-border-subtle)", borderRadius: 16, background: "var(--agent-glass-bg, rgba(255,255,255,0.55))", padding: "26px 22px", textAlign: "center" }}
        >
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>No WhatsApp conversations on this file yet</p>
          <p style={{ margin: "6px auto 0", fontSize: 13, lineHeight: 1.55, color: "var(--agent-text-muted)", maxWidth: 480 }}>
            Link your WhatsApp in Account → Connections and your property group chats will appear here automatically — read-only,
            with photos and documents kept on the file.
          </p>
        </div>
      )}
      {showLegacy && (
        <div data-bloom><WhatsAppPanel transactionId={transaction.id} agencyId={session.user.agencyId} /></div>
      )}
    </TabEnter>
  );
}
