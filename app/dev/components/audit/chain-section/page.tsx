"use client";
// Design-system audit — Add-sale flow, part 3 (the chain section + remaining bits).
//
// Every "After" is the real canonical / canonical recipe, live and interactive —
// step the position selector, press the buttons. Visual only: sizing, behaviour
// and breakpoints unchanged. Dev-only.

import { notFound } from "next/navigation";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import "@/components/arc/cookie-consent/scope.css";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Button } from "@/components/arc/button/button";
import { Pill } from "@/components/ui/Pill";
import { LinkSimple, Plus, X } from "@phosphor-icons/react";

const CORAL = "#FF6B4A";
const DEEP = "#E55B3D";
const INK = "#2D1810";
const MUTED = "rgba(45,24,16,0.55)";
const LABEL = "rgba(45,24,16,0.5)";
const LINE = "rgba(45,24,16,0.10)";

const SEG_TOK = {
  ["--surface-muted"]: "rgba(15,23,42,0.05)", ["--border"]: LINE, ["--text-muted"]: MUTED, ["--foreground"]: INK,
  ["--radius-control"]: "11px", ["--control-height-sm"]: "34px", ["--text-sm"]: "13px",
  ["--sc-selection-bg"]: CORAL, ["--sc-selection-fg"]: "#fff", ["--sc-selection-border"]: "transparent",
  ["--shadow-resting"]: "0 2px 6px rgba(255,107,74,0.30)",
} as CSSProperties;

// ── 1. Chain prompt ────────────────────────────────────────────────────────────
function PromptBefore() {
  return (
    <div style={{ padding: 16, borderRadius: 16, background: "#fff", border: `1px solid ${LINE}`, maxWidth: 440 }}>
      <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center", color: "#fff", background: "linear-gradient(135deg, #E55B3D, #FFB199)", boxShadow: "0 6px 14px -6px rgba(255,107,74,0.6)" }}><LinkSimple size={18} weight="bold" /></span>
        <div><p style={{ margin: 0, fontSize: 14.5, fontWeight: 650, color: INK }}>Is this sale part of a chain?</p><p style={{ margin: "4px 0 0", fontSize: 12.5, color: MUTED }}>Add the chain and we&rsquo;ll send invite links to the other agents.</p></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
        <button style={{ padding: "8px 16px", borderRadius: 10, border: 0, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "linear-gradient(180deg, #FF8A65, #FF5E36)", boxShadow: "0 4px 12px rgba(255,107,74,0.4)" }}>Yes, add the chain</button>
        <button style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${LINE}`, background: "#fff", color: INK, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Not in a chain</button>
      </div>
    </div>
  );
}
function PromptAfter() {
  const coral = { "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties;
  return (
    <div style={{ padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.66)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: `1px solid ${LINE}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)", maxWidth: 440 }}>
      <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
        <span style={{ color: CORAL, flexShrink: 0, display: "flex", paddingTop: 2 }}><LinkSimple size={22} /></span>
        <div><p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: INK }}>Is this sale part of a chain?</p><p style={{ margin: "4px 0 0", fontSize: 12.5, color: MUTED }}>Add the chain and we&rsquo;ll send invite links to the other agents.</p></div>
      </div>
      <div className="arc-scope" style={{ display: "flex", gap: 10, marginTop: 13 }}>
        <Button type="button" variant="primary" size="md" style={coral}>Yes, add the chain</Button>
        <Button type="button" variant="ghost" size="md">Not in a chain</Button>
      </div>
    </div>
  );
}

// ── 2. Position selector ───────────────────────────────────────────────────────
function PosBefore() {
  const [i, setI] = useState(3);
  const opts = ["Top", "Middle", "Bottom", "Not sure yet"];
  return (
    <div style={{ display: "inline-flex", gap: 4, padding: 3, borderRadius: 12, background: "rgba(255,107,74,0.05)", border: "1px solid rgba(255,107,74,0.14)" }}>
      {opts.map((o, n) => (
        <button key={o} type="button" onClick={() => setI(n)} style={{ padding: "7px 14px", borderRadius: 9, border: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap",
          background: i === n ? "linear-gradient(135deg, #E55B3D, color-mix(in srgb, #FF8A65 70%, #fff))" : "transparent", color: i === n ? "#fff" : MUTED, boxShadow: i === n ? "0 6px 14px -6px rgba(255,107,74,0.6)" : "none" }}>{o}</button>
      ))}
    </div>
  );
}
function PosAfter() {
  const [v, setV] = useState("unknown");
  return (
    <div className="arc-scope" style={SEG_TOK}>
      <SegmentedControl label="Where does your sale sit?" options={[{ value: "top", label: "Top" }, { value: "middle", label: "Middle" }, { value: "bottom", label: "Bottom" }, { value: "unknown", label: "Not sure yet" }]} value={v} onValueChange={setV} />
    </div>
  );
}

// ── 3. Add-above/below slot ────────────────────────────────────────────────────
function SlotBefore() {
  return (
    <button type="button" style={{ width: 300, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 12, border: "1px solid rgba(255,107,74,0.22)", background: "rgba(255,107,74,0.07)", color: DEEP, fontSize: 14, fontWeight: 600, cursor: "pointer" }}><Plus size={14} weight="bold" /> Add the sale above</button>
  );
}
function SlotAfter() {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ width: 300, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 12, border: `1.5px dashed ${hover ? CORAL : "rgba(45,24,16,0.18)"}`, background: "transparent", color: hover ? DEEP : MUTED, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "border-color .14s, color .14s" }}><Plus size={14} weight="bold" /> Add the sale above</button>
  );
}

