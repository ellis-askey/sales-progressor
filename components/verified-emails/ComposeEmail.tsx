"use client";

import { useState, useEffect } from "react";
import { PaperPlaneTilt, CaretDown, Warning } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { GlassCard } from "@/components/glass/GlassCard";

type VerifiedEmail = { id: string; email: string; status: string };

// The sign-off that will actually be appended on send — personal signature for
// agents, standardised in-house block for internal staff. Resolved server-side
// by /api/agent/compose-signature-preview (mirrors the send route's branch).
type SigPreview = { kind: "personal" | "inhouse"; html: string; mode: string | null; missing: string[] };

// "photo, job title and mobile" — Oxford-free list for the finish-signature nudge.
function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

type Props = {
  transactionId: string;
  defaultTo?: string;
  onSent?: () => void;
  onCancel?: () => void;
  senderIdentity?: { name: string; email: string };
};

export function ComposeEmail({ transactionId, defaultTo = "", onSent, onCancel, senderIdentity }: Props) {
  const { toast } = useAgentToast();
  const [verifiedEmails, setVerifiedEmails] = useState<VerifiedEmail[]>([]);
  const [fromEmail, setFromEmail] = useState(senderIdentity?.email ?? "");
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noEmailDismissed, setNoEmailDismissed] = useState(false);
  const [signature, setSignature] = useState<SigPreview | null>(null);

  // Resolve the real sign-off for this file so the composer shows exactly how
  // the email closes — and nudges a bare BASIC signature towards Settings.
  // Refetches nothing on edit: the signature is a function of the user + file.
  useEffect(() => {
    let live = true;
    fetch(`/api/agent/compose-signature-preview?transactionId=${encodeURIComponent(transactionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SigPreview | null) => { if (live && d?.html) setSignature(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [transactionId]);

  useEffect(() => {
    if (senderIdentity) return;
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

  if (!senderIdentity && verifiedEmails.length === 0) {
    if (noEmailDismissed) return null;
    return (
      <div className="agent-reveal-in mobile-alert-banner mobile-alert-banner--warning"
           style={{ background: "var(--agent-surface-elevated)", border: "0.5px solid rgba(201,125,26,0.40)", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-warning)" }}>No verified sending address</p>
          <p style={{ fontSize: 11, color: "var(--agent-warning)", marginTop: 2 }}>
            Go to{" "}
            <a href="/agent/account/profile" className="agent-link" style={{ fontSize: 11, color: "var(--agent-warning)", textDecoration: "underline", textUnderlineOffset: 2 }}>Account → Sending addresses</a>
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
    // Design Lab: `activity-compose-email`. Default v08 (Cool tint) per
    // Ellis's pick set, 2026-08-09.
    <GlassCard glassId="activity-compose-email" label="Activity · Compose email" defaultVariant="v08" className="p-4 space-y-3 rounded-[12px]">
      <p className="text-sm font-semibold text-slate-900/80">Compose email</p>

      {/* From */}
      <div>
        <label className="agent-label">From</label>
        {senderIdentity ? (
          <p className="text-sm text-slate-900/70 px-3 py-2 agent-input agent-input-sm">
            Sending as {senderIdentity.email}
          </p>
        ) : verifiedEmails.length === 1 ? (
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

      {/* Body + signature in one white field, so composing reads like the real
          email that goes out (Outlook-style: your sign-off sits right there
          under the message). Rendered on white regardless of the glass card
          theme, because an email is always light — agent tokens would vanish in
          dark mode. The signature the recipient sees is appended on send. */}
      <div>
        <label className="agent-label">Message</label>
        <div style={{ background: "#ffffff", border: "0.5px solid var(--agent-border-subtle)", borderRadius: 10, overflow: "hidden" }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Write your email here…"
            style={{ width: "100%", minHeight: 190, border: "none", outline: "none", background: "transparent", padding: "12px 14px 6px", fontSize: 14, lineHeight: 1.6, color: "#1f2937", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          {signature?.html && (
            <div style={{ padding: "0 14px 14px", overflowX: "auto" }} dangerouslySetInnerHTML={{ __html: signature.html }} />
          )}
        </div>
        {signature?.html && (
          <p style={{ margin: "8px 2px 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>
            {signature.kind === "inhouse" ? (
              "A standard sign-off is added when you send."
            ) : signature.mode !== "BASIC" ? (
              "Your signature is added when you send."
            ) : (() => {
              const personal = signature.missing.filter((m) => m !== "agency logo");
              return (
                <>
                  You&rsquo;re using the basic signature.{personal.length ? ` Add your ${formatList(personal)} to make it look more professional.` : " Personalise it with a photo and your details."}{" "}
                  <a href="/agent/account/profile" target="_blank" rel="noreferrer" style={{ color: "var(--agent-coral-deep)", fontWeight: 600 }}>Set up your signature</a>
                </>
              );
            })()}
          </p>
        )}
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
    </GlassCard>
  );
}
