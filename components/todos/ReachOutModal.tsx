"use client";

// The reach-out composer for the To-Do "No comms" card. One modal, four
// channels, each wired to the app's real send path (no reinvented composers):
//   Email   → POST /api/chase/send-email (branded send) + a logged OutboundMessage
//   WhatsApp→ a logged OutboundMessage + wa.me hand-off
//   Call    → a logged OutboundMessage (a call is a record, nothing sent)
//   Portal  → sendDraftClientUpdateAction — the push-else-email primitive
//             (pushes to the client's app when installed with notifications on,
//             falls back to a branded email otherwise; same rule as elsewhere)
// Sending on a side is what resets its clock, so onSent lets the card drop it.

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EnvelopeSimple, WhatsappLogo, Phone, PaperPlaneTilt } from "@phosphor-icons/react";
import { logCommAction } from "@/app/actions/comms";
import { sendDraftClientUpdateAction } from "@/app/actions/draft-update";
import { extractFirstName } from "@/lib/contacts/displayName";
import type { NoCommsSide } from "@/lib/services/hub";

export type ReachChannel = "email" | "whatsapp" | "phone" | "portal";

const CHANNELS: { key: ReachChannel; label: string; Icon: typeof Phone }[] = [
  { key: "email", label: "Email", Icon: EnvelopeSimple },
  { key: "whatsapp", label: "WhatsApp", Icon: WhatsappLogo },
  { key: "phone", label: "Log a call", Icon: Phone },
  { key: "portal", label: "Portal", Icon: PaperPlaneTilt },
];

export function ReachOutModal({
  txId,
  address,
  side,
  initialChannel,
  onClose,
  onSent,
}: {
  txId: string;
  address: string;
  side: NoCommsSide;
  initialChannel: ReachChannel;
  onClose: () => void;
  onSent: () => void;
}) {
  const [channel, setChannel] = useState<ReachChannel>(initialChannel);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unavailable =
    channel === "email" && !side.email
      ? "No email on file for this client."
      : channel === "whatsapp" && !side.phone
        ? "No phone number on file for this client."
        : null;

  const isCall = channel === "phone";
  const canSend = !!body.trim() && !unavailable && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    const text = body.trim();
    try {
      if (channel === "email") {
        const res = await fetch("/api/chase/send-email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transactionId: txId, toEmail: side.email, toName: side.name, messageText: text }),
        });
        if (!res.ok) throw new Error("The email didn't send. Try again.");
        // Log against the contact so the side's clock resets (the send route's
        // own mirror row carries no contactIds).
        await logCommAction({ transactionId: txId, type: "outbound", method: "email", contactIds: [side.primaryContactId], content: text, visibleToClient: false });
      } else if (channel === "whatsapp") {
        await logCommAction({ transactionId: txId, type: "outbound", method: "whatsapp", contactIds: [side.primaryContactId], content: text, visibleToClient: false });
        const num = (side.phone ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      } else if (channel === "phone") {
        await logCommAction({ transactionId: txId, type: "outbound", method: "phone", contactIds: [side.primaryContactId], content: text, visibleToClient: false });
      } else {
        const r = await sendDraftClientUpdateAction({ transactionId: txId, contactIds: side.contactIds, content: text });
        if (!r.ok) throw new Error(r.error);
      }
      onSent();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setSending(false);
    }
  }

  const sideLabel = side.side === "vendor" ? "seller" : "buyer";

  return (
    <Modal open onClose={onClose} ariaLabel={`Reach out to the ${sideLabel}`} size="md">
      <Modal.Header>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>
          Reach out to {side.name}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>
          {sideLabel === "seller" ? "Seller" : "Buyer"} · {address}
        </p>
      </Modal.Header>

      <Modal.Body>
        {/* Channel picker */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {CHANNELS.map(({ key, label, Icon }) => {
            const on = channel === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setChannel(key); setError(null); }}
                className="agent-hover-row"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px",
                  borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                  border: on ? "1px solid var(--agent-coral-deep)" : "0.5px solid var(--agent-border-default)",
                  background: on ? "rgba(var(--agent-coral-rgb), 0.12)" : "var(--agent-surface, transparent)",
                  color: on ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)",
                }}
              >
                <Icon size={15} weight={on ? "fill" : "regular"} />
                {label}
              </button>
            );
          })}
        </div>

        {unavailable ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)", padding: "18px 4px" }}>{unavailable}</p>
        ) : (
          <>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--agent-text-muted)", marginBottom: 6 }}>
              {isCall ? "What was discussed" : channel === "portal" ? "Your update" : "Message"}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              autoFocus
              placeholder={
                isCall ? "A short note on the call, for the file…"
                : channel === "portal" ? "A quick update for the client…"
                : `Write to ${extractFirstName(side.name)}…`
              }
              className="agent-textarea"
              style={{ width: "100%", fontSize: 13, resize: "vertical", lineHeight: 1.5, minHeight: 108 }}
            />
            {channel === "portal" && (
              <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>
                We&rsquo;ll push this to their app if they have it installed with notifications on, and email it otherwise.
              </p>
            )}
            {channel === "email" && (
              <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>
                Sends from your agency address to {side.email}. Start with a subject line if you want one.
              </p>
            )}
            {error && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--agent-danger, #DC2626)" }}>{error}</p>}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={send} disabled={!canSend} loading={sending}>
          {isCall ? "Log the call" : channel === "whatsapp" ? "Open WhatsApp" : "Send"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
