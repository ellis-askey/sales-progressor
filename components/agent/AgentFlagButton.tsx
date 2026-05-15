"use client";

import { useState } from "react";

export function AgentFlagButton({ transactionId, address, label }: { transactionId: string | null; address: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!message.trim()) return;
    setSending(true);
    await fetch("/api/agent/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId, message }),
    });
    setSending(false);
    setSent(true);
    setMessage("");
    setTimeout(() => { setSent(false); setOpen(false); }, 2000);
  }

  if (sent) {
    return (
      <div style={{
        fontSize: 12, fontWeight: 600,
        color: "var(--agent-success)",
        background: "var(--agent-success-bg)",
        border: "1px solid var(--agent-success-border)",
        padding: "4px 12px", borderRadius: 8,
      }}>
        Sent
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="agent-btn agent-btn-sm"
        style={{ background: "white", border: "0.5px solid rgba(0,0,0,0.15)", boxShadow: "none", backdropFilter: "none" }}
      >
        {label ?? "Flag to progressor"}
      </button>
    );
  }

  return (
    <div className="agent-reveal-in" style={{ flexShrink: 0, width: 240 }} onClick={(e) => e.stopPropagation()}>
      {transactionId !== null && (
        <p style={{ fontSize: 11, color: "var(--agent-text-muted)", marginBottom: 6 }}>About: {address.substring(0, 30)}{address.length > 30 ? "…" : ""}</p>
      )}
      <textarea
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="e.g. Client called in, asked about exchange date"
        rows={3}
        className="agent-textarea w-full text-xs resize-none box-border"
      />
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={submit}
          disabled={sending || !message.trim()}
          className="agent-btn agent-btn-primary agent-btn-sm"
          style={{ opacity: (sending || !message.trim()) ? 0.5 : 1 }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
        <button
          onClick={() => { setOpen(false); setMessage(""); }}
          className="agent-btn agent-btn-ghost agent-btn-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