// ── 4. Chain node card ─────────────────────────────────────────────────────────
function NodeBefore() {
  return (
    <div style={{ width: 320, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(255,107,74,0.06)", boxShadow: "inset 0 0 0 1.5px rgba(255,107,74,0.30)" }}>
      <div><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: INK }}>24 Willow Close</p><p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>Ashford, TN23 4AB</p></div>
      <Pill glass tone="brand" size="sm" style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Your file</Pill>
    </div>
  );
}
function NodeAfter() {
  return (
    <div style={{ width: 320, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#fff", boxShadow: `inset 0 0 0 1.5px rgba(255,107,74,0.45)` }}>
      <div><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: INK }}>24 Willow Close</p><p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>Ashford, TN23 4AB</p></div>
      <Pill tone="brand" size="sm">Your file</Pill>
    </div>
  );
}

// ── 5. Outsourced banner ───────────────────────────────────────────────────────
function OutBefore() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 12, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.30)", maxWidth: 420 }}>
      <span style={{ color: "#B7791F", flexShrink: 0 }}>⚠</span>
      <p style={{ margin: 0, fontSize: 12.5, color: "#8a5a00", lineHeight: 1.5 }}>This sale will be sent to your progression team to run.</p>
    </div>
  );
}
function OutAfter() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,0.66)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: `1px solid ${LINE}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)", maxWidth: 420 }}>
      <span style={{ color: "#C97D1A", flexShrink: 0, display: "flex" }}>⚠</span>
      <p style={{ margin: 0, fontSize: 12.5, color: INK, lineHeight: 1.5 }}>This sale will be sent to your progression team to run.</p>
    </div>
  );
}

// ── 6. Status pills ────────────────────────────────────────────────────────────
function PillsBefore() {
  return <div style={{ display: "flex", gap: 8 }}><Pill glass tone="warning" size="sm" style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Needed</Pill><Pill glass tone="brand" size="sm" style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Your file</Pill></div>;
}
function PillsAfter() {
  return <div style={{ display: "flex", gap: 8 }}><Pill tone="warning" size="sm">Needed</Pill><Pill tone="brand" size="sm">Your file</Pill></div>;
}

// ── Scaffold ───────────────────────────────────────────────────────────────────
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

export default function ChainSectionAuditPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EF", color: "#20242E", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 120px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · audit · part 3</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>Chain section &amp; the rest</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 740 }}>
            The whole chain block is old slop — glossy gradients + faded coral fills. Plus the outsourced banner and the caps status pills. Each <strong style={{ color: CORAL }}>After</strong> is live: step the position selector, press the buttons.
          </p>
        </header>

        <Item n={1} title="Chain prompt — “Is this sale part of a chain?”" verdict="exists" maps="AgentBanner + Button"
          note="Glossy gradient icon chip + glossy “Yes” button. Canonical: neutral surface, coral carried by the icon, flat-coral primary + ghost."
          before={<PromptBefore />} after={<PromptAfter />} />

        <Item n={2} title="Position selector — Top / Middle / Bottom / Not sure" verdict="exists" maps="SegmentedControl"
          note="The active option is the glossy coral gradient. The canonical SegmentedControl — gliding coral pill, same as the top-bar All/Mine. Click through it."
          before={<PosBefore />} after={<PosAfter />} />

        <Item n={3} title="Add-above / Add-below slot" verdict="new"
          note="A faded coral-fill button. An “add node” affordance should read as an outline/dashed invitation, not a filled button — coral text + icon, coral border on hover, no wash. A rail-add-slot primitive."
          before={<SlotBefore />} after={<SlotAfter />} />

        <Item n={4} title="Chain node card (“Your file”)" verdict="new"
          note="Faded coral wash + coral ring. Per the no-fills rule, drop the wash and keep the coral ring as the accent on a neutral card; the “Your file” pill carries the identity. A chain-node-card primitive."
          before={<NodeBefore />} after={<NodeAfter />} />

        <Item n={5} title="Outsourced banner" verdict="exists" maps="AgentBanner"
          note="A faded amber-fill notice. Canonical banner recipe: neutral frosted surface, the amber carried only by the icon."
          before={<OutBefore />} after={<OutAfter />} />

        <Item n={6} title="Status pills — “Needed”, “Your file”" verdict="exists" maps="Pill"
          note="Caps + 700 + tracking overrides on the canonical Pill. Drop the overrides — the Pill is normal-case, tone-driven."
          before={<PillsBefore />} after={<PillsAfter />} />

        <section style={{ borderTop: "1px solid #e7e2db", paddingTop: 26, marginTop: 8 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 650 }}>Summary</h3>
          <p style={{ margin: 0, fontSize: 13.5, color: "#6b6258", lineHeight: 1.7, maxWidth: 760 }}>
            <strong style={{ color: "#1f6f4a" }}>4 align to existing canonicals</strong> (prompt → AgentBanner + Button · position → SegmentedControl · outsourced → AgentBanner · pills → Pill).
            <br /><strong style={{ color: "#8a5a00" }}>2 new canonicals</strong> (rail add-slot · chain node card).
            The chain section is shared with the file page, so these land there too — approve and I&apos;ll apply + catalogue, one at a time.
          </p>
        </section>
      </div>
    </div>
  );
}
