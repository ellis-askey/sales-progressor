"use client";
// Design-system audit — the Add-sale (Fill in manually) flow.
//
// Every visual element of the form, classified and shown before → after so each
// can be approved. "After" uses the REAL canonical components where one exists,
// so this is what alignment would actually look like — not a mockup of a mockup.
// Visual only: sizing, behaviour and breakpoints are unchanged. Dev-only.

import { notFound } from "next/navigation";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { LabelInput } from "@/components/ui/LabelInput";
import { SearchField } from "@/components/arc/search-field/search-field";
import "@/components/arc/cookie-consent/scope.css";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Button } from "@/components/arc/button/button";
import { Pill } from "@/components/ui/Pill";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import { LinkSimple } from "@phosphor-icons/react";

const CORAL = "#FF6B4A";
const DEEP = "#E55B3D";
const INK = "#2D1810";
const MUTED = "rgba(45,24,16,0.55)";
const LABEL = "rgba(45,24,16,0.5)";
const LINE = "rgba(45,24,16,0.10)";

// arc token map → agent look, coral-preserving (shared by the segmented controls).
const SEG_TOK = {
  "--surface-muted": "rgba(15,23,42,0.05)", "--border": LINE, "--text-muted": MUTED, "--foreground": INK,
  "--radius-control": "11px", "--control-height-sm": "28px", "--text-sm": "13px",
  "--sc-selection-bg": CORAL, "--sc-selection-fg": "#fff", "--sc-selection-border": "transparent",
  "--shadow-resting": "0 2px 6px rgba(255,107,74,0.30)",
} as CSSProperties;

// ── Choice chips (tenure / purchase type / progressed by) ──────────────────────
function Chips({ flat }: { flat: boolean }) {
  const [sel, setSel] = useState("freehold");
  const opts = [{ v: "freehold", l: "Freehold" }, { v: "leasehold", l: "Leasehold" }];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: sel ? "#2F9E6B" : MUTED }}>Tenure</span>
      {opts.map((o) => {
        const on = sel === o.v;
        return (
          <button key={o.v} type="button" onClick={() => setSel(o.v)} style={{
            fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", padding: "6px 15px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
            border: on ? "1.5px solid transparent" : `1.5px solid ${LINE}`,
            background: on ? (flat ? CORAL : "linear-gradient(180deg, #FF8A65, #FF6B4A)") : "transparent",
            color: on ? "#fff" : MUTED,
            boxShadow: on && !flat ? "0 4px 13px -2px rgba(255,107,74,0.45), inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
            transition: "background 160ms, box-shadow 220ms",
          }}>{o.l}</button>
        );
      })}
    </div>
  );
}

// ── Eyebrow ────────────────────────────────────────────────────────────────────
function Eb({ sentence, children }: { sentence: boolean; children: string }) {
  return sentence
    ? <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: LABEL }}>{children}</p>
    : <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: LABEL }}>{children}</p>;
}

