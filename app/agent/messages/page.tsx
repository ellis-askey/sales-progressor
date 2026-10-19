// The WhatsApp reading room (pivot 2026-10-18): every captured conversation
// across the caller's permitted sales, read-only unless a thread lives on a
// real Cloud number. Linked in the nav; shows a connect-guide empty state
// when nothing's captured. Access scoping happens in the service layer
// (listInboxThreads → scopeTransactionWhere, Law 7).
import { requireSession } from "@/lib/session";
import { listInboxThreads } from "@/lib/services/whatsapp-cloud-inbox";
import { WhatsAppInboxView } from "@/components/whatsapp/WhatsAppInboxView";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const session = await requireSession();
  const threads = await listInboxThreads(session);

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "18px 16px 40px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-text-primary)" }}>WhatsApp</h1>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--agent-text-muted)" }}>
        Your captured WhatsApp conversations, filed against the right sales. Reading only; reply from your phone or WhatsApp
        Desktop as usual.
      </p>
      <WhatsAppInboxView threads={threads} />
    </div>
  );
}
