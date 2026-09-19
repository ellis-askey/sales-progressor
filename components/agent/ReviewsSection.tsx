"use client";

// "Reviews due" — the top section of /agent/to-do. Dated "come back to this
// file" items: files on hold with a return date (incl. chain-collapse waits and
// remarketing pauses, which the app already models as holds) plus hand-typed
// reviews. Read-model lives in lib/services/reviews.ts.
//
// Hold rows: a split button — Take off hold (resumes the file to whatever its
// settings already were) with a chevron menu to Extend or clear the return
// date. Manual reviews: a tick to complete, plus a chevron menu to reschedule,
// edit or remove. Both menus portal to the body so they never clip or fall
// behind the accordion/card.

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Link from "next/link";
import { CaretDown, Check, CalendarPlus, PencilSimple, Trash, XCircle } from "@phosphor-icons/react";
import { SectionHeader } from "@/components/agent/SectionHeader";
import type { ReviewItem, ReviewOrigin } from "@/lib/services/reviews";
import { reactivateFile, extendHoldAction } from "@/app/actions/automation";
import { updateManualTaskAction, deleteManualTaskAction } from "@/app/actions/manual-tasks";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { toUKDateStr } from "@/lib/utils";
import { DateField } from "@/components/ui/DateField";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toUKDateStr(d);
}
function todayStrFn(): string {
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

const RV_STYLES = `
  .rv-split { display: inline-flex; align-items: stretch; box-shadow: 0 1px 4px rgba(224,78,44,0.26); border-radius: 9px; }
  .rv-main { display: inline-flex; align-items: center; gap: 6px; font-family: inherit; font-size: 12.5px; font-weight: 600; color: #fff; background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); border: 1px solid transparent; border-right: 1px solid rgba(255,255,255,0.28); border-radius: 9px 0 0 9px; padding: 7px 12px; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255,255,255,0.28); transition: filter .12s ease; }
  .rv-caret { display: inline-flex; align-items: center; justify-content: center; width: 32px; color: #fff; background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); border: 1px solid transparent; border-radius: 0 9px 9px 0; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255,255,255,0.28); transition: filter .12s ease; }
  .rv-main:hover:not(:disabled), .rv-caret:hover:not(:disabled) { filter: brightness(1.05); }
  .rv-split button:disabled { opacity: 0.55; cursor: default; }
  .rv-cv { transition: transform .2s cubic-bezier(.4,0,.2,1); }
  .rv-caret[data-open="true"] .rv-cv { transform: rotate(180deg); }
  .rv-menu-btn { display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; border-radius: 7px; border: 1px solid var(--agent-border-default); background: var(--agent-surface-elevated); color: var(--agent-text-muted); cursor: pointer; transition: border-color .14s ease, color .14s ease; }
  .rv-menu-btn:hover { border-color: var(--agent-coral); color: var(--agent-coral-deep); }
  .rv-menu-btn[data-open="true"] { border-color: var(--agent-coral-deep); color: var(--agent-coral-deep); }
  .rv-menu { background: var(--agent-surface-elevated); border: 1px solid var(--agent-border-default); border-radius: 13px; box-shadow: 0 14px 36px rgba(30,45,74,0.20), 0 2px 8px rgba(30,45,74,0.10); padding: 7px; animation: rv-pop .13s ease; }
  @keyframes rv-pop { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }
  .rv-mi { display: flex; align-items: center; gap: 11px; width: 100%; text-align: left; padding: 8px 9px; border: none; background: none; border-radius: 9px; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--agent-text-primary); cursor: pointer; transition: background-color .14s ease, box-shadow .14s ease; }
  .rv-mi:hover { background-color: var(--agent-hover-tint); box-shadow: var(--agent-hover-lift); }
  .rv-mi.danger { color: var(--agent-danger); }
  .rv-ico { width: 19px; display: grid; place-items: center; color: var(--agent-text-muted); flex-shrink: 0; transition: color .14s ease; }
  .rv-mi:hover .rv-ico { color: var(--agent-coral-deep); }
  .rv-mi.danger .rv-ico, .rv-mi.danger:hover .rv-ico { color: var(--agent-danger); }
  .rv-mi small { display: block; font-weight: 400; font-size: 11px; color: var(--agent-text-muted); margin-top: 1px; }
  .rv-datebox { padding: 4px 6px 6px; display: flex; flex-direction: column; gap: 8px; min-width: 210px; }
  .rv-when { font-size: 11px; font-weight: 700; color: var(--agent-text-muted); padding: 2px 2px 0; }
  .rv-date { width: 100%; font-family: inherit; font-size: 13px; padding: 8px 10px; border-radius: 9px; border: 1px solid var(--agent-border-default); background: var(--agent-surface-glass); color: var(--agent-text-primary); transition: border-color .14s ease, box-shadow .14s ease; }
  .rv-date:hover { border-color: var(--agent-coral); }
  .rv-date:focus { outline: none; border-color: var(--agent-coral-deep); box-shadow: 0 0 0 3px rgba(var(--agent-coral-rgb), 0.12); }
  .rv-primary { width: 100%; font-family: inherit; font-size: 12.5px; font-weight: 600; color: #fff; background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); border: 1px solid transparent; border-radius: 9px; padding: 8px; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255,255,255,0.28); transition: filter .12s ease; }
  .rv-primary:hover:not(:disabled) { filter: brightness(1.05); }
  .rv-primary:disabled { opacity: 0.5; cursor: default; }
  .rv-addr { text-decoration: none; }
  .rv-addr-l1 { color: var(--agent-text-primary); font-weight: 600; transition: color .14s ease; }
  .rv-addr-town { color: var(--agent-text-secondary); transition: color .14s ease; }
  .rv-addr:hover .rv-addr-l1, .rv-addr:hover .rv-addr-town { color: var(--agent-coral-deep); }
`;

export function ReviewsSection({
  initialItems,
  initialDone,
}: {
  initialItems: ReviewItem[];
  initialDone: ReviewItem[];
}) {
  const { toast } = useAgentToast();
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

  // Take off hold: reactivate the file. Automation/emails simply resume to
  // whatever the file's settings already were (anything toggled off in settings
  // stays off) — no forced change, no chooser.
  function doResume(transactionId: string) {
    setBusyId(transactionId);
    startTransition(async () => {
      const result = await reactivateFile(transactionId);
      if (result.ok) {
        toast.success("Off hold, resumed to its settings");
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
        toast.success(date === null ? "Return date removed" : "Return date updated");
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

  function handleEditSave(id: string, title: string, notes: string) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const updated = await updateManualTaskAction(id, { title: title.trim(), notes: notes.trim() || null });
        setItems((prev) => prev.map((i) => (i.kind === "manual" && i.id === id ? { ...i, title: updated.title, notes: updated.notes } : i)));
        toast.success("Review updated");
      } catch {
        toast.error("Couldn't save. Try again.");
      }
      setBusyId(null);
    });
  }

  function handleDelete(id: string) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await deleteManualTaskAction(id);
        setItems((prev) => prev.filter((i) => !(i.kind === "manual" && i.id === id)));
        setDone((prev) => prev.filter((i) => !(i.kind === "manual" && i.id === id)));
        toast.success("Review removed");
      } catch {
        toast.error("Couldn't remove. Try again.");
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
              photoStoragePath: null,
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
          photoStoragePath: null,
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

  const rowProps = {
    busyId,
    onTakeOffHold: doResume,
    onExtend: handleExtend,
    onComplete: completeManual,
    onReopen: reopenManual,
    onSetManualDate: handleManualDate,
    onEditSave: handleEditSave,
    onDelete: handleDelete,
  };

  return (
    <div id="section-reviews" className="space-y-3">
      <style>{RV_STYLES}</style>
      {/* Section header — matches the top of the No-comms card */}
      <SectionHeader
        icon={<CalendarPlus size={22} weight="regular" />}
        title="Reviews due"
        subtitle="Files to come back to."
        count={openCount}
      />

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
                  <ReviewRow key={item.key} item={item} topBorder={i > 0} {...rowProps} />
                ))}
              </div>
            </ReviewDrawer>
          )}

          {/* Upcoming — closed by default */}
          {upcomingItems.length > 0 && (
            <ReviewDrawer title="Upcoming" count={upcomingItems.length} open={upcomingOpen} onToggle={() => setUpcomingOpen((v) => !v)}>
              <div ref={upcomingRef}>
                {upcomingItems.map((item, i) => (
                  <ReviewRow key={item.key} item={item} topBorder={i > 0} {...rowProps} />
                ))}
              </div>
            </ReviewDrawer>
          )}

          {/* Completed manual reviews — same drawer, closed by default */}
          {done.length > 0 && (
            <ReviewDrawer title="Completed" count={done.length} open={showDone} onToggle={() => setShowDone((v) => !v)} muted>
              <div>
                {done.map((item, i) => (
                  <ReviewRow key={item.key} item={item} topBorder={i > 0} dimmed {...rowProps} />
                ))}
              </div>
            </ReviewDrawer>
          )}
        </div>
      )}
    </div>
  );
}

