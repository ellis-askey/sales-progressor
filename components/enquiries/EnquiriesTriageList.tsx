"use client";

// Enquiries triage list. See what's outstanding, whose court the ball is in, and
// what needs chasing — and blitz-confirm/flip/chase without opening each file.
// Reuses the enquiry tracker actions; the chase-history timeline loads on expand.
// Internal only for now. Spec: docs/active/enquiries-triage/00-spec.md.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import type { AutoAnimationPlugin } from "@formkit/auto-animate";
import {
  Check, Checks, ArrowsLeftRight, ArrowsClockwise, ArrowRight, ChatCircleDots, CaretDown, MagnifyingGlass,
  Phone, EnvelopeSimple, CalendarBlank, ClockCountdown, WarningCircle, CheckCircle, PaperPlaneTilt,
} from "@phosphor-icons/react";
import {
  logEnquiryMovementAction, logEnquiryChaseAction, setEnquiryExpectedDateAction, getEnquiryHistoryAction,
  markEnquiriesSatisfiedAction,
  type EnquiryCallOutcome, type EnquiryCallParty,
} from "@/app/actions/enquiries";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { OpenEnquiryRow, EnquiryHistoryEntry } from "@/lib/services/enquiries";
import type { EnquiryCourt, EnquiryMovementMode, EnquiryMovementKind } from "@/lib/enquiries/tracker";
import { ChaseBar } from "@/components/enquiries/ChaseBar";
import { EnquiryLogSheet } from "@/components/enquiries/EnquiryLogSheet";
import { EnquiryEmailPreview } from "@/components/enquiries/EnquiryEmailPreview";
import { GlassCard } from "@/components/glass/GlassCard";

const courtLabel = (c: EnquiryCourt) => (c === "seller_solicitor" ? "seller's solicitor" : "buyer's solicitor");
const courtShort = (c: EnquiryCourt) => (c === "seller_solicitor" ? "seller's side" : "buyer's side");
const otherCourt = (c: EnquiryCourt): EnquiryCourt => (c === "seller_solicitor" ? "buyer_solicitor" : "seller_solicitor");

