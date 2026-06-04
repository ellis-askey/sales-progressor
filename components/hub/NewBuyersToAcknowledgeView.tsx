"use client";

// Phase 1 commit 8b — hub card surfaced for outsourced files where
// the active round was created by a relist and no one on the SP team
// has clicked Acknowledge yet.
//
// LOCKED COPY (Ellis voice-pass, 2026-06-04). Do not paraphrase:
//   Group header:   "New buyer added"
//   Card title:     {propertyAddress}   (matches the assign card layout)
//   Body line:      "{buyerName} is the new buyer (round {roundNumber}). Relisted {date}."
//   Button:         "Acknowledge"
//
// The card stays visible until the SP clicks Acknowledge. Clicking
// stamps BuyerRound.relistAcknowledgedAt + relistAcknowledgedById and
// the card disappears; nothing else changes downstream. A second
// relist (round 3) creates a fresh BuyerRound with relistAcknowledgedAt
// = NULL, so the card naturally re-raises — each round needs its own
// click.

import { useState, useTransition } from "react";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { acknowledgeRelistAction } from "@/app/actions/transactions";
import type { HubRelistAck } from "@/lib/services/hub";

function fmtRelistedDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function NewBuyersToAcknowledgeView({ initialRounds }: { initialRounds: HubRelistAck[] }) {
  const [rounds, setRounds] = useState(initialRounds);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [_isPending, startTransition] = useTransition();

  if (rounds.length === 0) return null;

  function acknowledge(roundId: string) {
    setPendingId(roundId);
    startTransition(async () => {
      try {
        await acknowledgeRelistAction(roundId);
        setRounds((prev) => prev.filter((r) => r.roundId !== roundId));
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div
      className="agent-glass-strong"
      style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}
    >
      {/* Header — matches "Needs assigning" chrome */}
      <div className="agent-card-hdr" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Sparkle size={15} color="var(--agent-text-muted)" />
          <div>
            <p className="agent-card-title-emphasis">New buyer added</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
              Outsourced files relisted with a new buyer.
            </p>
          </div>
        </div>
      </div>

      {/* Rows */}
      {rounds.slice(0, 5).map((r, i) => (
        <div
          key={r.roundId}
          style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "13px 20px 13px 17px",
            borderLeft: "3px solid var(--agent-coral)",
            background: "var(--agent-coral-bg-tint)",
            borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 500,
              color: "var(--agent-text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {r.propertyAddress}
            </p>
            <p style={{
              margin: "2px 0 0", fontSize: 11,
              color: "var(--agent-text-secondary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {/* LOCKED BODY LINE — voice-passed verbatim */}
              {r.newBuyerName} is the new buyer (round {r.roundNumber}). Relisted {fmtRelistedDate(r.relistedAt)}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => acknowledge(r.roundId)}
            disabled={pendingId === r.roundId}
            style={{
              flexShrink: 0,
              fontSize: 11, fontWeight: 600,
              color: "var(--agent-coral-deep)",
              background: "none", border: "none",
              cursor: pendingId === r.roundId ? "default" : "pointer",
              padding: 0,
              opacity: pendingId === r.roundId ? 0.5 : 1,
            }}
          >
            {pendingId === r.roundId ? "…" : "Acknowledge"}
          </button>
        </div>
      ))}
    </div>
  );
}
