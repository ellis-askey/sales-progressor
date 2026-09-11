"use client";

// Enquiries triage list. See what's outstanding, whose court the ball is in, and
// what needs chasing — and blitz-confirm/flip/chase without opening each file.
// Reuses the enquiry tracker actions; the chase-history timeline loads on expand.
// Internal only for now. Spec: docs/active/enquiries-triage/00-spec.md.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check, Checks, ArrowsLeftRight, ArrowsClockwise, ArrowRight, ChatCircleDots, CaretDown, MagnifyingGlass,
  Phone, EnvelopeSimple, CalendarBlank, ClockCountdown, WarningCircle, CheckCircle, PaperPlaneTilt,
} from "@phosphor-icons/react";
import {
  logEnquiryMovementAction, logEnquiryChaseAction, setEnquiryExpectedDateAction, getEnquiryHistoryAction,
  markEnquiriesSatisfiedAction,
} from "@/app/actions/enquiries";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { OpenEnquiryRow, EnquiryHistoryEntry } from "@/lib/services/enquiries";
import type { EnquiryCourt, EnquiryMovementMode, EnquiryMovementKind } from "@/lib/enquiries/tracker";
import { DateField } from "@/components/ui/DateField";

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
function isToday(d: Date | null): boolean {
  if (!d) return false;
  const n = new Date();
  const x = new Date(d);
  return n.getFullYear() === x.getFullYear() && n.getMonth() === x.getMonth() && n.getDate() === x.getDate();
}
function startOfTomorrow(): number {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.getTime() + 86400000;
}

type Pill = { label: string; tone: "danger" | "amber" | "green" | "blue" };
function statusPill(r: OpenEnquiryRow): Pill {
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
    return { label: `Expected ${fmtDay(r.expectedDate)}`, tone: "amber" };
  }
  // Court-driven, not last-event-driven: with the buyer's solicitor means the
  // replies are in and they're deciding (satisfied / raise further); with the
  // seller's solicitor means they still owe the replies. A logged chase no
  // longer flips this back to "waiting" the way reading lastMovement.kind did.
  if (r.currentlyWith === "buyer_solicitor") return { label: "Being reviewed", tone: "green" };
  return { label: "Awaiting replies", tone: "blue" };
}

type SortKey = "attention" | "quietest" | "recent";

