"use client";

// "Reviews due" — the top section of /agent/to-do. Dated "come back to this
// file" items: files on hold with a return date (incl. chain-collapse waits and
// remarketing pauses, which the app already models as holds) plus hand-typed
// reviews. Read-model lives in lib/services/reviews.ts.
//
// Hold rows carry the real actions (Take off hold → resume chooser, Extend →
// inline date) reusing the same server actions the hub used, so behaviour is
// unchanged — the surface just moved here so the hub's needs-you is cleanly
// steps-to-chase. Manual reviews check off like any to-do.

import { useState, useTransition, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Link from "next/link";
import { CaretDown, Check, CalendarPlus } from "@phosphor-icons/react";
import type { ReviewItem, ReviewOrigin } from "@/lib/services/reviews";
import { reactivateFile, extendHoldAction, pauseClientEmails } from "@/app/actions/automation";
import { updateManualTaskAction } from "@/app/actions/manual-tasks";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { toUKDateStr } from "@/lib/utils";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toUKDateStr(d);
}
function todayStr(): string {
  return toUKDateStr(new Date());
}

// Origin → pill label + tone. Keys off the hold reason (see reviews.ts).
const ORIGIN_META: Record<ReviewOrigin, { label: string; color: string; bg: string; border: string }> = {
  hold:        { label: "On hold",     color: "var(--agent-warning)", bg: "rgba(var(--agent-warning-rgb),0.12)", border: "rgba(var(--agent-warning-rgb),0.35)" },
  chain_wait:  { label: "Chain wait",  color: "var(--agent-info)",    bg: "rgba(var(--agent-info-rgb),0.12)",    border: "rgba(var(--agent-info-rgb),0.35)" },
  remarketing: { label: "Remarketing", color: "var(--agent-coral-deep)", bg: "var(--agent-coral-bg-tint)",       border: "rgba(var(--agent-coral-base-rgb),0.35)" },
};

// A single due/upcoming label + colour + whether it's due now, shared by both
// row kinds. Mirrors AgentTodoList.getDueStatus wording for consistency.
function dueLabel(reviewDate: Date | null): { label: string; color: string; due: boolean } {
  if (!reviewDate) return { label: "No date", color: "var(--agent-text-muted)", due: false };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(reviewDate); due.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - due.getTime()) / 86400000);
  if (diff < 0) {
    if (diff === -1) return { label: "Due tomorrow", color: "var(--agent-text-muted)", due: false };
    return { label: `Due ${fmtDate(reviewDate)}`, color: "var(--agent-text-muted)", due: false };
  }
  if (diff === 0) return { label: "Due today", color: "var(--agent-warning)", due: true };
  if (diff === 1) return { label: "Due back yesterday", color: "var(--agent-warning)", due: true };
  if (diff <= 3) return { label: `Due back ${diff} days ago`, color: "var(--agent-warning)", due: true };
  return { label: `Due back ${diff} days ago`, color: "var(--agent-danger)", due: true };
}

type ResumeTarget = { id: string; address: string };

