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
      <div className="text-xs font-semibold text-emerald-600 px-3 py-1.5 bg-emerald-50/60 rounded-lg">
        Sent!
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="agent-btn agent-btn-secondary agent-btn-sm"
      >
        {label ?? "Flag to progressor"}
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-60" onClick={(e) => e.stopPropagation()}>
      <p style={{ fontSize: 11, color: "var(--agent-text-muted)", marginBottom: 6 }}>Flag for: {address.substring(0, 30)}…</p>
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
