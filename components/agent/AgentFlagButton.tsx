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
        className="text-xs font-semibold text-white bg-white/15 border border-white/20 rounded-lg px-3.5 py-1.5 whitespace-nowrap flex-shrink-0 hover:bg-white/25 transition-colors"
      >
        {label ?? "Flag to progressor"}
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-60" onClick={(e) => e.stopPropagation()}>
      <p className="text-[11px] text-slate-900/40 mb-1.5">Flag for: {address.substring(0, 30)}…</p>
      <textarea
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="e.g. Client called in, asked about exchange date"
        rows={3}
        className="glass-input w-full text-xs px-2.5 py-2 resize-none box-border"
      />
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={submit}
          disabled={sending || !message.trim()}
          className="text-xs font-semibold px-3.5 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md transition-colors"
        >
          {sending ? "Sending…" : "Send"}
        </button>
        <button
          onClick={() => { setOpen(false); setMessage(""); }}
          className="text-xs text-slate-900/40 hover:text-slate-900/70 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
