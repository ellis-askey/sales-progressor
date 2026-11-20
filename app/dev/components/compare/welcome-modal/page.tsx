"use client";
// Design-system before/after — the welcome modal, step 1. Left is the shipped
// modal (cool navy ink, weight-800 type, gradient CTA, bespoke ghost). Right is
// aligned to the canon we built on the auth pages: warm ink, the 600 weight ramp,
// the flat-coral arc primary, the arc ghost at the SAME height, the canonical X,
// and flat-coral icon circles. Both cards are the same size + padding so only the
// treatment differs. Dev-only. Nothing shipped is touched until approved.

import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { House, BellRinging, WarningCircle, Eye, ArrowRight, X } from "@phosphor-icons/react";
import { Button } from "@/components/arc/button/button";
import { WELCOME_STEPS_CSS } from "@/components/agent/welcome-steps-styles";
import "@/components/arc/cookie-consent/scope.css";

const CORAL = "#FF6B4A";
const INK = "#2D1810";
const MUTED = "rgba(45,24,16,0.62)";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties;
const CARD_W = 520;

const FEATURES = [
  { Icon: House, t: "Add a sale. We’ll take it from there.", d: "We’ll map out the journey from offer accepted to completion and keep track of what needs to happen next." },
  { Icon: BellRinging, t: "Let us do the chasing", d: "Buyers, sellers and solicitors are automatically followed up for updates, so you don’t have to keep picking up the phone." },
  { Icon: WarningCircle, t: "Know what needs you", d: "If something’s holding a sale up or needs your attention, we’ll bring it to the surface." },
  { Icon: Eye, t: "Keep clients in the loop", d: "Buyers and sellers can follow their sale from their own portal, with updates along the way. Fewer “any news?” calls for you." },
];

