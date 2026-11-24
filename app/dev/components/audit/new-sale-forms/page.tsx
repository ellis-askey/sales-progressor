"use client";
// Design-system audit — Add-sale flow, part 2 (the form internals still to align).
//
// Every "after" is the REAL canonical component, fully interactive with the coral
// tokens applied — focus the inputs (the label lifts), type in the search, flip
// the toggle, press the buttons, dismiss the banner, open the accordion, step the
// dots. Visual only: sizing, behaviour and breakpoints are unchanged. Dev-only.

import { notFound } from "next/navigation";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { LabelInput } from "@/components/ui/LabelInput";
import { SearchField } from "@/components/arc/search-field/search-field";
import "@/components/arc/cookie-consent/scope.css";
import { Button } from "@/components/arc/button/button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import { LinkSimple, X, Plus, CaretDown } from "@phosphor-icons/react";

const CORAL = "#FF6B4A";
const DEEP = "#E55B3D";
const INK = "#2D1810";
const MUTED = "rgba(45,24,16,0.55)";
const LABEL = "rgba(45,24,16,0.5)";
const LINE = "rgba(45,24,16,0.10)";

const SF_TOK = {
  width: 260, ["--control-height-md"]: "40px", ["--radius-control"]: "10px",
  ["--surface"]: "rgba(255,255,255,0.6)", ["--border-strong"]: LINE,
  ["--foreground"]: INK, ["--text-muted"]: MUTED, ["--sf-focus"]: DEEP,
} as CSSProperties;

// ── 1. Banners ─────────────────────────────────────────────────────────────────
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
  const [linkHover, setLinkHover] = useState(false);
  const [xHover, setXHover] = useState(false);
  if (!show) return <button type="button" onClick={() => setShow(true)} style={{ fontSize: 12, color: CORAL, fontWeight: 600, background: "none", border: 0, cursor: "pointer" }}>Bring the banner back ↺</button>;
  return (
    <div style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "15px 16px", borderRadius: 18, background: "rgba(255,255,255,0.66)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(45,24,16,0.10)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 10px 30px rgba(15,26,46,0.08)", maxWidth: 440 }}>
      <span style={{ color: CORAL, flexShrink: 0, display: "flex", paddingTop: 1 }}><LinkSimple size={20} /></span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: INK }}>Want to invite the buyer or seller?</p>
        <p style={{ margin: "0 0 7px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>Add their contact details below and send the invite once the file is created.</p>
        <button type="button" onMouseEnter={() => setLinkHover(true)} onMouseLeave={() => setLinkHover(false)} style={{ fontSize: 12.5, fontWeight: 600, color: linkHover ? DEEP : CORAL, background: "none", border: 0, cursor: "pointer", padding: 0, transition: "color .12s" }}>I won&apos;t be using the portal</button>
      </div>
      <button type="button" onClick={() => setShow(false)} onMouseEnter={() => setXHover(true)} onMouseLeave={() => setXHover(false)} aria-label="Dismiss" style={{ width: 28, height: 28, borderRadius: 999, border: 0, background: xHover ? "rgba(45,24,16,0.07)" : "transparent", color: xHover ? INK : MUTED, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0, transition: "background .12s, color .12s" }}><X size={14} /></button>
    </div>
  );
}

// ── 2–3. Inputs + error ────────────────────────────────────────────────────────
function InputRowBefore({ error }: { error?: boolean }) {
  return (
    <div style={{ width: 240 }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: MUTED }}>Phone</p>
      <input defaultValue="07700 900000" style={{ width: "100%", height: 40, padding: "0 14px", fontSize: 14, color: INK, borderRadius: 10, background: "rgba(255,255,255,0.52)", border: `1px solid ${error ? "rgba(255,107,74,0.6)" : LINE}`, outline: "none" }} />
      {error && <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 500, color: "#C73E3E" }}>Enter a phone or email so we can reach them.</p>}
    </div>
  );
}

// ── 4. Search ──────────────────────────────────────────────────────────────────
function SearchBefore() {
  return (
    <div style={{ width: 260, position: "relative" }}>
      <input placeholder="Search firm name…" style={{ width: "100%", height: 40, padding: "0 14px 0 34px", fontSize: 14, borderRadius: 10, background: "rgba(255,255,255,0.52)", border: `1px solid ${LINE}`, outline: "none" }} />
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: MUTED }}>⌕</span>
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

