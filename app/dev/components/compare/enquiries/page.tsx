"use client";

// ENQUIRIES (/agent/enquiries) — canonical-alignment comparison, gallery-style.
//
// Each component is shown ISOLATED on a clean stage, exactly like /dev/components:
//   BEFORE  = the real shipped markup + real enq-* / agent-system classes.
//   AFTER   = the real canonical component, rendered live — how it actually ships.
// Register-as-is items show one stage (current == canonical). No approximations.
//
// Dev-only, read-only. Nothing applied. Overlay drawers / modals excluded; the
// in-page expand accordion IS included.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  MagnifyingGlass, CaretDown, CheckCircle, WarningCircle, CalendarBlank,
  PaperPlaneTilt, ArrowClockwise, ClockCountdown, ChatCircleDots, Phone, EnvelopeSimple,
} from "@phosphor-icons/react";
import { StatCards } from "@/components/ui/StatCards";
import { ChaseBar } from "@/components/enquiries/ChaseBar";
import { Select } from "@/components/ui/Select";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { DateField } from "@/components/ui/DateField";
import { PopoverMenuItem } from "@/components/ui/Popover";
import { buttonClasses } from "@/components/arc/button/button";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
const GREEN = "#16a34a";
type Theme = "light" | "dark";

type Cls = "A" | "B" | "C" | "D";
const CLS: Record<Cls, { label: string; fg: string }> = {
  A: { label: "COMPLIANT — already canonical", fg: "#15803d" },
  B: { label: "ALIGN — swap to canonical", fg: "#b45309" },
  C: { label: "REGISTER — keep as-is, make it canonical", fg: "#b91c1c" },
  D: { label: "KEEP — intentional (colour = meaning)", fg: "#6d28d9" },
};
function Tag({ k }: { k: Cls }) {
  const t = CLS[k];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: `${t.fg}1e`, border: `1px solid ${t.fg}55`, whiteSpace: "nowrap" }}>{t.label}</span>;
}

// Clean gallery stage (matches /dev/components): white surface, rounded, padded.
function Stage({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div style={{ background: "var(--stage-bg)", borderRadius: 14, border: "1px solid var(--stage-line)", padding: 20, minHeight: 60, display: "flex", alignItems: "center", justifyContent: wide ? "flex-start" : "center", boxShadow: "0 1px 3px rgba(30,20,15,0.05)", overflowX: "auto" }}>
      <div style={{ width: wide ? "100%" : "auto", maxWidth: "100%" }}>{children}</div>
    </div>
  );
}

function Lbl({ kind }: { kind: "before" | "after" | "both" }) {
  const m = {
    before: { t: "Before — shipped now", c: "var(--compare-muted)" },
    after: { t: "After — canonical (how it ships)", c: CORAL },
    both: { t: "Current = canonical — register as-is, no change", c: "#b91c1c" },
  }[kind];
  return <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: m.c, marginBottom: 7 }}>{m.t}</span>;
}

function Spec({ n, title, cls, verdict, before, after, both, wide }: {
  n: string; title: string; cls: Cls; verdict: ReactNode;
  before?: ReactNode; after?: ReactNode; both?: ReactNode; wide?: boolean;
}) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "22px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        <Tag k={cls} />
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.5, maxWidth: 900 }}>{verdict}</p>
      {both !== undefined ? (
        <div><Lbl kind="both" /><Stage wide={wide}>{both}</Stage></div>
      ) : (
        <div style={{ display: wide ? "block" : "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 300px", minWidth: 0, marginBottom: wide ? 14 : 0 }}><Lbl kind="before" /><Stage wide={wide}>{before}</Stage></div>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}><Lbl kind="after" /><Stage wide={wide}>{after}</Stage></div>
        </div>
      )}
    </section>
  );
}

