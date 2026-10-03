"use client";

// The "Sending address" section on a client agency's workspace (Branding tab).
// Lets a progression-business OWNER set up that client's OWN sending domain so
// emails for the client's sales white-label fully as their brand (the top tier of
// the two-tier sender model). Reuses the agency DomainAuthFlow, pointed at the
// owner-scoped client routes (/api/agent/clients/[agencyId]/sender/*). Until a
// domain is verified, emails fall back to the business sender, then the neutral
// platform address — the from-NAME is always the client's agency regardless.

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
  agencyName: string;
  senderEmail: string | null;
  senderVerified: boolean;
  domain: DomainRecord | null;
};

export function ClientSenderSection({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const { toast } = useAgentToast();
  const base = `/api/agent/clients/${agencyId}/sender`;
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

  return (
    <div className="aw-card full" style={{ marginTop: 16 }}>
      <h4>Sending address</h4>

      {loading ? (
        <p className="aw-empty">Loading…</p>
      ) : verified ? (
        <>
          <div className="cs-verified">
            <CheckCircle size={18} weight="fill" />
            <div>
              <p className="cs-vt">Emails for {agencyName} send from their own address</p>
              <p className="cs-vd"><span className="cs-mono">{status!.senderEmail}</span> is verified and live.</p>
            </div>
          </div>
          <p className="cs-note">
            Every client-facing email for {agencyName}&rsquo;s sales now goes out fully as their brand.
          </p>
        </>
      ) : pending ? (
        <>
          <p className="cs-intro">
            Finish verifying <strong>{status!.domain!.domain}</strong> by adding the DNS records below. Once it&rsquo;s
            verified, {agencyName}&rsquo;s emails send from their own address.
          </p>
          <DomainAuthFlow
            domain={status!.domain!}
            checkBase={`${base}/domain`}
            onVerified={load}
          />
        </>
      ) : showForm ? (
        <>
          <p className="cs-intro">
            Enter an email on {agencyName}&rsquo;s own domain (e.g. <span className="cs-mono">updates@theirdomain.co.uk</span>).
            We&rsquo;ll give you the DNS records to verify it once.
          </p>
          <div className="cs-form">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") startDomain(); }}
              placeholder="updates@theirdomain.co.uk"
              className="cs-input"
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
          <div className="cs-empty">
            <span className="cs-empty-ico"><EnvelopeSimple size={22} weight="bold" /></span>
            <div>
              <p className="cs-et">Emails send from a neutral address for now</p>
              <p className="cs-ed">
                Set up {agencyName}&rsquo;s own sending domain so their buyers and sellers see emails coming
                fully from them. Their name already shows as the sender either way.
              </p>
            </div>
          </div>
          <button type="button" className="agent-btn agent-btn-primary agent-btn-sm" onClick={() => setShowForm(true)}>
            Set up their sending address
          </button>
        </>
      )}

      <style>{`
        .cs-intro { font-size: 13px; color: var(--agent-text-secondary); line-height: 1.6; margin: 0 0 14px; max-width: 70ch; }
        .cs-note { font-size: 12px; color: var(--agent-text-muted); margin: 12px 0 0; }
        .cs-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }

        .cs-verified { display: flex; align-items: flex-start; gap: 11px; padding: 14px 16px; border-radius: 13px; background: rgba(47,125,83,0.08); border: 1px solid rgba(47,125,83,0.2); }
        .cs-verified > svg { color: var(--agent-success, #2F7D53); flex-shrink: 0; margin-top: 1px; }
        .cs-vt { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--agent-text-primary); }
        .cs-vd { margin: 2px 0 0; font-size: 12.5px; color: var(--agent-text-secondary); }

        .cs-empty { display: flex; align-items: flex-start; gap: 13px; margin-bottom: 14px; }
        .cs-empty-ico { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; background: rgba(var(--agent-coral-rgb),0.10); color: var(--agent-coral-deep, #E2452A); }
        .cs-et { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--agent-text-primary); }
        .cs-ed { margin: 3px 0 0; font-size: 12.5px; color: var(--agent-text-muted); line-height: 1.55; max-width: 64ch; }

        .cs-form { display: flex; gap: 9px; flex-wrap: wrap; align-items: center; }
        .cs-input { flex: 1; min-width: 220px; padding: 9px 12px; font-size: 13.5px; color: var(--agent-text-primary); background: var(--agent-surface, #fff); border: 1px solid var(--agent-border-strong, rgba(0,0,0,0.16)); border-radius: 9px; outline: none; }
        .cs-input:focus { border-color: var(--agent-coral); }
      `}</style>
    </div>
  );
}
