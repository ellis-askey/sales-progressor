"use client";
// Design-system audit — Add-sale flow, COMPLETE pass.
//
// One page, everything still non-canonical in /agent/transactions/new, before →
// after. Every "After" is the REAL canonical component, live and interactive —
// focus an input (the label lifts), open the country picker, type the search,
// open the results menu (rows fade on hover), tick the checkbox, type a £ amount,
// flip the toggle, press the links. Visual only: sizing, behaviour and
// breakpoints are unchanged. Dev-only. Supersedes the earlier new-sale +
// new-sale-forms audit pages by consolidating them and adding the four that were
// missing: the arc PhoneInput, the arc Checkbox, the £ PriceField reuse, and the
// results dropdown / popover menu.

import { notFound } from "next/navigation";
import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { LabelInput } from "@/components/ui/LabelInput";
import { SearchField } from "@/components/arc/search-field/search-field";
import "@/components/arc/cookie-consent/scope.css";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { PhoneInput } from "@/components/arc/phone-input/phone-input";
import { Button } from "@/components/arc/button/button";
import { Pill } from "@/components/ui/Pill";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import { NotesField } from "@/components/ui/NotesField";
import { PriceField } from "@/components/ui/PriceField";
import { AnchoredPanel } from "@/components/ui/Popover";
import { LinkSimple, MagnifyingGlass, CaretDown, Plus, Buildings, Check } from "@phosphor-icons/react";

const CORAL = "#FF6B4A";
const DEEP = "#E55B3D";
const INK = "#2D1810";
const MUTED = "rgba(45,24,16,0.55)";
const LABEL = "rgba(45,24,16,0.5)";
const LINE = "rgba(45,24,16,0.10)";
const GHOST = "#9C9086";

const SEG_TOK = {
  "--surface-muted": "rgba(15,23,42,0.05)", "--border": LINE, "--text-muted": MUTED, "--foreground": INK,
  "--radius-control": "11px", "--control-height-sm": "28px", "--text-sm": "13px",
  "--sc-selection-bg": CORAL, "--sc-selection-fg": "#fff", "--sc-selection-border": "transparent",
  "--shadow-resting": "0 2px 6px rgba(255,107,74,0.30)",
} as CSSProperties;

const SF_TOK = {
  width: 260, ["--control-height-md"]: "40px", ["--radius-control"]: "10px",
  ["--surface"]: "rgba(255,255,255,0.6)", ["--border-strong"]: LINE,
  ["--foreground"]: INK, ["--text-muted"]: MUTED, ["--sf-focus"]: DEEP,
} as CSSProperties;

// arc tokens → agent look for the phone field (it reads --foreground / --surface /
// --border-strong / --text-muted / --success, the rest come from scope.css).
const PHONE_TOK = {
  width: 300, ["--control-height-md"]: "42px", ["--radius-control"]: "16px",
  ["--surface"]: "#fff", ["--surface-raised"]: "#fff", ["--surface-muted"]: "rgba(15,23,42,0.04)",
  ["--border"]: LINE, ["--border-strong"]: LINE, ["--border-subtle"]: LINE,
  ["--foreground"]: INK, ["--text-secondary"]: INK, ["--text-muted"]: MUTED, ["--success"]: "#2F9E6B",
} as CSSProperties;

// ── 01 · Hero tenure / purchase-type pill (SaleHeroEditable → Choice) ────────────
// The REAL control on the add-sale page: a compact pill chip in the editable hero.
// Already clean — solid coral when selected, outline otherwise, no wash.
function HeroChoice({ v, sel, onClick, children }: { v: string; sel: string; onClick: () => void; children: ReactNode }) {
  const on = sel === v;
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", padding: "6px 15px", borderRadius: 999, cursor: "pointer",
      border: on ? "1.5px solid transparent" : `1.5px solid ${hover ? CORAL : LINE}`,
      background: on ? DEEP : "transparent",
      color: on ? "#fff" : hover ? DEEP : MUTED,
      transition: "background 160ms, border-color 150ms, color 150ms",
    }}>{children}</button>
  );
}
function HeroTenurePill() {
  const [sel, setSel] = useState("freehold");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: sel ? "#2F9E6B" : MUTED }}>Tenure</span>
      <HeroChoice v="freehold" sel={sel} onClick={() => setSel("freehold")}>Freehold</HeroChoice>
      <HeroChoice v="leasehold" sel={sel} onClick={() => setSel("leasehold")}>Leasehold</HeroChoice>
      <HeroChoice v="share" sel={sel} onClick={() => setSel("share")}>Share of freehold</HeroChoice>
    </div>
  );
}

