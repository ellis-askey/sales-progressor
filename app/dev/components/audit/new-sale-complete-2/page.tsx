"use client";
// Design-system audit — Add-sale flow, Part 2: the areas the first complete pass
// didn't cover (MOS-upload path, commission panel, chain, drafts, modals). Honest
// accounting: several are ALREADY canonical — shown so nothing is unaccounted for.
// Every "After" that changes is the real canonical component, live. Dev-only.

import { notFound } from "next/navigation";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { LabelInput } from "@/components/ui/LabelInput";
import { PriceField } from "@/components/ui/PriceField";
import { Pill } from "@/components/ui/Pill";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";

const CORAL = "#FF6B4A";
const INK = "#2D1810";
const MUTED = "rgba(45,24,16,0.55)";
const LABEL = "rgba(45,24,16,0.5)";
const LINE = "rgba(45,24,16,0.10)";
const GHOST = "#9C9086";
const GREEN = "#2F9E6B";
const AMBER = "#C97D1A";

// ── 01 · Commission — percent field ─────────────────────────────────────────────
function PercentBefore() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 12px", borderRadius: 12, border: `1px solid ${LINE}`, background: "rgba(15,23,42,0.03)" }}>
      <input type="number" defaultValue="" placeholder="0" style={{ width: 54, border: 0, background: "none", outline: "none", fontSize: 20, fontWeight: 600, color: INK }} />
      <span style={{ fontSize: 20, fontWeight: 600, color: GHOST }}>%</span>
    </div>
  );
}
function PercentAfter() {
  const [v, setV] = useState("");
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, width: 150 }}>
      <div style={{ flex: 1 }}>
        <LabelInput field="pct" label="Commission %" accent={CORAL} type="number" fullWidth value={v} onChange={(e) => setV(e.target.value)} />
      </div>
    </div>
  );
}

// ── 02 · Commission — breakdown rows ────────────────────────────────────────────
function BreakdownRow({ label, value, tone, strong }: { label: string; value: string; tone?: "income" | "cost" | "muted"; strong?: boolean }) {
  const vc = tone === "income" ? GREEN : tone === "cost" ? AMBER : tone === "muted" ? MUTED : INK;
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: strong ? 12.5 : 12, fontWeight: strong ? 600 : 400, color: strong ? INK : MUTED }}>{label}</span>
      <span style={{ fontSize: strong ? 18 : 13, fontWeight: strong ? 700 : 600, color: strong ? GREEN : vc, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
function Breakdown() {
  return (
    <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 8 }}>
      <BreakdownRow label="Commission" value="£3,500 inc VAT" />
      <BreakdownRow label="Solicitor referral" value="+£150" tone="income" />
      <BreakdownRow label="Sent to us" value="Free" tone="muted" />
      <div style={{ borderTop: `0.5px solid ${LINE}`, paddingTop: 8, marginTop: 2 }}>
        <BreakdownRow label="Net to your agency" value="£3,650" strong />
      </div>
    </div>
  );
}

// ── 03 · Eyebrows ───────────────────────────────────────────────────────────────
function Eb({ sentence, children }: { sentence: boolean; children: string }) {
  return <p style={sentence
    ? { margin: 0, fontSize: 11, fontWeight: 600, color: LABEL }
    : { margin: 0, fontSize: 11, fontWeight: 650, letterSpacing: "0.04em", textTransform: "uppercase", color: LABEL }}>{children}</p>;
}

