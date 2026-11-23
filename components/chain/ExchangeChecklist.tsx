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
import { CaretRight } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { setChainLinkExchangeReadyAction } from "@/app/actions/chains";
import type { ExchangePush, ExchangePushRow } from "@/lib/services/exchange-push";
import { UserAvatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { buttonClasses } from "@/components/arc/button/button";
import { ChaseNeighbourDrawer } from "@/components/chase/ChaseNeighbourDrawer";

function rel(iso: string | null): string {
  if (!iso) return "never chased";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "chased today";
  if (days === 1) return "chased yesterday";
  return `chased ${days} days ago`;
}

export function ExchangeChecklist({ push }: { push: ExchangePush }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [rows, setRows] = useState<ExchangePushRow[]>(push.rows);
  const [busy, setBusy] = useState<string | null>(null);
  // The chain link currently being chased (opens the exchange chase drawer). #285
  const [chaseTarget, setChaseTarget] = useState<ExchangePushRow | null>(null);
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
      // Pass our file id so the confirm is logged to this file's activity feed.
      const res = await setChainLinkExchangeReadyAction(row.linkId, next, push.transactionId);
      if (!res.ok) {
        setRows((prev) => prev.map((r) => (r.linkId === row.linkId ? { ...r, ready: !next } : r)));
        toast.error(res.error);
      } else {
        router.refresh();
      }
      setBusy(null);
    });
  }

  return (
    <div
      style={{
        border: `1px solid ${allReady ? "rgba(var(--agent-success-rgb, 31,138,74),0.4)" : "rgba(var(--agent-coral-rgb),0.22)"}`,
        borderRadius: 16,
        background: "var(--agent-surface-elevated, #fff)",
        overflow: "hidden",
      }}
    >
      {/* Header — flips green + a Book CTA once everyone's ready. */}
      <div style={{ padding: "15px 16px 2px" }}>
        <h3 style={{ margin: "0 0 3px", fontSize: 16.5, fontWeight: 730, color: "var(--agent-text-primary)" }}>
          {allReady ? "The whole chain's ready to exchange." : "You're ready. Here's what's holding up the rest of the chain."}
        </h3>
        {!allReady && (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
            Mark each sale as ready once confirmed. We&apos;ll fill in what we know from linked sales, leaving you to confirm the rest as you chase.
          </p>
        )}
      </div>

      {/* Progress */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 6px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ProgressBar percent={(readyCount / total) * 100} height={9} color="var(--agent-success)" />
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--agent-success)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {readyCount} / {total} ready
        </span>
      </div>

      {/* Rows */}
      <style>{`
        .exc-row{display:flex;align-items:center;gap:12px;padding:10px 8px}
        .exc-main{display:flex;align-items:center;gap:12px;flex:1;min-width:0}
        .exc-ctrls{display:flex;align-items:center;gap:10px;flex-shrink:0}
        /* On a phone the one-line row crushed the address (critique: "16 Deans F…").
           Address takes the first line; the pill + Chase + toggle wrap beneath it,
           indented under the address and aligned right. */
        @media(max-width:560px){
          .exc-row{flex-wrap:wrap}
          .exc-main{flex-basis:100%}
          .exc-ctrls{width:100%;justify-content:flex-end;padding-left:40px}
        }
      `}</style>
      <div style={{ padding: "6px 8px 10px" }}>
        {rows.map((row, i) => {
          const confName = row.confirmedByName ?? push.viewerName;
          const confImage = row.confirmedByImage ?? push.viewerImage;
          return (
            <div
              key={row.linkId}
              className="exc-row"
              style={{
                borderTop: i > 0 ? "1px solid var(--agent-border-subtle)" : undefined,
                borderRadius: row.isUs ? 10 : 0,
              }}
            >
              <div className="exc-main">
                <PropertyThumb photoUrl={row.photoUrl} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.address}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)", marginTop: 1 }}>
                    {row.ours
                      ? `Your sale${row.agentName ? ` · added by ${row.agentName}` : ""}`
                      : [row.agentName, row.firmName].filter(Boolean).join(" · ") || "Not joined"}
                    {!row.ours && !row.ready && row.lastChasedAt ? ` · ${rel(row.lastChasedAt)}` : ""}
                  </div>
                </div>
              </div>
              <div className="exc-ctrls">
              {row.isUs ? (
                // Our own sale — who confirmed it (the viewer), with their avatar.
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                  <UserAvatar user={{ name: confName ?? "", image: confImage }} size={18} />
                  <span style={{ fontSize: 11, fontWeight: 650, color: "var(--agent-text-secondary)" }}>
                    {confName ? `Confirmed by ${confName}` : "Confirmed"}
                  </span>
                </span>
              ) : row.ready ? (
                // A chain link that's ready — the canonical tinted success pill.
                <Pill tone="success">Ready</Pill>
              ) : null /* not ready → no pill; the off toggle + Chase say it all */}
              {row.chaseable && !row.ready && (
                <button
                  type="button"
                  className="agent-link"
                  onClick={() => setChaseTarget(row)}
                  style={{ fontSize: 11.5, fontWeight: 650, border: 0, background: "none", cursor: "pointer", padding: "4px 2px", whiteSpace: "nowrap" }}
                >
                  Chase
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
            className={buttonClasses({ size: "md" })}
            style={{ background: "var(--agent-success)", color: "#fff" }}
          >
            Book the exchange
            <CaretRight size={14} weight="bold" />
          </Link>
        </div>
      )}

      {/* Chase a specific chain link to confirm it's ready to exchange. (#285) */}
      {chaseTarget && (
        <ChaseNeighbourDrawer
          transactionId={push.transactionId}
          chainLinkId={chaseTarget.linkId}
          neighbourName={chaseTarget.agentName}
          neighbourAddress={chaseTarget.address}
          onClose={() => setChaseTarget(null)}
          onSent={() => { setChaseTarget(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
