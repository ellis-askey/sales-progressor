// The WhatsApp reading room (pivot 2026-10-18): every captured conversation
// across the caller's permitted sales, read-only unless a thread lives on a
// real Cloud number. Access scoping happens in the service layer
// (listInboxThreads → scopeTransactionWhere, Law 7).
//
// PARKED 2026-10-19 (founder): WhatsApp lives on each file's own tab; a
// standalone cross-file page duplicated it, so this route 404s and its nav
// link is gone. The machinery stays — delete the notFound() to revive it.
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { listInboxThreads } from "@/lib/services/whatsapp-cloud-inbox";
import { WhatsAppInboxView } from "@/components/whatsapp/WhatsAppInboxView";

export const dynamic = "force-dynamic";

const PARKED = true;

export default async function MessagesPage() {
  if (PARKED) notFound();
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
