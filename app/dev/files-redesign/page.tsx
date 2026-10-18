"use client";

// /dev/files-redesign — PROPOSED All Files table (visual mock, no wiring). v4.
// Per-tab, data-audited, and ZERO duplication of what the tab already tells you:
//   • On hold: no "on hold" anywhere. Columns answer the real questions — when
//     is it due back (Review), and how long / why (Paused). From the hold record
//     (startedAt, plannedEndAt, optional typed reason).
//   • Completed: Exchanged → Completed + how long it took. No "Completed" word.
//   • Withdrawn: how far it got (Reached), when, and why.
//   • Active: Stage · Activity/Next step · Exchange forecast (date + pace).
//   • All: the only tab that mixes statuses, so it keeps a status marker.

import { useState } from "react";
import { notFound } from "next/navigation";
import {
  CaretRight, CaretUpDown, EnvelopeSimple, Phone, FileText, Note, Eye, Warning,
  TrendUp, TrendDown, Minus, CheckCircle, Prohibit, PauseCircle, LinkSimple, ArrowRight,
  Handshake, Key, XCircle,
} from "@phosphor-icons/react";

// ── Palette ───────────────────────────────────────────────────────────────────
const INK = "#2D1810", INK2 = "#5A3A28", MUT = "rgba(45,24,16,0.5)", FAINT = "rgba(45,24,16,0.4)";
const LINE = "rgba(45,24,16,0.10)", CORALD = "#E8542F";
const GREEN = "#1f8a4a", AMBER = "#c97d1a", RED = "#c73e3e", BLUE = "#2563a8", INDIGO = "#5b6b8c", SLATE = "#64748b";

type Status = "active" | "on_hold" | "completed" | "withdrawn";
type Pace = "ahead" | "on_track" | "slightly_behind" | "behind";
type Risk = "watch" | "at_risk" | null;
type Act = { Icon: typeof Phone; title: string; when: string };
type Next = { text: string; tone: string; Icon?: typeof ArrowRight } | null;

type Row = {
  id: string; line: string; townpc: string; agency: string; status: Status;
  stage: { name: string; idx: number } | null;
  act?: Act; next?: Next; risk?: Risk;
  exchange?: { date: string; weeks: string; pace: Pace };
  hold?: { days: number; review: string | null; overdue?: boolean; reason: string | null };
  done?: { price: string; exchanged: string; completed: string; took: string };
  gone?: { reached: string; reachedIdx: number; cat: "buyer" | "seller" | "chain" | "other"; date: string; reason: string };
};

const TOTAL = 6;