/* ===================== sample data ===================== */
const STAT_CARDS = [
  { key: "total", icon: <ChatCircleDots size={22} weight="regular" />, tone: "coral" as const, value: "13", label: "In enquiries", sub: "6 with sellers · 7 with buyers" },
  { key: "need", icon: <WarningCircle size={22} weight="fill" />, tone: "warning" as const, value: "1", label: "Need checking", sub: "Overdue or due today" },
  { key: "await", icon: <PaperPlaneTilt size={22} weight="regular" />, tone: "info" as const, value: "10", label: "Awaiting replies", sub: "With a solicitor" },
  { key: "expected", icon: <CalendarBlank size={22} weight="regular" />, tone: "neutral" as const, value: "0", label: "Expected", sub: "A reply date is set" },
];
const HIST: [string, string, string][] = [
  ["Wed 4 Nov", "Chased · Ellis Askey", "coral"],
  ["Wed 4 Nov", "Whose-court corrected · Ellis Askey", "neutral"],
  ["Mon 19 Oct", "Chased · Ellis Askey", "coral"],
  ["Mon 5 Oct", "Chase email sent", "coral"],
];

/* ===================== BEFORE fragments (real enq-* classes) ===================== */
const SearchBefore = () => (
  <div className="enq-search" style={{ width: 340 }}><MagnifyingGlass size={15} /><input placeholder="Search by address, client or solicitor…" /></div>
);
const SelectsBefore = () => (
  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
    <select className="enq-select" defaultValue="all"><option value="all">All sides</option></select>
    <label className="enq-sort-label">Sort:</label>
    <select className="enq-select" defaultValue="attention"><option value="attention">Needs attention</option></select>
  </div>
);
const StatusTags = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    <span className="enq-pill2 enq-pill-danger"><WarningCircle size={12} weight="fill" />Replies overdue</span>
    <span className="enq-pill2 enq-pill-amber"><CalendarBlank size={12} />Chase again</span>
    <span className="enq-pill2 enq-pill-green"><CheckCircle size={12} weight="fill" />Being reviewed</span>
    <span className="enq-pill2 enq-pill-blue"><ClockCountdown size={12} />Awaiting replies</span>
  </div>
);
const IconBtnsBefore = () => (
  <div style={{ display: "flex", gap: 6 }}>
    <button className="enq-iconbtn" title="I've chased"><ArrowClockwise size={15} /></button>
    <button className="enq-iconbtn" title="Send a chase"><PaperPlaneTilt size={15} /></button>
    <button className="enq-iconbtn" title="Happened earlier"><CalendarBlank size={15} /></button>
  </div>
);
const SplitBefore = () => (
  <span className="enq-split"><button className="enq-btn enq-split-main enq-btn-satisfied"><CheckCircle size={14} weight="fill" /> Mark satisfied</button><button className="enq-btn enq-split-caret enq-btn-satisfied" aria-label="More"><CaretDown size={13} weight="bold" /></button></span>
);
const EyebrowBefore = () => <div className="enq-detail-h">Enquiry round</div>;
const DateBefore = () => (<div className="enq-bd-field enq-exp-field" style={{ width: 280 }}><CalendarBlank size={15} className="enq-bd-cal" /><span className="enq-bd-ph">Add expected date</span></div>);
const ChipsBefore = () => (<div style={{ display: "flex", gap: 6 }}><button className="enq-chip"><Phone size={12} /> Phone</button><button className="enq-chip"><EnvelopeSimple size={12} /> Email</button></div>);
const Timeline = () => (
  <ul className="enq-timeline">{HIST.map(([d, l, t], i) => (<li key={i}><span className={`enq-dot enq-dot-${t}`} /><span className="enq-tl-date">{d}</span><span className="enq-tl-label">{l}</span></li>))}</ul>
);