// ── 5. Buttons ─────────────────────────────────────────────────────────────────
function ButtonsBefore() {
  return <button style={{ padding: "12px 22px", borderRadius: 14, border: 0, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", background: "linear-gradient(180deg, #FF8A65, #FF5E36)", boxShadow: "0 8px 22px rgba(255,107,74,0.4)" }}>Create file</button>;
}
function ButtonsAfter() {
  const coral = { "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties;
  const [linkHover, setLinkHover] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <Button type="button" variant="primary" size="lg" style={{ ...coral, minWidth: 150, justifyContent: "center" }}>Create file</Button>
      <Button type="button" variant="ghost" size="md">Save draft</Button>
      <button type="button" onMouseEnter={() => setLinkHover(true)} onMouseLeave={() => setLinkHover(false)} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 13, fontWeight: 600, color: linkHover ? DEEP : CORAL, background: "none", border: 0, cursor: "pointer", transition: "color .12s" }}><Plus size={13} weight="bold" /> Add vendor</button>
    </div>
  );
}

// ── 6. Eyebrows ────────────────────────────────────────────────────────────────
function EyebrowBefore() {
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{["Vendors", "Solicitors & broker", "Your commission"].map((l) => <p key={l} style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: LABEL }}>{l}</p>)}</div>;
}
function EyebrowAfter() {
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{["Vendors", "Solicitors & broker", "Your commission"].map((l) => <p key={l} style={{ margin: 0, fontSize: 11, fontWeight: 600, color: LABEL }}>{l}</p>)}</div>;
}

// ── 7. Toggle ──────────────────────────────────────────────────────────────────
function ToggleDemo() {
  const [on, setOn] = useState(true);
  return <LiquidToggle checked={on} onChange={setOn} width={38} height={22} color={CORAL} aria-label="Mortgage broker" />;
}

// ── 8. Contact dots (NEW) ──────────────────────────────────────────────────────
function DotsBefore() {
  return <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map((d) => <span key={d} style={{ width: 7, height: 7, borderRadius: 999, background: d === 0 ? CORAL : "rgba(45,24,16,0.18)" }} />)}</div>;
}
function DotsAfter() {
  const [at, setAt] = useState(0);
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {[0, 1, 2].map((d) => (
        <button key={d} type="button" onClick={() => setAt(d)} aria-label={`Entry ${d + 1}`} style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer", display: "flex" }}>
          <span style={{ width: d === at ? 18 : 7, height: 7, borderRadius: 999, background: d === at ? CORAL : "rgba(45,24,16,0.18)", transition: "width .2s ease, background .2s ease" }} />
        </button>
      ))}
    </div>
  );
}