const ROWS: Row[] = [
  // ── Active ──
  { id: "a1", line: "2 Mandelyns, Northchurch", townpc: "Berkhamsted, HP4 3XH", agency: "Akeman Residential", status: "active",
    stage: { name: "Enquiries", idx: 3 }, risk: "watch",
    act: { Icon: EnvelopeSimple, title: "Chased the seller", when: "17 Oct · 2:14pm" }, next: { text: "Awaiting enquiry replies", tone: MUT },
    exchange: { date: "9 Dec 2026", weeks: "Less than 8 weeks", pace: "on_track" } },
  { id: "a2", line: "11 Heath Farm Road, Tring", townpc: "Tring, HP23 4DE", agency: "Longsons Estate Agents", status: "active",
    stage: { name: "Searches", idx: 2 }, risk: null,
    act: { Icon: Phone, title: "Logged a call with the buyer", when: "14 Oct · 11:05am" }, next: { text: "Waiting on searches", tone: MUT },
    exchange: { date: "20 Nov 2026", weeks: "Less than 5 weeks", pace: "ahead" } },
  { id: "a3", line: "8 Ark Royal Court", townpc: "Sleaford, NG34 7JU", agency: "Rhys Mayers", status: "active",
    stage: { name: "Instructed", idx: 1 }, risk: null,
    act: { Icon: FileText, title: "Draft pack received", when: "7 Oct · 9:30am" }, next: { text: "Next: chase the solicitor", tone: CORALD, Icon: ArrowRight },
    exchange: { date: "15 Jan 2027", weeks: "Less than 13 weeks", pace: "slightly_behind" } },
  { id: "a4", line: "41 Priory Gardens", townpc: "Hitchin, SG5 2DJ", agency: "Akeman Residential", status: "active",
    stage: { name: "Exchange", idx: 4 }, risk: null,
    act: { Icon: Note, title: "Marked ready to exchange", when: "16 Oct · 10:12am" }, next: { text: "Ready — waiting on the chain", tone: INDIGO, Icon: LinkSimple },
    exchange: { date: "7 Nov 2026", weeks: "Less than 3 weeks", pace: "on_track" } },
  { id: "a5", line: "5 Copperfields", townpc: "Luton, LU2 7FP", agency: "Rhys Mayers", status: "active",
    stage: { name: "Searches", idx: 2 }, risk: "at_risk",
    act: { Icon: Phone, title: "Chased the solicitor", when: "2 Oct · 1:20pm" }, next: { text: "Chase overdue", tone: RED },
    exchange: { date: "12 Dec 2026", weeks: "Predicted date passed", pace: "behind" } },

  // ── On hold ── (no "on hold" wording — the tab says it)
  { id: "h1", line: "3 Bosanquet Road", townpc: "Hoddesdon, EN11 8NL", agency: "Akeman Residential", status: "on_hold",
    stage: { name: "Enquiries", idx: 3 }, hold: { days: 17, review: "28 Oct", reason: "Seller abroad until November" } },
  { id: "h2", line: "17 Maltings Close", townpc: "Ware, SG12 9QX", agency: "Longsons Estate Agents", status: "on_hold",
    stage: { name: "Draft pack", idx: 1 }, hold: { days: 36, review: "5 Oct", overdue: true, reason: null } },
  { id: "h3", line: "9 Turners Hill", townpc: "Cheshunt, EN8 9BQ", agency: "Rhys Mayers", status: "on_hold",
    stage: { name: "Searches", idx: 2 }, hold: { days: 9, review: "2 Nov", reason: "Waiting on probate" } },
  { id: "h4", line: "22 Dewsleys Lane", townpc: "Newham, CM17 0JF", agency: "George David, Aylesbury", status: "on_hold",
    stage: { name: "Instructed", idx: 1 }, hold: { days: 61, review: null, reason: "Buyer arranging finance" } },

  // ── Completed ── (sale price anchor + iconed exchanged→completed dates)
  { id: "c1", line: "54 Buryholme", townpc: "Broxbourne, EN10 6TX", agency: "Longsons Estate Agents", status: "completed",
    stage: null, done: { price: "£485,000", exchanged: "2 Sep 2026", completed: "22 Sep 2026", took: "~3 weeks" } },
  { id: "c2", line: "7 Elm Drive", townpc: "St Albans, AL1 4RT", agency: "Akeman Residential", status: "completed",
    stage: null, done: { price: "£625,000", exchanged: "15 Aug 2026", completed: "5 Sep 2026", took: "~3 weeks" } },
  { id: "c3", line: "31 Amwell Lane", townpc: "Stanstead Abbotts, SG12 8BZ", agency: "Rhys Mayers", status: "completed",
    stage: null, done: { price: "£410,000", exchanged: "20 Aug 2026", completed: "1 Sep 2026", took: "~2 weeks" } },
  { id: "c4", line: "88 Queens Road", townpc: "Hertford, SG13 8BW", agency: "George David, Aylesbury", status: "completed",
    stage: null, done: { price: "£550,000", exchanged: "10 Jul 2026", completed: "12 Aug 2026", took: "~5 weeks" } },

  // ── Withdrawn ── (how far it got + category + when + why)
  { id: "w1", line: "108 Wendover Road", townpc: "Aylesbury, HP21 9LW", agency: "George David, Aylesbury", status: "withdrawn",
    stage: null, gone: { reached: "Enquiries", reachedIdx: 3, cat: "chain", date: "28 Sep 2026", reason: "Buyer pulled out — chain collapsed above" } },
  { id: "w2", line: "3 Foxglove Way", townpc: "Welwyn, AL6 9HT", agency: "Longsons Estate Agents", status: "withdrawn",
    stage: null, gone: { reached: "Searches", reachedIdx: 2, cat: "seller", date: "14 Sep 2026", reason: "Seller changed their mind" } },
  { id: "w3", line: "45 Castle Street", townpc: "Berkhamsted, HP4 2DW", agency: "Akeman Residential", status: "withdrawn",
    stage: null, gone: { reached: "Draft pack", reachedIdx: 1, cat: "buyer", date: "2 Sep 2026", reason: "Down-valuation — buyer couldn't proceed" } },
  { id: "w4", line: "12 Nightingale Road", townpc: "Hitchin, SG5 1QL", agency: "Rhys Mayers", status: "withdrawn",
    stage: null, gone: { reached: "Instructed", reachedIdx: 0, cat: "seller", date: "20 Aug 2026", reason: "Gazumped by another buyer" } },
];

