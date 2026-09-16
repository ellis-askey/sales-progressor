"use client";

// Phase F2 — the accept/dismiss UI for a "add this signature number to the
// contact" suggestion on an inbound email. Suggest-only: nothing happens until
// the agent taps. Optimistic — hides on tap, returns if the server rejects it.

import { useState, useTransition } from "react";
import { Phone, Check, X } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import {
  applyContactPhoneSuggestionAction,
  dismissContactPhoneSuggestionAction,
} from "@/app/actions/contact-suggestions";

export function EmailContactSuggestion({
  transactionId,
  messageId,
  suggestion,
}: {
  transactionId: string;
  messageId: string;
  suggestion: { contactId: string; contactName: string; phone: string };
}) {
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (done) return null;

  const act = (apply: boolean) => {
    setBusy(true);
    setDone(true); // optimistic
    startTransition(async () => {
      try {
        const res = apply
          ? await applyContactPhoneSuggestionAction({ transactionId, messageId })
          : await dismissContactPhoneSuggestionAction({ transactionId, messageId });
        if (!res.ok) throw new Error("rejected");
        if (apply) toast.success(`Number added to ${suggestion.contactName}`);
      } catch {
        setDone(false);
        toast.error(apply ? "Couldn't add that number" : "Couldn't dismiss that");
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <div
      style={{
        marginTop: 8,
        borderRadius: 8,
        border: "0.5px solid rgba(var(--agent-coral-rgb), 0.25)",
        background: "rgba(var(--agent-coral-rgb), 0.05)",
        padding: "8px 10px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Phone size={13} weight="fill" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>
          Add {suggestion.phone} to {suggestion.contactName}?
        </p>
        <p style={{ fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.35 }}>
          Found in this email&rsquo;s signature. They have no number on file.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => act(true)}
        className="agent-btn agent-btn-sm agent-btn-primary"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}
      >
        <Check size={12} weight="bold" /> Add
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => act(false)}
        aria-label="Dismiss suggestion"
        title="Dismiss"
        className="agent-icon-btn agent-icon-btn-sm"
        style={{ flexShrink: 0 }}
      >
        <X size={12} weight="bold" />
      </button>
    </div>
  );
}