// ── Hard-label "before" input (the eyebrow-above-field pattern) ─────────────────
function HardInput({ label, placeholder, caps, value }: { label: string; placeholder: string; caps?: boolean; value?: string }) {
  return (
    <div style={{ width: 280 }}>
      <p style={caps
        ? { margin: "0 0 5px", fontSize: 10.5, fontWeight: 650, letterSpacing: "0.04em", textTransform: "uppercase", color: GHOST }
        : { margin: "0 0 5px", fontSize: 12, fontWeight: 500, color: MUTED }}>{label}</p>
      <input defaultValue={value} placeholder={placeholder} style={{ width: "100%", height: 40, padding: "0 14px", fontSize: 14, color: INK, borderRadius: 10, background: "rgba(255,255,255,0.52)", border: `1px solid ${LINE}`, outline: "none" }} />
    </div>
  );
}

// ── 03 · Phone ──────────────────────────────────────────────────────────────────
function PhoneAfter() {
  const [v, setV] = useState("");
  return (
    <div className="arc-scope" style={PHONE_TOK}>
      <style>{".arc-scope label{position:static}"}</style>
      <PhoneInput label="Phone" value={v} onValueChange={setV} defaultCountry="GB" />
    </div>
  );
}

// ── 05 · Checkbox ───────────────────────────────────────────────────────────────
function NiceCheckBefore() {
  const [on, setOn] = useState(true);
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer", maxWidth: 300 }}>
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
      <span aria-hidden style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 6, marginTop: 1, display: "grid", placeItems: "center", background: on ? DEEP : "transparent", boxShadow: on ? "none" : `inset 0 0 0 1.5px ${LINE}`, transition: "background 160ms" }}>
        <Check size={12} weight="bold" color="#fff" style={{ opacity: on ? 1 : 0, transform: on ? "scale(1)" : "scale(0.5)", transition: "opacity 160ms, transform 200ms cubic-bezier(0.16,1,0.3,1)" }} />
      </span>
      <span style={{ fontSize: 12, color: INK, lineHeight: 1.45 }}>This is our recommended broker. Save it to Partners so it&rsquo;s ready next time.</span>
    </label>
  );
}
function CheckboxAfter() {
  const [on, setOn] = useState(true);
  return (
    <div className="arc-scope" style={{ maxWidth: 300, ["--control-on" as string]: DEEP, ["--surface" as string]: "#fff", ["--border-strong" as string]: LINE, ["--foreground" as string]: INK, ["--text-muted" as string]: MUTED, ["--text-sm" as string]: "13px", ["--control-height-md" as string]: "20px" } as CSSProperties}>
      <Checkbox checked={on} onCheckedChange={(c) => setOn(c === true)} label="This is our recommended broker. Save it to Partners so it’s ready next time." />
    </div>
  );
}

// ── 06 · £ money ────────────────────────────────────────────────────────────────
function PriceBefore() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ display: "inline-flex", alignItems: "center", alignSelf: "flex-start", padding: "9px 16px", borderRadius: 999, border: `1px solid rgba(255,107,74,0.5)`, background: "#fff", fontSize: 15, fontWeight: 600, color: MUTED }}>£</span>
      <span style={{ display: "inline-flex", alignItems: "center", alignSelf: "flex-start", padding: "8px 14px", borderRadius: 12, border: `1px solid ${LINE}`, background: "#fff", fontSize: 22, fontWeight: 700, color: INK }}>£0.00</span>
    </div>
  );
}
function PriceAfter() {
  const [fee, setFee] = useState<number | null>(null);
  const [commission, setCommission] = useState<number | null>(320000);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 220 }}>
      <PriceField label="Referral fee" value={fee} onChange={setFee} accent />
      <PriceField label="Your commission" value={commission} onChange={setCommission} accent height={54} fontSize={24} />
    </div>
  );
}

// ── 08 · Firm search ────────────────────────────────────────────────────────────
function SearchBefore() {
  return (
    <div style={{ width: 260, position: "relative" }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: MUTED }}><MagnifyingGlass size={16} /></span>
      <input placeholder="Search firm name…" style={{ width: "100%", height: 40, padding: "0 14px 0 36px", fontSize: 14, borderRadius: 10, background: "rgba(255,255,255,0.52)", border: `1px solid ${LINE}`, outline: "none" }} />
    </div>
  );
}
function SearchAfter() {
  const [v, setV] = useState("");
  return (
    <div className="arc-scope" style={SF_TOK}>
      <style>{".arc-scope label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}"}</style>
      <SearchField label="Firm" value={v} onValueChange={setV} placeholder="Search firm name…" />
    </div>
  );
}

