"use client";

// Closed-loop chain arc (2026-06-05) — hub card surfaced for files where
// the relist modal collected "Don't know yet" for the new buyer's onward
// sale. Mirrors NewBuyersToAcknowledgeView's chrome so the two cards feel
// like one family: same glass-card, same coral accent, same in-row Dismiss
// button that clears the flag.
//
// Two paths to dismiss the flag:
//   1. The agent navigates to the file, attaches the buyer's onward
//      chain via the chain widget — that flow already clears the flag.
//   2. The agent confirms there's no onward chain (first-time / cash
//      buyer) by clicking "No onward sale" on the card itself.

import { useState, useTransition } from "react";
import { Link } from "@phosphor-icons/react/dist/ssr";
import Link2 from "next/link";
import { clearChainSetupPendingAction } from "@/app/actions/transactions";
import type { HubChainSetupPending } from "@/lib/services/hub";

function fmtFlaggedDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ChainSetupPendingView({ initialFiles }: { initialFiles: HubChainSetupPending[] }) {
  const [files, setFiles] = useState(initialFiles);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [_isPending, startTransition] = useTransition();

  if (files.length === 0) return null;

  function dismiss(transactionId: string) {
    setPendingId(transactionId);
    startTransition(async () => {
      try {
        await clearChainSetupPendingAction(transactionId);
        setFiles((prev) => prev.filter((f) => f.transactionId !== transactionId));
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
      <div className="agent-card-hdr" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Link size={15} color="var(--agent-text-muted)" />
          <div>
            <p className="agent-card-title-emphasis">Complete chain setup</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
              Files relisted without their new buyer&apos;s onward sale confirmed.
            </p>
          </div>
        </div>
      </div>

      {files.slice(0, 5).map((f, i) => (
        <div
          key={f.transactionId}
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
            <Link2
              href={`/agent/transactions/${f.transactionId}`}
              style={{
                margin: 0, fontSize: 12, fontWeight: 500,
                color: "var(--agent-text-primary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                textDecoration: "none",
                display: "block",
              }}
              className="hover:underline"
            >
              {f.propertyAddress}
            </Link2>
            <p style={{
              margin: "2px 0 0", fontSize: 11,
              color: "var(--agent-text-secondary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {f.newBuyerName ? `${f.newBuyerName}'s onward sale is unconfirmed. ` : "New buyer's onward sale is unconfirmed. "}
              Flagged {fmtFlaggedDate(f.flaggedAt)}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(f.transactionId)}
            disabled={pendingId === f.transactionId}
            style={{
              flexShrink: 0,
              fontSize: 11, fontWeight: 600,
              color: "var(--agent-coral-deep)",
              background: "none", border: "none",
              cursor: pendingId === f.transactionId ? "default" : "pointer",
              padding: 0,
              opacity: pendingId === f.transactionId ? 0.5 : 1,
            }}
          >
            {pendingId === f.transactionId ? "…" : "Mark sorted"}
          </button>
        </div>
      ))}
    </div>
  );
}
