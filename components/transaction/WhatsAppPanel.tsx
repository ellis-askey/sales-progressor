// Async server component for the WhatsApp tab on the file-detail page.
// Fetches the file's captured WhatsApp conversations (grouped by chat, media
// pre-signed) and hands them to the read-only chat renderer. Empty state when
// nothing has been captured or paired to this file yet.

import { getWhatsAppConversations } from "@/lib/services/comms";
import { WhatsAppChat } from "@/components/transaction/WhatsAppChat";

export async function WhatsAppPanel({
  transactionId,
  agencyId,
}: {
  transactionId: string;
  agencyId: string | null;
}) {
  const conversations = await getWhatsAppConversations(transactionId, agencyId).catch(() => []);

  if (conversations.length === 0) {
    return (
      <div
        className="rounded-2xl px-6 py-10 text-center"
        style={{ background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle)" }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>No WhatsApp messages yet</p>
        <p style={{ fontSize: 13, color: "var(--agent-text-muted)", marginTop: 4 }}>
          Once a WhatsApp chat is paired to this file, the conversation appears here.
        </p>
      </div>
    );
  }

  return <WhatsAppChat conversations={conversations} />;
}