// ── Bespoke "before" input + search + seg + toggle + banner ────────────────────
function BeforeInput({ error }: { error?: boolean }) {
  return (
    <div style={{ width: 240 }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: MUTED }}>Phone</p>
      <input defaultValue="07700 900000" style={{ width: "100%", height: 40, padding: "0 14px", fontSize: 14, color: INK, borderRadius: 10, background: "rgba(255,255,255,0.52)", border: `1px solid ${error ? "rgba(255,107,74,0.6)" : LINE}`, outline: "none" }} />
      {error && <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 500, color: "#C73E3E" }}>Enter a phone or email so we can reach them.</p>}
    </div>
  );
}
function BeforeSearch() {
  return (
    <div style={{ width: 260, position: "relative" }}>
      <input placeholder="Search firm name…" style={{ width: "100%", height: 40, padding: "0 14px 0 34px", fontSize: 14, borderRadius: 10, background: "rgba(255,255,255,0.52)", border: `1px solid ${LINE}`, outline: "none" }} />
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: MUTED }}>⌕</span>
    </div>
  );
}
function BeforeSeg({ opts }: { opts: string[] }) {
  const [i, setI] = useState(0);
  return (
    <div style={{ display: "inline-flex", borderRadius: 10, background: "rgba(45,24,16,0.05)", padding: 3, gap: 2 }}>
      {opts.map((o, n) => (
        <button key={o} type="button" onClick={() => setI(n)} style={{ padding: "5px 14px", borderRadius: 8, border: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
          background: i === n ? "linear-gradient(180deg, #FF8A65, #FF6B4A)" : "transparent", color: i === n ? "#fff" : MUTED, boxShadow: i === n ? "0 2px 8px rgba(255,107,74,0.4)" : "none" }}>{o}</button>
      ))}
    </div>
  );
}
function AfterSeg({ opts }: { opts: string[] }) {
  const [v, setV] = useState(opts[0]);
  return <div className="arc-scope" style={SEG_TOK}><SegmentedControl label="Choose" options={opts.map((o) => ({ value: o, label: o }))} value={v} onValueChange={setV} /></div>;
}
function BeforeBanner() {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", borderRadius: 16, background: "rgba(255,107,74,0.07)", border: "1px solid rgba(255,107,74,0.18)", maxWidth: 440 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(255,107,74,0.14)", color: DEEP, flexShrink: 0 }}><LinkSimple size={18} /></span>
      <div><p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: INK }}>Want to invite the buyer or seller?</p><p style={{ margin: 0, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>Add their contact details below and you can send the invite once the file is created.</p></div>
    </div>
  );
}
function AfterBanner() {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", borderRadius: 18, background: "rgba(255,255,255,0.66)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(45,24,16,0.10)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)", maxWidth: 440 }}>
      <span style={{ color: CORAL, flexShrink: 0, display: "flex", paddingTop: 1 }}><LinkSimple size={20} /></span>
      <div><p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: INK }}>Want to invite the buyer or seller?</p><p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>Add their contact details below and you can send the invite once the file is created.</p></div>
    </div>
  );
}

// Stateful interactive afters (so each can be clicked to confirm).
function DemoToggle() {
  const [on, setOn] = useState(true);
  return <LiquidToggle checked={on} onChange={setOn} width={38} height={22} color={CORAL} aria-label="Mortgage broker" />;
}
function DemoSearch() {
  const [v, setV] = useState("");
  return (
    <div className="arc-scope" style={{ width: 260, ["--control-height-md" as string]: "40px", ["--radius-control" as string]: "10px", ["--surface" as string]: "rgba(255,255,255,0.6)", ["--border-strong" as string]: LINE, ["--foreground" as string]: INK, ["--text-muted" as string]: MUTED, ["--sf-focus" as string]: DEEP } as CSSProperties}>
      <style>{".arc-scope label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}"}</style>
      <SearchField label="Firm" value={v} onValueChange={setV} placeholder="Search firm name…" />
    </div>
  );
}