// Collapsible group drawer — clickable header, rotating chevron, and the
// standard agent-acc grid-rows slide open/closed.
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

// Address as a link: first line in the primary text colour, town/postcode a
// touch lighter, both turning coral on hover. Replaces the old coral link.
function AddressLink({ href, address }: { href: string; address: string }) {
  const [line1, ...rest] = address.split(",");
  const town = rest.join(",").trim();
  return (
    <Link href={href} className="rv-addr" style={{ fontSize: 13, lineHeight: 1.35 }}>
      <span className="rv-addr-l1">{line1.trim()}</span>
      {town && <span className="rv-addr-town">{`, ${town}`}</span>}
    </Link>
  );
}

// Portal menu: fixed-positioned under its anchor, above everything, closing on
// outside-click / scroll / resize. Guarantees it never clips or falls behind
// the accordion or card it lives in.
function PortalMenu({
  anchorRef, open, onClose, children, width = 236,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 6, left });

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return; // let the trigger handle its own toggle
      onClose();
    };
    const close = () => onClose();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, anchorRef, onClose, width]);

  if (!open || !pos) return null;
  return createPortal(
    <div ref={menuRef} className="rv-menu" role="menu" style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: width, zIndex: 1300 }}>
      {children}
    </div>,
    document.body,
  );
}

