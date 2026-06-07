"use client";

// Hub card: files whose hold-date has passed and still need a human
// decision. Two actions per row — "Take off hold" (reactivate) or "Extend
// hold" (push the date out via calendar picker or indefinitely). Rows
// smoothly collapse when actioned (auto-animate handles the height
// transition). When the last row leaves, the whole card disappears and
// the layout below shifts up.
//
// Surface lives on the hub at /agent/hub. The parent server component
// fetches via getExpiredHolds(vis) and passes the initial list down. If
// the prop is empty we render nothing — the card is opt-in by presence.

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Link from "next/link";
import { reactivateFile, extendHoldAction, pauseClientEmails } from "@/app/actions/automation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import type { ExpiredHoldItem } from "@/lib/services/hub";

function formatDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function tomorrowAt9(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function daysAgo(d: Date): string {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff < 1) return "today";
  if (diff < 2) return "yesterday";
  return `${diff} days ago`;
}

export function ExpiredHoldsCard({ initialItems }: { initialItems: ExpiredHoldItem[] }) {
  const { toast } = useAgentToast();
  const { theme, isNight } = usePortalTheme();
  const [items, setItems] = useState<ExpiredHoldItem[]>(initialItems);
  const [showExtenderFor, setShowExtenderFor] = useState<string | null>(null);
  const [extenderDate, setExtenderDate] = useState<string>("");
  const [cardExiting, setCardExiting] = useState(false);
  const [, startTransition] = useTransition();
  // auto-animate handles row-removal collapse smoothly — height + opacity
  // transition handled by the lib; sibling elements below the card shift
  // up naturally because we remove the element from the DOM.
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  if (items.length === 0 && !cardExiting) return null;

  function removeRow(transactionId: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.transactionId !== transactionId);
      // If that was the last row, fade the whole card too.
      if (next.length === 0) setCardExiting(true);
      return next;
    });
  }

  // Resume modal — fires when user clicks "Take off hold" so they can
  // choose to resume client chases or keep them paused.
  const [resumeFor, setResumeFor] = useState<{ id: string; address: string } | null>(null);

  function openResume(transactionId: string, address: string) {
    setResumeFor({ id: transactionId, address });
  }
  function doResume(transactionId: string, keepEmailsPaused: boolean) {
    setResumeFor(null);
    startTransition(async () => {
      const result = await reactivateFile(transactionId);
      if (result.ok) {
        if (keepEmailsPaused) {
          // fire-and-forget; the row is already animating out
          pauseClientEmails(transactionId).catch(() => {});
        }
        toast.success(keepEmailsPaused ? "Off hold: emails stay paused" : "Off hold: automation resumed");
        removeRow(transactionId);
      } else {
        toast.error(result.error ?? "Couldn't reactivate. Try again.");
      }
    });
  }

  function handleExtend(transactionId: string, plannedEndAt: Date | null) {
    startTransition(async () => {
      const result = await extendHoldAction(transactionId, plannedEndAt);
      if (result.ok) {
        toast.success("Hold extended");
        setShowExtenderFor(null);
        setExtenderDate("");
        removeRow(transactionId);
      } else {
        toast.error(result.error ?? "Couldn't extend. Try again.");
      }
    });
  }

  function openExtender(transactionId: string) {
    setShowExtenderFor(transactionId);
    setExtenderDate("");
  }
  function closeExtender() {
    setShowExtenderFor(null);
    setExtenderDate("");
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

      <div ref={listRef}>
        {items.map((item) => (
          <div
            key={item.transactionId}
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
                <input
                  type="date"
                  value={extenderDate}
                  onChange={(e) => setExtenderDate(e.target.value)}
                  min={formatDateInput(tomorrowAt9())}
                  className="glass-input"
                  style={{ padding: "6px 10px", fontSize: 12 }}
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (!extenderDate) return;
                    // Guard against hand-typed past dates — `min` is only a
                    // picker hint. Server also rejects, this is the fast UX.
                    if (extenderDate < formatDateInput(tomorrowAt9())) {
                      toast.error("Pick a future date");
                      return;
                    }
                    handleExtend(item.transactionId, new Date(extenderDate));
                  }}
                  disabled={!extenderDate || extenderDate < formatDateInput(tomorrowAt9())}
                  className="agent-btn agent-btn-xs agent-btn-primary"
                >
                  Set date
                </button>
                <button
                  onClick={() => handleExtend(item.transactionId, null)}
                  className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
                  title="Hold indefinitely. Won't auto-surface again."
                >
                  Indefinitely
                </button>
                <button onClick={closeExtender} className="agent-link" style={{ fontSize: 11 }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => openResume(item.transactionId, item.propertyAddress)} className="agent-btn agent-btn-sm agent-btn-primary">
                  Take off hold
                </button>
                <button onClick={() => openExtender(item.transactionId)} className="agent-btn agent-btn-sm agent-btn-ghost-bordered">
                  Extend
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {resumeFor && createPortal(
        <div
          data-theme={theme}
          data-night={isNight ? "" : undefined}
          className="nv2-night"
          style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div className="fixed inset-0 agent-backdrop-overlay" onClick={() => setResumeFor(null)} style={{ zIndex: 0 }} />

          <div
            className="rounded-2xl w-full max-w-md"
            style={{
              position: "relative",
              zIndex: 1,
              background: "var(--agent-surface-elevated)",
              border: "0.5px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", gap: 12 }}>
              <h2 style={{ flex: 1, margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Take off hold</h2>
              <button type="button" onClick={() => setResumeFor(null)} aria-label="Close" className="agent-icon-btn agent-icon-btn-md">×</button>
            </div>

            <div className="px-6 py-5 space-y-3">
              <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                <strong style={{ color: "var(--agent-text-primary)", fontWeight: 600 }}>{resumeFor.address}</strong>
                {", pick one. You can always change later."}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ResumeOptionCard
                  title="Resume automation"
                  description="Client chase emails, reminders + escalations restart from where they left off."
                  onClick={() => doResume(resumeFor.id, false)}
                />
                <ResumeOptionCard
                  title="Reactivate, keep emails paused"
                  description="File is active again but no client emails fire. Manual chasing only. Flip back on from the Automation card any time."
                  onClick={() => doResume(resumeFor.id, true)}
                />
              </div>
            </div>

            <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setResumeFor(null)}
                className="agent-link"
                style={{ padding: "10px 6px", fontSize: 13, fontWeight: 500 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ResumeOptionCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "12px 14px",
        background: "var(--agent-surface-glass)",
        border: "0.5px solid rgba(15,23,42,0.10)",
        borderRadius: 12,
        cursor: "pointer",
        transition: "background 150ms, border-color 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--agent-hover-tint, rgba(255,107,74,0.06))";
        e.currentTarget.style.borderColor = "rgba(255,107,74,0.30)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--agent-surface-glass)";
        e.currentTarget.style.borderColor = "rgba(15,23,42,0.10)";
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>{title}</p>
      <p style={{ fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5, margin: "4px 0 0" }}>{description}</p>
    </button>
  );
}