export function EnquiriesTriageList({
  rows,
  signedPhotos,
}: {
  rows: OpenEnquiryRow[];
  signedPhotos: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, EnquiryHistoryEntry[] | "loading">>({});
  // Which row currently has an open menu (elevate its card so the dropdown sits
  // above every sibling) or an open backdate strip (collapse its slider + status).
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [backdateRowId, setBackdateRowId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [side, setSide] = useState<"all" | EnquiryCourt>("all");
  const [sort, setSort] = useState<SortKey>("attention");

  // Tiles reflect the WHOLE set (not the filtered view). Mutually-exclusive
  // buckets so they read as a breakdown of the total.
  const tiles = useMemo(() => {
    const midnight = new Date().setHours(0, 0, 0, 0);
    let needChecking = 0, awaiting = 0, expectedToday = 0;
    for (const r of rows) {
      if (isToday(r.expectedDate)) { expectedToday++; continue; }
      const chaseMs = r.nextChaseAt ? new Date(r.nextChaseAt).getTime() : null;
      if (r.status !== "snoozed" && chaseMs != null && chaseMs < startOfTomorrow()) { needChecking++; continue; }
      awaiting++;
    }
    void midnight;
    return { total: rows.length, needChecking, awaiting, expectedToday };
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

  function run(id: string, fn: () => Promise<{ ok: boolean }>, msg: string) {
    if (busyId) return;
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res?.ok) { toast.success(msg); router.refresh(); }
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
      {/* Tiles */}
      <div className="enq-tiles">
        <Tile icon={<ChatCircleDots size={16} />} value={tiles.total} label="in enquiries" sub={`Across ${tiles.total} ${tiles.total === 1 ? "sale" : "sales"}`} />
        <Tile icon={<WarningCircle size={16} weight="fill" />} value={tiles.needChecking} label="need checking" sub="Overdue or due today" danger />
        <Tile icon={<PaperPlaneTilt size={16} />} value={tiles.awaiting} label="awaiting replies" sub="With a solicitor" />
        <Tile icon={<CalendarBlank size={16} />} value={tiles.expectedToday} label="expected today" sub="Based on latest updates" />
      </div>

      {/* Toolbar */}
      <div className="enq-toolbar">
        <div className="enq-search">
          <MagnifyingGlass size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by address, client or solicitor…" aria-label="Search enquiries" />
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
      <div className="enq-list">
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
              className={`enq-card${menuRowId === r.transactionId ? " enq-card--menu" : ""}${backdateRowId === r.transactionId ? " enq-card--backdate" : ""}`}
              data-busy={busy ? "" : undefined}
            >
              <div className="enq-row2">
                {signedPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="enq-thumb" src={signedPhoto} alt="" aria-hidden />
                ) : (
                  <div className="enq-thumb property-photo-fallback" aria-hidden />
                )}
                <div className="enq-idcol">
                  <Link href={`/agent/transactions/${r.transactionId}`} className="enq-addr" data-sensitive="true">{line1.trim()}</Link>
                  {rest.length > 0 && <div className="enq-town" data-sensitive="true">{rest.join(",").trim()}</div>}
                  <div className="enq-meta2">
                    {r.tenure ? <span style={{ textTransform: "capitalize" }}>{r.tenure}</span> : null}
                    {r.tenure && fmtPrice(r.price) ? " · " : ""}
                    {fmtPrice(r.price) ?? ""}
                  </div>
                </div>

                {/* Court slider */}
                <div className="enq-slider">
                  <div className="enq-track">
                    <span className="enq-handle" style={{ left: isSeller ? "0" : "calc(100% - 14px)" }} />
                  </div>
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
                  onBackdateChange={(open) => setBackdateRowId(open ? r.transactionId : (id) => (id === r.transactionId ? null : id))}
                  move={(opts, msg) => run(r.transactionId, () => logEnquiryMovementAction({ transactionId: r.transactionId, ...opts }), msg)}
                  onSatisfy={() => run(r.transactionId, () => markEnquiriesSatisfiedAction({ transactionId: r.transactionId }), "Enquiries satisfied")}
                />
              </div>

              {expanded && <ExpandedDetail row={r} history={history[r.transactionId]} onChase={(method) => run(r.transactionId, () => logEnquiryChaseAction({ transactionId: r.transactionId, method }), `Logged: chased by ${method}`)} onExpected={(date) => run(r.transactionId, () => setEnquiryExpectedDateAction({ transactionId: r.transactionId, date }), date ? "Expected date set" : "Expected date cleared")} busy={busy} />}
            </div>
          );
        })}
      </div>

      <p className="enq-foot">Showing {shown.length} of {rows.length} {rows.length === 1 ? "enquiry" : "enquiries"}</p>
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
function fmtChipDate(iso: string): string {
  if (!iso || iso === todayISO()) return "Today";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function RowActions({
  row, busy, isSeller, expanded, onToggleExpand, onMenuOpenChange, onBackdateChange, move, onSatisfy,
}: {
  row: OpenEnquiryRow;
  busy: boolean;
  isSeller: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onBackdateChange: (open: boolean) => void;
  move: (opts: MoveOpts, msg: string) => void;
  onSatisfy: () => void;
}) {
  const other = otherCourt(row.currentlyWith);
  const [menuOpen, setMenuOpen] = useState(false);
  const [satisfyArmed, setSatisfyArmed] = useState(false);
  // Backdate strip enter/exit: bdMounted keeps it in the DOM; bdClosing swaps to
  // the reverse (despawn) animation for ~260ms before it unmounts, so opening
  // AND reverting both animate. The parent collapses / re-expands the slider +
  // status via the card class, driven off onBackdateChange.
  const [bdMounted, setBdMounted] = useState(false);
  const [bdClosing, setBdClosing] = useState(false);
  const [bdISO, setBdISO] = useState(todayISO());
  const wrapRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the parent (card elevation for the dropdown) in sync with the menu.
  const changeMenu = (open: boolean) => { setMenuOpen(open); onMenuOpenChange(open); };

  function openBackdate() {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    changeMenu(false);
    setBdClosing(false);
    setBdMounted(true);
    onBackdateChange(true);
  }
  function closeBackdate() {
    // Reverse: the left content re-expands now (card class off), the strip plays
    // its despawn, then it unmounts once the animation is done.
    onBackdateChange(false);
    setBdClosing(true);
    setBdISO(todayISO());
    closeTimer.current = setTimeout(() => { setBdMounted(false); setBdClosing(false); }, 260);
  }
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) changeMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  // Concrete movements. Backdatable ones take an optional ISO date.
  const doRepliesSent = (occurredAt?: string) => move({ mode: "handover", flipsCourtTo: other, kind: "replies_sent", note: "Replies sent", occurredAt }, `Replies sent, moved to the ${courtShort(other)}`);
  const doPartial = (occurredAt?: string) => move({ mode: "touch", kind: "partial_replies", note: "Some replies sent across", occurredAt }, "Logged: some replies in");
  const doStill = (occurredAt?: string) => move({ mode: "touch", kind: "update", occurredAt }, "Confirmed, still with them");
  const doRaise = (occurredAt?: string) => move({ mode: "handover", flipsCourtTo: "seller_solicitor", kind: "raised", note: "Further enquiries raised", occurredAt }, "Further enquiries raised, moved to the seller's side");
  const doWrong = () => move({ mode: "relabel", flipsCourtTo: other, kind: "correction" }, `Corrected: now with the ${courtShort(other)}`);

  function openDatePicker() {
    const el = dateRef.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); }
  }

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

  // ── Backdate strip: pick a day, then choose the action ──
  if (bdMounted) {
    const acts = isSeller
      ? [
          { k: "rs", label: "Replies sent", icon: <PaperPlaneTilt size={14} weight="fill" />, run: doRepliesSent, solid: true },
          { k: "sp", label: "Some replies", icon: <Checks size={14} />, run: doPartial },
          { k: "st", label: "Still with them", icon: <ArrowsClockwise size={14} />, run: doStill },
        ]
      : [
          { k: "rf", label: "Raise further", icon: <ArrowRight size={14} />, run: doRaise, solid: true },
          { k: "st", label: "Still with them", icon: <ArrowsClockwise size={14} />, run: doStill },
        ];
    return (
      <div className={`enq-actions2 enq-actions-backdate${bdClosing ? " is-closing" : ""}`} ref={wrapRef}>
        <span className="enq-backdate enq-bd-item">
          <CalendarBlank size={14} weight="regular" style={{ color: "var(--agent-text-muted)" }} />
          <button type="button" className="enq-bd-date" onClick={openDatePicker}>{fmtChipDate(bdISO)} <CaretDown size={11} weight="bold" /></button>
          <input ref={dateRef} type="date" className="enq-bd-input" min={dateToISO(row.openedAt)} max={todayISO()} value={bdISO} onChange={(e) => { if (e.target.value) setBdISO(e.target.value); }} aria-label="When did this happen" />
        </span>
        <span className="enq-bd-acts">
          {acts.map((a) => (
            <button key={a.k} type="button" disabled={busy} className={`enq-btn enq-bd-item ${a.solid ? "enq-btn-primary2" : "enq-btn-flip"}`} onClick={() => { a.run(bdISO); closeBackdate(); }}>{a.icon} {a.label}</button>
          ))}
        </span>
        <button type="button" disabled={busy} className="enq-btn enq-btn-cancel enq-bd-item" onClick={closeBackdate}>Cancel</button>
      </div>
    );
  }

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
      <button type="button" className="enq-iconbtn enq-a-desktop" disabled={busy} title="Happened earlier" aria-label="Happened earlier" onClick={openBackdate}>
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

      <button type="button" className="enq-expand" aria-label={expanded ? "Hide details" : "Show details"} aria-expanded={expanded} onClick={onToggleExpand}>
        <CaretDown size={15} weight="bold" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
      </button>
    </div>
  );
}