/* ── Current (shipped) — real pw- classes + WELCOME_STEPS_CSS ───────────────── */
function CurrentCard() {
  return (
    <div className="pw-card" data-pw-theme="light" style={{ width: CARD_W, maxWidth: "100%", animation: "none", borderRadius: 16 }}>
      <button className="pw-close" aria-label="Close"><X size={14} weight="bold" /></button>
      <div className="pw-col" style={{ padding: "40px 46px 34px" }}>
        <div className="pw-dots"><span className="pw-dot on" /><span className="pw-dot" /><span className="pw-dot" /></div>
        <div className="pw-stepbody">
          <span className="pw-eyebrow">You&apos;re in</span>
          <h2 className="pw-title">Welcome to TSP, Ellis.</h2>
          <p className="pw-lede">Your workspace is ready. Here&rsquo;s how TSP makes progression easier, then we&rsquo;ll get your first sale set up.</p>
          <ul className="pw-points pw-badges">
            {FEATURES.map((f) => (
              <li key={f.t}>
                <span className="pw-chip"><f.Icon size={24} weight="regular" /></span>
                <span><span className="pw-pt-t">{f.t}</span><span className="pw-pt-d">{f.d}</span></span>
              </li>
            ))}
          </ul>
          <div className="pw-foot">
            <button className="pw-ghost">Skip for now</button>
            <button className="pw-cta">Next: Choose your chases <ArrowRight size={18} weight="bold" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Aligned (proposed) — canon type + arc buttons + canon X + flat chips ───── */
function AlignedCard() {
  return (
    <div className="arc-scope" style={{ width: CARD_W, maxWidth: "100%", background: "#fff", borderRadius: 16, border: "0.5px solid rgba(45,24,16,0.10)", boxShadow: "0 24px 64px rgba(45,24,16,0.16), 0 4px 16px rgba(45,24,16,0.07)", position: "relative", overflow: "hidden", ...coralScope() }}>
      <button aria-label="Close" className="wm-close"><X size={14} weight="bold" /></button>
      <style>{`.wm-close{position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:999px;display:grid;place-items:center;border:0;background:transparent;color:rgba(45,24,16,0.5);cursor:pointer;transition:background .14s ease,color .14s ease}.wm-close:hover{background:rgba(45,24,16,0.07);color:${INK}}`}</style>
      <div style={{ padding: "40px 46px 34px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
          <span style={{ height: 6, width: 20, borderRadius: 999, background: CORAL }} />
          <span style={{ height: 6, width: 6, borderRadius: 999, background: "rgba(45,24,16,0.14)" }} />
          <span style={{ height: 6, width: 6, borderRadius: 999, background: "rgba(45,24,16,0.14)" }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: CORAL }}>You&apos;re in</span>
        <h2 style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15, color: INK }}>Welcome to TSP, Ellis.</h2>
        <p style={{ margin: "11px 0 0", fontSize: 14, lineHeight: 1.6, color: MUTED }}>Your workspace is ready. Here&rsquo;s how TSP makes progression easier, then we&rsquo;ll get your first sale set up.</p>

        <ul style={{ listStyle: "none", margin: "22px 0 0", padding: 0, display: "flex", flexDirection: "column" }}>
          {FEATURES.map((f, i) => (
            <li key={f.t} style={{ display: "flex", gap: 15, alignItems: "flex-start", padding: "14px 0", borderTop: i === 0 ? "0" : "0.5px solid rgba(45,24,16,0.10)" }}>
              <span style={{ flexShrink: 0, width: 42, height: 42, borderRadius: "50%", background: CORAL, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 5px 14px rgba(255,107,74,0.30)" }}>
                <f.Icon size={20} weight="regular" />
              </span>
              <span>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: INK }}>{f.t}</span>
                <span style={{ display: "block", marginTop: 3, fontSize: 13, lineHeight: 1.5, color: MUTED }}>{f.d}</span>
              </span>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 26, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Button type="button" variant="ghost" size="lg">Skip for now</Button>
          <Button type="button" variant="primary" size="lg" style={coralVars}>
            Next: Choose your chases
            <ArrowRight size={18} weight="bold" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function coralScope(): CSSProperties {
  return { "--control-on": CORAL } as CSSProperties;
}

function Col({ tag, title, children }: { tag: string; title: string; children: ReactNode }) {
  const current = tag.toLowerCase() === "current";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 9px", borderRadius: 999, color: current ? "#9a8d84" : INK, background: current ? "rgba(45,24,16,0.06)" : "rgba(255,107,74,0.14)" }}>{tag}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

const CHANGES: [string, string][] = [
  ["Ink", "Cool navy #0F1B2D / grey #54617d → warm #2D1810 / rgba(45,24,16,·), matching the auth pages."],
  ["Weights", "Title + eyebrow drop from 800 (off our ramp) to 600; feature titles 700 → 600."],
  ["Title", "25px / -0.5px → 28px / -0.01em — the same hero as “Create your account”."],
  ["Eyebrow", "11.5px / 800 / 0.14em → 10px / 600 / 0.1em (coral kept)."],
  ["Primary", "Gradient pill (cta-from→cta-to, translateY hover) → the flat-coral arc Button, size lg."],
  ["Skip", "Bespoke 13.5px text → the arc ghost Button at size lg — the SAME 48px height as the primary."],
  ["Icon circles", "Coral gradient → flat coral #FF6B4A (one coral, like the radio + buttons)."],
  ["Close (X)", "26px bespoke → the canonical 30px X (warm muted, tint on hover)."],
  ["Animation", "Unchanged — keeps agent-modal-in (240ms) / welcome-zoom-out, drawer slide < 1200px, step cross-fade."],
];

export default function WelcomeModalCompare() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#F1EEEA", color: INK, fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 140px" }}>
      <style dangerouslySetInnerHTML={{ __html: WELCOME_STEPS_CSS }} />
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ marginBottom: 36 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · before / after</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em" }}>Welcome modal — step 1</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 720 }}>
            The first modal, proposed as the canonical modal. Both cards are the same size and padding, so only the treatment differs. The CSS is shared by the self-managed <em>and</em> progressor welcomes across all three steps — so this is previewed before anything shipped is touched.
          </p>
        </header>

        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>
          <Col tag="Current" title="Shipped"><CurrentCard /></Col>
          <Col tag="Proposed" title="Aligned to canon"><AlignedCard /></Col>
        </div>

        <section style={{ marginTop: 56, maxWidth: 760, marginInline: "auto" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 600, color: INK }}>What changes</h2>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6b6258" }}>Functionality, copy, steps and the open/close behaviour are untouched — this is type, colour and which buttons are used.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {CHANGES.map(([k, v]) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 14, alignItems: "baseline", paddingBottom: 10, borderBottom: "1px solid rgba(45,24,16,0.08)" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{k}</span>
                <span style={{ fontSize: 13, color: "#6b6258", lineHeight: 1.5 }}>{v}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
