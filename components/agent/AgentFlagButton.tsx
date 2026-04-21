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
      <div style={{ fontSize: 12, color: "#059669", fontWeight: 600, padding: "6px 12px", background: "#f0fdf4", borderRadius: 8 }}>
        Sent!
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
      >
        {label ?? "Flag to progressor"}
      </button>
    );
  }

  return (
    <div style={{ flexShrink: 0, width: 240 }} onClick={(e) => e.stopPropagation()}>
      <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Flag for: {address.substring(0, 30)}…</p>
      <textarea
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="e.g. Client called in, asked about exchange date"
        rows={3}
        style={{ width: "100%", fontSize: 12, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, resize: "none", outline: "none", boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button
          onClick={submit}
          disabled={sending || !message.trim()}
          style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
        <button
          onClick={() => { setOpen(false); setMessage(""); }}
          style={{ fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