const PACE: Record<Pace, { label: string; color: string; Icon: typeof TrendUp }> = {
  ahead:           { label: "Ahead of target", color: GREEN, Icon: TrendUp },
  on_track:        { label: "On track",        color: BLUE,  Icon: TrendUp },
  slightly_behind: { label: "Slightly behind", color: AMBER, Icon: Minus },
  behind:          { label: "Behind",          color: RED,   Icon: TrendDown },
};
const RISKC: Record<"watch" | "at_risk", { label: string; color: string; Icon: typeof Eye }> = {
  watch:   { label: "Watch",   color: AMBER, Icon: Eye },
  at_risk: { label: "At risk", color: RED,   Icon: Warning },
};
const STATUS_MARK: Record<Status, { label: string; color: string; Icon: typeof Eye } | null> = {
  active: null, on_hold: { label: "On hold", color: AMBER, Icon: PauseCircle },
  completed: { label: "Completed", color: BLUE, Icon: CheckCircle }, withdrawn: { label: "Withdrawn", color: SLATE, Icon: Prohibit },
};

const TABS: { key: string; label: string; match: (r: Row) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "active", label: "Active", match: (r) => r.status === "active" },
  { key: "on_hold", label: "On hold", match: (r) => r.status === "on_hold" },
  { key: "completed", label: "Completed", match: (r) => r.status === "completed" },
  { key: "withdrawn", label: "Withdrawn", match: (r) => r.status === "withdrawn" },
];

// ── Cell renderers ─────────────────────────────────────────────────────────────

function Property({ row, tab, compact }: { row: Row; tab: string; compact?: boolean }) {
  let m: { label: string; color: string; Icon: typeof Eye } | null = null;
  if (tab === "all") m = row.status !== "active" ? STATUS_MARK[row.status] : (row.risk ? RISKC[row.risk] : null);
  else if (tab === "active" && row.risk) m = RISKC[row.risk];
  return (
    <span style={{ display: "flex", gap: 12, minWidth: 0 }}>
      <span style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 10, background: "linear-gradient(135deg,#efe7df,#e3d6ca)", border: `0.5px solid ${LINE}` }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: compact ? "normal" : "nowrap" }}>{row.line}</span>
          {m && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: m.color }}><m.Icon size={13} weight="fill" /> {m.label}</span>}
        </span>
        <span style={{ display: "block", fontSize: 12, color: MUT, marginTop: 1 }}>{row.townpc}</span>
        <span style={{ display: "block", fontSize: 11.5, color: FAINT, marginTop: 1 }}>{row.agency}</span>
      </span>
    </span>
  );
}

function Stage({ stage }: { stage: Row["stage"] }) {
  if (!stage) return <span style={{ fontSize: 12, color: FAINT }}>—</span>;
  return (
    <span style={{ display: "block", width: "100%", maxWidth: 190 }}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: INK }}>{stage.name}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: FAINT, fontVariantNumeric: "tabular-nums" }}>{stage.idx + 1} of {TOTAL}</span>
      </span>
      <span style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= stage.idx ? (i === stage.idx ? CORALD : GREEN) : "rgba(45,24,16,0.1)" }} />
        ))}
      </span>
    </span>
  );
}

