"use client";

// Hub card: files whose hold-date has passed and still need a human
// decision. Two actions per row — "Take off hold" (reactivate) or "Extend
// hold" (push the date out via calendar picker or indefinitely). Rows
// smoothly collapse when actioned (auto-animate handles the height
// transition). When the last row leaves, the whole card disappears and
// the layout below shifts up.
//
// 2026-08-08 layout pass (founder mock): icon header + count chip,
// collapsible body, per-row accent bar, overdue pill, hold-started date,
// placed-by attribution and the captured hold reason. All behaviour
// (resume modal, inline extender, row collapse, toasts) unchanged.
//
// Surface lives on the hub at /agent/hub. The parent server component
// fetches via getExpiredHolds(vis) and passes the initial list down. If
// the prop is empty we render nothing — the card is opt-in by presence.

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Link from "next/link";
import {
  Warning,
  HouseLine,
  Clock,
  CalendarBlank,
  CalendarPlus,
  User,
  Check,
  CaretDown,
  Note,
} from "@phosphor-icons/react";
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

function overdueLabel(d: Date): string {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff < 1) return "Due back today";
  if (diff < 2) return "Overdue by 1 day";
  return `Overdue by ${diff} days`;
}

function formatShortDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const DANGER = "var(--agent-danger, #C73E3E)";

export function ExpiredHoldsCard({ initialItems }: { initialItems: ExpiredHoldItem[] }) {
  const { toast } = useAgentToast();
  const { theme, isNight } = usePortalTheme();
  const [items, setItems] = useState<ExpiredHoldItem[]>(initialItems);
  const [collapsed, setCollapsed] = useState(false);
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
      {/* ── Header — icon badge + title + count chip, chevron toggles body ── */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        style={{
          width: "100%",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "transparent",
          border: "none",
          borderBottom: collapsed ? "none" : "0.5px solid rgba(15,23,42,0.08)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "rgba(199,62,62,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: DANGER,
          }}
        >
          <Warning size={17} weight="bold" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              Holds needing attention
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.06)",
                color: "var(--agent-text-secondary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {items.length}
            </span>
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
            {items.length === 1
              ? "1 file was meant to come off hold by now."
              : `${items.length} files were meant to come off hold by now.`}
          </span>
        </span>
        <span
          aria-hidden
          style={{
            color: "var(--agent-text-muted)",
            display: "flex",
            alignItems: "center",
            transition: "transform 180ms ease",
            transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
          }}
        >
          <CaretDown size={14} weight="bold" />
        </span>
      </button>

      {/* ── Rows ── */}
      {!collapsed && (
        <div ref={listRef} style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.transactionId}
              style={{
                position: "relative",
                borderRadius: 10,
                background: "rgba(199,62,62,0.035)",
                border: "0.5px solid rgba(15,23,42,0.06)",
                borderLeft: `3px solid ${DANGER}`,
                padding: "12px 14px",
              }}
            >
              {/* Top line: house icon + address/agency + ON HOLD pill */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span
                  aria-hidden
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    background: "rgba(199,62,62,0.10)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: DANGER,
                    marginTop: 1,
                  }}
                >
                  <HouseLine size={15} weight="bold" />
                </span>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
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
                  {item.agencyName && (
                    <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
                      {item.agencyName}
                    </p>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: "rgba(15,23,42,0.06)",
                    color: "var(--agent-text-secondary)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  On hold
                </span>
              </div>

              {/* Meta strip: overdue pill · hold started · placed by */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 10,
                  fontSize: 11,
                  color: "var(--agent-text-muted)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontWeight: 600,
                    color: DANGER,
                    background: "rgba(199,62,62,0.10)",
                    padding: "3px 9px",
                    borderRadius: 999,
                  }}
                >
                  <Clock size={12} weight="bold" />
                  {overdueLabel(item.plannedEndAt)}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <CalendarBlank size={12} />
                  Hold started {formatShortDate(item.startedAt)}
                </span>
                {item.placedByName && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <User size={12} />
                    Placed by {item.placedByName}
                  </span>
                )}
              </div>

              {/* Reason line — only when one was captured at hold time */}
              {item.reason && (
                <p
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 5,
                    margin: "8px 0 0",
                    fontSize: 11,
                    color: "var(--agent-text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  <Note size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    <strong style={{ fontWeight: 600, color: "var(--agent-text-primary)" }}>Reason:</strong>{" "}
                    {item.reason}
                  </span>
                </p>
              )}

              {/* Actions — extender swaps in place of the two buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                {showExtenderFor === item.transactionId ? (
                  <div data-testid="hub-expired-holds-extender" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
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
                    <button
                      onClick={() => openResume(item.transactionId, item.propertyAddress)}
                      className="agent-btn agent-btn-sm agent-btn-primary"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Check size={13} weight="bold" />
                      Take off hold
                    </button>
                    <button
                      onClick={() => openExtender(item.transactionId)}
                      className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <CalendarPlus size={13} weight="bold" />
                      Extend hold
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