function ReviewRow({
  item, topBorder, dimmed = false, busyId,
  onTakeOffHold, onExtend, onComplete, onReopen, onSetManualDate, onEditSave, onDelete,
}: {
  item: ReviewItem;
  topBorder: boolean;
  dimmed?: boolean;
  busyId: string | null;
  onTakeOffHold: (id: string) => void;
  onExtend: (id: string, date: Date | null) => void;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onSetManualDate: (id: string, dateStr: string) => void;
  onEditSave: (id: string, title: string, notes: string) => void;
  onDelete: (id: string) => void;
}) {
  const due = dueLabel(item.reviewDate);
  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap",
    padding: "12px 16px",
    borderTop: topBorder ? "0.5px solid var(--agent-border-subtle)" : undefined,
    opacity: dimmed ? 0.6 : 1,
  };

  if (item.kind === "hold") {
    return <HoldReviewRow item={item} rowStyle={rowStyle} dimmed={dimmed} due={due} busy={busyId === item.transactionId}
      onTakeOffHold={onTakeOffHold} onExtend={onExtend} />;
  }
  return <ManualReviewRow item={item} rowStyle={rowStyle} dimmed={dimmed} due={due} busy={busyId === item.id}
    onComplete={onComplete} onReopen={onReopen} onSetManualDate={onSetManualDate} onEditSave={onEditSave} onDelete={onDelete} />;
}

// ── Hold row: split button + Extend / Remove-date menu ─────────────────────
function HoldReviewRow({
  item, rowStyle, dimmed, due, busy, onTakeOffHold, onExtend,
}: {
  item: Extract<ReviewItem, { kind: "hold" }>;
  rowStyle: React.CSSProperties;
  dimmed: boolean;
  due: { label: string; color: string };
  busy: boolean;
  onTakeOffHold: (id: string) => void;
  onExtend: (id: string, date: Date | null) => void;
}) {
  const meta = ORIGIN_META[item.origin];
  const caretRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<"items" | "date">("items");
  const [dateVal, setDateVal] = useState("");

  return (
    <div style={{ ...rowStyle, borderLeft: `3px solid ${meta.color}` }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <AddressLink href={`/agent/transactions/${item.transactionId}`} address={item.address} />
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
          <div className="rv-split">
            <button className="rv-main" disabled={busy} onClick={() => onTakeOffHold(item.transactionId)}>
              <Check size={13} weight="bold" /> Take off hold
            </button>
            <button
              ref={caretRef}
              className="rv-caret"
              data-open={menuOpen}
              disabled={busy}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More options"
              onClick={() => { setView("items"); setDateVal(""); setMenuOpen((o) => !o); }}
            >
              <CaretDown className="rv-cv" size={13} weight="bold" />
            </button>
          </div>
        )}
        <PortalMenu anchorRef={caretRef} open={menuOpen} onClose={() => setMenuOpen(false)}>
          {view === "items" ? (
            <>
              <button className="rv-mi" onClick={() => { setView("date"); setDateVal(""); }}>
                <span className="rv-ico"><CalendarPlus size={16} /></span>
                <span>Extend the date<small>Push the return date back</small></span>
              </button>
              <button className="rv-mi" onClick={() => { onExtend(item.transactionId, null); setMenuOpen(false); }}>
                <span className="rv-ico"><XCircle size={16} /></span>
                <span>Remove the return date<small>Stay on hold, no date set</small></span>
              </button>
            </>
          ) : (
            <div className="rv-datebox">
              <span className="rv-when">New return date</span>
              <DateField value={dateVal} min={tomorrowStr()} autoFocus onChange={(e) => setDateVal(e.target.value)} className="rv-date" wrapperStyle={{ display: "block" }} />
              <button
                className="rv-primary"
                disabled={!dateVal || dateVal < tomorrowStr()}
                onClick={() => { onExtend(item.transactionId, new Date(dateVal)); setMenuOpen(false); }}
              >
                Extend
              </button>
            </div>
          )}
        </PortalMenu>
      </div>
    </div>
  );
}