function Activity({ row }: { row: Row }) {
  if (!row.act) return <span style={{ fontSize: 12, color: FAINT }}>—</span>;
  const { Icon } = row.act;
  return (
    <span style={{ display: "flex", gap: 10, minWidth: 0 }}>
      <Icon size={18} weight="regular" color={INK2} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 650, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.act.title}</span>
        <span style={{ display: "block", fontSize: 11.5, color: MUT, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{row.act.when}</span>
        {row.next && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: row.next.tone, marginTop: 2 }}>{row.next.Icon && <row.next.Icon size={12} weight="bold" />}{row.next.text}</span>}
      </span>
    </span>
  );
}

function Exchange({ row }: { row: Row }) {
  if (!row.exchange) return <span style={{ fontSize: 12, color: FAINT }}>—</span>;
  const p = PACE[row.exchange.pace];
  return (
    <span>
      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: INK }}>{row.exchange.date}</span>
      <span style={{ display: "block", fontSize: 11.5, color: row.exchange.weeks.includes("passed") ? RED : MUT, marginTop: 2 }}>{row.exchange.weeks}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 650, color: p.color, marginTop: 4 }}><p.Icon size={14} weight="bold" /> {p.label}</span>
    </span>
  );
}

// On-hold: the useful questions, not "on hold".
function Review({ row }: { row: Row }) {
  const h = row.hold; if (!h) return null;
  if (!h.review) return <span style={{ fontSize: 13, color: MUT }}>Not set</span>;
  if (h.overdue) return (
    <span><span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: RED }}>Overdue</span><span style={{ display: "block", fontSize: 11.5, color: RED, marginTop: 2 }}>was {h.review}</span></span>
  );
  return <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{h.review}</span>;
}
function Paused({ row }: { row: Row }) {
  const h = row.hold; if (!h) return null;
  return (
    <span>
      <span style={{ display: "block", fontSize: 13, fontWeight: 650, color: INK }}>{h.days} days</span>
      {h.reason
        ? <span style={{ display: "block", fontSize: 11.5, color: INK2, marginTop: 2, fontStyle: "italic" }}>“{h.reason}”</span>
        : <span style={{ display: "block", fontSize: 11.5, color: FAINT, marginTop: 2 }}>No reason given</span>}
    </span>
  );
}

const dateCell = (d?: string) => <span style={{ fontSize: 13, fontWeight: 650, color: INK }}>{d ?? "—"}</span>;
const Money = ({ p }: { p?: string }) => <span style={{ fontSize: 15, fontWeight: 750, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{p ?? "—"}</span>;
function IconDate({ Icon, d }: { Icon: typeof Key; d?: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Icon size={15} weight="regular" color={INK2} style={{ flexShrink: 0 }} /><span style={{ fontSize: 13, fontWeight: 650, color: INK }}>{d ?? "—"}</span></span>;
}

// Withdrawn: how far it progressed before it died — same visual weight as the
// active stage bar, dimmed red to read "got here, then stopped".
function ReachedBar({ row }: { row: Row }) {
  const g = row.gone; if (!g) return null;
  return (
    <span style={{ display: "block", width: "100%", maxWidth: 190 }}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: INK2 }}>{g.reached}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: FAINT, fontVariantNumeric: "tabular-nums" }}>{g.reachedIdx + 1} of {TOTAL}</span>
      </span>
      <span style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= g.reachedIdx ? "rgba(199,62,62,0.3)" : "rgba(45,24,16,0.08)" }} />
        ))}
      </span>
    </span>
  );
}

const CAT: Record<"buyer" | "seller" | "chain" | "other", { label: string; color: string }> = {
  buyer: { label: "Buyer withdrew", color: RED },
  seller: { label: "Seller withdrew", color: AMBER },
  chain: { label: "Chain collapse", color: INDIGO },
  other: { label: "Other", color: SLATE },
};
function ReasonCell({ row }: { row: Row }) {
  const g = row.gone; if (!g) return null;
  const c = CAT[g.cat];
  return (
    <span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: c.color }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: c.color, flexShrink: 0 }} /> {c.label}
      </span>
      <span style={{ display: "block", fontSize: 12, color: INK2, marginTop: 3, lineHeight: 1.4 }}>{g.reason}</span>
    </span>
  );
}

