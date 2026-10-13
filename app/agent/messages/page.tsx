// Central WhatsApp inbox (Phase 4, docs/active/whatsapp-rebuild §C4/§7A):
// every mapped conversation across the caller's permitted sales. DARK LAUNCH:
// reachable by URL only (no nav link until go-live) and 404s while the Cloud
// integration is unconfigured. Access scoping happens in the service layer
// (listInboxThreads → scopeTransactionWhere, Law 7).
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { isCloudConfigured } from "@/lib/integrations/whatsapp-cloud/config";
import { listInboxThreads } from "@/lib/services/whatsapp-cloud-inbox";
import { WhatsAppInboxView } from "@/components/whatsapp/WhatsAppInboxView";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  if (!isCloudConfigured()) notFound();
  const session = await requireSession();
  const threads = await listInboxThreads(session);

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "18px 16px 40px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-text-primary)" }}>Messages</h1>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--agent-text-muted)" }}>
        WhatsApp conversations across your sales. Replies land here and on each sale&rsquo;s WhatsApp tab.
      </p>
      <WhatsAppInboxView threads={threads} />
    </div>
  );
}