// ── Audit row ──────────────────────────────────────────────────────────────────
type Verdict = "exists" | "new";
function Item({ n, title, verdict, maps, note, before, after }: { n: number; title: string; verdict: Verdict; maps: string; note: string; before: ReactNode; after: ReactNode }) {
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
        <Pane tag={verdict === "new" ? "Proposed" : "After"} tone="coral">{after}</Pane>
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

export default function NewSaleAuditPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const coralBtn = { "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties;
  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EF", color: "#20242E", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 120px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · audit</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>Add-sale flow</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 720 }}>
            Every visual element, classified. <strong style={{ color: "#1f6f4a" }}>Exists</strong> = aligns to a canonical already in the library (before → after shows the alignment).
            <strong style={{ color: "#8a5a00" }}> New canonical</strong> = a primitive to add to the components page. Visual only — sizing, behaviour and breakpoints are unchanged.
          </p>
        </header>

        <Item n={1} title="Choice chips — tenure / purchase type / progressed by" verdict="exists" maps="flat-coral family"
          note="The selected pill uses the old glossy coral GRADIENT + gloss + heavy shadow. Align to the flat-coral canon (the same #FF6B4A as the primary button and segmented pill). Unselected outline + green group label stay."
          before={<Chips flat={false} />} after={<Chips flat={true} />} />

        <Item n={2} title="Section labels (Vendors, Solicitors & broker, Notes, Your commission, Sale price)" verdict="exists" maps="Eyebrow"
          note="Caps · 700 · 0.08em — the shouty overline. Align to the approved eyebrow: sentence case · 600 · muted."
          before={<div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Eb sentence={false}>Vendors</Eb><Eb sentence={false}>Your commission</Eb><Eb sentence={false}>Sale price</Eb></div>}
          after={<div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Eb sentence>Vendors</Eb><Eb sentence>Your commission</Eb><Eb sentence>Sale price</Eb></div>} />

        <Item n={3} title="Text inputs — full name, phone, email" verdict="exists" maps="LabelInput"
          note="Bespoke top-label inputs (white 52% fill, hard label above). Align to the canonical LabelInput — the label lives in the field and lifts on focus, coral accent."
          before={<BeforeInput />} after={<div style={{ width: 240 }}><LabelInput field="Phone" label="Phone" accent={CORAL} fullWidth /></div>} />

        <Item n={4} title="Required / error field state" verdict="exists" maps="LabelInput + InlineAlert"
          note="A pink input border + a loose red line of text. Align to the field's own error state, and for form-level messages the canonical InlineAlert (bordered, not washed)."
          before={<BeforeInput error />}
          after={<div style={{ display: "flex", flexDirection: "column", gap: 10, width: 300 }}><LabelInput field="Phone" label="Phone" accent="#C73E3E" fullWidth /><InlineAlert kind="danger">Enter a phone or email so we can reach them.</InlineAlert></div>} />

        <Item n={5} title="Solicitor firm search" verdict="exists" maps="SearchField"
          note="A bespoke search input with a glyph. Align to the canonical SearchField — same glyph, clear button, reserved-width slot."
          before={<BeforeSearch />} after={<DemoSearch />} />

        <Item n={6} title="Segmented toggles — Fixed £/Percent %, +VAT/Inc VAT, File worth/Sold prices" verdict="exists" maps="Segmented control"
          note="Bespoke 'Seg' with a glossy gradient active chip. Align to the canonical arc SegmentedControl — the gliding coral selection, one family with the top-bar All/Mine."
          before={<div style={{ display: "flex", flexDirection: "column", gap: 10 }}><BeforeSeg opts={["Fixed £", "Percent %"]} /><BeforeSeg opts={["+ VAT", "Inc VAT"]} /></div>}
          after={<div style={{ display: "flex", flexDirection: "column", gap: 10 }}><AfterSeg opts={["Fixed £", "Percent %"]} /><AfterSeg opts={["+ VAT", "Inc VAT"]} /></div>} />

        <Item n={7} title="Mortgage-broker toggle" verdict="exists" maps="Toggle (LiquidToggle)"
          note="The on/off switch is already the canonical LiquidToggle — included for completeness; no change, just confirm the coral."
          before={<DemoToggle />} after={<DemoToggle />} />

        <Item n={8} title="Prompt banners — portal invite, chain, outsourced" verdict="exists" maps="AgentBanner"
          note="Faded coral-tint cards (washed fill + tinted icon chip). Align to the canonical AgentBanner recipe — neutral frosted surface, the kind colour carried only by the icon, no wash. (AgentBanner should itself be catalogued — it's referenced but not yet an entry.)"
          before={<BeforeBanner />} after={<AfterBanner />} />

        <Item n={9} title="Primary / secondary / link buttons — Create file, Save draft, Add vendor, Done" verdict="exists" maps="Button + coral link"
          note="The Create-file primary is the glossy gradient; Add-vendor is a coral text link. Align the primary to the flat-coral Button; the links are already the canonical coral link."
          before={<button style={{ padding: "12px 22px", borderRadius: 14, border: 0, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", background: "linear-gradient(180deg, #FF8A65, #FF5E36)", boxShadow: "0 8px 22px rgba(255,107,74,0.4)" }}>Create file</button>}
          after={<Button type="button" variant="primary" size="lg" style={{ ...coralBtn, minWidth: 160, justifyContent: "center" }}>Create file</Button>} />

        <Item n={10} title="Sale-price field + status pills" verdict="exists" maps="Price input + Pill"
          note="The £ price pill maps to the shared PriceInput; 'From memo' / tenure tags map to the canonical Pill (normal case, tone-driven)."
          before={<span style={{ display: "inline-flex", alignItems: "center", padding: "10px 16px", borderRadius: 12, border: `1px solid ${LINE}`, background: "#fff", fontSize: 18, fontWeight: 700, color: INK }}>£477,875</span>}
          after={<div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><span style={{ display: "inline-flex", alignItems: "center", padding: "10px 16px", borderRadius: 12, border: `1px solid ${LINE}`, background: "#fff", fontSize: 18, fontWeight: 700, color: INK }}>£477,875</span><Pill tone="success" size="sm">From memo</Pill></div>} />

        <Item n={11} title="Contact carousel — multi-entry dots" verdict="new"
          note="The little dot pager on the vendor/purchaser cards (and the amber 'needs attention' dot) has no canonical home. Add a Field-indicator / step-dots primitive (shares DNA with the modal step dots)." maps=""
          before={<div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map((d) => <span key={d} style={{ width: 7, height: 7, borderRadius: 999, background: d === 0 ? CORAL : "rgba(45,24,16,0.18)" }} />)}</div>}
          after={<div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map((d) => <span key={d} style={{ width: d === 0 ? 18 : 7, height: 7, borderRadius: 999, background: d === 0 ? CORAL : "rgba(45,24,16,0.18)", transition: "all .2s" }} />)}</div>} />

        <Item n={12} title="Collapsible section header (Solicitors & broker, Notes)" verdict="new"
          note="The accordion header (caps label + rotating chevron + grid-rows open/close) is a repeated pattern with no entry. Add an Accordion / collapsible-section canonical — and its label follows the eyebrow decision." maps=""
          before={<div style={{ width: 320, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${LINE}` }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: LABEL }}>Solicitors &amp; broker</span><span style={{ color: MUTED }}>⌄</span></div>}
          after={<div style={{ width: 320, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${LINE}` }}><span style={{ fontSize: 11, fontWeight: 600, color: LABEL }}>Solicitors &amp; broker</span><span style={{ color: MUTED }}>⌄</span></div>} />

        <Item n={13} title="Commission breakdown rows (Self-progress · Free · Net to your agency)" verdict="new"
          note="The label↔value rows in the earnings card (and the total row) are a distinct list-row pattern. Add a Breakdown-row canonical (label left, value right, optional emphasis + divider)." maps=""
          before={<div style={{ width: 300 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: INK, padding: "6px 0" }}><span>Self-progress</span><span style={{ fontWeight: 600 }}>Free</span></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderTop: `1px solid ${LINE}` }}><span style={{ fontWeight: 600, color: INK }}>Net to your agency</span><span style={{ color: MUTED }}>Add a commission</span></div></div>}
          after={<div style={{ width: 300 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: INK, padding: "6px 0" }}><span>Self-progress</span><span style={{ fontWeight: 600 }}>Free</span></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderTop: `1px solid ${LINE}` }}><span style={{ fontWeight: 600, color: INK }}>Net to your agency</span><span style={{ color: MUTED }}>Add a commission</span></div></div>} />

        <Item n={14} title="Notes textarea" verdict="new"
          note="The multiline notes field has no canonical textarea (the arc 'textarea' is vendored but unused). Add a Textarea canonical that matches the LabelInput treatment." maps=""
          before={<textarea placeholder="Any context about this sale…" style={{ width: 300, height: 70, padding: 12, fontSize: 14, borderRadius: 10, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.5)", outline: "none", resize: "none", fontFamily: "inherit" }} />}
          after={<textarea placeholder="Any context about this sale…" style={{ width: 300, height: 70, padding: 12, fontSize: 14, borderRadius: 10, border: `1px solid ${LINE}`, background: "#fff", outline: "none", resize: "none", fontFamily: "inherit" }} />} />

        <section style={{ borderTop: "1px solid #e7e2db", paddingTop: 26, marginTop: 8 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 650 }}>Summary</h3>
          <p style={{ margin: 0, fontSize: 13.5, color: "#6b6258", lineHeight: 1.7, maxWidth: 760 }}>
            <strong style={{ color: "#1f6f4a" }}>10 align to existing canonicals</strong> (chips → flat coral · labels → eyebrow · inputs → LabelInput · errors → LabelInput + InlineAlert · search → SearchField · segmented → SegmentedControl · toggle → LiquidToggle · banners → AgentBanner · buttons → Button · price/pills → PriceInput + Pill).
            <br /><strong style={{ color: "#8a5a00" }}>4 new canonicals to add</strong> (field-indicator dots · accordion header · breakdown row · textarea) — plus AgentBanner itself needs cataloguing.
            Approve per-row and I&apos;ll align the form + add the new entries, one component at a time.
          </p>
        </section>
      </div>
    </div>
  );
}
