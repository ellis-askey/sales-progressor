"use client";

// The Hub "Needs filing" tray. Emails the sync matched to real people/properties
// but couldn't place on a single file (usually a solicitor who acts on two of
// your sales). Each is one tap to the right file, or Dismiss. Zero-candidate
// noise never reaches here — it's dropped at ingest — so this stays short and
// action-led. Optimistic: a row leaves on tap and returns if the server rejects.

import { useState, useTransition } from "react";
import { EnvelopeSimple, ArrowDown, ArrowUp, Check, X } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { filePendingEmailAction, dismissPendingEmailAction } from "@/app/actions/pending-inbound";
import type { PendingInboundRow } from "@/lib/services/pending-inbound";

function ago(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NeedsFilingCard({ rows }: { rows: PendingInboundRow[] }) {
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const visible = rows.filter((r) => !removed.has(r.id));
  if (visible.length === 0) return null;

  const act = (
    pendingId: string,
    run: () => Promise<{ ok: boolean }>,
    okMsg: string | null,
    failMsg: string,
  ) => {
    setBusy(pendingId);
    setRemoved((prev) => new Set(prev).add(pendingId)); // optimistic
    startTransition(async () => {
      try {
        const res = await run();
        if (!res.ok) throw new Error("rejected");
        if (okMsg) toast.success(okMsg);
      } catch {
        setRemoved((prev) => { const n = new Set(prev); n.delete(pendingId); return n; });
        toast.error(failMsg);
      } finally {
        setBusy((c) => (c === pendingId ? null : c));
      }
    });
  };

  const file = (pendingId: string, transactionId: string, address: string) =>
    act(pendingId, () => filePendingEmailAction({ pendingId, transactionId }),
      `Filed to ${address || "the property"}`, "Couldn't file that email");

  const dismiss = (pendingId: string) =>
    act(pendingId, () => dismissPendingEmailAction({ pendingId }), null, "Couldn't dismiss that");

  return (
    <GlassCard glassId="hub-needs-filing" label="Hub · Needs filing" defaultVariant="v05" style={{ padding: "14px 16px", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <EnvelopeSimple size={16} weight="fill" style={{ color: "var(--agent-coral-deep)" }} />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>Needs filing</h3>
        <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>
          {visible.length} email{visible.length === 1 ? "" : "s"} to place on a file
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((r) => {
          const sent = r.direction === "outbound";
          const rowBusy = busy === r.id;
          return (
            <div
              key={r.id}
              style={{
                borderRadius: 10,
                border: "0.5px solid var(--agent-border-subtle)",
                background: "var(--agent-surface-glass)",
                padding: "10px 12px",
                opacity: rowBusy ? 0.6 : 1,
                transition: "opacity 120ms ease",
              }}
            >
              {/* Who + when */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
                    fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999,
                    color: sent ? "var(--agent-coral-deep)" : "#0f766e",
                    background: sent ? "rgba(var(--agent-coral-rgb), 0.10)" : "rgba(16,185,129,0.12)",
                  }}
                >
                  {sent ? <ArrowUp size={10} weight="bold" /> : <ArrowDown size={10} weight="bold" />}
                  {sent ? "Sent" : "Received"}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--agent-text-secondary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sent ? "To " : "From "}{r.partyName || r.partyEmail}
                </span>
                <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)", flexShrink: 0 }}>{ago(r.receivedAt)}</span>
              </div>

              {/* Subject + preview */}
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.subject || "(no subject)"}
              </p>
              {r.preview && (
                <p style={{ fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.4, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.preview}
                </p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                {r.candidates.length > 0 ? (
                  r.candidates.map((c) => (
                    <button
                      key={c.transactionId}
                      type="button"
                      disabled={rowBusy}
                      onClick={() => file(r.id, c.transactionId, c.address)}
                      className="agent-btn agent-btn-sm agent-btn-primary"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Check size={12} weight="bold" /> File to {c.address || "this file"}
                    </button>
                  ))
                ) : (
                  <span style={{ fontSize: 11, color: "var(--agent-text-tertiary)" }}>
                    Open the sale to file it, or dismiss.
                  </span>
                )}
                <button
                  type="button"
                  disabled={rowBusy}
                  onClick={() => dismiss(r.id)}
                  className="agent-link agent-link-muted"
                  style={{ marginLeft: "auto", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 3 }}
                >
                  <X size={12} weight="bold" /> Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
