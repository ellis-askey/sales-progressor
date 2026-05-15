"use client";

import { useState, useEffect } from "react";
import { PaperPlaneTilt, CaretDown, Warning } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";

type VerifiedEmail = { id: string; email: string; status: string };

type Props = {
  transactionId: string;
  defaultTo?: string;
  onSent?: () => void;
  onCancel?: () => void;
};

export function ComposeEmail({ transactionId, defaultTo = "", onSent, onCancel }: Props) {
  const { toast } = useAgentToast();
  const [verifiedEmails, setVerifiedEmails] = useState<VerifiedEmail[]>([]);
  const [fromEmail, setFromEmail] = useState("");
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noEmailDismissed, setNoEmailDismissed] = useState(false);

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
      toast.success(`Email sent to ${to.trim()}`);
      setSent(true);
      setTimeout(() => { onSent?.(); }, 1500);
    }
  }

  if (verifiedEmails.length === 0) {
    if (noEmailDismissed) return null;
    return (
      <div className="agent-reveal-in mobile-alert-banner mobile-alert-banner--warning"
           style={{ background: "var(--agent-surface-elevated)", border: "0.5px solid rgba(201,125,26,0.40)", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-warning)" }}>No verified sending address</p>
          <p style={{ fontSize: 11, color: "var(--agent-warning)", marginTop: 2 }}>
            Go to{" "}
            <a href="/agent/settings" className="agent-link" style={{ fontSize: 11, color: "var(--agent-warning)", textDecoration: "underline", textUnderlineOffset: 2 }}>Settings → Sending addresses</a>
            {" "}to verify a work email address before sending.
          </p>
        </div>
        <button
          onClick={() => setNoEmailDismissed(true)}
          className="agent-icon-btn agent-icon-btn-sm"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="agent-reveal-in px-4 py-4 rounded-[10px]"
           style={{ background: "var(--agent-success-bg)", border: "0.5px solid var(--agent-success-border)" }}>
        <p className="text-sm font-semibold text-emerald-700">✓ Email sent</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-900/80">Compose email</p>

      {/* From */}
      <div>
        <label className="agent-label">From</label>
        {verifiedEmails.length === 1 ? (
          <p className="text-sm text-slate-900/70 px-3 py-2 agent-input agent-input-sm">{verifiedEmails[0].email}</p>
        ) : (
          <div className="relative">
            <select
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              className="agent-input agent-input-sm w-full appearance-none pr-8"
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
        <label className="agent-label">To</label>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com"
          className="agent-input agent-input-sm w-full"
        />
      </div>

      {/* Subject */}
      <div>
        <label className="agent-label">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Re: 14 Grosvenor Square"
          className="agent-input agent-input-sm w-full"
        />
      </div>

      {/* Body */}
      <div>
        <label className="agent-label">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Write your email here…"
          className="agent-input w-full resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={send}
          disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
          className="agent-btn agent-btn-sm agent-btn-primary"
        >
          <PaperPlaneTilt className="w-4 h-4" />
          {sending ? "Sending…" : "Send"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
