"use client";

// Phase E2b — the Hub "Needs filing" tray. Inbound emails the sync couldn't
// confidently file. Each shows its candidate files as one-tap "File here"
// buttons, plus Dismiss. Optimistic: the row disappears on tap, returns on
// server rejection.

import { useState, useTransition } from "react";
import { EnvelopeSimple, Check, X } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { filePendingEmailAction, dismissPendingEmailAction } from "@/app/actions/pending-inbound";
import type { PendingInboundRow } from "@/lib/services/pending-inbound";

export function NeedsFilingCard({ rows }: { rows: PendingInboundRow[] }) {
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const visible = rows.filter((r) => !removed.has(r.id));
  if (visible.length === 0) return null;

  const file = (pendingId: string, transactionId: string) => {
    setBusy(pendingId);
    setRemoved((prev) => new Set(prev).add(pendingId));
    startTransition(async () => {
      try {
        const res = await filePendingEmailAction({ pendingId, transactionId });
        if (!res.ok) throw new Error("rejected");
        toast.success("Filed to the property");
      } catch {
        setRemoved((prev) => { const n = new Set(prev); n.delete(pendingId); return n; });
        toast.error("Couldn't file that email");
      } finally {
        setBusy((c) => (c === pendingId ? null : c));
      }
    });
  };

  const dismiss = (pendingId: string) => {
    setBusy(pendingId);
    setRemoved((prev) => new Set(prev).add(pendingId));
    startTransition(async () => {
      try {
        const res = await dismissPendingEmailAction({ pendingId });
        if (!res.ok) throw new Error("rejected");
      } catch {
        setRemoved((prev) => { const n = new Set(prev); n.delete(pendingId); return n; });
        toast.error("Couldn't dismiss that");
      } finally {
        setBusy((c) => (c === pendingId ? null : c));
      }
    });
  };

  return (
    <GlassCard glassId="hub-needs-filing" label="Hub · Needs filing" defaultVariant="v05" style={{ padding: "14px 16px", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <EnvelopeSimple size={16} weight="fill" style={{ color: "var(--agent-coral-deep)" }} />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>Needs filing</h3>
        <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>
          {visible.length} email{visible.length === 1 ? "" : "s"} we couldn&rsquo;t match to a file
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((r) => (
          <div key={r.id} style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.subject || "(no subject)"}
              </span>
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0 }}>
                {r.direction === "outbound" ? "To: " : "From: "}{r.partyName || r.partyEmail}
              </span>
            </div>
            {r.preview && (
              <p style={{ fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.4, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.preview}
              </p>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
              {r.candidates.length > 0 ? (
                r.candidates.map((c) => (
                  <button
                    key={c.transactionId}
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => file(r.id, c.transactionId)}
                    className="agent-btn agent-btn-sm agent-btn-primary"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Check size={12} weight="bold" /> File to {c.address || "this file"}
                  </button>
                ))
              ) : (
                <span style={{ fontSize: 11, color: "var(--agent-text-tertiary)" }}>
                  No suggested file — open the sale and file it there, or dismiss.
                </span>
              )}
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => dismiss(r.id)}
                aria-label="Dismiss"
                title="Dismiss"
                className="agent-icon-btn agent-icon-btn-sm"
                style={{ marginLeft: "auto" }}
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