function ManualReviewRow({
  item, rowStyle, dimmed, due, busy,
  onComplete, onReopen, onSetManualDate, onEditSave, onDelete,
}: {
  item: Extract<ReviewItem, { kind: "manual" }>;
  rowStyle: React.CSSProperties;
  dimmed: boolean;
  due: { label: string; color: string };
  busy: boolean;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onSetManualDate: (id: string, dateStr: string) => void;
  onEditSave: (id: string, title: string, notes: string) => void;
  onDelete: (id: string) => void;
}) {
  const isDone = item.status === "done";
  const caretRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<"items" | "date" | "confirm">("items");
  const [dateVal, setDateVal] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editNotes, setEditNotes] = useState(item.notes ?? "");

  function startEdit() {
    setEditTitle(item.title);
    setEditNotes(item.notes ?? "");
    setEditing(true);
    setMenuOpen(false);
  }

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
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input className="agent-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Review title" autoFocus style={{ fontSize: 13, padding: "6px 9px" }} />
            <textarea className="agent-input" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes (optional)" rows={2} style={{ fontSize: 12, padding: "6px 9px", resize: "none" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="rv-primary" style={{ width: "auto", padding: "6px 14px" }} disabled={busy || !editTitle.trim()} onClick={() => { onEditSave(item.id, editTitle, editNotes); setEditing(false); }}>Save</button>
              <button className="agent-link agent-link-muted" style={{ fontSize: 12 }} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13, fontWeight: isDone ? 400 : 500, color: isDone ? "var(--agent-text-muted)" : "var(--agent-text-primary)", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.4 }}>
              {item.title}
            </p>
            {item.notes && <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.4 }}>{item.notes}</p>}
            {item.transactionId && item.address && (
              <div style={{ marginTop: 3 }}>
                <AddressLink href={`/agent/transactions/${item.transactionId}`} address={item.address} />
              </div>
            )}
          </>
        )}
      </div>

      {!editing && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", marginTop: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: due.color, whiteSpace: "nowrap" }}>{due.label}</span>
          {!dimmed && !isDone && (
            <button
              ref={caretRef}
              className="rv-menu-btn"
              data-open={menuOpen}
              disabled={busy}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Review options"
              onClick={() => { setView("items"); setDateVal(""); setMenuOpen((o) => !o); }}
            >
              <CaretDown className="rv-cv" size={13} weight="bold" />
            </button>
          )}
        </div>
      )}

      <PortalMenu anchorRef={caretRef} open={menuOpen} onClose={() => setMenuOpen(false)}>
        {view === "items" ? (
          <>
            <button className="rv-mi" onClick={() => { setView("date"); setDateVal(""); }}>
              <span className="rv-ico"><CalendarPlus size={16} /></span>
              <span>Reschedule<small>Pick a new date</small></span>
            </button>
            <button className="rv-mi" onClick={startEdit}>
              <span className="rv-ico"><PencilSimple size={16} /></span>
              <span>Edit<small>Change the wording</small></span>
            </button>
            <button className="rv-mi danger" onClick={() => setView("confirm")}>
              <span className="rv-ico"><Trash size={16} /></span>
              <span>Remove<small>Take it off the list</small></span>
            </button>
          </>
        ) : view === "date" ? (
          <div className="rv-datebox">
            <span className="rv-when">New date</span>
            <DateField value={dateVal} min={todayStrFn()} autoFocus onChange={(e) => setDateVal(e.target.value)} className="rv-date" wrapperStyle={{ display: "block" }} />
            <button
              className="rv-primary"
              disabled={!dateVal || dateVal < todayStrFn()}
              onClick={() => { onSetManualDate(item.id, dateVal); setMenuOpen(false); }}
            >
              Save
            </button>
          </div>
        ) : (
          <div className="rv-datebox">
            <span className="rv-when">Remove this review?</span>
            <button className="rv-primary" style={{ background: "var(--agent-danger)" }} onClick={() => { onDelete(item.id); setMenuOpen(false); }}>Remove</button>
          </div>
        )}
      </PortalMenu>
    </div>
  );
}
