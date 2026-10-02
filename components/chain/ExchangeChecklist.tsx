"use client";

// The shared "chase the chain to exchange" checklist. One component, two homes:
// the file Overview panel (ExchangePushPanel) and the chains "Push to exchange"
// tab. It renders a sale's own readiness plus a row per OTHER sale in the chain,
// each a ready/not-yet toggle we own (confirmed by phone), filled in from their
// file where we're allowed to see it. Toggling writes the shared ChainLink stamp
// via setChainLinkExchangeReadyAction, so a tick here shows in the other home
// too. Critique 2026-10-02.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { setChainLinkExchangeReadyAction, markChainLinkChasedAction } from "@/app/actions/chains";
import type { ExchangePush, ExchangePushRow, ExchangeReadySource } from "@/lib/services/exchange-push";

function rel(iso: string | null): string {
  if (!iso) return "never chased";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "chased today";
  if (days === 1) return "chased yesterday";
  return `chased ${days} days ago`;
}

const SOURCE_TEXT: Record<ExchangeReadySource, string> = {
  exchanged: "Exchanged",
  confirmed: "You confirmed",
  their_file: "From their file",
  not_yet: "Not yet",
};

export function ExchangeChecklist({ push }: { push: ExchangePush }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [rows, setRows] = useState<ExchangePushRow[]>(push.rows);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Re-seed from the server after a revalidate so both homes stay in step.
  useEffect(() => { setRows(push.rows); }, [push.rows]);

  const readyCount = rows.filter((r) => r.ready).length;
  const total = rows.length;
  const allReady = readyCount === total;

  function toggle(row: ExchangePushRow) {
    if (row.isUs) return;
    const next = !row.ready;
    // Optimistic: flip locally, then persist + refresh so the other home updates.
    setRows((prev) => prev.map((r) => (r.linkId === row.linkId ? { ...r, ready: next, source: next ? "confirmed" : "not_yet" } : r)));
    setBusy(row.linkId);
    startTransition(async () => {
      const res = await setChainLinkExchangeReadyAction(row.linkId, next);
      if (!res.ok) {
        setRows((prev) => prev.map((r) => (r.linkId === row.linkId ? { ...r, ready: !next } : r)));
        toast.error(res.error);
      } else {
        router.refresh();
      }
      setBusy(null);
    });
  }

  function chase(row: ExchangePushRow) {
    setBusy(row.linkId + "-chase");
    startTransition(async () => {
      const res = await markChainLinkChasedAction(row.linkId);
      if (res.ok) {
        toast.success(`Marked chased${row.firmName ? ` · ${row.firmName}` : ""}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
      setBusy(null);
    });
  }

  return (
    <div
      style={{
        border: `1px solid ${allReady ? "rgba(var(--agent-success-rgb, 31,138,74),0.4)" : "rgba(var(--agent-coral-rgb),0.22)"}`,
        borderRadius: 16,
        background: allReady
          ? "linear-gradient(180deg, rgba(var(--agent-success-rgb, 31,138,74),0.08), var(--agent-surface-elevated,#fff))"
          : "linear-gradient(180deg, rgba(var(--agent-coral-rgb),0.045), var(--agent-surface-elevated,#fff))",
        overflow: "hidden",
      }}
    >
      {/* Header — flips green + a Book CTA once everyone's ready. */}
      <div style={{ padding: "15px 16px 2px" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: allReady ? "var(--agent-success)" : "var(--agent-coral-deep)" }}>
          {allReady ? "Chain ready" : "Pushing for exchange"}
        </span>
        <h3 style={{ margin: "6px 0 3px", fontSize: 16.5, fontWeight: 730, color: "var(--agent-text-primary)" }}>
          {allReady ? "The whole chain's ready to exchange." : "You're ready. The chain isn't — here's who's left."}
        </h3>
        {!allReady && (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
            Tick each sale ready as you confirm it. We fill it in from their file where we can see it; the rest you confirm as you chase.
          </p>
        )}
      </div>

      {/* Progress */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 6px" }}>
        <span style={{ flex: 1, height: 9, borderRadius: 99, background: "rgba(42,23,16,0.06)", overflow: "hidden" }}>
          <i style={{ display: "block", height: "100%", width: `${Math.round((readyCount / total) * 100)}%`, borderRadius: 99, background: "linear-gradient(90deg, var(--agent-success), #2bb56a)", transition: "width 450ms cubic-bezier(0.16,1,0.3,1)" }} />
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--agent-success)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {readyCount} / {total} ready
        </span>
      </div>

      {/* Rows */}
      <div style={{ padding: "6px 8px 10px" }}>
        {rows.map((row, i) => {
          const dotBg = row.isUs ? "var(--agent-success)" : row.kind === "claimed" ? "var(--agent-text-secondary)" : "#c6b9a8";
          return (
            <div
              key={row.linkId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 8px",
                borderTop: i > 0 ? "1px solid var(--agent-border-subtle)" : undefined,
                borderRadius: row.isUs ? 10 : 0,
                background: row.isUs ? "rgba(var(--agent-success-rgb, 31,138,74),0.05)" : undefined,
              }}
            >
              <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: dotBg, color: "#fff", fontSize: 12, fontWeight: 800 }}>
                {row.isUs ? "★" : row.kind === "claimed" ? "◆" : "◇"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.address}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)", marginTop: 1 }}>
                  {row.isUs ? "Your sale · both sides confirmed" : [row.agentName, row.firmName].filter(Boolean).join(" · ") || "Not joined"}
                  {!row.isUs && !row.ready ? ` · ${rel(row.lastChasedAt)}` : ""}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 650,
                  whiteSpace: "nowrap",
                  padding: "3px 9px",
                  borderRadius: 99,
                  color: row.ready ? (row.source === "confirmed" ? "var(--agent-coral-deep)" : "var(--agent-success)") : "var(--agent-text-muted)",
                  background: row.ready ? (row.source === "confirmed" ? "rgba(var(--agent-coral-rgb),0.1)" : "rgba(var(--agent-success-rgb, 31,138,74),0.1)") : "rgba(42,23,16,0.05)",
                }}
              >
                {SOURCE_TEXT[row.source]}
              </span>
              {row.chaseable && !row.ready && (
                <button
                  onClick={() => chase(row)}
                  disabled={busy === row.linkId + "-chase"}
                  style={{ fontSize: 11.5, fontWeight: 650, color: "var(--agent-coral-deep)", background: "none", border: 0, cursor: "pointer", padding: "4px 2px", whiteSpace: "nowrap" }}
                >
                  {busy === row.linkId + "-chase" ? "…" : "Chase"}
                </button>
              )}
              {/* Toggle (locked green for our own sale) */}
              <button
                onClick={() => toggle(row)}
                disabled={row.isUs || busy === row.linkId}
                aria-label={row.ready ? "Ready to exchange" : "Not ready"}
                aria-pressed={row.ready}
                style={{
                  position: "relative",
                  width: 44,
                  height: 26,
                  borderRadius: 99,
                  border: 0,
                  flexShrink: 0,
                  padding: 0,
                  cursor: row.isUs ? "default" : "pointer",
                  opacity: row.isUs ? 0.65 : 1,
                  background: row.ready ? "var(--agent-success)" : "#d8cdbf",
                  transition: "background 250ms ease",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 3,
                    left: row.ready ? 21 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    transition: "left 250ms cubic-bezier(0.3,1.4,0.5,1)",
                  }}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Book the exchange — live once everyone's green. */}
      {allReady && (
        <div style={{ padding: "4px 16px 18px", textAlign: "center" }}>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--agent-text-muted)" }}>
            Every sale has confirmed ready. Coordinate the exchange day with the solicitors.
          </p>
          <Link
            href={`/agent/transactions/${push.transactionId}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(180deg, var(--agent-success), #17703b)", color: "#fff", borderRadius: 11, padding: "11px 22px", fontSize: 14, fontWeight: 720, textDecoration: "none", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 16px rgba(var(--agent-success-rgb, 31,138,74),0.3)" }}
          >
            Book the exchange →
          </Link>
        </div>
      )}
    </div>
  );
}
