"use client";
// Design-system comparison — the agent-app eyebrow (.agent-eyebrow), shown in
// real contexts both ways so the global flip can be judged before it ships.
//   Current  — caps · 500 · 0.05em (what every agent-app section label is today)
//   Sentence — sentence case · 600 · no tracking (the canonical decision)
// This is the blast radius: Hub, file overview, reminders, documents — every one
// of these labels flips at once. Dev-only, nothing is changed here.

import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

const INK = "#20242E";
const MUTED = "rgba(45,24,16,0.55)";
const LINE = "rgba(45,24,16,0.10)";
const CORAL = "#FF6B4A";
const GREEN = "#1f9d6b";

function eyebrow(sentence: boolean): CSSProperties {
  return sentence
    ? { margin: 0, fontSize: 10.5, fontWeight: 600, letterSpacing: 0, textTransform: "none", color: MUTED, lineHeight: 1.2 }
    : { margin: 0, fontSize: 10, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: MUTED, lineHeight: 1.2 };
}

// A real card from the file overview, rendered with a given eyebrow treatment.
function Card({ sentence, label, icon, iconColor, children }: { sentence: boolean; label: string; icon: string; iconColor: string; children: ReactNode }) {
  return (
    <div style={{ width: 300, padding: 16, borderRadius: 16, background: "#fff", border: `1px solid ${LINE}`, boxShadow: "0 1px 3px rgba(30,20,15,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: iconColor, fontSize: 14 }}>{icon}</span>
          <p style={eyebrow(sentence)}>{label}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Stack({ sentence }: { sentence: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card sentence={sentence} label="Next action" icon="🔥" iconColor={CORAL}>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: INK }}>Chase: Search results received</p>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>Waiting on: Seller&rsquo;s solicitor has received initial enquiries.</p>
      </Card>
      <Card sentence={sentence} label="Sale health" icon="♥" iconColor={GREEN}>
        {[["Time on file", "Under a minute"], ["Stage", "Conveyancing"], ["Risk level", "Low"]].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
            <span style={{ color: MUTED }}>{k}</span><span style={{ color: INK, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </Card>
      {/* Bare section labels, the kind seen across Hub / Documents / Reminders */}
      <div style={{ display: "flex", flexDirection: "column", gap: 11, padding: "4px 2px" }}>
        {["Documents", "Reminders", "People on this sale", "Recent activity"].map((l) => <p key={l} style={eyebrow(sentence)}>{l}</p>)}
      </div>
    </div>
  );
}

function Column({ tag, title, note, recommended, children }: { tag: string; title: string; note: string; recommended?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: recommended ? CORAL : "#9a938a" }}>{tag}{recommended ? " · recommended" : ""}</span>
        <h2 style={{ margin: "4px 0 2px", fontSize: 15, fontWeight: 650, color: INK }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 12, color: "#6b6258", maxWidth: 300 }}>{note}</p>
      </div>
      <div style={{ borderRadius: 18, padding: 20, background: "#faf8f5", border: recommended ? `1.5px solid ${CORAL}` : "1px solid rgba(45,24,16,0.08)" }}>{children}</div>
    </div>
  );
}

export default function AgentEyebrowComparePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EF", color: INK, fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 100px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <header style={{ marginBottom: 36 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · comparison</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 28, fontWeight: 680, letterSpacing: "-0.02em" }}>Agent-app eyebrow — global flip</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 640 }}>
            <code>.agent-eyebrow</code> labels <strong>every</strong> card and section in the agent app — Hub, the file overview, reminders, documents, people.
            This is what flipping it to the canonical sentence case looks like across those contexts. It&rsquo;s one CSS change, but it touches the whole app at once.
          </p>
        </header>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>
          <Column tag="Current" title="As it ships" note="caps · 500 · 0.05em"><Stack sentence={false} /></Column>
          <Column tag="Sentence" title="Canonical" note="sentence case · 600 · no tracking" recommended><Stack sentence /></Column>
        </div>
      </div>
    </div>
  );
}
