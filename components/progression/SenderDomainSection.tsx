"use client";

// Shared "Sending address" setup used in two places:
//   - scope="client":  a client agency's workspace (Branding tab) — the owner sets
//     up THAT client's own domain so its emails white-label fully as the agency.
//   - scope="business": the owner's own settings (Emails tab) — the business's
//     DEFAULT sending domain, used for any client without its own address set up.
//
// Both reuse the agency DomainAuthFlow, pointed at owner-scoped routes (passed as
// `base`). Copy is scope-aware. Until a domain is verified, emails fall back one
// tier (business sender, then the neutral platform address); the from-NAME is
// always the relevant agency's regardless.

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, EnvelopeSimple } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { DomainAuthFlow } from "@/components/verified-emails/DomainAuthFlow";

type CnameRecord = { host: string; data: string; type: string };
type DomainRecord = {
  id: string; domain: string; status: string;
  dkimValid: boolean; spfValid: boolean; cnameRecords: CnameRecord[];
};
type SenderStatus = {
  senderEmail: string | null;
  senderVerified: boolean;
  domain: DomainRecord | null;
};

export function SenderDomainSection({
  base,
  scope,
  subjectName,
}: {
  /** API base for status/create/check (owner-scoped). */
  base: string;
  scope: "client" | "business";
  /** The client agency's name (scope=client); ignored for business copy. */
  subjectName?: string;
}) {
  const { toast } = useAgentToast();
  const name = subjectName ?? "";
  const [status, setStatus] = useState<SenderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(base);
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  async function startDomain() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await fetch(`${base}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Couldn't start setup."); return; }
      setShowForm(false);
      setEmail("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  const verified = status?.senderVerified && status.senderEmail;
  const pending = status?.domain && status.domain.status !== "verified";

  // Scope-aware copy.
  const c = scope === "client"
    ? {
        verifiedTitle: `Emails for ${name} send from their own address`,
        verifiedNote: `Every client-facing email for ${name}'s sales now goes out fully as their brand.`,
        pendingLead: (domain: string) => `Finish verifying ${domain} by adding the DNS records below. Once it's verified, ${name}'s emails send from their own address.`,
        formLead: `Enter an email on ${name}'s own domain (e.g. `,
        emptyTitle: "Emails send from a neutral address for now",
        emptyBody: `Set up ${name}'s own sending domain so their buyers and sellers see emails coming fully from them. Their name already shows as the sender either way.`,
        emptyCta: "Set up their sending address",
        placeholder: "updates@theirdomain.co.uk",
      }
    : {
        verifiedTitle: "Your business sends from your own address",
        verifiedNote: "This is your default sender for any client that doesn't have its own address set up.",
        pendingLead: (domain: string) => `Finish verifying ${domain} by adding the DNS records below. Once it's verified, your business emails send from your own address.`,
        formLead: "Enter an email on your business's own domain (e.g. ",
        emptyTitle: "Your business uses a neutral sending address",
        emptyBody: "Set up your own sending domain so emails go out from your business. We'll use it for any client you haven't given their own address. The agency's name still shows as the sender on client emails.",
        emptyCta: "Set up your sending address",
        placeholder: "updates@yourbusiness.co.uk",
      };

  return (
    <div className="sds-card">
      <h4 className="sds-h">Sending address</h4>

      {loading ? (
        <p className="sds-empty-txt">Loading…</p>
      ) : verified ? (
        <>
          <div className="sds-verified">
            <CheckCircle size={18} weight="fill" />
            <div>
              <p className="sds-vt">{c.verifiedTitle}</p>
              <p className="sds-vd"><span className="sds-mono">{status!.senderEmail}</span> is verified and live.</p>
            </div>
          </div>
          <p className="sds-note">{c.verifiedNote}</p>
        </>
      ) : pending ? (
        <>
          <p className="sds-intro">{c.pendingLead(status!.domain!.domain)}</p>
          <DomainAuthFlow domain={status!.domain!} checkBase={`${base}/domain`} onVerified={load} />
        </>
      ) : showForm ? (
        <>
          <p className="sds-intro">
            {c.formLead}<span className="sds-mono">{c.placeholder}</span>). We&rsquo;ll give you the DNS records to verify it once.
          </p>
          <div className="sds-form">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") startDomain(); }}
              placeholder={c.placeholder}
              className="sds-input"
              autoFocus
            />
            <button type="button" className="agent-btn agent-btn-primary agent-btn-sm" onClick={startDomain} disabled={adding || !email.trim()}>
              {adding ? "Starting…" : "Set up"}
            </button>
            <button type="button" className="agent-btn agent-btn-ghost agent-btn-sm" onClick={() => { setShowForm(false); setEmail(""); }} disabled={adding}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="sds-empty">
            <span className="sds-empty-ico"><EnvelopeSimple size={22} weight="bold" /></span>
            <div>
              <p className="sds-et">{c.emptyTitle}</p>
              <p className="sds-ed">{c.emptyBody}</p>
            </div>
          </div>
          <button type="button" className="agent-btn agent-btn-primary agent-btn-sm" onClick={() => setShowForm(true)}>
            {c.emptyCta}
          </button>
        </>
      )}

      <style>{`
        .sds-card { background: var(--agent-glass-bg, rgba(255,255,255,0.5)); border: 1px solid var(--agent-border-subtle); border-radius: 15px; padding: 17px; -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); margin-top: 16px; }
        .sds-h { margin: 0 0 13px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--agent-text-muted); }
        .sds-empty-txt { font-size: 13px; color: var(--agent-text-muted); margin: 0; }
        .sds-intro { font-size: 13px; color: var(--agent-text-secondary); line-height: 1.6; margin: 0 0 14px; max-width: 70ch; }
        .sds-note { font-size: 12px; color: var(--agent-text-muted); margin: 12px 0 0; }
        .sds-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }

        .sds-verified { display: flex; align-items: flex-start; gap: 11px; padding: 14px 16px; border-radius: 13px; background: rgba(47,125,83,0.08); border: 1px solid rgba(47,125,83,0.2); }
        .sds-verified > svg { color: var(--agent-success, #2F7D53); flex-shrink: 0; margin-top: 1px; }
        .sds-vt { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--agent-text-primary); }
        .sds-vd { margin: 2px 0 0; font-size: 12.5px; color: var(--agent-text-secondary); }

        .sds-empty { display: flex; align-items: flex-start; gap: 13px; margin-bottom: 14px; }
        .sds-empty-ico { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; background: rgba(var(--agent-coral-rgb),0.10); color: var(--agent-coral-deep, #E2452A); }
        .sds-et { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--agent-text-primary); }
        .sds-ed { margin: 3px 0 0; font-size: 12.5px; color: var(--agent-text-muted); line-height: 1.55; max-width: 64ch; }

        .sds-form { display: flex; gap: 9px; flex-wrap: wrap; align-items: center; }
        .sds-input { flex: 1; min-width: 220px; padding: 9px 12px; font-size: 13.5px; color: var(--agent-text-primary); background: var(--agent-surface, #fff); border: 1px solid var(--agent-border-strong, rgba(0,0,0,0.16)); border-radius: 9px; outline: none; }
        .sds-input:focus { border-color: var(--agent-coral); }
      `}</style>
    </div>
  );
}
