"use client";

// Hub card: files whose hold-date has passed and still need a human
// decision. Two actions per row — "Take off hold" (reactivate) or "Extend
// hold" (push the date out). Each row animates out when actioned. When
// the last row leaves, the whole card collapses.
//
// Surface lives on the hub at /agent/hub. The parent server component
// fetches via getExpiredHolds(vis) and passes the initial list down. If
// the prop is empty we render nothing — the card is opt-in by presence.

import { useState, useTransition } from "react";
import Link from "next/link";
import { reactivateFile, extendHoldAction } from "@/app/actions/automation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { ExpiredHoldItem } from "@/lib/services/hub";

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}

function daysAgo(d: Date): string {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff < 1) return "today";
  if (diff < 2) return "yesterday";
  return `${diff} days ago`;
}

type RowState = "visible" | "exiting";

export function ExpiredHoldsCard({ initialItems }: { initialItems: ExpiredHoldItem[] }) {
  const { toast } = useAgentToast();
  const [items, setItems] = useState<ExpiredHoldItem[]>(initialItems);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [showExtenderFor, setShowExtenderFor] = useState<string | null>(null);
  const [cardExiting, setCardExiting] = useState(false);
  const [, startTransition] = useTransition();

  if (items.length === 0 && !cardExiting) return null;

  function removeRow(transactionId: string) {
    setRowState((s) => ({ ...s, [transactionId]: "exiting" }));
    setTimeout(() => {
      setItems((prev) => {
        const next = prev.filter((i) => i.transactionId !== transactionId);
        // If that was the last row, fade the whole card too.
        if (next.length === 0) setCardExiting(true);
        return next;
      });
    }, 220);
  }

  function handleTakeOff(transactionId: string) {
    startTransition(async () => {
      const result = await reactivateFile(transactionId);
      if (result.ok) {
        toast.success("Taken off hold");
        removeRow(transactionId);
      } else {
        toast.error(result.error ?? "Couldn't reactivate — try again");
      }
    });
  }

  function handleExtend(transactionId: string, plannedEndAt: Date | null) {
    startTransition(async () => {
      const result = await extendHoldAction(transactionId, plannedEndAt);
      if (result.ok) {
        toast.success("Hold extended");
        setShowExtenderFor(null);
        removeRow(transactionId);
      } else {
        toast.error(result.error ?? "Couldn't extend — try again");
      }
    });
  }

  return (
    <div
      className={cardExiting ? "agent-reveal-out" : "agent-reveal-in"}
      style={{
        background: "var(--agent-surface-elevated)",
        borderRadius: 14,
        border: "0.5px solid rgba(15,23,42,0.08)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "0.5px solid rgba(15,23,42,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>
            Holds needing attention
          </p>
          <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: "2px 0 0", lineHeight: 1.4 }}>
            {items.length === 1
              ? "1 file was meant to come off hold by now."
              : `${items.length} files were meant to come off hold by now.`}
          </p>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            background: "rgba(217,119,6,0.12)",
            color: "#b45309",
            padding: "2px 8px",
            borderRadius: 999,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          On hold
        </span>
      </div>

      <div>
        {items.map((item) => {
          const isExiting = rowState[item.transactionId] === "exiting";
          return (
            <div
              key={item.transactionId}
              className={isExiting ? "agent-row-exit" : undefined}
              style={{
                padding: "10px 16px",
                borderBottom: "0.5px solid rgba(15,23,42,0.06)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <Link
                  href={`/agent/transactions/${item.transactionId}`}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--agent-text-primary)",
                    textDecoration: "none",
                  }}
                >
                  {item.propertyAddress}
                </Link>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
                  Was due back {daysAgo(item.plannedEndAt)}
                  {item.agencyName ? ` · ${item.agencyName}` : ""}
                </p>
              </div>

              {showExtenderFor === item.transactionId ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => handleExtend(item.transactionId, addDays(7))}  className="agent-btn agent-btn-xs agent-btn-ghost-bordered">+ 7d</button>
                  <button onClick={() => handleExtend(item.transactionId, addDays(14))} className="agent-btn agent-btn-xs agent-btn-ghost-bordered">+ 14d</button>
                  <button onClick={() => handleExtend(item.transactionId, addDays(30))} className="agent-btn agent-btn-xs agent-btn-ghost-bordered">+ 30d</button>
                  <button onClick={() => handleExtend(item.transactionId, null)}        className="agent-btn agent-btn-xs agent-btn-ghost-bordered" title="Hold indefinitely — won't auto-surface again">Indefinitely</button>
                  <button onClick={() => setShowExtenderFor(null)} className="agent-link" style={{ fontSize: 11 }}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleTakeOff(item.transactionId)} className="agent-btn agent-btn-sm agent-btn-primary">
                    Take off hold
                  </button>
                  <button onClick={() => setShowExtenderFor(item.transactionId)} className="agent-btn agent-btn-sm agent-btn-ghost-bordered">
                    Extend
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
