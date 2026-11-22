"use client";

// EmailSetupPrompt — the one C-audit drift. The hub's dismissible "send from your own
// address" nudge is a GlassCard in an agent-canon-cta scope (so its primary is already
// the canonical flat-coral). But three controls are still hand-rolled inline instead of
// the canonicals that exist for exactly them. Left = shipped, byte-for-byte from
// components/agent/EmailSetupPrompt.tsx. Right = the same card with those three swapped
// to canon. Nothing else moves. Dev-only, read-only.

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { X, Envelope, ArrowRight } from "@phosphor-icons/react";
import { buttonClasses } from "@/components/arc/button/button";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";

function Pane({ side, children }: { side: "current" | "proposed"; children: ReactNode }) {
  const isP = side === "proposed";
  return (
    <div style={{ flex: "1 1 360px", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{isP ? "Proposed — canonical" : "Current — shipped (byte-for-byte)"}</span>
      <div style={{ borderRadius: 16, padding: 20, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)", minHeight: 56 }}>{children}</div>
    </div>
  );
}
function Block({ n, title, note, current, proposed }: { n: string; title: string; note: ReactNode; current: ReactNode; proposed: ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "24px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.5, maxWidth: 880 }}>{note}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current">{current}</Pane>
        <Pane side="proposed">{proposed}</Pane>
      </div>
    </section>
  );
}

/* ----- The shipped card, reproduced verbatim from EmailSetupPrompt.tsx (hover states shown resting). ----- */
function CurrentCard() {
  return (
    <div className="agent-canon-cta" style={{ display: "flex", gap: 14, alignItems: "flex-start", borderRadius: "var(--agent-radius-lg, 16px)", padding: "16px 18px", background: "var(--agent-surface, #fff)", border: "1px solid var(--agent-border-subtle)", boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}>
      <span style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 9, background: "rgba(255,107,74,0.10)", color: "#FF6B4A" }}><Envelope size={17} weight="fill" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>Send emails from your own address</p>
        <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>Connect your agency email and client updates will come directly from you, keeping everything familiar, trusted and under your brand.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a className="agent-btn agent-btn-primary agent-btn-sm" style={{ textDecoration: "none" }}>Set up my email</a>
          {/* hand-rolled ghost */}
          <button type="button" style={{ display: "inline-flex", alignItems: "center", height: 32, padding: "0 12px", borderRadius: "var(--agent-radius-md, 10px)", fontSize: 14, fontWeight: 500, color: "var(--agent-text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>Not now</button>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
          Want to change what those emails say?{" "}
          {/* hand-rolled coral link */}
          <a style={{ color: "#FF6B4A", fontWeight: 600, textDecoration: "none" }}>Personalise your client emails</a>
        </p>
      </div>
      {/* hand-rolled 30px round close */}
      <button type="button" aria-label="Dismiss" style={{ width: 30, height: 30, borderRadius: 999, border: "none", background: "transparent", cursor: "pointer", color: "var(--agent-text-muted)", display: "grid", placeItems: "center", flexShrink: 0 }}><X size={14} /></button>
    </div>
  );
}

/* ----- The same card, three controls swapped to canon. Everything else identical. ----- */
function ProposedCard() {
  return (
    <div className="agent-canon-cta" style={{ display: "flex", gap: 14, alignItems: "flex-start", borderRadius: "var(--agent-radius-lg, 16px)", padding: "16px 18px", background: "var(--agent-surface, #fff)", border: "1px solid var(--agent-border-subtle)", boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}>
      <span style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 9, background: "rgba(255,107,74,0.10)", color: "#FF6B4A" }}><Envelope size={17} weight="fill" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>Send emails from your own address</p>
        <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>Connect your agency email and client updates will come directly from you, keeping everything familiar, trusted and under your brand.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a className="agent-btn agent-btn-primary agent-btn-sm" style={{ textDecoration: "none" }}>Set up my email</a>
          {/* canon ghost */}
          <button type="button" className={buttonClasses({ variant: "ghost", size: "sm" })}>Not now</button>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
          Want to change what those emails say?{" "}
          {/* canon .agent-link */}
          <a className="agent-link" style={{ fontWeight: 600 }}>Personalise your client emails</a>
        </p>
      </div>
      {/* canon .agent-icon-btn */}
      <button type="button" className="agent-icon-btn agent-icon-btn-md" aria-label="Dismiss"><X size={14} weight="bold" /></button>
    </div>
  );
}

export default function EmailSetupPromptComparePage() {
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
    ["--compare-pane" as string]: theme === "dark" ? "rgba(255,255,255,0.03)" : "#faf8f5",
    ["--compare-bg" as string]: theme === "dark" ? "#17140f" : "#F4F2EF",
  };
  const toggle = (a: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: a ? CORAL : "transparent", color: a ? "#fff" : "var(--compare-body)" });

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme === "light" ? "sunset" : "dark"} style={{ ...vars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={toggle(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggle(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Compare · hub · email-setup nudge</span>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "22px 24px 80px" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "var(--compare-ink)" }}>Email-setup nudge — three controls to canon</h1>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 900 }}>
          The card already sits in an <code>agent-canon-cta</code> scope, so its <strong>primary</strong> is the canonical flat-coral and stays untouched. Three controls are still hand-rolled inline where a canonical exists for exactly them. The proposal swaps those three; the copy, layout, glass, icon badge and primary are byte-for-byte identical. Behaviour (dismiss, links, self-gating) is unchanged.
        </p>

        <Block
          n="full"
          title="The whole card — before / after"
          note="Resting state (no hover). Spot the dismiss ✕ (top-right), the “Not now” control, and the coral text link."
          current={<CurrentCard />}
          proposed={<ProposedCard />}
        />

        <Block
          n="1"
          title="Dismiss ✕ → .agent-icon-btn"
          note={<>Current: a bespoke 30px round button with its own hover-shade logic in component state. Proposed: the canonical <code>.agent-icon-btn</code> — the one ✕ used by modals and the cookie panel, with its hover built in. Same size, same resting look; the hover now matches every other close in the app.</>}
          current={<div style={{ display: "inline-flex", padding: 8 }}><button type="button" aria-label="Dismiss" style={{ width: 30, height: 30, borderRadius: 999, border: "none", background: "transparent", cursor: "pointer", color: "var(--agent-text-muted)", display: "grid", placeItems: "center" }}><X size={14} /></button></div>}
          proposed={<div style={{ display: "inline-flex", padding: 8 }}><button type="button" className="agent-icon-btn agent-icon-btn-md" aria-label="Dismiss"><X size={14} weight="bold" /></button></div>}
        />

        <Block
          n="2"
          title="“Not now” → canon ghost button"
          note={<>Current: an inline button with hand-managed hover colour + background. Proposed: the arc <code>ghost</code> at <code>sm</code> — the same quiet control used elsewhere, hover and focus states for free.</>}
          current={<button type="button" style={{ display: "inline-flex", alignItems: "center", height: 32, padding: "0 12px", borderRadius: 10, fontSize: 14, fontWeight: 500, color: "var(--agent-text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>Not now</button>}
          proposed={<button type="button" className={buttonClasses({ variant: "ghost", size: "sm" })}>Not now</button>}
        />

        <Block
          n="3"
          title="Coral link → .agent-link"
          note={<>Current: an inline <code>&lt;Link&gt;</code> with hard-coded <code>#FF6B4A</code> → <code>#E55B3D</code> and <strong>no hover underline</strong> — this is the one coral link in the app without it. Proposed: <code>.agent-link</code>, the shared coral-link language. Rest state identical; on <em>hover</em> it gains the app-standard spreading underline + darken that every other coral link already has. That hover change is the decision — align it to match the rest, or grandfather this link&apos;s bespoke no-underline hover.</>}
          current={<span style={{ fontSize: 12.5, color: "var(--agent-text-muted)" }}>Want to change what those emails say? <a style={{ color: "#FF6B4A", fontWeight: 600, textDecoration: "none" }}>Personalise your client emails</a></span>}
          proposed={<span style={{ fontSize: 12.5, color: "var(--agent-text-muted)" }}>Want to change what those emails say? <a className="agent-link" style={{ fontWeight: 600 }}>Personalise your client emails</a></span>}
        />
      </div>
    </div>
  );
}