// ── 04 · MOS reading bar (already mostly canonical) ─────────────────────────────
function MemoBar() {
  return (
    <div style={{ width: 420, borderRadius: 16, background: "#fff", border: `1px solid ${LINE}`, borderTop: `2px solid ${GREEN}`, boxShadow: "0 1px 3px rgba(30,20,15,0.05)", padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle size={14} weight="fill" color={GREEN} />
          <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>Memo read · 2 fields need attention</span>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>Change file</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <Pill glass tone="warning" size="md">Tenure</Pill>
        <Pill glass tone="warning" size="md">Price</Pill>
      </div>
    </div>
  );
}

// ── 05 · Modal inner inputs (shell already canonical) ───────────────────────────
function ModalInputsBefore() {
  return (
    <div style={{ width: 300, borderRadius: 14, background: "#fff", border: `1px solid ${LINE}`, boxShadow: "0 10px 30px rgba(15,26,46,0.10)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${LINE}`, fontSize: 13, fontWeight: 600, color: INK }}>Add a new firm</div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {["Firm name", "Case handler"].map((l) => (
          <div key={l}>
            <p style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 600, color: "rgba(45,24,16,0.65)" }}>{l}</p>
            <input placeholder="" style={{ width: "100%", height: 38, padding: "0 12px", fontSize: 14, borderRadius: 10, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.4)", outline: "none" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
function ModalInputsAfter() {
  return (
    <div style={{ width: 300, borderRadius: 14, background: "#fff", border: `1px solid ${LINE}`, boxShadow: "0 10px 30px rgba(15,26,46,0.10)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${LINE}`, fontSize: 13, fontWeight: 600, color: INK }}>Add a new firm</div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, ["--lbi-top" as string]: "0px" } as CSSProperties}>
        <LabelInput field="firm" label="Firm name" accent={CORAL} fullWidth />
        <LabelInput field="handler" label="Case handler" accent={CORAL} fullWidth />
      </div>
    </div>
  );
}

// ── 06 · Draft row (already canonical) ──────────────────────────────────────────
function DraftRow() {
  const [h, setH] = useState(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ width: 360, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 14px", borderRadius: 12, border: `1px solid ${LINE}`, background: h ? "rgba(255,107,74,0.04)" : "#fff", transition: "background .15s", cursor: "pointer" }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>14 Beaumont Rise, Harpenden</p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: MUTED }}>Draft · saved 2 days ago</p>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: h ? "#E55B3D" : CORAL, flexShrink: 0 }}>Resume →</span>
    </div>
  );
}

// ── Scaffold ────────────────────────────────────────────────────────────────────
type Verdict = "exists" | "new" | "done";
function Item({ n, title, verdict, maps, note, before, after }: { n: number; title: string; verdict: Verdict; maps?: string; note: string; before: ReactNode; after?: ReactNode }) {
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
      <div style={{ display: "grid", gridTemplateColumns: after ? "1fr 1fr" : "1fr", gap: 18 }}>
        <Pane tag={after ? "Before · on the page now" : "On the page now"} tone="muted">{before}</Pane>
        {after && <Pane tag={verdict === "new" ? "Proposed · live" : "After · live"} tone="coral">{after}</Pane>}
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

export default function NewSaleComplete2AuditPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EF", color: "#20242E", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 120px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · audit · complete · part 2</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>Add-sale flow — the uncovered areas</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 820 }}>
            The parts Part 1 didn&apos;t reach: the MOS-upload path, the commission panel, chain, drafts and modals. Honest accounting —
            several are <strong style={{ color: "#1f6f4a" }}>already canonical</strong> and shown so nothing is unaccounted for. Only the <strong style={{ color: CORAL }}>After</strong>-paired rows change.
          </p>
        </header>

        <Item n={1} title="Commission — percent field" verdict="exists" maps="LabelInput (numeric)"
          note="The amount field already uses PriceField; only the Fixed-£ ⇄ Percent-% toggle’s percent branch is a bespoke native number input (price-hero-input-native). Align it to a LabelInput numeric field so both branches share one treatment. Type in it."
          before={<PercentBefore />} after={<PercentAfter />} />

        <Item n={2} title="Commission — breakdown + net rows" verdict="new"
          note="The label↔value rows in the earnings card (Commission / referrals / Sent-to-us / Net to your agency, with the emphasised total) are a repeated list pattern with no entry. Catalogue a breakdown-row primitive (label left, value right, tone + emphasis + divider)."
          before={<Breakdown />} after={<Breakdown />} />

        <Item n={3} title="Commission + MOS section labels" verdict="exists" maps="Eyebrow"
          note="“Your commission”, “Sale details”, “Vendor”, “Purchaser” are the faint/uppercase overlines. Align to the approved sentence-case eyebrow."
          before={<div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Eb sentence={false}>Your commission</Eb><Eb sentence={false}>Sale details</Eb></div>}
          after={<div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Eb sentence>Your commission</Eb><Eb sentence>Sale details</Eb></div>} />

        <Item n={4} title="MOS “reading” status bar" verdict="done"
          note="Already canonical: it uses the real Pill (warning tone) for the missing-field chips, token links for Change file / Cancel, and --agent-* tokens throughout. The only change it inherits is the eyebrow on its group labels (row 03). No primitive swap."
          before={<MemoBar />} />

        <Item n={5} title="Field indicators (“from memo” tick / needs-attention dot)" verdict="done"
          note="Already canonical: FieldIndicator is a tokenised success CheckCircle + warning dot; FieldHint is tokenised warning text. No change."
          before={<div style={{ display: "flex", alignItems: "center", gap: 16 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: INK }}>Price <CheckCircle size={14} weight="fill" color={GREEN} /></span><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: INK }}>Tenure <span style={{ width: 6, height: 6, borderRadius: 999, background: AMBER }} /></span></div>} />

        <Item n={6} title="Modals — inner inputs (Add firm / Add broker / Change file)" verdict="exists" maps="LabelInput"
          note="The modal SHELL is already the canonical Modal (Header / Body / Footer). Inside, the fields are still hard-label glass-input inputs — swap them to LabelInput so modal forms match the rest. Shell unchanged. Click the fields."
          before={<ModalInputsBefore />} after={<ModalInputsAfter />} />

        <Item n={7} title="Draft list row + Resume" verdict="done"
          note="Already canonical: the draft row is the catalogued draft-row (agent-hover-row + agent-icon-btn + coral Resume link). Hover it. No change."
          before={<DraftRow />} />

        <Item n={8} title="Chain builder (ChainSection + AddNodeDrawer)" verdict="exists" maps="shared sub-system"
          note="The chain section delegates to ChainSection — the SAME component the file page uses, with its own AddNodeDrawer. Its address + solicitor fields are AddressFields + SolicitorPicker, so they inherit the exact LabelInput + SearchField swaps from Part 1 — no new work, but its own audit note so it’s recorded. (Changing ChainSection also touches the file page — do it as its own PR.)"
          before={<div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, maxWidth: 520 }}>ChainSection is shared with the property-file page. Its inputs are AddressFields (→ LabelInput) and SolicitorPicker (→ SearchField + menu). Aligned by the Part-1 swaps; no bespoke primitive unique to the chain builder.</div>} />

        <section style={{ borderTop: "1px solid #e7e2db", paddingTop: 26, marginTop: 8 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 650 }}>Full accounting</h3>
          <p style={{ margin: 0, fontSize: 13.5, color: "#6b6258", lineHeight: 1.7, maxWidth: 820 }}>
            <strong style={{ color: "#1f6f4a" }}>Remaining swaps:</strong> commission percent field → LabelInput · commission + MOS labels → eyebrow · modal inner inputs → LabelInput.
            <br /><strong style={{ color: "#8a5a00" }}>New to catalogue:</strong> breakdown-row (+ the menu · pick-row · selection-pill from Part 1).
            <br /><strong style={{ color: "#1f6f4a" }}>Already canonical (no change):</strong> MOS reading bar (Pill + token links) · field indicators · draft row · commission amount field (PriceField) · the Fixed/Percent + VAT segmented controls · the modal shell.
            <br /><strong>Shared sub-system:</strong> ChainSection (file page too — its own PR).
            <br />Together with Part 1 (<code>/dev/components/audit/new-sale-complete</code>), this records every element on both the manual-add and MOS-upload paths.
          </p>
        </section>
      </div>
    </div>
  );
}
