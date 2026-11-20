"use client";
// Design-system comparison — apply the canonicals to the create & sign-in pages.
// Three stacked before/afters: (1) the register step-progress animation, (2) the
// password-strength canonical (word at the end + a Too-short state), and (3) the
// cookie banner's toggle reconciled from arc Switch to our LiquidToggle.
// Dev-only; nothing writes data.

import { notFound } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import { Switch } from "@/components/arc/switch/switch";
import "@/components/arc/cookie-consent/scope.css";

const CORAL = "#FF6B4A";
const INK = "#2D1810";

function Controls({ onPlay, onReset, playing }: { onPlay: () => void; onReset: () => void; playing: boolean }) {
  const btn = { fontSize: 12, fontWeight: 600, padding: "6px 13px", borderRadius: 8, border: "1px solid rgba(23,23,30,0.16)", background: "#fff", color: INK, cursor: "pointer" } as const;
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
      <button type="button" onClick={onPlay} disabled={playing} style={{ ...btn, opacity: playing ? 0.45 : 1, cursor: playing ? "default" : "pointer" }}>{playing ? "Playing…" : "▶ Play"}</button>
      <button type="button" onClick={onReset} style={btn}>Reset</button>
    </div>
  );
}

function Col({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a938a" }}>{tag}</span>
      <div style={{ display: "grid", placeItems: "center", minHeight: 64 }}>{children}</div>
    </div>
  );
}
function BeforeAfter({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 44, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>
      <Col tag="Before — today">{before}</Col>
      <Col tag="After — canonical">{after}</Col>
    </div>
  );
}
function Section({ eyebrow, title, note, children }: { eyebrow: string; title: string; note: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 46, paddingBottom: 46, borderBottom: "1px solid rgba(45,24,16,0.08)" }}>
      <div style={{ marginBottom: 22 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>{eyebrow}</span>
        <h2 style={{ margin: "6px 0 5px", fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: INK }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#6b6258", lineHeight: 1.55, maxWidth: 680 }}>{note}</p>
      </div>
      {children}
    </section>
  );
}

/* 1 — Step progress: colour-fade (today) vs sequential fill (canonical). */
function StepperCompare() {
  const [done, setDone] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const clear = () => { if (timer.current) { window.clearInterval(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  const play = () => { clear(); setDone(0); setPlaying(true); let n = 0; timer.current = window.setInterval(() => { n += 1; setDone(n); if (n >= 2) { clear(); setPlaying(false); } }, 700); };
  const reset = () => { clear(); setPlaying(false); setDone(0); };
  return (
    <>
      <BeforeAfter
        before={<div style={{ display: "flex", gap: 8, width: 300 }}>{[0, 1].map((i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i < done ? CORAL : "rgba(32,36,46,0.12)", transition: "background 0.3s ease" }} />)}</div>}
        after={<div style={{ display: "flex", gap: 8, width: 300 }}>{[0, 1].map((i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: "rgba(32,36,46,0.12)", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 999, background: CORAL, transformOrigin: "left", transform: i < done ? "scaleX(1)" : "scaleX(0)", transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1)" }} /></div>)}</div>}
      />
      <Controls onPlay={play} onReset={reset} playing={playing} />
    </>
  );
}

/* 2 — Password strength: word under the bar (today) vs word at the end + a
   Too-short state (canonical). */
const PW = [
  { seg: 1, color: "#C0334A", word: "Too short", below: null },
  { seg: 1, color: "#D9682F", word: "Weak", below: "Weak" },
  { seg: 2, color: "#E0942E", word: "Fair", below: "Fair" },
  { seg: 3, color: "#6FA03A", word: "Good", below: "Good" },
  { seg: 4, color: "#2F9E6B", word: "Strong", below: "Strong" },
];
function Bars({ color, seg }: { color: string; seg: number }) {
  return <div style={{ display: "flex", gap: 4, flex: 1 }}>{[0, 1, 2, 3].map((i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < seg ? color : "rgba(61,31,14,0.12)", transition: "background 0.25s ease" }} />)}</div>;
}
function PasswordCompare() {
  const [lvl, setLvl] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const clear = () => { if (timer.current) { window.clearInterval(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  const play = () => { clear(); setLvl(0); setPlaying(true); let n = 0; timer.current = window.setInterval(() => { n += 1; setLvl(n); if (n >= PW.length - 1) { clear(); setPlaying(false); } }, 650); };
  const reset = () => { clear(); setPlaying(false); setLvl(0); };
  const L = PW[lvl];
  return (
    <>
      <BeforeAfter
        before={
          <div style={{ width: 260 }}>
            <Bars color={L.color} seg={L.seg} />
            <p style={{ fontSize: 11, color: L.below ? L.color : "transparent", margin: "5px 0 0", fontWeight: 500, minHeight: 15 }}>{L.below ? `Password strength: ${L.below}` : " "}</p>
          </div>
        }
        after={
          <div style={{ width: 300, display: "flex", alignItems: "center", gap: 14 }}>
            <Bars color={L.color} seg={L.seg} />
            <span style={{ fontSize: 12, fontWeight: 600, color: L.color, minWidth: 62, textAlign: "right", transition: "color 0.25s ease" }}>{L.word}</span>
          </div>
        }
      />
      <Controls onPlay={play} onReset={reset} playing={playing} />
    </>
  );
}

/* 3 — Cookie toggle: arc Switch (came in with the banner) vs our LiquidToggle. */
function LiquidRow() { const [on, setOn] = useState(true); return <LiquidToggle checked={on} onChange={setOn} width={44} height={24} />; }
const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, width: 300, background: "#fff", border: "1px solid rgba(23,23,30,0.08)", borderRadius: 12, padding: "12px 14px" } as const;
function ToggleCompare() {
  return (
    <BeforeAfter
      before={<div className="arc-scope" style={row}><span style={{ fontSize: 13, color: INK }}>Analytics cookies</span><Switch defaultChecked /></div>}
      after={<div style={row}><span style={{ fontSize: 13, color: INK }}>Analytics cookies</span><LiquidRow /></div>}
    />
  );
}

export default function RegisterCanonicalCompare() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EF", color: INK, fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 120px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ marginBottom: 40 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · comparison</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em" }}>Apply the canonicals</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 640 }}>Three changes to the sign-up / sign-in pages, stacked. Hit <strong>Play</strong> where there&rsquo;s motion. Approve all three and I&rsquo;ll apply them to production.</p>
        </header>

        <Section eyebrow="01 · Register" title="Step progress — sequential fill" note="Today the two segments just fade colour as you advance. The canonical fills them one after another (left to right), the arc Stepper's motion applied to our bar.">
          <StepperCompare />
        </Section>
        <Section eyebrow="02 · Register" title="Password strength — word at the end + Too-short" note="Today the strength word sits under the bar and there's no Too-short state. The canonical moves the word to the end of the bar and adds a Too-short level, matching the DS entry.">
          <PasswordCompare />
        </Section>
        <Section eyebrow="03 · Cookie banner" title="Toggle — reconcile to LiquidToggle" note="Adopting the cookie banner verbatim pulled in the arc Switch, which differs from our LiquidToggle used everywhere else. The canonical swaps it to LiquidToggle so there's one toggle app-wide.">
          <ToggleCompare />
        </Section>
      </div>
    </div>
  );
}