// ── 9. Accordion header (NEW) ──────────────────────────────────────────────────
function AccordionDemo({ canon }: { canon?: boolean }) {
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

// ── 10. Breakdown rows (NEW) ───────────────────────────────────────────────────
function BreakdownDemo() {
  return (
    <div style={{ width: 300 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: INK, padding: "6px 0" }}><span>Self-progress</span><span style={{ fontWeight: 600 }}>Free</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0 2px", borderTop: `1px solid ${LINE}`, marginTop: 4 }}><span style={{ fontWeight: 600, color: INK }}>Net to your agency</span><span style={{ fontWeight: 700, color: INK }}>£3,200</span></div>
    </div>
  );
}

// ── Row scaffold ───────────────────────────────────────────────────────────────
type Verdict = "exists" | "new";
function Item({ n, title, verdict, maps, note, before, after }: { n: number; title: string; verdict: Verdict; maps?: string; note: string; before: ReactNode; after: ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid #e7e2db", padding: "26px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono, monospace)", color: "#b3a99d" }}>{String(n).padStart(2, "0")}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "#20242E" }}>{title}</h3>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: verdict === "new" ? "#8a5a00" : "#1f6f4a", background: verdict === "new" ? "rgba(224,148,46,0.14)" : "rgba(47,158,107,0.13)", border: `1px solid ${verdict === "new" ? "rgba(224,148,46,0.32)" : "rgba(47,158,107,0.3)"}` }}>
          {verdict === "new" ? "New canonical" : `Exists → ${maps}`}
        </span>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b6258", lineHeight: 1.55, maxWidth: 760 }}>{note}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Pane tag="Before" tone="muted">{before}</Pane>
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

export default function NewSaleFormsAuditPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EF", color: "#20242E", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 120px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · audit · part 2</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>Add-sale flow — form internals</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 740 }}>
            The rest of the form, after the pills + toggles + price were aligned. Every <strong style={{ color: CORAL }}>After</strong> is the <strong>real</strong> canonical, live and interactive —
            focus an input (the label lifts), type the search, flip the toggle, press a button, dismiss the banner, open the accordion, step the dots. Coral tokens applied throughout.
          </p>
        </header>

        <Item n={1} title="Prompt banners — portal invite, chain, outsourced" verdict="exists" maps="AgentBanner"
          note="Faded colour-tint cards (washed fill + tinted icon chip). AgentBanner's recipe: a neutral frosted surface where ONLY the icon carries the kind colour, with a coral link action + canonical dismiss. Try the X, then bring it back."
          before={<BannerBefore />} after={<BannerAfter />} />

        <Item n={2} title="Text inputs — full name, phone, email" verdict="exists" maps="LabelInput"
          note="Hard-label inputs (white 52% fill, label stuck above). The canonical LabelInput floats the label into the field and lifts it on focus, coral accent. Click it."
          before={<InputRowBefore />} after={<div style={{ width: 240 }}><LabelInput field="Phone" label="Phone" accent={CORAL} fullWidth /></div>} />

        <Item n={3} title="Required / error field state" verdict="exists" maps="LabelInput + InlineAlert"
          note="A pink input outline + a loose red line. The field carries its own error accent, and form-level messages use the canonical InlineAlert (bordered, not washed)."
          before={<InputRowBefore error />}
          after={<div style={{ display: "flex", flexDirection: "column", gap: 10, width: 300 }}><LabelInput field="Phone" label="Phone" accent="#C73E3E" fullWidth /><InlineAlert kind="danger">Enter a phone or email so we can reach them.</InlineAlert></div>} />

        <Item n={4} title="Solicitor / broker firm search" verdict="exists" maps="SearchField"
          note="A bespoke search input. The canonical SearchField — native glyph, coral focus, clear button in a reserved slot. Type in it."
          before={<SearchBefore />} after={<SearchAfter />} />

        <Item n={5} title="Buttons — Create file, Save draft, Add vendor" verdict="exists" maps="Button + coral link"
          note="The Create-file primary is the glossy gradient. The canonical flat-coral Button (press it — it dips), the quiet ghost, and the coral text link."
          before={<ButtonsBefore />} after={<ButtonsAfter />} />

        <Item n={6} title="Section labels (Vendors, Solicitors & broker, Your commission)" verdict="exists" maps="Eyebrow"
          note="Caps · 700 · 0.08em — the shouty overline. The approved eyebrow: sentence case · 600 · muted."
          before={<EyebrowBefore />} after={<EyebrowAfter />} />

        <Item n={7} title="Mortgage-broker toggle" verdict="exists" maps="LiquidToggle"
          note="Already the canonical LiquidToggle — here live for completeness. Flip it; confirm the coral."
          before={<ToggleDemo />} after={<ToggleDemo />} />

        <Item n={8} title="Contact carousel — entry dots" verdict="new"
          note="The dot pager on the vendor/purchaser cards has no canonical home. A field-indicator primitive: the active entry widens to a coral pill. Click the dots."
          before={<DotsBefore />} after={<DotsAfter />} />

        <Item n={9} title="Collapsible section header (Solicitors & broker, Notes)" verdict="new"
          note="The accordion header (label + rotating chevron + grid-rows open/close) is a repeated pattern with no entry. Its label follows the eyebrow decision. Click to open/close."
          before={<AccordionDemo />} after={<AccordionDemo canon />} />

        <Item n={10} title="Commission breakdown rows" verdict="new"
          note="The label↔value rows in the earnings card (and the emphasised total). A breakdown-row primitive: label left, value right, optional divider + emphasis."
          before={<BreakdownDemo />} after={<BreakdownDemo />} />

        <section style={{ borderTop: "1px solid #e7e2db", paddingTop: 26, marginTop: 8 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 650 }}>Summary</h3>
          <p style={{ margin: 0, fontSize: 13.5, color: "#6b6258", lineHeight: 1.7, maxWidth: 760 }}>
            <strong style={{ color: "#1f6f4a" }}>7 align to existing canonicals</strong> (banners → AgentBanner · inputs → LabelInput · errors → LabelInput + InlineAlert · search → SearchField · buttons → Button + link · labels → eyebrow · toggle → LiquidToggle).
            <br /><strong style={{ color: "#8a5a00" }}>3 new canonicals</strong> (entry dots · accordion header · breakdown row).
            Approve per row and I&apos;ll apply each to the live form + add the new entries, one component at a time.
          </p>
        </section>
      </div>
    </div>
  );
}
