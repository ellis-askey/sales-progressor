"use client";
// Design-system comparison — Eyebrow / section-label treatment.
//
// The same real section labels (memo scan columns, fact tiles, research results)
// rendered three ways, so the decision is judged as pixels in context, not as a
// hex/weight abstraction:
//   Current   — caps · 700 · 0.08em (shouty; what ships today)
//   Refined   — caps · 600 · 0.04em (the documented canon, quieter)
//   Sentence  — sentence case · 600 (recommended — warm, human, still a label)
// Nothing here writes data or touches production. Dev-only.

import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

const CORAL = "#FF6B4A";
const INK = "#2D1810";
const MUTED = "rgba(45,24,16,0.55)";
const LABEL = "rgba(45,24,16,0.5)";

type Tr = "current" | "refined" | "sentence";

function eyebrow(tr: Tr): CSSProperties {
  if (tr === "current") return { margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: LABEL };
  if (tr === "refined") return { margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: LABEL };
  return { margin: 0, fontSize: 11.5, fontWeight: 600, letterSpacing: "0", textTransform: "none", color: LABEL };
}

function Eb({ tr, children }: { tr: Tr; children: string }) {
  return <p style={eyebrow(tr)}>{children}</p>;
}

function PendDot() {
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,107,74,0.55)", boxShadow: "0 0 0 3px rgba(255,107,74,0.10)", flexShrink: 0 }} />;
}

// One context card rendered with a given eyebrow treatment.
function ContextBlock({ tr }: { tr: Tr }) {
  const tile = (label: string, children: ReactNode) => (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(45,24,16,0.08)" }}>
      <div style={{ marginBottom: 4 }}><Eb tr={tr}>{label}</Eb></div>
      {children}
    </div>
  );
  const saleRow = (a: string, p: string, d: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(45,24,16,0.08)" }}>
      <span style={{ fontSize: 12, color: INK, fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: INK, flexShrink: 0 }}>{p}</span>
      <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{d}</span>
    </div>
  );
  return (
    <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Memo scan columns */}
      <div style={{ padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(45,24,16,0.08)", display: "flex", gap: 18 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Eb tr={tr}>Sale details</Eb>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><PendDot /><span style={{ fontSize: 12, color: INK }}>Address</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><PendDot /><span style={{ fontSize: 12, color: INK }}>Tenure</span></div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Eb tr={tr}>Vendor</Eb>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><PendDot /><span style={{ fontSize: 12, color: INK }}>Vendor details</span></div>
        </div>
      </div>

      {/* Fact tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {tile("Last sold", <>
          <p style={{ margin: "0 0 1px", fontSize: 14, fontWeight: 700, color: INK }}>£473,200</p>
          <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Jan 2026</p>
        </>)}
        {tile("EPC rating", <>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#8dba2d", lineHeight: 1 }}>C</span>
        </>)}
      </div>

      {/* Research results */}
      <div style={{ padding: 18, borderRadius: 14, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(45,24,16,0.08)" }}>
        <div style={{ marginBottom: 2 }}><Eb tr={tr}>Area research · EN11 8AS</Eb></div>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: MUTED, fontStyle: "italic" }}>Postcode-level data. No specific property matched yet.</p>
        <div style={{ marginBottom: 6 }}><Eb tr={tr}>Recent sales nearby</Eb></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {saleRow("53 The Meadway", "£473,200", "Jan 2026")}
          {saleRow("28 The Meadway", "£340,000", "Feb 2025")}
        </div>
      </div>
    </div>
  );
}

function Column({ tag, title, note, recommended, children }: { tag: string; title: string; note: string; recommended?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: recommended ? CORAL : "#9a938a" }}>
          {tag}{recommended ? " · recommended" : ""}
        </span>
        <h2 style={{ margin: "4px 0 2px", fontSize: 15, fontWeight: 650, color: "#20242E" }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 12, color: "#6b6258", maxWidth: 320 }}>{note}</p>
      </div>
      <div style={{ borderRadius: 18, padding: 18, background: "#faf8f5", border: recommended ? `1.5px solid ${CORAL}` : "1px solid rgba(45,24,16,0.08)" }}>
        {children}
      </div>
    </div>
  );
}

export default function EyebrowComparePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EF", color: "#20242E", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 100px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ marginBottom: 36 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · comparison</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 28, fontWeight: 680, letterSpacing: "-0.02em" }}>Eyebrow / section labels</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 680 }}>
            The same real labels — the memo-scan columns, the fact tiles, the research results — rendered three ways, judged in context.
            The shouty feel comes from the <strong>700 weight</strong> and <strong>0.08em</strong> tracking. My pick is
            <strong> sentence case</strong>: it keeps the label reading as structure while matching the product&rsquo;s warm, human voice —
            and it stays quiet through size, weight and colour, not capitals.
          </p>
        </header>

        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>
          <Column tag="Current" title="As it ships" note="caps · 700 · 0.08em"><ContextBlock tr="current" /></Column>
          <Column tag="Refined caps" title="Documented canon" note="caps · 600 · 0.04em — quieter, still uppercase"><ContextBlock tr="refined" /></Column>
          <Column tag="Sentence" title="Warm + human" note="sentence case · 600 · muted" recommended><ContextBlock tr="sentence" /></Column>
        </div>
      </div>
    </div>
  );
}
