"use client";

// Hub card: files that have gone quiet — a client who was engaging and stopped,
// one who never engaged, or a file with no communication logged for 10+ days.
// Read-only surfacing of the nightly problem-detection flags, one row per file,
// longest-standing concern first. Rows link straight to the file. Deliberately
// separate from the attention card: an overdue step is a different thing from a
// whole file going quiet.
//
// Surface lives on the hub at /agent/hub (internal staff only for now). Parent
// fetches via getGoneQuietFiles(vis) and passes the list down. Empty → renders
// nothing (opt-in by presence).

import { useState } from "react";
import Link from "next/link";
import { Clock, HouseLine, CaretDown } from "@phosphor-icons/react";

export type GoneQuietCardItem = {
  transactionId: string;
  propertyAddress: string;
  kind: string;
  reason: string | null;
  // ISO date string (serialised from the server Date).
  detectedAt: string;
};

const ACCENT = "#64748B"; // slate — "watch", not an emergency

function flaggedLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Flagged today";
  if (days === 1) return "Flagged yesterday";
  return `Flagged ${days} days ago`;
}

// Fallback one-liner when a flag has no written reason yet.
function fallbackReason(kind: string): string {
  if (kind === "portal_gone_quiet") return "A client was checking in and has gone quiet.";
  if (kind === "no_portal_activity") return "The portal is set up but the client hasn't engaged.";
  return "No communication logged on this file recently.";
}

export function GoneQuietCard({ items }: { items: GoneQuietCardItem[] }) {
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;

  return (
    <div
      className="agent-reveal-in"
      style={{
        background: "var(--agent-surface-elevated)",
        borderRadius: 14,
        border: "0.5px solid rgba(15,23,42,0.08)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        style={{
          width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
          background: "transparent", border: "none",
          borderBottom: collapsed ? "none" : "0.5px solid rgba(15,23,42,0.08)",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span aria-hidden style={{
          width: 34, height: 34, borderRadius: 999, background: "rgba(100,116,139,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: ACCENT,
        }}>
          <Clock size={17} weight="bold" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              Gone quiet
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999,
              background: "rgba(15,23,42,0.06)", color: "var(--agent-text-secondary)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {items.length}
            </span>
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
            {items.length === 1
              ? "1 file has gone quiet and may need a personal nudge."
              : `${items.length} files have gone quiet and may need a personal nudge.`}
          </span>
        </span>
        <span aria-hidden style={{
          color: "var(--agent-text-muted)", display: "flex", alignItems: "center",
          transition: "transform 180ms ease", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
        }}>
          <CaretDown size={14} weight="bold" />
        </span>
      </button>

      {/* Rows */}
      {!collapsed && (
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <div key={item.transactionId} style={{
              position: "relative", borderRadius: 10, background: "rgba(100,116,139,0.04)",
              border: "0.5px solid rgba(15,23,42,0.06)", borderLeft: `3px solid ${ACCENT}`,
              padding: "12px 14px",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span aria-hidden style={{
                  width: 30, height: 30, borderRadius: 999, background: "rgba(100,116,139,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: ACCENT, marginTop: 1,
                }}>
                  <HouseLine size={15} weight="bold" />
                </span>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <Link href={`/agent/transactions/${item.transactionId}`} style={{
                    fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textDecoration: "none",
                  }}>
                    {item.propertyAddress}
                  </Link>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                    {item.reason ?? fallbackReason(item.kind)}
                  </p>
                </div>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 5, marginTop: 10,
                fontSize: 11, color: "var(--agent-text-muted)",
              }}>
                <Clock size={12} />
                {flaggedLabel(item.detectedAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