/* ===================== AFTER fragments (real canonicals) ===================== */
const SearchAfter = () => (
  <div style={{ position: "relative", width: 340 }}>
    <MagnifyingGlass size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)" }} />
    <input className="agent-input agent-input-sm" placeholder="Search by address, client or solicitor…" style={{ width: "100%", paddingLeft: 34, fontSize: 13.5, height: 38 }} />
  </div>
);
function SelectsAfter() {
  const [a, setA] = useState("all"); const [b, setB] = useState("attention");
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ minWidth: 150 }}><Select value={a} onChange={setA} options={[{ value: "all", label: "All sides" }, { value: "seller", label: "With seller's solicitor" }, { value: "buyer", label: "With buyer's solicitor" }]} /></div>
      <label className="enq-sort-label">Sort:</label>
      <div style={{ minWidth: 150 }}><Select value={b} onChange={setB} options={[{ value: "attention", label: "Needs attention" }, { value: "quietest", label: "Quietest first" }, { value: "recent", label: "Recently updated" }]} /></div>
    </div>
  );
}
const IconBtnsAfter = () => (
  <div style={{ display: "flex", gap: 6 }}>
    <button className="agent-icon-btn agent-icon-btn-md" title="I've chased"><ArrowClockwise size={15} /></button>
    <button className="agent-icon-btn agent-icon-btn-md" title="Send a chase"><PaperPlaneTilt size={15} /></button>
    <button className="agent-icon-btn agent-icon-btn-md" title="Happened earlier"><CalendarBlank size={15} /></button>
  </div>
);
const SplitAfter = () => (
  <span style={{ display: "inline-flex" }}>
    <button className={buttonClasses({ variant: "primary", size: "sm" })} style={{ ["--foreground" as string]: GREEN, ["--background" as string]: "#fff", borderTopRightRadius: 0, borderBottomRightRadius: 0, gap: 5 } as CSSProperties}><CheckCircle size={14} weight="fill" /> Mark satisfied</button>
    <button className={buttonClasses({ variant: "primary", size: "sm" })} style={{ ["--foreground" as string]: GREEN, ["--background" as string]: "#fff", borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "1px solid rgba(255,255,255,0.32)", padding: "0 7px" } as CSSProperties} aria-label="More"><CaretDown size={13} weight="bold" /></button>
  </span>
);
const EyebrowAfter = () => <p className="agent-eyebrow" style={{ margin: 0 }}>Enquiry round</p>;
function DateAfter() { const [d, setD] = useState(""); return <div style={{ width: 280 }}><DateField value={d} onChange={(e) => setD(e.target.value)} className="agent-input agent-input-sm" style={{ fontSize: 13, width: "100%" }} /></div>; }
const ChipsAfter = () => (<div style={{ display: "flex", gap: 6 }}><button className={buttonClasses({ variant: "secondary", size: "sm" })} style={{ gap: 5 }}><Phone size={12} /> Phone</button><button className={buttonClasses({ variant: "secondary", size: "sm" })} style={{ gap: 5 }}><EnvelopeSimple size={12} /> Email</button></div>);

// Interactive chase-bar (drag the ball; toggle the stage to see the colours).
function ChaseBarDemo() {
  const [stage, setStage] = useState<"chase" | "escalate" | "hold">("chase");
  const [seller, setSeller] = useState(true);
  const prog = stage === "chase" ? 0.45 : stage === "escalate" ? 0.92 : 0.5;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
      <div style={{ width: 320, maxWidth: "100%" }}><ChaseBar stage={stage} progress={prog} isSeller={seller} onDragCommit={(dir) => setSeller(dir === "to_seller")} /></div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--compare-muted)" }}>Stage:</span>
        {(["chase", "escalate", "hold"] as const).map((s) => (<button key={s} type="button" onClick={() => setStage(s)} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: stage === s ? CORAL : "transparent", color: stage === s ? "#fff" : "var(--compare-body)" }}>{s}</button>))}
        <span style={{ fontSize: 11.5, color: "var(--compare-muted)", marginLeft: 6 }}>drag the ball to hand over</span>
      </div>
    </div>
  );
}

// A full enquiry row (real markup), with swappable thumb / pill / actions.
function EnquiryRow({ thumb, pill, actions }: { thumb: ReactNode; pill: ReactNode; actions: ReactNode }) {
  return (
    <div className="enq-card">
      <div className="enq-row2">
        <a className="enq-idlink" style={{ textDecoration: "none" }}>
          {thumb}
          <div className="enq-idcol">
            <div className="enq-idmain"><span className="enq-addr">1 Church Road</span><div className="enq-town">Ivinghoe, LU7 9EH</div></div>
            <div className="enq-meta2"><span style={{ textTransform: "capitalize" }}>Freehold</span><span className="enq-metadot" aria-hidden>·</span><span>£274,000</span></div>
          </div>
        </a>
        <div className="enq-slider">
          <ChaseBar stage="escalate" progress={0.92} isSeller={false} />
          <div className="enq-ends"><span style={{ color: "var(--agent-text-muted)", fontWeight: 500 }}>Seller&apos;s solicitor</span><span style={{ color: "var(--agent-coral-deep)", fontWeight: 700 }}>Buyer&apos;s solicitor</span></div>
          <div className="enq-forwd">With the buyer&apos;s solicitor for 58 days</div>
        </div>
        <div className="enq-statuscol">{pill}<span className="enq-substatus">With the buyer&apos;s solicitor to review</span></div>
        {actions}
      </div>
    </div>
  );
}
const ThumbBefore = () => <div className="enq-thumb property-photo-fallback" aria-hidden />;
const ThumbAfter = () => <PropertyThumb photoUrl={null} size={48} />;
const PillAmber = () => <span className="enq-pill2 enq-pill-amber"><CalendarBlank size={12} />Chase again</span>;

