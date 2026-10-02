"use client";

// Chains → "Check-ins" tab.
//
// Every claimed sale in the agent's chains that isn't theirs — other agents'
// files — as a "who do I chase next" list, sorted least-recently-touched first
// (the service does the sort). The staleness signal is adaptive: internal TSP
// staff see each sale's real last-activity date (C); customer agencies see when
// WE last chased that agent (A), the privacy-safe signal. "Mark chased" stamps
// the chase so the row drops down the list. Critique 2026-10-02.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { markChainLinkChasedAction } from "@/app/actions/chains";
import type { CheckInRow } from "@/lib/services/chains";

// "3 days ago" / "yesterday" / "today" / "2 weeks ago".
function rel(iso: string | null): string {
  if (!iso) return "no contact yet";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 56) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

// Age in days for the staleness tint (older = hotter).
function ageDays(iso: string | null): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function CheckInsList({ rows }: { rows: CheckInRow[] }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function markChased(row: CheckInRow) {
    setBusy(row.linkId);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: "0 0 2px", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
        Other agents&apos; sales in your chains, quietest first. Chase the ones at the top, then mark them so they drop down.
      </p>
      {rows.map((row) => {
        // The staleness signal shown + sorted on: real last-activity where we can
        // see it, else when we last chased them.
        const primaryIso = row.lastActivityAt ?? row.lastChasedAt;
        const age = ageDays(primaryIso);
        const tone = age >= 14 ? "var(--agent-danger)" : age >= 7 ? "var(--agent-warning)" : "var(--agent-text-secondary)";
        const toneBg = age >= 14 ? "rgba(var(--agent-danger-rgb),0.1)" : age >= 7 ? "rgba(var(--agent-warning-rgb),0.12)" : "rgba(45,24,16,0.05)";
        const who = row.agentName ?? "Another agent";
        const pct = row.progressPercent;
        return (
          <div
            key={row.linkId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              padding: "13px 16px",
              borderRadius: 13,
              background: "var(--agent-surface-elevated, #fff)",
              border: "1px solid var(--agent-border-subtle)",
              boxShadow: "0 1px 2px rgba(45,24,16,0.04)",
            }}
          >
            {/* Property + who to chase */}
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 650, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.address}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>
                {who}
                {row.firmName ? <span> · {row.firmName}</span> : null}
              </p>
            </div>

            {/* Progress */}
            <div style={{ flex: "0 0 96px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "block", flex: 1, height: 6, borderRadius: 4, background: "var(--agent-border-subtle)", overflow: "hidden" }}>
                <i style={{ display: "block", height: "100%", width: `${pct ?? 0}%`, background: "linear-gradient(90deg, var(--agent-coral), var(--agent-coral-deep))" }} />
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--agent-text-secondary)", minWidth: 30, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {pct == null ? "—" : `${pct}%`}
              </span>
            </div>

            {/* Staleness */}
            <div style={{ flex: "0 0 auto", textAlign: "right" }}>
              <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, color: tone, background: toneBg, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>
                {row.lastActivityAt ? `Active ${rel(row.lastActivityAt)}` : row.lastChasedAt ? `Chased ${rel(row.lastChasedAt)}` : "No contact yet"}
              </span>
              {/* When we can see their activity, still show when WE last chased, so you don't double-chase. */}
              {row.lastActivityAt && row.lastChasedAt && (
                <p style={{ margin: "3px 0 0", fontSize: 10.5, color: "var(--agent-text-muted)" }}>chased {rel(row.lastChasedAt)}</p>
              )}
            </div>

            {/* Action */}
            <button
              onClick={() => markChased(row)}
              disabled={busy === row.linkId}
              style={{
                flex: "0 0 auto",
                border: "1px solid var(--agent-border-default)",
                borderRadius: 9,
                padding: "8px 14px",
                fontFamily: "inherit",
                fontSize: 12.5,
                fontWeight: 650,
                color: "var(--agent-coral-deep)",
                background: "var(--agent-surface-elevated, #fff)",
                cursor: busy === row.linkId ? "wait" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {busy === row.linkId ? "Saving…" : "Mark chased"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
