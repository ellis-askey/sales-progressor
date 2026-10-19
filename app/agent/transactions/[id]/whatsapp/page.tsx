// File-detail — WhatsApp tab (route segment).
// Pivot 2026-10-18: the tab is open to EVERY file-access role. It shows the
// file's conversation threads (bridge-captured and/or Cloud) read-first; the
// legacy flat panel remains internal-team-only underneath during the parallel
// run. No capture yet → a guide-to-connect empty state, never a 404.
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

  // Legacy flat capture panel: internal team on TSP-progressed files only,
  // exactly as before the pivot.
  const showLegacy = isInternalTeam && !fileProgressorLabel(transaction.progressionBusiness);

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