/* ---- final-pass fragments (the bits the first 11 didn't cover) ---- */
// Row action menu items (two-line: label + description).
const MenuItemsBefore = () => (
  <div className="enq-menu" role="menu" style={{ position: "static", background: "var(--stage-bg)", border: "1px solid var(--stage-line)", borderRadius: 12, width: 240, padding: 4 }}>
    <button className="enq-mi"><span className="enq-mi-ico"><ArrowClockwise size={16} /></span><span className="enq-mi-txt">I&apos;ve chased<small>Quiet for 2 working days, then resurfaces</small></span></button>
    <button className="enq-mi"><span className="enq-mi-ico"><PaperPlaneTilt size={16} /></span><span className="enq-mi-txt">Send a chase<small>Email the solicitor now</small></span></button>
    <div className="enq-mi-div" />
    <button className="enq-mi"><span className="enq-mi-ico"><CheckCircle size={16} /></span><span className="enq-mi-txt">Mark satisfied<small>Closes the loop, opens exchange</small></span></button>
  </div>
);
const MenuItemsAfter = () => (
  <div style={{ background: "var(--stage-bg)", border: "1px solid var(--stage-line)", borderRadius: 12, width: 240, padding: 4 }}>
    <PopoverMenuItem icon={<ArrowClockwise size={15} weight="bold" />} description="Quiet for 2 working days, then resurfaces">I&apos;ve chased</PopoverMenuItem>
    <PopoverMenuItem icon={<PaperPlaneTilt size={15} weight="bold" />} description="Email the solicitor now">Send a chase</PopoverMenuItem>
    <PopoverMenuItem icon={<CheckCircle size={15} weight="fill" />} description="Closes the loop, opens exchange">Mark satisfied</PopoverMenuItem>
  </div>
);
// Armed confirm.
const ConfirmBefore = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
    <span className="enq-confirm-q">Mark satisfied? This opens exchange.</span>
    <button className="enq-btn enq-btn-satisfied"><CheckCircle size={14} weight="bold" /> Confirm</button>
    <button className="enq-btn enq-btn-flip">Cancel</button>
  </div>
);
const ConfirmAfter = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Mark satisfied? This opens exchange.</span>
    <button className={buttonClasses({ variant: "primary", size: "sm" })} style={{ ["--foreground" as string]: GREEN, ["--background" as string]: "#fff", gap: 5 } as CSSProperties}><CheckCircle size={14} weight="bold" /> Confirm</button>
    <button className={buttonClasses({ variant: "ghost", size: "sm" })}>Cancel</button>
  </div>
);
// Mobile "Update" button.
const UpdateBefore = () => <button className="enq-btn enq-btn-flip">Update <CaretDown size={13} weight="bold" /></button>;
const UpdateAfter = () => <button className={buttonClasses({ variant: "secondary", size: "sm" })} style={{ gap: 5 }}>Update <CaretDown size={13} weight="bold" /></button>;
// Backdate date field.
const BackdateBefore = () => (<div className="enq-bd-field" style={{ width: 240 }}><CalendarBlank size={15} className="enq-bd-cal" /><span className="enq-bd-ph">Choose a date</span></div>);
function BackdateAfter() { const [d, setD] = useState(""); return <div style={{ width: 240 }}><DateField value={d} onChange={(e) => setD(e.target.value)} className="agent-input agent-input-sm" style={{ fontSize: 13, width: "100%" }} /></div>; }
// Clear link.
const ClearBefore = () => <span style={{ fontSize: 12.5, color: "var(--agent-text-primary)" }}>Fri 7 Nov <button className="enq-linkbtn">Clear</button></span>;
const ClearAfter = () => <span style={{ fontSize: 12.5, color: "var(--agent-text-primary)" }}>Fri 7 Nov <button className="agent-link" style={{ fontSize: 12.5, fontWeight: 600 }}>Clear</button></span>;
// Expand caret.
const ExpandBefore = () => <button className="enq-expand" aria-label="Show details"><CaretDown size={15} weight="bold" /></button>;
const ExpandAfter = () => <button className="agent-icon-btn agent-icon-btn-md" aria-label="Show details"><CaretDown size={15} weight="bold" /></button>;