function Tile({ icon, value, label, sub, danger }: { icon: React.ReactNode; value: number; label: string; sub: string; danger?: boolean }) {
  return (
    <div className="enq-tile">
      <div className="enq-tile-top">
        <span className="enq-tile-value" style={danger ? { color: "var(--agent-coral-deep)" } : undefined}>{value}</span>
        <span className="enq-tile-icon" style={danger ? { color: "var(--agent-coral-deep)", background: "rgba(var(--agent-coral-rgb),0.10)" } : undefined}>{icon}</span>
      </div>
      <div className="enq-tile-label" style={danger ? { color: "var(--agent-coral-deep)" } : undefined}>{label}</div>
      <div className="enq-tile-sub">{sub}</div>
    </div>
  );
}

function ExpandedDetail({
  row, history, onChase, onExpected, busy,
}: {
  row: OpenEnquiryRow;
  history: EnquiryHistoryEntry[] | "loading" | undefined;
  onChase: (method: "phone" | "email") => void;
  onExpected: (date: string | null) => void;
  busy: boolean;
}) {
  const [dateOpen, setDateOpen] = useState(false);
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
        {row.expectedDate ? (
          <div className="enq-detail-b">{fmtDay(row.expectedDate)} <button type="button" className="enq-linkbtn" disabled={busy} onClick={() => onExpected(null)}>Clear</button></div>
        ) : dateOpen ? (
          <DateField className="enq-date" wrapperStyle={{ display: "inline-block" }} autoFocus disabled={busy} onChange={(e) => { if (e.target.value) onExpected(e.target.value); setDateOpen(false); }} onBlur={() => setDateOpen(false)} />
        ) : (
          <button type="button" className="enq-linkbtn" onClick={() => setDateOpen(true)}>Add expected date</button>
        )}
        <div className="enq-detail-chase">
          <span className="enq-detail-meta">Log a chase:</span>
          <button type="button" className="enq-chip" disabled={busy} onClick={() => onChase("phone")}><Phone size={12} /> Phone</button>
          <button type="button" className="enq-chip" disabled={busy} onClick={() => onChase("email")}><EnvelopeSimple size={12} /> Email</button>
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
                <span className="enq-tl-date">{fmtDay(h.at)}</span>
                <span className="enq-tl-label">{h.label}{h.by ? ` · ${h.by}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