function fmtPrice(pence: number | null): string | null {
  if (pence == null) return null;
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}
function fmtDay(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function startOfTomorrow(): number {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.getTime() + 86400000;
}

type Pill = { label: string; tone: "danger" | "amber" | "green" | "blue" };
function statusPill(r: OpenEnquiryRow): Pill {
  // A stalled loop (silent past escalation) is the loudest signal — surface it
  // even when it was recently chased (a future nextChaseAt would otherwise read
  // as a calm "Awaiting replies"/"Being reviewed"). Court-aware wording.
  if (r.status === "stalled") {
    return { label: r.currentlyWith === "seller_solicitor" ? "Replies overdue" : "Review overdue", tone: "danger" };
  }
  const tomorrow = startOfTomorrow();
  const chaseMs = r.nextChaseAt ? new Date(r.nextChaseAt).getTime() : null;
  if (r.status !== "snoozed" && chaseMs != null) {
    if (chaseMs < new Date().setHours(0, 0, 0, 0)) {
      const days = Math.max(1, Math.floor((new Date().setHours(0, 0, 0, 0) - chaseMs) / 86400000));
      return { label: `${days} ${days === 1 ? "day" : "days"} overdue`, tone: "danger" };
    }
    if (chaseMs < tomorrow) return { label: "Due today", tone: "danger" };
  }
  if (r.expectedDate && new Date(r.expectedDate).getTime() >= new Date().setHours(0, 0, 0, 0)) {
    // Just the calendar icon + the date — the "Expected" word is dropped (critique #4).
    return { label: fmtDay(r.expectedDate), tone: "amber" };
  }
  // Court-driven, not last-event-driven: with the buyer's solicitor means the
  // replies are in and they're deciding (satisfied / raise further); with the
  // seller's solicitor means they still owe the replies. A logged chase no
  // longer flips this back to "waiting" the way reading lastMovement.kind did.
  if (r.currentlyWith === "buyer_solicitor") return { label: "Being reviewed", tone: "green" };
  return { label: "Awaiting replies", tone: "blue" };
}

type SortKey = "attention" | "quietest" | "recent";

// Custom auto-animate move for the list. When an action re-sorts a row, it lifts
// (a subtle scale + shadow) as it glides to its new slot, so an actioned enquiry
// visibly travels to its place while the rows between reflow to make room —
// instead of vanishing and reappearing lower down. Rows leaving the list (e.g.
// Mark satisfied closes the loop) fade + shrink out. Honours reduced-motion by
// collapsing to an instant (0ms) effect.
const enqMovePlugin: AutoAnimationPlugin = (el, action, oldCoords, newCoords) => {
  const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // A deliberate journey, not a snap: they action one, watch it travel to its new
  // home, then move on. Slower move; enter/leave stay brisk.
  const moveMs = reduce ? 0 : 750;
  const fadeMs = reduce ? 0 : 300;
  const easing = "cubic-bezier(0.45, 0, 0.25, 1)";
  let keyframes: Keyframe[] = [];

  if (action === "add") {
    keyframes = [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "translateY(0)" },
    ];
    return new KeyframeEffect(el, keyframes, { duration: fadeMs, easing });
  } else if (action === "remove") {
    keyframes = [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.97)" },
    ];
    return new KeyframeEffect(el, keyframes, { duration: fadeMs, easing });
  } else {
    // remain: FLIP from the old position back to zero, lifting through the middle.
    const dx = (oldCoords?.left ?? 0) - (newCoords?.left ?? 0);
    const dy = (oldCoords?.top ?? 0) - (newCoords?.top ?? 0);
    keyframes = [
      { transform: `translate(${dx}px, ${dy}px) scale(1)`, boxShadow: "0 0 0 0 rgba(30,45,74,0)" },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35}px) scale(1.02)`, boxShadow: "0 12px 26px rgba(30,45,74,0.16)", offset: 0.5 },
      { transform: "translate(0, 0) scale(1)", boxShadow: "0 0 0 0 rgba(30,45,74,0)" },
    ];
  }
  return new KeyframeEffect(el, keyframes, { duration: moveMs, easing });
};

export function EnquiriesTriageList({
  rows,
  signedPhotos,
  emailConnected = false,
}: {
  rows: OpenEnquiryRow[];
  signedPhotos: Record<string, string>;
  // Whether the current user's mailbox ingest (Outlook/IMAP) is connected. Drives
  // whether the Email chip logs one-tap (connected: sent email auto-captured) or
  // opens the logger (not connected). See critique #6.
  emailConnected?: boolean;
}) {
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, EnquiryHistoryEntry[] | "loading">>({});
  // Which row currently has an open menu or backdate popover — elevate its card
  // so the dropdown sits above every sibling.
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  // Drag-to-confirm (critique #20b): set when a row's court slider is dragged
  // across, opening a confirm modal before the handover actually fires.
  const [dragConfirm, setDragConfirm] = useState<{ row: OpenEnquiryRow; dir: "to_seller" | "to_buyer" } | null>(null);
  // Log-a-chase sheet (critique #5/#6): phone always, email when ingest isn't
  // connected. Opened from a row; renders once at the list root so it overlays.
  const [logSheet, setLogSheet] = useState<{ row: OpenEnquiryRow; mode: "phone" | "email" } | null>(null);

  const [q, setQ] = useState("");
  const [side, setSide] = useState<"all" | EnquiryCourt>("all");
  const [sort, setSort] = useState<SortKey>("attention");

  // FLIP the list: actioned rows glide to their new sorted slot (with a lift)
  // and the rows between reflow to fill the gap. Animation is paused while the
  // search box is focused so per-keystroke filtering doesn't churn.
  const [listRef, enableAnim] = useAutoAnimate<HTMLDivElement>(enqMovePlugin);
  // Follow the actioned row to where it lands: set on an action, consumed once
  // the reordered list commits (below). Timestamped so a failed action that
  // never reorders can't trigger a stale scroll on a later change.
  const scrollTargetRef = useRef<{ id: string; at: number } | null>(null);

  // Tiles reflect the WHOLE set (not the filtered view). Mutually-exclusive
  // buckets so they read as a breakdown of the total.
  const tiles = useMemo(() => {
    const midnight = new Date().setHours(0, 0, 0, 0);
    let needChecking = 0, awaiting = 0, expected = 0, withSellers = 0, withBuyers = 0;
    for (const r of rows) {
      if (r.currentlyWith === "seller_solicitor") withSellers++; else withBuyers++;
      // Expected: a reply date has been given (today or later) — it's parked, not
      // waiting blind. (Moves these out of "awaiting" so the split reads true.)
      if (r.expectedDate && new Date(r.expectedDate).getTime() >= midnight) { expected++; continue; }
      // Need checking: a chase is due today/overdue, OR the loop has STALLED (silent
      // past escalation) even if recently chased — long silence still needs a human.
      const chaseMs = r.nextChaseAt ? new Date(r.nextChaseAt).getTime() : null;
      const dueNow = r.status !== "snoozed" && chaseMs != null && chaseMs < startOfTomorrow();
      if (dueNow || r.status === "stalled") { needChecking++; continue; }
      awaiting++;
    }
    return { total: rows.length, needChecking, awaiting, expected, withSellers, withBuyers };
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (side !== "all" && r.currentlyWith !== side) return false;
      if (!needle) return true;
      return (
        r.address.toLowerCase().includes(needle) ||
        r.clientNames.toLowerCase().includes(needle) ||
        (r.vendorSolicitor ?? "").toLowerCase().includes(needle) ||
        (r.purchaserSolicitor ?? "").toLowerCase().includes(needle)
      );
    });
    const rank = (r: OpenEnquiryRow) =>
      r.status === "stalled" ? 0 : (r.nextChaseAt && new Date(r.nextChaseAt).getTime() < startOfTomorrow() && r.status !== "snoozed") ? 1 : r.status === "snoozed" ? 3 : 2;
    if (sort === "attention") list = [...list].sort((a, b) => rank(a) - rank(b) || b.quietDays - a.quietDays);
    else if (sort === "quietest") list = [...list].sort((a, b) => b.quietDays - a.quietDays);
    else list = [...list].sort((a, b) => (b.lastMovement?.occurredAt ? new Date(b.lastMovement.occurredAt).getTime() : 0) - (a.lastMovement?.occurredAt ? new Date(a.lastMovement.occurredAt).getTime() : 0));
    return list;
  }, [rows, q, side, sort]);

  // After the reordered list commits, pan the actioned row into view so the user
  // travels with it and sees where it settles (often lower down). Only fires for
  // action-driven reorders (scrollTargetRef is set in run()), not search/sort.
  useEffect(() => {
    const t = scrollTargetRef.current;
    if (!t) return;
    if (Date.now() - t.at > 4000) { scrollTargetRef.current = null; return; }
    const node = document.querySelector(`[data-tx="${t.id}"]`) as HTMLElement | null;
    if (!node) return; // not yet in the reordered DOM, or the row left the list
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    scrollTargetRef.current = null;
  }, [shown]);

  // Esc closes the drag-confirm modal.
  useEffect(() => {
    if (!dragConfirm) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setDragConfirm(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [dragConfirm]);

  function run(id: string, fn: () => Promise<{ ok: boolean; reason?: string }>, msg: string) {
    if (busyId) return;
    scrollTargetRef.current = { id, at: Date.now() };
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res?.ok) { toast.success(msg); /* Phase 4: action revalidates /agent/enquiries */ }
        // Give the real reason where we have one. "prereqs_missing" means an
        // earlier step on the file isn't confirmed yet, so the loop can't close.
        // Tell the agent that rather than the generic "try again".
        else if (res?.reason === "prereqs_missing") toast.error("An earlier step needs confirming first before you can mark enquiries satisfied.");
        else toast.error("That didn't save. Please try again.");
      } catch { toast.error("That didn't save. Please try again."); }
      finally { setBusyId(null); }
    });
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!history[id]) {
      setHistory((h) => ({ ...h, [id]: "loading" }));
      try {
        const entries = await getEnquiryHistoryAction(id);
        setHistory((h) => ({ ...h, [id]: entries }));
      } catch {
        setHistory((h) => ({ ...h, [id]: [] }));
      }
    }
  }

  if (rows.length === 0) {
    return (
      <div className="agent-glass" style={{ padding: "34px 24px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
        <ChatCircleDots size={30} weight="regular" style={{ color: "var(--agent-text-muted)", marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>Every enquiry loop is confirmed.</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>Open loops appear here to blitz through as they need a court check.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary overview — same family as Chains / Completions */}
      <GlassCard glassId="enquiries-summary" label="Enquiries · summary" defaultVariant="v05" style={{ borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
        <div className="enq-summary-grid">
          <Tile icon={<ChatCircleDots size={22} weight="regular" />} tone="coral" value={tiles.total} label="In enquiries" sub={`${tiles.withSellers} with sellers · ${tiles.withBuyers} with buyers`} />
          <Tile icon={<WarningCircle size={22} weight="fill" />} tone="warning" value={tiles.needChecking} label="Need checking" sub="Overdue or due today" />
          <Tile icon={<PaperPlaneTilt size={22} weight="regular" />} tone="info" value={tiles.awaiting} label="Awaiting replies" sub="With a solicitor" />
          <Tile icon={<CalendarBlank size={22} weight="regular" />} tone="neutral" value={tiles.expected} label="Expected" sub="A reply date is set" />
        </div>
      </GlassCard>

      {/* Toolbar */}
      <div className="enq-toolbar">
        <div className="enq-search">
          <MagnifyingGlass size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => enableAnim(false)} onBlur={() => enableAnim(true)} placeholder="Search by address, client or solicitor…" aria-label="Search enquiries" />
        </div>
        <select className="enq-select" value={side} onChange={(e) => setSide(e.target.value as typeof side)} aria-label="Filter by side">
          <option value="all">All sides</option>
          <option value="seller_solicitor">With seller&apos;s solicitor</option>
          <option value="buyer_solicitor">With buyer&apos;s solicitor</option>
        </select>
        <select className="enq-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="attention">Sort: Needs attention</option>
          <option value="quietest">Sort: Quietest first</option>
          <option value="recent">Sort: Recently updated</option>
        </select>
      </div>

      {/* Rows */}
      <div className="enq-list" ref={listRef}>
        {shown.map((r) => {
          const signedPhoto = r.photoStoragePath ? signedPhotos[r.photoStoragePath] ?? null : null;
          const busy = busyId === r.transactionId;
          const pill = statusPill(r);
          const isSeller = r.currentlyWith === "seller_solicitor";
          const withBuyer = !isSeller;
          const [line1, ...rest] = r.address.split(",");
          const expanded = expandedId === r.transactionId;
          return (
            <div
              key={r.transactionId}
              data-tx={r.transactionId}
              className={`enq-card${menuRowId === r.transactionId ? " enq-card--menu" : ""}`}
              data-busy={busy ? "" : undefined}
            >
              {/* The whole row toggles expand/collapse, EXCEPT the file link, the
                  court slider, and the action cluster — those keep their own
                  behaviour (navigate / drag / act). Caret stays as the keyboard
                  path (critique E1). */}
              <div
                className="enq-row2 enq-row2-clickable"
                role="presentation"
                onClick={(e) => { if (!(e.target as HTMLElement).closest(".enq-idlink, .enq-slider, .enq-actions2")) toggleExpand(r.transactionId); }}
              >
                {/* Photo + address are one link: hovering anywhere (photo or
                    town) highlights the address, clicking opens the file. */}
                <Link href={`/agent/transactions/${r.transactionId}`} className="enq-idlink" aria-label={`Open ${line1.trim()}`}>
                  {signedPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="enq-thumb" src={signedPhoto} alt="" aria-hidden />
                  ) : (
                    <div className="enq-thumb property-photo-fallback" aria-hidden />
                  )}
                  <div className="enq-idcol">
                    <span className="enq-addr" data-sensitive="true">{line1.trim()}</span>
                    {rest.length > 0 && <div className="enq-town" data-sensitive="true">{rest.join(",").trim()}</div>}
                    <div className="enq-meta2">
                      {r.tenure ? <span style={{ textTransform: "capitalize" }}>{r.tenure}</span> : null}
                      {r.tenure && fmtPrice(r.price) ? " · " : ""}
                      {fmtPrice(r.price) ?? ""}
                    </div>
                  </div>
                </Link>

                {/* Court slider */}
                <div className="enq-slider">
                  <ChaseBar stage={r.chaseBar.stage} progress={r.chaseBar.progress} isSeller={isSeller} onDragCommit={(dir) => setDragConfirm({ row: r, dir })} />
                  <div className="enq-ends">
                    <span style={{ color: isSeller ? "var(--agent-coral-deep)" : "var(--agent-text-muted)", fontWeight: isSeller ? 700 : 500 }}>Seller&apos;s solicitor</span>
                    <span style={{ color: !isSeller ? "var(--agent-coral-deep)" : "var(--agent-text-muted)", fontWeight: !isSeller ? 700 : 500 }}>Buyer&apos;s solicitor</span>
                  </div>
                  <div className="enq-forwd">With the {courtLabel(r.currentlyWith)} for {r.quietDays} {r.quietDays === 1 ? "day" : "days"}</div>
                </div>

                {/* Status */}
                <div className="enq-statuscol">
                  <span className={`enq-pill2 enq-pill-${pill.tone}`}>{pill.tone === "green" ? <CheckCircle size={12} weight="fill" /> : pill.tone === "danger" ? <WarningCircle size={12} weight="fill" /> : pill.tone === "amber" ? <CalendarBlank size={12} /> : <ClockCountdown size={12} />}{pill.label}</span>
                  <span className="enq-substatus">{r.partial ? "Some replies in · more to come" : (r.outstandingNote || (withBuyer ? "With the buyer's solicitor to review" : "Replies outstanding"))}</span>
                </div>

                {/* Actions — court-aware, responsive: a split button on desktop
                    (one-click primary + a ▾ for the rest) collapses to a single
                    "Update" menu below the tablet breakpoint. A calendar icon
                    arms an inline "happened earlier" strip that backdates the
                    clock. See RowActions. */}
                <RowActions
                  row={r}
                  busy={busy}
                  isSeller={isSeller}
                  expanded={expanded}
                  onToggleExpand={() => toggleExpand(r.transactionId)}
                  onMenuOpenChange={(open) => setMenuRowId(open ? r.transactionId : (id) => (id === r.transactionId ? null : id))}
                  move={(opts, msg) => run(r.transactionId, () => logEnquiryMovementAction({ transactionId: r.transactionId, ...opts }), msg)}
                  onSatisfy={() => run(r.transactionId, () => markEnquiriesSatisfiedAction({ transactionId: r.transactionId }), "Enquiries satisfied")}
                />
              </div>

              {/* Accordion: always mounted so the grid-rows 0fr→1fr reveal
                  animates both ways. The history fetch stays gated on expand
                  (toggleExpand), so collapsed rows don't hit the server. */}
              <div className={`agent-acc${expanded ? " open" : ""}`}>
                <div className="agent-acc-in">
                  <ExpandedDetail row={r} history={history[r.transactionId]} emailConnected={emailConnected} onLog={(mode) => setLogSheet({ row: r, mode })} onChase={(method, details) => run(r.transactionId, () => logEnquiryChaseAction({ transactionId: r.transactionId, method, ...details }), `Logged: chased by ${method}`)} onExpected={(date) => run(r.transactionId, () => setEnquiryExpectedDateAction({ transactionId: r.transactionId, date }), date ? "Expected date set" : "Expected date cleared")} busy={busy} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="enq-foot">Showing {shown.length} of {rows.length} {rows.length === 1 ? "enquiry" : "enquiries"}</p>

      {dragConfirm && (() => {
        const id = dragConfirm.row.transactionId;
        const addr = dragConfirm.row.address.split(",")[0].trim();
        const toBuyer = dragConfirm.dir === "to_buyer";
        return (
          <div className="enq-modal-overlay" role="presentation" onClick={() => setDragConfirm(null)}>
            <div className="enq-modal" role="dialog" aria-modal="true" aria-label={toBuyer ? "Confirm replies issued in full" : "Confirm raising further enquiries"} onClick={(e) => e.stopPropagation()}>
              <h3 className="enq-modal-title">{toBuyer ? "Replies issued in full?" : "Raise further enquiries?"}</h3>
              <p className="enq-modal-body">
                {toBuyer
                  ? `This moves ${addr} to the buyer's solicitor to review. Only confirm once all replies are across.`
                  : `This moves ${addr} back to the seller's solicitor for another round of enquiries.`}
              </p>
              <div className="enq-modal-actions">
                {toBuyer ? (
                  <>
                    <button type="button" className="enq-btn enq-btn-satisfied" onClick={() => { run(id, () => logEnquiryMovementAction({ transactionId: id, mode: "handover", flipsCourtTo: "buyer_solicitor", kind: "replies_sent", note: "Replies sent" }), "Replies sent, moved to the buyer's side"); setDragConfirm(null); }}>
                      <Checks size={14} weight="bold" /> Yes, replies issued in full
                    </button>
                    <button type="button" className="enq-btn enq-btn-flip" onClick={() => { run(id, () => logEnquiryMovementAction({ transactionId: id, mode: "touch", kind: "partial_replies", note: "Some replies sent across" }), "Logged: some replies in"); setDragConfirm(null); }}>
                      Only some replies in
                    </button>
                    <button type="button" className="enq-btn enq-btn-flip" onClick={() => setDragConfirm(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="enq-btn enq-btn-primary2" onClick={() => { run(id, () => logEnquiryMovementAction({ transactionId: id, mode: "handover", flipsCourtTo: "seller_solicitor", kind: "raised", note: "Further enquiries raised" }), "Further enquiries raised, moved to the seller's side"); setDragConfirm(null); }}>
                      <ArrowRight size={14} weight="bold" /> Yes, raise further
                    </button>
                    <button type="button" className="enq-btn enq-btn-flip" onClick={() => setDragConfirm(null)}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {logSheet && (
        <EnquiryLogSheet
          mode={logSheet.mode}
          address={logSheet.row.address.split(",")[0].trim()}
          parties={logSheet.row.parties}
          defaultPartyId={logSheet.row.currentlyWith === "seller_solicitor" ? "vsol" : "psol"}
          busy={busyId === logSheet.row.transactionId}
          onSubmit={(d) => run(logSheet.row.transactionId, () => logEnquiryChaseAction({ transactionId: logSheet.row.transactionId, method: logSheet.mode, outcome: d.outcome, note: d.note, partyLabel: d.partyLabel, contactId: d.contactId }), logSheet.mode === "phone" ? "Call logged" : "Email logged")}
          onClose={() => setLogSheet(null)}
        />
      )}
    </div>
  );
}

// ─── Row action cluster ───────────────────────────────────────────────────────
// Responsive: a split button on desktop (one-click primary + ▾ for the rest)
// that collapses to a single "Update" menu on tablet/mobile. A calendar icon
// arms an inline "happened earlier" strip that backdates the movement so the
// chase cadence + "for N days" count from the real event day, not the click.
// Backdating covers the clock-resetting actions (handovers + "still with them").

type MoveOpts = {
  mode?: EnquiryMovementMode;
  flipsCourtTo?: EnquiryCourt | null;
  kind?: EnquiryMovementKind;
  note?: string;
  occurredAt?: string;
};

function dateToISO(d: Date): string {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}
function todayISO(): string {
  return dateToISO(new Date());
}
function tomorrowISO(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return dateToISO(t);
}
function fmtBd(iso: string): string {
  if (iso === todayISO()) return "Today";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function RowActions({
  row, busy, isSeller, expanded, onToggleExpand, onMenuOpenChange, move, onSatisfy,
}: {
  row: OpenEnquiryRow;
  busy: boolean;
  isSeller: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onMenuOpenChange: (open: boolean) => void;
  move: (opts: MoveOpts, msg: string) => void;
  onSatisfy: () => void;
}) {
  const other = otherCourt(row.currentlyWith);
  const [menuOpen, setMenuOpen] = useState(false);
  const [satisfyArmed, setSatisfyArmed] = useState(false);
  // Backdate popover: a little menu with the date picker on top and the
  // clock-resetting actions stacked below, each disabled until a date is chosen.
  // Elevates the card (via the menu class) so it can overflow; no row collapse.
  const [bdOpen, setBdOpen] = useState(false);
  const [bdISO, setBdISO] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep the parent (card elevation for the dropdown) in sync with the menu.
  const changeMenu = (open: boolean) => { setMenuOpen(open); onMenuOpenChange(open); };

  function openBackdate() {
    setMenuOpen(false);
    setBdISO("");
    setBdOpen(true);
    onMenuOpenChange(true); // elevate the card so the popover isn't clipped
  }
  function closeBackdate() {
    setBdOpen(false);
    setBdISO("");
    onMenuOpenChange(false);
  }

  useEffect(() => {
    if (!menuOpen && !bdOpen) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { changeMenu(false); setBdOpen(false); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, bdOpen]);

  // Concrete movements. Backdatable ones take an optional ISO date.
  const doRepliesSent = (occurredAt?: string) => move({ mode: "handover", flipsCourtTo: other, kind: "replies_sent", note: "Replies sent", occurredAt }, `Replies sent, moved to the ${courtShort(other)}`);
  const doPartial = (occurredAt?: string) => move({ mode: "touch", kind: "partial_replies", note: "Some replies sent across", occurredAt }, "Logged: some replies in");
  const doStill = (occurredAt?: string) => move({ mode: "touch", kind: "update", occurredAt }, "Confirmed, still with them");
  const doRaise = (occurredAt?: string) => move({ mode: "handover", flipsCourtTo: "seller_solicitor", kind: "raised", note: "Further enquiries raised", occurredAt }, "Further enquiries raised, moved to the seller's side");
  const doWrong = () => move({ mode: "relabel", flipsCourtTo: other, kind: "correction" }, `Corrected: now with the ${courtShort(other)}`);

  // ── Armed: Mark satisfied (two-tap — it opens exchange) ──
  if (satisfyArmed) {
    return (
      <div className="enq-actions2" ref={wrapRef}>
        <span className="enq-confirm-q">Mark satisfied? This opens exchange.</span>
        <button type="button" disabled={busy} className="enq-btn enq-btn-satisfied" onClick={() => { setSatisfyArmed(false); onSatisfy(); }}><Check size={14} weight="bold" /> Confirm</button>
        <button type="button" disabled={busy} className="enq-btn enq-btn-flip" onClick={() => setSatisfyArmed(false)}>Cancel</button>
      </div>
    );
  }

  // Backdatable actions for the popover (the clock-resetting ones).
  const bdActs = isSeller
    ? [
        { k: "rs", label: "Replies sent", desc: "Full replies across → buyer's side", icon: <PaperPlaneTilt size={16} />, run: doRepliesSent },
        { k: "sp", label: "Some replies in", desc: "Partial, stays their court", icon: <Checks size={16} />, run: doPartial },
        { k: "st", label: "Still with them", desc: "In touch, no move", icon: <ArrowsClockwise size={16} />, run: doStill },
      ]
    : [
        { k: "rf", label: "Raise further", desc: "Fresh round → seller's side", icon: <ArrowRight size={16} />, run: doRaise },
        { k: "st", label: "Still with them", desc: "In touch, no move", icon: <ArrowsClockwise size={16} />, run: doStill },
      ];

  // ── Normal: split (desktop) / menu (tablet+mobile) ──
  const primaryGreen = !isSeller; // buyer-side primary is "Mark satisfied" (green)
  const onPrimary = isSeller ? () => doRepliesSent() : () => setSatisfyArmed(true);
  const primaryLabel = isSeller ? "Replies sent" : "Mark satisfied";
  const primaryIcon = isSeller ? <PaperPlaneTilt size={14} weight="fill" /> : <CheckCircle size={14} weight="fill" />;

  const items = isSeller
    ? [
        { icon: <PaperPlaneTilt size={16} />, label: "Replies sent", desc: "Full replies across → buyer's side", onClick: () => doRepliesSent() },
        { icon: <Checks size={16} />, label: "Some replies in", desc: "Partial, stays their court", onClick: () => doPartial() },
        { icon: <ArrowsClockwise size={16} />, label: "Still with them", desc: "In touch, no move", onClick: () => doStill() },
        { icon: <ArrowsLeftRight size={16} />, label: "Wrong side?", desc: "Fix the court, keep the timer", onClick: () => doWrong() },
      ]
    : [
        { icon: <CheckCircle size={16} />, label: "Mark satisfied", desc: "Closes the loop, opens exchange", onClick: () => setSatisfyArmed(true) },
        { icon: <ArrowRight size={16} />, label: "Raise further", desc: "Fresh round → seller's side", onClick: () => doRaise() },
        { icon: <ArrowsClockwise size={16} />, label: "Still with them", desc: "In touch, no move", onClick: () => doStill() },
        { icon: <ArrowsLeftRight size={16} />, label: "Wrong side?", desc: "Fix the court, keep the timer", onClick: () => doWrong() },
      ];

  const pick = (fn: () => void) => { changeMenu(false); fn(); };

  return (
    <div className="enq-actions2" ref={wrapRef}>
      {/* Desktop: calendar + split button */}
      <button type="button" className="enq-iconbtn enq-a-desktop" disabled={busy} title="Happened earlier" aria-label="Happened earlier" aria-expanded={bdOpen} onClick={() => (bdOpen ? closeBackdate() : openBackdate())}>
        <CalendarBlank size={15} />
      </button>
      <span className="enq-split enq-a-desktop">
        <button type="button" disabled={busy} className={`enq-btn enq-split-main ${primaryGreen ? "enq-btn-satisfied" : "enq-btn-primary2"}`} onClick={onPrimary}>{primaryIcon} {primaryLabel}</button>
        <button type="button" disabled={busy} aria-label="More actions" aria-expanded={menuOpen} className={`enq-btn enq-split-caret ${primaryGreen ? "enq-btn-satisfied" : "enq-btn-primary2"}`} onClick={() => changeMenu(!menuOpen)}><CaretDown size={13} weight="bold" /></button>
      </span>

      {/* Tablet/mobile: single Update menu trigger */}
      <button type="button" disabled={busy} className="enq-btn enq-btn-flip enq-a-mobile" aria-expanded={menuOpen} onClick={() => changeMenu(!menuOpen)}>Update <CaretDown size={13} weight="bold" /></button>

      {menuOpen && (
        <div className="enq-menu" role="menu">
          {items.map((mi, i) => (
            <button key={i} type="button" role="menuitem" className="enq-mi" onClick={() => pick(mi.onClick)}>
              <span className="enq-mi-ico">{mi.icon}</span>
              <span className="enq-mi-txt">{mi.label}<small>{mi.desc}</small></span>
            </button>
          ))}
          <div className="enq-mi-div" />
          <button type="button" role="menuitem" className="enq-mi" onClick={openBackdate}>
            <span className="enq-mi-ico"><CalendarBlank size={16} /></span>
            <span className="enq-mi-txt">Happened earlier…<small>Backdate so the timer&apos;s right</small></span>
          </button>
        </div>
      )}

      {bdOpen && (
        <div className="enq-menu enq-bd-menu" role="menu">
          <div className="enq-bd-when">When did this happen?</div>
          {/* Tap-to-open: the native input covers the field and is directly
              tappable, so a tap opens the OS picker on iOS (the old hidden-input +
              showPicker pattern silently did nothing on iPhone — critique W2). */}
          <div className="enq-bd-field">
            <CalendarBlank size={15} className="enq-bd-cal" />
            <span className={bdISO ? "enq-bd-val" : "enq-bd-ph"}>{bdISO ? fmtBd(bdISO) : "Choose a date"}</span>
            <input
              type="date"
              className="enq-exp-native"
              min={dateToISO(row.openedAt)}
              max={todayISO()}
              value={bdISO}
              onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* iOS opens on tap anyway */ } }}
              onChange={(e) => setBdISO(e.target.value)}
              aria-label="When did this happen"
            />
          </div>
          <div className="enq-mi-div" />
          {bdActs.map((a) => (
            <button
              key={a.k}
              type="button"
              role="menuitem"
              className="enq-mi"
              disabled={busy || !bdISO}
              onClick={() => { a.run(bdISO); closeBackdate(); }}
            >
              <span className="enq-mi-ico">{a.icon}</span>
              <span className="enq-mi-txt">{a.label}<small>{a.desc}</small></span>
            </button>
          ))}
        </div>
      )}

      <button type="button" className="enq-expand" aria-label={expanded ? "Hide details" : "Show details"} aria-expanded={expanded} onClick={onToggleExpand}>
        <CaretDown size={15} weight="bold" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
      </button>
    </div>
  );
}

type TileTone = "coral" | "info" | "warning" | "success" | "neutral";
function Tile({ icon, value, label, sub, tone }: { icon: React.ReactNode; value: number; label: string; sub: string; tone: TileTone }) {
  return (
    <div className="enq-summary-cell">
      <span aria-hidden className={`stat-circle stat-circle--${tone}`}>{icon}</span>
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span className="enq-summary-val">{value.toLocaleString()}</span>
        <span className="enq-summary-label">{label}</span>
        <span className="enq-summary-sub">{sub}</span>
      </span>
    </div>
  );
}

function ExpandedDetail({
  row, history, onChase, onLog, emailConnected, onExpected, busy,
}: {
  row: OpenEnquiryRow;
  history: EnquiryHistoryEntry[] | "loading" | undefined;
  onChase: (method: "phone" | "email", details?: { outcome?: EnquiryCallOutcome; note?: string; withParty?: EnquiryCallParty }) => void;
  onLog: (mode: "phone" | "email") => void;
  emailConnected: boolean;
  onExpected: (date: string | null) => void;
  busy: boolean;
}) {
  const [previewMsgId, setPreviewMsgId] = useState<string | null>(null);
  return (
    <div className="enq-detail">
      <div className="enq-detail-col">
        <div className="enq-detail-h">Enquiry round</div>
        <div className="enq-detail-b">Raised {fmtDay(row.openedAt)} by the buyer&apos;s solicitor</div>
      </div>
      <div className="enq-detail-col">
        <div className="enq-detail-h">Last update</div>
        {row.lastMovement ? (
          <>
            <div className="enq-detail-b">&ldquo;{row.lastMovement.note}&rdquo;</div>
            <div className="enq-detail-meta">{row.lastMovement.byName ?? "Team"} · {fmtDay(row.lastMovement.occurredAt)}</div>
          </>
        ) : <div className="enq-detail-b" style={{ color: "var(--agent-text-muted)" }}>No updates logged yet.</div>}
      </div>
      <div className="enq-detail-col">
        <div className="enq-detail-h">Expected</div>
        {row.expectedDate && new Date(row.expectedDate).getTime() >= new Date().setHours(0, 0, 0, 0) ? (
          <div className="enq-detail-b">{fmtDay(row.expectedDate)} <button type="button" className="enq-linkbtn" disabled={busy} onClick={() => onExpected(null)}>Clear</button></div>
        ) : (
          // Tap-to-open: a real (invisible) date input covers the field, so a tap
          // opens the OS picker directly. No autoFocus + onBlur — that combo made
          // iOS cancel the picker the instant it stole focus (#3). Earliest is
          // tomorrow: a same-day "hold until" can't apply, so it would silently
          // no-op (critique F1). An expired date falls back to this add field (W1).
          <div className="enq-bd-field enq-exp-field">
            <CalendarBlank size={15} className="enq-bd-cal" />
            <span className="enq-bd-ph">Add expected date</span>
            <input
              type="date"
              className="enq-exp-native"
              min={tomorrowISO()}
              disabled={busy}
              onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* iOS opens on tap anyway */ } }}
              onChange={(e) => { if (e.target.value) onExpected(e.target.value); }}
              aria-label="Expected replies date"
            />
          </div>
        )}
        <div className="enq-detail-chase">
          <span className="enq-detail-meta">Log a chase:</span>
          <button type="button" className="enq-chip" disabled={busy} onClick={() => onLog("phone")}><Phone size={12} /> Phone</button>
          {/* Email: one-tap when the mailbox ingest is connected (their sent email
              is captured automatically); otherwise open the logger so they can
              record it themselves (#6). */}
          <button type="button" className="enq-chip" disabled={busy} onClick={() => (emailConnected ? onChase("email") : onLog("email"))}><EnvelopeSimple size={12} /> Email</button>
        </div>
      </div>
      <div className="enq-detail-col">
        <div className="enq-detail-h">Chase history</div>
        {history === "loading" || history === undefined ? (
          <div className="enq-detail-meta">Loading…</div>
        ) : history.length === 0 ? (
          <div className="enq-detail-meta">Nothing logged yet.</div>
        ) : (
          <ul className="enq-timeline">
            {history.slice(0, 8).map((h) => (
              <li key={h.id}>
                <span className={`enq-dot enq-dot-${h.tone}`} />
                {h.messageId ? (
                  <button type="button" className="enq-tl-open" onClick={() => setPreviewMsgId(h.messageId)} title="View this email exactly as it was sent">
                    <span className="enq-tl-date">{fmtDay(h.at)}</span>
                    <span className="enq-tl-label">{h.label}{h.by ? ` · ${h.by}` : ""}</span>
                  </button>
                ) : (
                  <>
                    <span className="enq-tl-date">{fmtDay(h.at)}</span>
                    <span className="enq-tl-label">{h.label}{h.by ? ` · ${h.by}` : ""}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <EnquiryEmailPreview messageId={previewMsgId} onClose={() => setPreviewMsgId(null)} />
    </div>
  );
}