export function ReviewsSection({
  initialItems,
  initialDone,
}: {
  initialItems: ReviewItem[];
  initialDone: ReviewItem[];
}) {
  const { toast } = useAgentToast();
  const { theme, isNight } = usePortalTheme();
  const [items, setItems] = useState(initialItems);
  const [done, setDone] = useState(initialDone);
  const [showDone, setShowDone] = useState(false);
  // Due now = open by default (most urgent, most-overdue-first). Upcoming =
  // closed by default. Both collapse/expand with the standard accordion slide.
  const [dueOpen, setDueOpen] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [dueRef] = useAutoAnimate<HTMLDivElement>();
  const [upcomingRef] = useAutoAnimate<HTMLDivElement>();

  // Hold action state
  const [resumeFor, setResumeFor] = useState<ResumeTarget | null>(null);
  const [extenderFor, setExtenderFor] = useState<string | null>(null);
  const [extenderDate, setExtenderDate] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const todayStr = toUKDateStr(new Date());
  const dueItems = useMemo(
    () => items.filter((i) => i.reviewDate && toUKDateStr(i.reviewDate) <= todayStr),
    [items, todayStr],
  );
  const upcomingItems = useMemo(
    () => items.filter((i) => !i.reviewDate || toUKDateStr(i.reviewDate) > todayStr),
    [items, todayStr],
  );

  function removeHold(transactionId: string) {
    setItems((prev) => prev.filter((i) => !(i.kind === "hold" && i.transactionId === transactionId)));
  }

  function doResume(transactionId: string, keepEmailsPaused: boolean) {
    setResumeFor(null);
    setBusyId(transactionId);
    startTransition(async () => {
      const result = await reactivateFile(transactionId);
      if (result.ok) {
        if (keepEmailsPaused) pauseClientEmails(transactionId).catch(() => {});
        toast.success(keepEmailsPaused ? "Off hold: emails stay paused" : "Off hold: automation resumed");
        removeHold(transactionId);
      } else {
        toast.error(result.error ?? "Couldn't reactivate. Try again.");
      }
      setBusyId(null);
    });
  }

  function handleExtend(transactionId: string, date: Date | null) {
    setBusyId(transactionId);
    startTransition(async () => {
      const result = await extendHoldAction(transactionId, date);
      if (result.ok) {
        toast.success("Review date updated");
        setExtenderFor(null);
        setExtenderDate("");
        // Reflect the new date in place (or drop if pushed to indefinite).
        setItems((prev) =>
          date === null
            ? prev.filter((i) => !(i.kind === "hold" && i.transactionId === transactionId))
            : prev
                .map((i) => (i.kind === "hold" && i.transactionId === transactionId ? { ...i, reviewDate: date } : i))
                .sort((a, b) => (a.reviewDate?.getTime() ?? Infinity) - (b.reviewDate?.getTime() ?? Infinity)),
        );
      } else {
        toast.error(result.error ?? "Couldn't update. Try again.");
      }
      setBusyId(null);
    });
  }

  function handleManualDate(id: string, dateStr: string) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const updated = await updateManualTaskAction(id, { dueDate: dateStr });
        setItems((prev) =>
          prev
            .map((i) => (i.kind === "manual" && i.id === id ? { ...i, reviewDate: updated.dueDate } : i))
            .sort((a, b) => (a.reviewDate?.getTime() ?? Infinity) - (b.reviewDate?.getTime() ?? Infinity)),
        );
      } catch {
        toast.error("Couldn't update the date. Try again.");
      }
      setBusyId(null);
    });
  }

  function reopenManual(id: string) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const updated = await updateManualTaskAction(id, { status: "open" });
        setDone((prev) => prev.filter((i) => !(i.kind === "manual" && i.id === id)));
        setItems((prev) =>
          [
            ...prev,
            {
              kind: "manual" as const,
              key: `task-${id}`,
              id,
              transactionId: updated.transactionId,
              address: updated.transaction?.propertyAddress ?? null,
              title: updated.title,
              notes: updated.notes,
              reviewDate: updated.dueDate,
              status: "open" as const,
            },
          ].sort((a, b) => (a.reviewDate?.getTime() ?? Infinity) - (b.reviewDate?.getTime() ?? Infinity)),
        );
      } catch {
        toast.error("Couldn't reopen. Try again.");
      }
      setBusyId(null);
    });
  }

  async function completeManual(id: string) {
    setBusyId(id);
    try {
      const updated = await updateManualTaskAction(id, { status: "done" });
      setItems((prev) => prev.filter((i) => !(i.kind === "manual" && i.id === id)));
      setDone((prev) => [
        {
          kind: "manual",
          key: `task-${id}`,
          id,
          transactionId: updated.transactionId,
          address: updated.transaction?.propertyAddress ?? null,
          title: updated.title,
          notes: updated.notes,
          reviewDate: updated.dueDate,
          status: "done",
        },
        ...prev,
      ]);
    } catch {
      toast.error("Couldn't complete. Try again.");
    }
    setBusyId(null);
  }

  const openCount = items.length;
  if (openCount === 0 && done.length === 0) return null;

  return (
    <div id="section-reviews" className="space-y-3">
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
        <CalendarPlus size={15} weight="bold" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} aria-hidden />
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>Reviews due</h2>
        {openCount > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
            background: "var(--agent-coral-bg-tint)", color: "var(--agent-coral-deep)",
            border: "1.5px solid rgba(var(--agent-coral-base-rgb), 0.35)",
          }}>
            {openCount}
          </span>
        )}
      </div>

      {openCount === 0 && done.length === 0 ? (
        <div className="agent-glass-strong agent-empty-card" style={{ padding: "24px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-muted)" }}>Nothing to review right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Due now — open by default, most-overdue first */}
          {dueItems.length > 0 && (
            <ReviewDrawer title="Due now" count={dueItems.length} open={dueOpen} onToggle={() => setDueOpen((v) => !v)} accent="var(--agent-warning)">
              <div ref={dueRef}>
                {dueItems.map((item, i) => (
                  <ReviewRow
                    key={item.key}
                    item={item}
                    topBorder={i > 0}
                    busyId={busyId}
                    extenderFor={extenderFor}
                    extenderDate={extenderDate}
                    setExtenderDate={setExtenderDate}
                    onOpenExtender={(id) => { setExtenderFor(id); setExtenderDate(""); }}
                    onCloseExtender={() => { setExtenderFor(null); setExtenderDate(""); }}
                    onExtend={handleExtend}
                    onOpenResume={(id, address) => setResumeFor({ id, address })}
                    onComplete={completeManual}
                    onReopen={reopenManual}
                    onSetManualDate={handleManualDate}
                  />
                ))}
              </div>
            </ReviewDrawer>
          )}

          {/* Upcoming — closed by default */}
          {upcomingItems.length > 0 && (
            <ReviewDrawer title="Upcoming" count={upcomingItems.length} open={upcomingOpen} onToggle={() => setUpcomingOpen((v) => !v)}>
              <div ref={upcomingRef}>
                {upcomingItems.map((item, i) => (
                  <ReviewRow
                    key={item.key}
                    item={item}
                    topBorder={i > 0}
                    busyId={busyId}
                    extenderFor={extenderFor}
                    extenderDate={extenderDate}
                    setExtenderDate={setExtenderDate}
                    onOpenExtender={(id) => { setExtenderFor(id); setExtenderDate(""); }}
                    onCloseExtender={() => { setExtenderFor(null); setExtenderDate(""); }}
                    onExtend={handleExtend}
                    onOpenResume={(id, address) => setResumeFor({ id, address })}
                    onComplete={completeManual}
                    onReopen={reopenManual}
                    onSetManualDate={handleManualDate}
                  />
                ))}
              </div>
            </ReviewDrawer>
          )}

          {/* Completed manual reviews — same drawer, closed by default */}
          {done.length > 0 && (
            <ReviewDrawer title="Completed" count={done.length} open={showDone} onToggle={() => setShowDone((v) => !v)} muted>
              <div>
                {done.map((item, i) => (
                  <ReviewRow key={item.key} item={item} topBorder={i > 0} dimmed busyId={busyId}
                    extenderFor={null} extenderDate="" setExtenderDate={() => {}}
                    onOpenExtender={() => {}} onCloseExtender={() => {}} onExtend={() => {}}
                    onOpenResume={() => {}} onComplete={() => {}} onReopen={reopenManual} onSetManualDate={() => {}} />
                ))}
              </div>
            </ReviewDrawer>
          )}
        </div>
      )}

      {/* Take-off-hold resume chooser (ported from the hub's AttentionCard) */}
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
            style={{ position: "relative", zIndex: 1, background: "var(--agent-surface-elevated)", border: "0.5px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", gap: 12 }}>
              <h2 style={{ flex: 1, margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Take off hold</h2>
              <button type="button" onClick={() => setResumeFor(null)} aria-label="Close" className="agent-icon-btn agent-icon-btn-md">×</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                <strong style={{ color: "var(--agent-text-primary)", fontWeight: 600 }}>{resumeFor.address}</strong>{", pick one. You can always change later."}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ResumeOptionCard title="Resume automation" description="Client chase emails, reminders + escalations restart from where they left off." onClick={() => doResume(resumeFor.id, false)} />
                <ResumeOptionCard title="Reactivate, keep emails paused" description="File is active again but no client emails fire. Manual chasing only. Flip back on any time." onClick={() => doResume(resumeFor.id, true)} />
              </div>
            </div>
            <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setResumeFor(null)} className="agent-link" style={{ padding: "10px 6px", fontSize: 13, fontWeight: 500 }}>Cancel</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// Collapsible group drawer — clickable header, rotating chevron, and the
// standard agent-acc grid-rows slide open/closed. Matches the To-Do page's
// "Completed" disclosure so every collapsible strip on the page feels the same.
function ReviewDrawer({
  title, count, open, onToggle, children, accent, muted = false,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accent?: string;
  muted?: boolean;
}) {
  return (
    <div className="agent-glass" style={{ borderRadius: 12, overflow: "hidden" }}>
      <div
        className="agent-acc-hdr"
        style={{ borderBottom: "none" }}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {accent && <span aria-hidden style={{ width: 6, height: 6, borderRadius: 99, background: accent, flexShrink: 0 }} />}
          <span className="agent-acc-title" style={{ color: muted ? "var(--agent-text-muted)" : "var(--agent-text-primary)" }}>{title}</span>
          <span className="agent-badge">{count}</span>
        </div>
        <CaretDown size={12} weight="bold" aria-hidden style={{ flexShrink: 0, color: "var(--agent-text-muted)", transition: "transform 200ms cubic-bezier(0.4,0,0.2,1)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </div>
      <div className={`agent-acc${open ? " open" : ""}`}>
        <div className="agent-acc-in">{children}</div>
      </div>
    </div>
  );
}

function ReviewRow({
  item, topBorder, dimmed = false, busyId,
  extenderFor, extenderDate, setExtenderDate,
  onOpenExtender, onCloseExtender, onExtend, onOpenResume, onComplete, onReopen, onSetManualDate,
}: {
  item: ReviewItem;
  topBorder: boolean;
  dimmed?: boolean;
  busyId: string | null;
  extenderFor: string | null;
  extenderDate: string;
  setExtenderDate: (v: string) => void;
  onOpenExtender: (id: string) => void;
  onCloseExtender: () => void;
  onExtend: (id: string, date: Date | null) => void;
  onOpenResume: (id: string, address: string) => void;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onSetManualDate: (id: string, dateStr: string) => void;
}) {
  const [editingDate, setEditingDate] = useState(false);
  const due = dueLabel(item.reviewDate);
  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap",
    padding: "12px 16px",
    borderTop: topBorder ? "0.5px solid var(--agent-border-subtle)" : undefined,
    opacity: dimmed ? 0.6 : 1,
  };

  if (item.kind === "hold") {
    const meta = ORIGIN_META[item.origin];
    const busy = busyId === item.transactionId;
    return (
      <div style={{ ...rowStyle, borderLeft: `3px solid ${meta.color}` }}>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/agent/transactions/${item.transactionId}`} className="agent-link" style={{ fontSize: 13, fontWeight: 600 }}>
              {item.address}
            </Link>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, flexShrink: 0 }}>
              {meta.label}
            </span>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.4 }}>
            {item.reason ?? "On hold. No reason recorded."}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, marginLeft: "auto" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: due.color, whiteSpace: "nowrap" }}>{due.label}</span>
          {!dimmed && (
            extenderFor === item.transactionId ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <input type="date" value={extenderDate} min={tomorrowStr()} autoFocus onChange={(e) => setExtenderDate(e.target.value)} className="agent-input" style={{ padding: "4px 8px", fontSize: 12 }} />
                <button onClick={() => { if (extenderDate && extenderDate >= tomorrowStr()) onExtend(item.transactionId, new Date(extenderDate)); }} disabled={!extenderDate || extenderDate < tomorrowStr()} className="agent-btn agent-btn-xs agent-btn-primary">Set date</button>
                <button onClick={onCloseExtender} className="agent-link" style={{ fontSize: 11 }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={() => onOpenResume(item.transactionId, item.address)} disabled={busy} className="agent-btn agent-btn-sm agent-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Check size={13} weight="bold" /> Take off hold
                </button>
                <button onClick={() => onOpenExtender(item.transactionId)} disabled={busy} className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <CalendarPlus size={13} weight="bold" /> Extend
                </button>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  // Manual review row
  const isDone = item.status === "done";
  const busy = busyId === item.id;
  return (
    <div style={rowStyle}>
      <button
        onClick={() => (isDone ? onReopen(item.id) : onComplete(item.id))}
        disabled={busy}
        aria-label={isDone ? "Reopen review" : "Mark review done"}
        title={isDone ? "Reopen" : undefined}
        className="agent-circle-btn"
        style={{
          width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1,
          border: isDone ? "none" : "1.5px solid var(--agent-coral-base, var(--agent-coral-deep))",
          background: isDone ? "var(--agent-success)" : "transparent",
          cursor: busy ? "wait" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {isDone && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        )}
      </button>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: isDone ? 400 : 500, color: isDone ? "var(--agent-text-muted)" : "var(--agent-text-primary)", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.4 }}>
          {item.title}
        </p>
        {item.notes && <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.4 }}>{item.notes}</p>}
        {item.transactionId && item.address && (
          <Link href={`/agent/transactions/${item.transactionId}`} className="agent-link" style={{ fontSize: 11, display: "inline-block", marginTop: 3 }}>{item.address}</Link>
        )}
      </div>
      {/* Due label — click to reschedule the review (open rows only) */}
      {dimmed || isDone ? (
        <span style={{ fontSize: 11, fontWeight: 600, color: due.color, whiteSpace: "nowrap", marginLeft: "auto", marginTop: 1 }}>{due.label}</span>
      ) : editingDate ? (
        <input
          type="date"
          autoFocus
          defaultValue={item.reviewDate ? toUKDateStr(item.reviewDate) : ""}
          min={todayStr()}
          onChange={(e) => { if (e.target.value && e.target.value >= todayStr()) onSetManualDate(item.id, e.target.value); setEditingDate(false); }}
          onBlur={() => setEditingDate(false)}
          className="agent-input"
          style={{ padding: "4px 8px", fontSize: 12, marginLeft: "auto", marginTop: 1 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingDate(true)}
          disabled={busy}
          title="Change review date"
          style={{ background: "none", border: "none", padding: 0, cursor: busy ? "wait" : "pointer", marginLeft: "auto", marginTop: 1, textAlign: "right" }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: due.color, whiteSpace: "nowrap", textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: "var(--agent-border-default)" }}>{due.label}</span>
        </button>
      )}
    </div>
  );
}

function ResumeOptionCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ textAlign: "left", padding: "12px 14px", background: "var(--agent-surface-glass)", border: "0.5px solid rgba(15,23,42,0.10)", borderRadius: 12, cursor: "pointer", transition: "background 150ms, border-color 150ms" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--agent-hover-tint, rgba(255,107,74,0.06))"; e.currentTarget.style.borderColor = "rgba(255,107,74,0.30)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--agent-surface-glass)"; e.currentTarget.style.borderColor = "rgba(15,23,42,0.10)"; }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>{title}</p>
      <p style={{ fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5, margin: "4px 0 0" }}>{description}</p>
    </button>
  );
}