/* ===================== inventory ===================== */
const INVENTORY: { item: string; cls: Cls; verdict: string }[] = [
  { item: "PageHeader", cls: "A", verdict: "Shared page-header primitive" },
  { item: "Summary stat cards ×4", cls: "A", verdict: "Canonical StatCards" },
  { item: "Toolbar search", cls: "B", verdict: "→ canonical agent-input search" },
  { item: "Filter + Sort selects", cls: "B", verdict: "→ canonical Select" },
  { item: "Status tag", cls: "C", verdict: "Register enq-pill2 as a canonical status-tag, keep as-is" },
  { item: "Property thumb", cls: "B", verdict: "→ canonical PropertyThumb" },
  { item: "Court chase-bar", cls: "C", verdict: "Register as-is (colours semantic, kept)" },
  { item: "Row icon buttons ×3", cls: "B", verdict: "→ canonical .agent-icon-btn" },
  { item: "Mark-satisfied split-button", cls: "B", verdict: "→ canonical split-button (green = token override)" },
  { item: "Expand: eyebrow labels", cls: "B", verdict: "→ canonical agent-eyebrow (sentence case — fixes the ALL-CAPS)" },
  { item: "Expand: expected date field", cls: "B", verdict: "→ canonical DateField" },
  { item: "Expand: Phone / Email chips", cls: "B", verdict: "→ arc secondary buttons" },
  { item: "Expand: chase-history timeline", cls: "C", verdict: "Register as-is (token dots + type already clean)" },
  { item: "Address / town / tenure text", cls: "A", verdict: "Compliant text" },
  { item: "Expand/collapse accordion", cls: "A", verdict: "Canonical agent-acc" },
  { item: "Empty state", cls: "A", verdict: "Canonical empty-hero + SetupCard" },
  { item: "Chase-bar colours + button tones", cls: "D", verdict: "Semantic — keep" },
];