// ── 09 · Results dropdown / popover menu (fade-on-hover rows) ────────────────────
const FIRMS = ["Andersons Property Law", "Blacks Legal", "Clarke & Mortimer Solicitors", "Devlin Law LLP", "Gough Thorne"];
function MenuBefore() {
  return (
    <div style={{ width: 300, borderRadius: 12, border: `1px solid ${LINE}`, background: "#fff", boxShadow: "0 10px 30px rgba(15,26,46,0.10)", overflow: "hidden" }}>
      {FIRMS.slice(0, 3).map((f) => (
        <div key={f} style={{ padding: "10px 14px", fontSize: 13, color: INK, cursor: "pointer" }}>{f}</div>
      ))}
      <div style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: DEEP, cursor: "pointer" }}>+ Add “Dev…” as new firm</div>
    </div>
  );
}
function MenuAfter() {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div style={{ width: 300 }}>
      <button ref={ref} type="button" onClick={() => setOpen((o) => !o)} className="glass-input" style={{ width: "100%", height: 40, padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14, borderRadius: 10, border: `1px solid ${LINE}`, background: "#fff", cursor: "pointer", color: picked ? INK : MUTED }}>
        <span>{picked ?? "Search firm name…"}</span>
        <CaretDown size={14} color={MUTED} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
      </button>
      <AnchoredPanel anchorRef={ref} open={open} onClose={() => setOpen(false)} matchWidth bare placement="bottom-start">
        {FIRMS.map((f) => (
          <button key={f} type="button" className="ui-pop-pick" onMouseDown={() => { setPicked(f); setOpen(false); }}>{f}</button>
        ))}
        <button type="button" className="ui-pop-pick ui-pop-pick-add" onMouseDown={() => setOpen(false)}>+ Add as new firm</button>
      </AnchoredPanel>
    </div>
  );
}

// ── 10 · Text links (hover) ─────────────────────────────────────────────────────
function LinkBefore() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: DEEP }}>+ Add vendor</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: DEEP }}>I won&apos;t be using the client portal</span>
    </div>
  );
}
function LinkRow({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: h ? DEEP : CORAL, background: "none", border: 0, padding: 0, cursor: "pointer", position: "relative", transition: "color .12s" }}>
      {icon}
      <span style={{ position: "relative" }}>{children}<span style={{ position: "absolute", left: 0, right: 0, bottom: -2, height: 1.5, background: "currentColor", borderRadius: 1, transform: h ? "scaleX(1)" : "scaleX(0)", transformOrigin: "left", transition: "transform .18s cubic-bezier(0.16,1,0.3,1)" }} /></span>
    </button>
  );
}
function LinkAfter() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      <LinkRow icon={<Plus size={13} weight="bold" />}>Add vendor</LinkRow>
      <LinkRow>I won&apos;t be using the client portal</LinkRow>
      <LinkRow>Use a different broker</LinkRow>
    </div>
  );
}

// ── 11 · Eyebrow labels ─────────────────────────────────────────────────────────
function Eyebrows({ sentence }: { sentence: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {["Vendors", "Tenure", "Purchase type", "Brokerage name"].map((l) => (
        <p key={l} style={sentence
          ? { margin: 0, fontSize: 11, fontWeight: 600, color: LABEL }
          : { margin: 0, fontSize: 10.5, fontWeight: 650, letterSpacing: "0.05em", textTransform: "uppercase", color: LABEL }}>{l}</p>
      ))}
    </div>
  );
}

// ── 12 · Collapsible header ─────────────────────────────────────────────────────
function Accordion({ canon }: { canon?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ width: 320 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", background: "none", border: 0, borderBottom: `1px solid ${LINE}`, cursor: "pointer" }}>
        <span style={canon ? { fontSize: 11, fontWeight: 600, color: LABEL } : { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: LABEL }}>Solicitors &amp; broker</span>
        <CaretDown size={13} weight="bold" color={MUTED} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s cubic-bezier(0.4,0,0.2,1)" }} />
      </button>
      <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .24s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>Seller&apos;s and buyer&apos;s solicitor search fields live here.</p>
        </div>
      </div>
    </div>
  );
}