// Who's looking after the file — initials avatar + name + role (agent vs
// progressor). In the real app this reads the assigned user / progressor; here
// it's a deterministic mock so each file keeps a stable owner.
const HANDLERS = [
  { name: "Jess Hart", initials: "JH", role: "Progressor", color: "#0e7490" },
  { name: "Mark Ellis", initials: "ME", role: "Agent", color: "#E8542F" },
  { name: "Priya Shah", initials: "PS", role: "Progressor", color: "#7c3aed" },
  { name: "Tom Reed", initials: "TR", role: "Agent", color: "#16a34a" },
  { name: "Dan Cole", initials: "DC", role: "Progressor", color: "#2563eb" },
];
function handlerFor(id: string) {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HANDLERS[h % HANDLERS.length];
}
function HandledBy({ row }: { row: Row }) {
  const h = handlerFor(row.id);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
      <span aria-hidden style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, background: h.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)" }}>{h.initials}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
        <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: h.role === "Progressor" ? "#0e7490" : CORALD, marginTop: 0 }}>{h.role}</span>
      </span>
    </span>
  );
}

// All-tab adaptive key value (status marker on Property disambiguates — no words).
function KeyDate({ row }: { row: Row }) {
  if (row.status === "active") return <Exchange row={row} />;
  if (row.status === "on_hold") return <Review row={row} />;
  if (row.status === "completed") return dateCell(row.done?.completed);
  return dateCell(row.gone?.date);
}

// ── Column model per tab ───────────────────────────────────────────────────────

type Col = { header: string; track: string; sortable?: boolean; render: (r: Row) => React.ReactNode };

