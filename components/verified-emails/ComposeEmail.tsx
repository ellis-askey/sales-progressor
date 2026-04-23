"use client";

import { useState, useEffect } from "react";
import { PaperPlaneTilt, CaretDown, Warning } from "@phosphor-icons/react";

type VerifiedEmail = { id: string; email: string; status: string };

type Props = {
  transactionId: string;
  defaultTo?: string;
  onSent?: () => void;
  onCancel?: () => void;
};

export function ComposeEmail({ transactionId, defaultTo = "", onSent, onCancel }: Props) {
  const [verifiedEmails, setVerifiedEmails] = useState<VerifiedEmail[]>([]);
  const [fromEmail, setFromEmail] = useState("");
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agent/verified-emails")
      .then((r) => r.json())
      .then((data: VerifiedEmail[]) => {
        const usable = data.filter((e) => e.status === "verified" || e.status === "legacy_single_sender");
        setVerifiedEmails(usable);
        if (usable.length > 0) setFromEmail(usable[0].email);
      });
  }, []);

  async function send() {
    if (!fromEmail || !to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/agent/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromEmail, to: to.trim(), subject: subject.trim(), body: body.trim(), transactionId }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to send");
    } else {
      setSent(true);
      setTimeout(() => { onSent?.(); }, 1500);
    }
  }

  if (verifiedEmails.length === 0) {
    return (
      <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-amber-50 border border-amber-100">
        <Warning className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" weight="fill" />
        <div>
          <p className="text-sm font-semibold text-amber-800">No verified sending address</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Go to{" "}
            <a href="/agent/settings" className="underline font-medium">Settings → Sending addresses</a>
            {" "}to verify a work email address before sending.
          </p>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="px-4 py-4 rounded-xl bg-emerald-50 border border-emerald-100">
        <p className="text-sm font-semibold text-emerald-700">✓ Email sent</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-3">
      <p className="text-sm font-semibold text-slate-900/80">Compose email</p>

      {/* From */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-900/40 uppercase tracking-wide mb-1">From</label>
        {verifiedEmails.length === 1 ? (
          <p className="text-sm text-slate-900/70 px-3 py-2 glass-input">{verifiedEmails[0].email}</p>
        ) : (
          <div className="relative">
            <select
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm appearance-none pr-8"
            >
              {verifiedEmails.map((e) => (
                <option key={e.id} value={e.email}>{e.email}</option>
              ))}
            </select>
            <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-900/40 pointer-events-none" />
          </div>
        )}
      </div>

      {/* To */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-900/40 uppercase tracking-wide mb-1">To</label>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com"
          className="glass-input w-full px-3 py-2 text-sm"
        />
      </div>

      {/* Subject */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-900/40 uppercase tracking-wide mb-1">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Re: 14 Grosvenor Square"
          className="glass-input w-full px-3 py-2 text-sm"
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-900/40 uppercase tracking-wide mb-1">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Write your email here…"
          className="glass-input w-full px-3 py-2.5 text-sm resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={send}
          disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-sm font-medium text-white transition-colors"
        >
          <PaperPlaneTilt className="w-4 h-4" />
          {sending ? "Sending…" : "Send"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