export default function EnquiriesComparePage() {
  const restore = useRef<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  // Light maps to the app's real default light theme "sunset" (there is no
  // [data-theme="light"]) so the full --agent-* token set is defined.
  useEffect(() => { const h = document.documentElement; if (restore.current === null) restore.current = h.getAttribute("data-theme"); h.setAttribute("data-theme", theme === "light" ? "sunset" : "dark"); }, [theme]);
  useEffect(() => () => { const h = document.documentElement; if (restore.current) h.setAttribute("data-theme", restore.current); else h.removeAttribute("data-theme"); }, []);

  const vars: CSSProperties = {
    ["--compare-ink" as string]: theme === "dark" ? "#f1ece6" : "#20242E",
    ["--compare-body" as string]: theme === "dark" ? "rgba(241,236,230,0.70)" : "#5b5349",
    ["--compare-muted" as string]: theme === "dark" ? "rgba(241,236,230,0.55)" : "#9a938a",
    ["--compare-faint" as string]: theme === "dark" ? "rgba(241,236,230,0.4)" : "#b3a99d",
    ["--compare-line" as string]: theme === "dark" ? "rgba(255,255,255,0.09)" : "#e7e2db",
    ["--compare-bg" as string]: theme === "dark" ? "#17140f" : "#F4F2EF",
    ["--stage-bg" as string]: theme === "dark" ? "#201b14" : "#ffffff",
    ["--stage-line" as string]: theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,23,30,0.07)",
  };
  const tog = (a: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: a ? CORAL : "transparent", color: a ? "#fff" : "var(--compare-body)" });
  const counts = INVENTORY.reduce((a, r) => { a[r.cls] = (a[r.cls] ?? 0) + 1; return a; }, {} as Record<Cls, number>);

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme === "light" ? "sunset" : "dark"} style={{ ...vars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={tog(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={tog(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Compare · Enquiries (/agent/enquiries)</span>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "22px 24px 90px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 700, color: "var(--compare-ink)" }}>Enquiries — canonical alignment</h1>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 820 }}>
          One component per row, shown clean like the gallery. <b style={{ color: CLS.B.fg }}>Before</b> = the real shipped component. <b style={{ color: CLS.B.fg }}>After</b> = the real canonical, rendered live. <b style={{ color: CLS.C.fg }}>Register</b> items show one stage — keep exactly, just make it official.
        </p>

        <div style={{ borderRadius: 14, border: "1px solid var(--compare-line)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 16, padding: "11px 16px", background: "var(--stage-bg)", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, color: "var(--compare-ink)" }}>{INVENTORY.length} components</strong>
            <span style={{ fontSize: 12.5, color: "var(--compare-body)" }}><b style={{ color: CLS.A.fg }}>{counts.A ?? 0} compliant</b> · <b style={{ color: CLS.B.fg }}>{counts.B ?? 0} align</b> · <b style={{ color: CLS.C.fg }}>{counts.C ?? 0} register</b> · <b style={{ color: CLS.D.fg }}>{counts.D ?? 0} keep</b></span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <tbody>
                {INVENTORY.map((r) => (
                  <tr key={r.item} style={{ borderTop: "1px solid var(--compare-line)" }}>
                    <td style={{ padding: "7px 16px", color: "var(--compare-ink)", fontWeight: 600, whiteSpace: "nowrap" }}>{r.item}</td>
                    <td style={{ padding: "7px 16px" }}><span style={{ color: CLS[r.cls].fg, fontWeight: 700 }}>{r.cls}</span></td>
                    <td style={{ padding: "7px 16px", color: "var(--compare-body)" }}>{r.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- the components ---- */}
        <Spec n="1" title="Toolbar search" cls="B" verdict={<>Bespoke <code>enq-search</code> pill → the canonical <code>agent-input</code> search.</>} before={<SearchBefore />} after={<SearchAfter />} />
        <Spec n="2" title="Filter + Sort selects" cls="B" verdict={<>Native <code>enq-select</code>s → the canonical <code>Select</code>.</>} before={<SelectsBefore />} after={<SelectsAfter />} />
        <Spec n="3" title="Status tag" cls="C" verdict={<>Keep the <code>enq-pill2</code> status tag exactly — register it as a canonical status-tag (not the plain Pill).</>} both={<StatusTags />} />
        <Spec n="4" title="Property thumb" cls="B" verdict={<>The <code>enq-thumb</code> fallback → the canonical <code>PropertyThumb</code> (same house-glyph fallback).</>} before={<ThumbBefore />} after={<ThumbAfter />} />
        <Spec n="5" title="Row icon buttons" cls="B" verdict={<>The three <code>enq-iconbtn</code>s → the canonical icon button <code>.agent-icon-btn</code>.</>} before={<IconBtnsBefore />} after={<IconBtnsAfter />} />
        <Spec n="6" title="Mark-satisfied split-button" cls="B" verdict={<>The green <code>enq-split</code> → the canonical split-button. Green is a token override, same one button.</>} before={<SplitBefore />} after={<SplitAfter />} />
        <Spec n="7" title="Court chase-bar" cls="C" verdict={<>Keep exactly — register as a canonical <code>ChaseBar</code>. Drag the ball; toggle the stage to see the semantic colours.</>} both={<ChaseBarDemo />} wide />
        <Spec n="8" title="Expand · eyebrow label" cls="B" verdict={<><strong>The ALL-CAPS fix.</strong> <code>enq-detail-h</code> (uppercase) → the canonical <code>agent-eyebrow</code>, which is sentence case (no caps, letter-spacing 0).</>} before={<EyebrowBefore />} after={<EyebrowAfter />} />
        <Spec n="9" title="Expand · expected date field" cls="B" verdict={<>The <code>enq-exp</code> native-date field → the canonical <code>DateField</code>.</>} before={<DateBefore />} after={<DateAfter />} />
        <Spec n="10" title="Expand · Phone / Email chips" cls="B" verdict={<>The <code>enq-chip</code>s → canonical arc secondary buttons.</>} before={<ChipsBefore />} after={<ChipsAfter />} />
        <Spec n="11" title="Expand · chase-history timeline" cls="C" verdict={<>Reads clean (token dots + type) — register as-is.</>} both={<Timeline />} />
        <Spec n="12" title="Summary stat cards" cls="A" verdict={<>Already the canonical <code>StatCards</code> — no change (register in gallery).</>} both={<div style={{ width: "100%" }}><StatCards ariaLabel="Enquiries summary" cards={STAT_CARDS} /></div>} wide />

        {/* ---- final pass: the bits the first 11 didn't cover ---- */}
        <h2 style={{ margin: "40px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Final pass — remaining bespoke controls</h2>

        <Spec n="13" title="Row action menu items" cls="B" verdict={<>The ▾ dropdown rows. The panel is already the canonical <code>AnchoredPanel</code>; the items (<code>enq-mi</code>) were hand-rolled. Rather than drop the descriptions, I <strong>extended the canonical <code>PopoverMenuItem</code> with an optional <code>description</code></strong> (backward-compatible) + a canonical <code>PopoverDivider</code> — so the menu keeps its two-line descriptions AND is fully canonical. After = the real extended canonical.</>} before={<MenuItemsBefore />} after={<MenuItemsAfter />} />
        <Spec n="14" title="Armed “Mark satisfied?” confirm" cls="B" verdict={<>The inline confirm strip — Confirm (<code>enq-btn-satisfied</code>) + Cancel (<code>enq-btn-flip</code>) → arc Button primary (green token) + ghost.</>} before={<ConfirmBefore />} after={<ConfirmAfter />} />
        <Spec n="15" title="Mobile “Update” button" cls="B" verdict={<>The tablet/phone menu trigger (<code>enq-btn-flip</code>) → arc Button secondary.</>} before={<UpdateBefore />} after={<UpdateAfter />} />
        <Spec n="16" title="Backdate date field" cls="B" verdict={<>The “When did this happen?” popover&apos;s native date input (<code>enq-bd-field</code>) → the canonical <code>DateField</code> (same swap as the Expected field).</>} before={<BackdateBefore />} after={<BackdateAfter />} />
        <Spec n="17" title="“Clear” link" cls="B" verdict={<>The Clear link beside a set expected date (<code>enq-linkbtn</code>) → the canonical coral <code>.agent-link</code>.</>} before={<ClearBefore />} after={<ClearAfter />} />
        <Spec n="18" title="Expand caret (row end)" cls="B" verdict={<>The ⌄ show/hide-details button (<code>enq-expand</code>) → the canonical icon button <code>.agent-icon-btn</code>.</>} before={<ExpandBefore />} after={<ExpandAfter />} />

        <section style={{ borderTop: "1px solid var(--compare-line)", padding: "22px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 5 }}>
            <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>19</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: "var(--compare-ink)" }}>Tooltips + list animation — decisions, no render change</h3>
            <Tag k="D" />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 900 }}>
            <b>Tooltips:</b> the row icon buttons use plain native <code>title=&quot;&quot;</code> hints (4 of them). Standard and fine — but if you want them consistent with a canonical tooltip component, that&apos;s a yes/no. <br />
            <b>List animation:</b> when you action a row it lifts and travels to its new slot (a bespoke <code>auto-animate</code> plugin). Deliberate and good — my recommendation is <b>keep it</b> and register it as a motion pattern (no change). Accordion expand = canonical <code>agent-acc</code>; the chase-bar dance belongs to the ChaseBar.
          </p>
        </section>

        {/* ---- the row, in context ---- */}
        <h2 style={{ margin: "40px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>In context — the full row</h2>
        <Spec n="ROW" title="Enquiry row" cls="C" verdict={<>The same row with its parts swapped to the canonicals above (thumb, status tag kept, icon buttons, split-button). Layout, copy, chase-bar + court labels untouched.</>} wide
          before={<EnquiryRow thumb={<ThumbBefore />} pill={<PillAmber />} actions={<div className="enq-actions2" style={{ display: "flex", gap: 6, alignItems: "center" }}><IconBtnsBefore /><SplitBefore /></div>} />}
          after={<EnquiryRow thumb={<ThumbAfter />} pill={<PillAmber />} actions={<div className="enq-actions2" style={{ display: "flex", gap: 6, alignItems: "center" }}><IconBtnsAfter /><SplitAfter /></div>} />} />
      </div>
    </div>
  );
}