function columnsFor(tab: string): Col[] {
  const property: Col = { header: "Property", track: "minmax(240px,1.5fr)", sortable: true, render: (r) => <Property row={r} tab={tab} /> };
  const stage: Col = { header: "Stage / Progress", track: "190px", sortable: true, render: (r) => <Stage stage={r.stage} /> };
  const activity: Col = { header: "Latest activity / Next step", track: "minmax(220px,1.35fr)", sortable: true, render: (r) => <Activity row={r} /> };
  const handled: Col = { header: "Handled by", track: "150px", sortable: true, render: (r) => <HandledBy row={r} /> };
  let cols: Col[];
  switch (tab) {
    case "active":
      cols = [property, stage, activity, { header: "Exchange forecast", track: "190px", sortable: true, render: (r) => <Exchange row={r} /> }]; break;
    case "on_hold":
      cols = [property, stage,
        { header: "Review due", track: "140px", sortable: true, render: (r) => <Review row={r} /> },
        { header: "Paused", track: "minmax(200px,1.2fr)", render: (r) => <Paused row={r} /> }]; break;
    case "completed":
      cols = [{ ...property, track: "minmax(230px,1.4fr)" },
        { header: "Sold for", track: "120px", sortable: true, render: (r) => <Money p={r.done?.price} /> },
        { header: "Exchanged", track: "140px", sortable: true, render: (r) => <IconDate Icon={Handshake} d={r.done?.exchanged} /> },
        { header: "Completed", track: "140px", sortable: true, render: (r) => <IconDate Icon={Key} d={r.done?.completed} /> }]; break;
    case "withdrawn":
      cols = [{ ...property, track: "minmax(230px,1.3fr)" },
        { header: "Reached", track: "180px", sortable: true, render: (r) => <ReachedBar row={r} /> },
        { header: "Withdrawn", track: "140px", sortable: true, render: (r) => <IconDate Icon={XCircle} d={r.gone?.date} /> },
        { header: "Reason", track: "minmax(220px,1.4fr)", render: (r) => <ReasonCell row={r} /> }]; break;
    default: // all
      cols = [property, stage, activity, { header: "Key date", track: "190px", render: (r) => <KeyDate row={r} /> }]; break;
  }
  return [...cols, handled];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FilesRedesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [tab, setTab] = useState("active");
  const rows = ROWS.filter(TABS.find((t) => t.key === tab)!.match);
  const cols = columnsFor(tab);
  const grid = [...cols.map((c) => c.track), "34px"].join(" ");

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#faf7f4,#f3ece6)", fontFamily: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", color: INK, padding: "44px 28px 100px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: CORALD }}>Dev · proposed design · v5</p>
        <h1 style={{ margin: "8px 0 8px", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>All Files — proposed layout</h1>
        <p style={{ margin: "0 0 18px", fontSize: 14.5, lineHeight: 1.55, color: INK2, maxWidth: 820 }}>
          Each tab's columns answer the real questions for those files — and never repeat what the tab already tells you. Switch tabs to see them change.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px,1fr))", gap: 10, marginBottom: 26 }}>
          {[
            ["Handled by (every tab)", "Initials avatar + name + role — agent vs progressor, colour-coded. Reads the assigned owner in the real app."],
            ["Active", "Stage · Activity / Next step · Exchange forecast (date + pace)."],
            ["On hold", "Review due (when it comes back / overdue) · Paused (how long + the typed reason, or “No reason given”). No “on hold” anywhere."],
            ["Completed", "Sold-for price (anchor) · Exchanged → Completed (iconed handshake → keys)."],
            ["Withdrawn", "How-far-it-reached bar (dimmed red) · category (Buyer/Seller/Chain) · date · the written reason."],
            ["All", "The only mixed tab — keeps a small status marker + an adaptive Key date."],
          ].map(([h, b]) => (
            <div key={h} style={{ background: "#fff", border: `0.5px solid ${LINE}`, borderRadius: 12, padding: "12px 14px" }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 750, color: INK }}>{h}</p>
              <p style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.45, color: MUT }}>{b}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "inline-flex", gap: 2, background: "rgba(45,24,16,0.05)", borderRadius: 999, padding: 3, marginBottom: 16 }}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{ border: "none", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 999, background: on ? "#fff" : "transparent", color: on ? INK : MUT, boxShadow: on ? "0 1px 2px rgba(40,26,20,0.12)" : "none" }}>{t.label}</button>;
          })}
        </div>

        {/* DESKTOP */}
        <p style={{ margin: "6px 0 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: FAINT }}>Desktop</p>
        <div style={{ background: "rgba(255,255,255,0.7)", border: `0.5px solid ${LINE}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 14px rgba(45,24,16,0.05)", overflowX: "auto" }}>
          <div style={{ minWidth: 760 }}>
            <div style={{ display: "grid", gridTemplateColumns: grid, gap: 18, padding: "12px 20px", borderBottom: `0.5px solid ${LINE}`, background: "rgba(45,24,16,0.015)" }}>
              {cols.map((c, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: MUT }}>{c.header}{c.sortable && <CaretUpDown size={12} weight="bold" color={FAINT} />}</span>)}
              <span />
            </div>
            {rows.map((row) => (
              <div key={row.id} className="fr-row" style={{ display: "grid", gridTemplateColumns: grid, gap: 18, padding: "16px 20px", alignItems: "center", borderBottom: `0.5px solid ${LINE}`, cursor: "pointer" }}>
                {cols.map((c, i) => <span key={i} style={{ minWidth: 0 }}>{c.render(row)}</span>)}
                <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 999, border: `1px solid ${LINE}`, color: FAINT, marginLeft: "auto" }}><CaretRight size={13} weight="bold" /></span>
              </div>
            ))}
          </div>
        </div>

        {/* MOBILE */}
        <p style={{ margin: "34px 0 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: FAINT }}>Mobile (card)</p>
        <div style={{ width: 392, maxWidth: "100%", background: "rgba(255,255,255,0.7)", border: `0.5px solid ${LINE}`, borderRadius: 18, padding: 10, boxShadow: "0 2px 14px rgba(45,24,16,0.05)" }}>
          {rows.slice(0, 4).map((row) => (
            <div key={row.id} style={{ background: "#fff", border: `0.5px solid ${LINE}`, borderRadius: 13, padding: 14, marginBottom: 8, display: "flex", flexDirection: "column", gap: 12 }}>
              <Property row={row} tab={tab} compact />
              {cols.slice(1).map((c, i) => (
                <div key={i}>
                  <p style={{ margin: "0 0 5px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: FAINT }}>{c.header}</p>
                  {c.render(row)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <style>{`.fr-row:hover{ background: rgba(255,107,74,0.04); }`}</style>
    </div>
  );
}