// ── 14 · Toggle / 15 · Notes / 16 · Banner ──────────────────────────────────────
function ToggleDemo() {
  const [on, setOn] = useState(true);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: INK }}>Mortgage broker involved in this sale</span>
      <LiquidToggle checked={on} onChange={() => setOn((o) => !o)} width={44} height={25} color={DEEP} aria-label="Mortgage broker" />
    </div>
  );
}
function NotesDemo() {
  const [v, setV] = useState("");
  return <div style={{ width: 320, ["--focus-ring" as string]: "rgba(255,107,74,0.18)" } as CSSProperties}><NotesField label="Notes" value={v} onChange={setV} placeholder="Any context about this sale…" /></div>;
}
function BannerBefore() {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", borderRadius: 16, background: "rgba(255,107,74,0.07)", border: "1px solid rgba(255,107,74,0.18)", maxWidth: 440 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(255,107,74,0.14)", color: DEEP, flexShrink: 0 }}><LinkSimple size={18} /></span>
      <div><p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: INK }}>Want to invite the buyer or seller?</p><p style={{ margin: 0, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>Add their contact details below and send the invite once the file is created.</p></div>
    </div>
  );
}
function BannerAfter() {
  const [show, setShow] = useState(true);
  if (!show) return <button type="button" onClick={() => setShow(true)} style={{ fontSize: 12, color: CORAL, fontWeight: 600, background: "none", border: 0, cursor: "pointer" }}>Bring the banner back ↺</button>;
  return (
    <div style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "15px 16px", borderRadius: 18, background: "rgba(255,255,255,0.66)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(45,24,16,0.10)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 10px 30px rgba(15,26,46,0.08)", maxWidth: 440 }}>
      <span style={{ color: CORAL, flexShrink: 0, display: "flex", paddingTop: 1 }}><LinkSimple size={20} /></span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: INK }}>Want to invite the buyer or seller?</p>
        <p style={{ margin: "0 0 7px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>Add their contact details below and send the invite once the file is created.</p>
        <LinkRow>I won&apos;t be using the client portal</LinkRow>
      </div>
      <button type="button" onClick={() => setShow(false)} aria-label="Dismiss" style={{ width: 28, height: 28, borderRadius: 999, border: 0, background: "transparent", color: MUTED, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>✕</button>
    </div>
  );
}

// ── Scaffold ────────────────────────────────────────────────────────────────────
type Verdict = "exists" | "new" | "done";
function Item({ n, title, verdict, maps, note, before, after }: { n: number; title: string; verdict: Verdict; maps?: string; note: string; before: ReactNode; after: ReactNode }) {
  const tag = verdict === "new" ? { t: "New canonical", c: "#8a5a00", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.32)" }
    : verdict === "done" ? { t: "Already canonical", c: "#1f6f4a", bg: "rgba(47,158,107,0.13)", bd: "rgba(47,158,107,0.3)" }
    : { t: `Exists → ${maps}`, c: "#1f6f4a", bg: "rgba(47,158,107,0.13)", bd: "rgba(47,158,107,0.3)" };
  return (
    <section style={{ borderTop: "1px solid #e7e2db", padding: "26px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono, monospace)", color: "#b3a99d" }}>{String(n).padStart(2, "0")}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "#20242E" }}>{title}</h3>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: tag.c, background: tag.bg, border: `1px solid ${tag.bd}` }}>{tag.t}</span>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b6258", lineHeight: 1.55, maxWidth: 820 }}>{note}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Pane tag="Before · on the page now" tone="muted">{before}</Pane>
        <Pane tag={verdict === "new" ? "Proposed · live" : "After · live"} tone="coral">{after}</Pane>
      </div>
    </section>
  );
}
function Pane({ tag, tone, children }: { tag: string; tone: "muted" | "coral"; children: ReactNode }) {
  return (
    <div>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: tone === "coral" ? CORAL : "#9a938a", marginBottom: 8 }}>{tag}</span>
      <div style={{ minHeight: 76, borderRadius: 14, padding: 18, background: "#faf8f5", border: tone === "coral" ? `1.5px solid ${CORAL}` : "1px solid #e7e2db", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14 }}>{children}</div>
    </div>
  );
}

export default function NewSaleCompleteAuditPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EF", color: "#20242E", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 120px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · audit · complete</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>Add-sale flow — everything left</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 820 }}>
            Every element still non-canonical on <code>/agent/transactions/new</code>, in one place. Each <strong style={{ color: CORAL }}>After</strong> is the <strong>real</strong> canonical component, live —
            open the country picker, the results menu (rows fade on hover), tick the box, type a £ amount, focus an input (the label lifts), hover the links. <strong style={{ color: "#8a5a00" }}>Bold rows (03 · 05 · 06 · 09)</strong> are the four you caught that weren&apos;t covered before. Visual only; behaviour and sizing unchanged.
          </p>
        </header>

        <Item n={1} title="Tenure / purchase type — editable hero pill" verdict="done"
          note="Correction: this isn’t a big choice-card on the page — tenure and purchase type are picked as a compact pill in the editable hero (SaleHeroEditable → Choice). It’s already clean: solid coral when selected, outline otherwise, no wash. No change needed — it’s a candidate to catalogue as the selection-pill primitive (shared with the claim-flow choice chips). Click the pills."
          before={<HeroTenurePill />} after={<HeroTenurePill />} />

        <Item n={2} title="Text inputs — full name, contact name, brokerage name, address" verdict="exists" maps="LabelInput"
          note="Hard labels sat above the field — including the shouty uppercase BROKERAGE NAME / CONTACT NAME on the broker card. The canonical LabelInput floats the label into the field and lifts it on focus. Click it."
          before={<div style={{ display: "flex", flexDirection: "column", gap: 12 }}><HardInput label="Full name" placeholder="e.g. Sarah Johnson" /><HardInput label="BROKERAGE NAME" placeholder="e.g. Bright Future Mortgages" caps /></div>}
          after={<div style={{ display: "flex", flexDirection: "column", gap: 14, width: 280, ["--lbi-top" as string]: "0px" } as CSSProperties}><LabelInput field="name" label="Full name" accent={CORAL} fullWidth /><LabelInput field="brokerage" label="Brokerage name" accent={CORAL} fullWidth /></div>} />

        <Item n={3} title="Phone field → arc PhoneInput" verdict="exists" maps="PhoneInput (arc)"
          note="Today every phone is a plain text input (“07700 900000” / “020 …”). The vendored arc PhoneInput gives a country picker (open it), as-you-type formatting with a faint guide, a valid-tick, and E.164 out — install it on both the contact and broker phone fields. One of the four that weren’t covered before."
          before={<HardInput label="Phone" placeholder="07700 900000" />} after={<PhoneAfter />} />

        <Item n={4} title="Email field" verdict="exists" maps="LabelInput"
          note="Same hard-label pattern as the text inputs, type=email. The canonical LabelInput, email variant."
          before={<HardInput label="Email" placeholder="sarah@example.com" />}
          after={<div style={{ width: 280 }}><LabelInput field="email" label="Email" type="email" accent={CORAL} fullWidth /></div>} />

        <Item n={5} title="Checkbox — “recommended broker”" verdict="exists" maps="Checkbox (arc)"
          note="The broker card hand-rolls its tick (NiceCheck) — but we now have the canonical arc Checkbox. Swap to it so every tick in the app is one component. Tick both. One of the four that weren’t covered before."
          before={<NiceCheckBefore />} after={<CheckboxAfter />} />

        <Item n={6} title="£ money — referral fee, commission, net to agency" verdict="exists" maps="PriceField"
          note="The referral-fee pill (sale-price-pill) and the commission input (price-hero-input-native) are two different bespoke money fields. Both map to the one canonical PriceField (GBP, pence, coral-accent border). Type in them. One of the four that weren’t covered before."
          before={<PriceBefore />} after={<PriceAfter />} />

        <Item n={7} title="Segmented toggles — Fixed £ / Percent %, + VAT / Inc VAT" verdict="done"
          note="These already use the canonical arc SegmentedControl in the earnings panel — shown here for completeness. The old glossy-gradient look on the left is retired; the gliding coral selection is live."
          before={<div style={{ display: "inline-flex", borderRadius: 10, background: "rgba(45,24,16,0.05)", padding: 3, gap: 2 }}>{["Fixed £", "Percent %"].map((o, i) => <span key={o} style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: i === 0 ? "linear-gradient(180deg,#FF8A65,#FF6B4A)" : "transparent", color: i === 0 ? "#fff" : MUTED, boxShadow: i === 0 ? "0 2px 8px rgba(255,107,74,0.4)" : "none" }}>{o}</span>)}</div>}
          after={<SegAfter />} />

        <Item n={8} title="Solicitor / broker firm search" verdict="exists" maps="SearchField (arc)"
          note="A bespoke sol-search input with its own magnifier. The canonical arc SearchField — native glyph, coral focus, clear button in a reserved slot. Type in it."
          before={<SearchBefore />} after={<SearchAfter />} />

        <Item n={9} title="Results dropdown / popover menu" verdict="new"
          note="The firm-results and case-handler menus use AnchoredPanel + the .ui-pop-pick rows (that fade on hover) — a strong primitive that isn’t in the components page yet. Catalogue it. Open the menu, hover the rows, pick one. One of the four that weren’t covered before."
          before={<MenuBefore />} after={<MenuAfter />} />

        <Item n={10} title="Text links — Add vendor, won’t-use-portal, Use a different broker" verdict="exists" maps="Coral link"
          note="All hand-rolled coral text with no hover. The canonical coral link warms to deep-coral and sweeps an underline in. Hover each."
          before={<LinkBefore />} after={<LinkAfter />} />

        <Item n={11} title="Section labels — Vendors, Tenure, Purchase type, Brokerage name" verdict="exists" maps="Eyebrow"
          note="A mix of faint 600 and uppercase 650/0.05em overlines. Align all to the approved eyebrow: sentence case · 600 · muted · no tracking."
          before={<Eyebrows sentence={false} />} after={<Eyebrows sentence />} />

        <Item n={12} title="Collapsible section header — Solicitors & broker, Notes" verdict="new"
          note="The accordion header (label + rotating chevron + grid-rows open/close) repeats with no entry. Catalogue it; its label follows the eyebrow decision. Open/close it."
          before={<Accordion />} after={<Accordion canon />} />

        <Item n={13} title="Prompt banner — portal invite" verdict="exists" maps="AgentBanner"
          note="A coral-tint wash card with a tinted icon chip. The canonical recipe: neutral frosted surface, the kind colour carried only by the icon, coral link + dismiss. Try the ✕, then bring it back. (AgentBanner itself still needs cataloguing.)"
          before={<BannerBefore />} after={<BannerAfter />} />

        <Item n={14} title="Mortgage-broker toggle" verdict="done"
          note="Already the canonical LiquidToggle — shown live for completeness. Flip it; confirm the coral."
          before={<ToggleDemo />} after={<ToggleDemo />} />

        <Item n={15} title="Notes textarea" verdict="done"
          note="Already the canonical NotesField (arc Textarea) — shown live for completeness. Type in it; focus shows the coral ring."
          before={<textarea placeholder="Any context about this sale…" style={{ width: 320, height: 70, padding: 12, fontSize: 14, borderRadius: 10, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.5)", outline: "none", resize: "none", fontFamily: "inherit" }} />}
          after={<NotesDemo />} />

        <section style={{ borderTop: "1px solid #e7e2db", paddingTop: 26, marginTop: 8 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 650 }}>Summary</h3>
          <p style={{ margin: 0, fontSize: 13.5, color: "#6b6258", lineHeight: 1.7, maxWidth: 820 }}>
            <strong style={{ color: "#1f6f4a" }}>10 align to existing canonicals</strong> (choice cards → flat-coral · inputs → LabelInput · phone → PhoneInput · email → LabelInput · checkbox → Checkbox · £ → PriceField · search → SearchField · links → coral link · labels → eyebrow · banner → AgentBanner).
            <br /><strong style={{ color: "#8a5a00" }}>2 new to catalogue</strong> (results menu / popover · collapsible header).
            <br /><strong style={{ color: "#1f6f4a" }}>3 already canonical</strong> (segmented control · toggle · notes).
            <br />The four you caught — <strong>PhoneInput, Checkbox, £ PriceField, the results menu</strong> — are 03, 05, 06, 09. Approve the set and I&apos;ll catalogue the two new primitives, then align the live form one component at a time (behaviour untouched).
          </p>
        </section>
      </div>
    </div>
  );
}

function SegAfter() {
  const [a, setA] = useState("Fixed £");
  const [b, setB] = useState("+ VAT");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="arc-scope" style={SEG_TOK}><SegmentedControl label="Fee type" options={[{ value: "Fixed £", label: "Fixed £" }, { value: "Percent %", label: "Percent %" }]} value={a} onValueChange={setA} /></div>
      <div className="arc-scope" style={SEG_TOK}><SegmentedControl label="VAT" options={[{ value: "+ VAT", label: "+ VAT" }, { value: "Inc VAT", label: "Inc VAT" }]} value={b} onValueChange={setB} /></div>
    </div>
  );
}
