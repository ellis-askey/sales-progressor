"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";

/* ─── Design tokens (CSS variable refs — adapt to active data-theme) ────── */
const CORAL   = "var(--agent-coral-deep)";
const AMBER   = "var(--agent-warning)";
const SUCCESS = "var(--agent-success)";
const TP      = "var(--agent-text-primary)";
const TS      = "var(--agent-text-secondary)";
const TM      = "var(--agent-text-muted)";
const BORDER  = "var(--agent-border-default)";
const GLASS   = "var(--agent-glass-bg)";

/* ─── Inline CSS ─────────────────────────────────────────────────────────── */
const CSS = `
  /* reduced-motion override — simulates prefers-reduced-motion */
  [data-rm="1"] *, [data-rm="1"] *::before, [data-rm="1"] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }

  /* ── test-page chrome */
  .pp-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    color: rgba(30,45,74,.45); margin: 52px 0 14px; padding: 9px 16px;
    background: rgba(30,45,74,.05); border-left: 3px solid rgba(30,45,74,.2);
    border-radius: 0 6px 6px 0; font-family: monospace;
  }
  .pp-sub {
    font-size: 11px; color: rgba(30,45,74,.4); font-family: monospace;
    margin: -10px 0 16px; padding-left: 2px;
  }
  .pp-bar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 16px; }
  .pp-bar-label { font-size: 11px; color: rgba(30,45,74,.45); font-family: monospace; white-space: nowrap; }
  .pp-pill { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(30,45,74,.15);
    font-size: 11px; font-weight: 500; cursor: pointer; background: white; color: rgba(30,45,74,.55);
    transition: all 120ms; line-height: 1.4; }
  .pp-pill.on { background: #1E2D4A; color: white; border-color: #1E2D4A; }

  /* ── mobile frame */
  .m-frame { width: 375px; min-height: 200px; border: 1.5px solid rgba(30,45,74,.12);
    border-radius: 16px; overflow: hidden; position: relative;
    background: var(--agent-bg-base); }

  /* accordion — canonical classes now in agent-system.css (.agent-acc / .agent-acc-in) */
  .m-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    color: rgba(30,45,74,.35); margin: 32px 0 7px; font-family: monospace; }
  .m-topbar { display: flex; align-items: center; padding: 12px 16px; gap: 10px;
    background: rgba(255,255,255,0.85); backdrop-filter: blur(28px) saturate(180%);
    border-bottom: 0.5px solid var(--agent-border-default); position: sticky; top: 0; }

  /* ── skeleton bars */
  .sk { background: rgba(30,45,74,.07); border-radius: 5px; }
  .sk-pulse { animation: agent-skeleton-pulse 1.5s ease-in-out infinite; }
  .sk-a1 { animation-delay: 0ms; }
  .sk-a2 { animation-delay: 120ms; }
  .sk-a3 { animation-delay: 240ms; }
  .sk-a4 { animation-delay: 360ms; }
  .sk-a5 { animation-delay: 480ms; }
  .sk-a6 { animation-delay: 600ms; }
  .sk-a7 { animation-delay: 720ms; }

  /* ── field elements */
  .pp-field { display: flex; flex-direction: column; gap: 5px; }
  .pp-flabel { font-size: 12px; font-weight: 600; color: ${TS}; display: flex; align-items: center; gap: 5px; }

  /* ── agent-input: suppress readonly invisibility so mock-filled fields stay visible */
  .agent-input[readonly] {
    background: rgba(255,255,255,0.65) !important;
    border-color: var(--agent-border-default) !important;
    color: var(--agent-text-primary) !important;
    cursor: default;
  }
  .agent-input[readonly]::placeholder { color: var(--agent-text-muted) !important; }

  .pp-finput-pop { border: 1px solid ${BORDER}; border-radius: 8px; padding: 9px 12px; font-size: 13px;
    color: ${TP}; background: rgba(255,255,255,.65); font-family: inherit; width: 100%; box-sizing: border-box;
    font-weight: 500; }
  .pp-fhint { font-size: 11px; }

  /* ── carousel controls (page-specific — not canonical) */
  .carousel-chevron {
    display: flex; align-items: center; justify-content: center;
    background: var(--agent-surface-elevated);
    border: 1px solid var(--agent-border-default);
    border-radius: var(--agent-radius-md);
    color: var(--agent-text-primary);
    font-size: 14px;
    cursor: pointer;
    transition: background var(--agent-transition-fast), border-color var(--agent-transition-fast), transform var(--agent-transition-fast);
  }
  .carousel-chevron:hover:not(:disabled):not([aria-disabled]) {
    background: var(--agent-glass-bg-hover);
    border-color: var(--agent-border-strong);
  }
  .carousel-chevron:focus-visible {
    outline: none;
    box-shadow: var(--agent-focus-ring);
  }
  .carousel-chevron:active:not(:disabled) { transform: scale(0.92); }
  .carousel-chevron:disabled { opacity: 0.35; cursor: not-allowed; }
  [data-rm="1"] .carousel-chevron:active { transform: none; }

  /* ── field indicator */
  .fi { display: inline-block; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .fi-ok   { background: ${SUCCESS}; }
  .fi-warn { background: ${AMBER}; }

  /* ── contact card  */
  .contact-card { background: ${GLASS}; border: 0.5px solid ${BORDER}; border-radius: 10px;
    padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }

  /* ── modal backdrop */
  .pp-backdrop { position: fixed; inset: 0; background: rgba(45,24,16,.18);
    backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000;
    animation: agent-backdrop-in 200ms var(--agent-ease) both; }
  .pp-modal { animation: agent-modal-in 250ms var(--agent-ease) both; }

  /* ── file preview card */
  .fp-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: ${TM}; margin-bottom: 6px; }

  /* ── carousel dots (page-specific) */
  .c-dot { height: 5px; border-radius: 3px; background: var(--agent-border-strong); transition: width 200ms cubic-bezier(.16,1,.3,1), background 150ms ease; cursor: pointer; }
  .c-dot.active { background: ${CORAL}; }
  .c-dot:not(.active):hover { background: var(--agent-text-muted); }

  /* ── hero drop-zone hover (page-specific) */
  .hero-upload-zone { transition: background var(--agent-transition-fast); cursor: pointer; }
  .hero-upload-zone:hover:not([data-drag="true"]) { background: var(--agent-glass-bg-hover) !important; }

  /* ── toast */
  .pp-toast { position: fixed; bottom: 24px; right: 24px; background: ${TP};
    color: white; border-radius: 10px; padding: 12px 18px; font-size: 13px; font-weight: 500;
    animation: agent-toast-in 240ms cubic-bezier(.16,1,.3,1) both;
    box-shadow: 0 8px 24px rgba(45,24,16,.18); z-index: 999; }

  /* ── stage 2 section animate */
  .s2-sec { animation: agent-section-in 360ms cubic-bezier(.16,1,.3,1) both; }
  .s2-s1 { animation-delay: 0ms; }
  .s2-s2 { animation-delay: 80ms; }
  .s2-s3 { animation-delay: 160ms; }
  .s2-s4 { animation-delay: 240ms; }
  .s2-s5 { animation-delay: 320ms; }
`;

/* ─── Local helpers ──────────────────────────────────────────────────────── */

function SL({ id, text, sub }: { id: string; text: string; sub?: string }) {
  return (
    <>
      <p id={id} className="pp-label">{text}</p>
      {sub && <p className="pp-sub">{sub}</p>}
    </>
  );
}

function Ctrl({ label, opts, val, set }: { label: string; opts: { v: string; t: string }[]; val: string; set: (v: string) => void }) {
  return (
    <div className="pp-bar">
      <span className="pp-bar-label">{label}:</span>
      {opts.map(o => (
        <button key={o.v} className={`pp-pill${val === o.v ? " on" : ""}`} onClick={() => set(o.v)}>{o.t}</button>
      ))}
    </div>
  );
}

function Sk({ w, h, delay = 0 }: { w: string | number; h: number; delay?: number }) {
  return <div className={`sk sk-pulse sk-a${Math.min(7, Math.floor(delay / 120) + 1)}`} style={{ width: w, height: h, animationDelay: `${delay}ms`, flexShrink: 0 }} />;
}

function FI({ state }: { state: "ok" | "warn" | "none" }) {
  if (state === "none") return null;
  return <span className={`fi ${state === "ok" ? "fi-ok" : "fi-warn"}`} />;
}

function FieldRow({ label, placeholder, value, hint, hintColor, indicator }: {
  label: string; placeholder?: string; value?: string; hint?: string; hintColor?: string; indicator?: "ok" | "warn";
}) {
  return (
    <div className="pp-field">
      <label className="pp-flabel"><FI state={indicator ?? "none"} />{label}</label>
      {value
        ? <div className="pp-finput-pop">{value}</div>
        : <input className="agent-input" placeholder={placeholder} readOnly />}
      {hint && <p className="pp-fhint" style={{ color: hintColor ?? TM }}>{hint}</p>}
    </div>
  );
}

function Glass({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="agent-glass-strong" style={{ padding: "20px 24px", ...style }}>
      {children}
    </div>
  );
}

function Divider() {
  return <hr style={{ border: "none", borderTop: `0.5px solid ${BORDER}`, margin: "0 -24px" }} />;
}

/* ─── Mockup sub-components ─────────────────────────────────────────────── */

function MockTopbar({ title = "New Sale" }: { title?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px",
      background: "rgba(255,255,255,0.85)", backdropFilter: "blur(28px) saturate(180%)",
      borderBottom: `0.5px solid ${BORDER}` }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--agent-border-subtle)" }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: TP }}>{title}</span>
    </div>
  );
}

function MobileFrame({ children, topbar }: { children: React.ReactNode; topbar?: boolean }) {
  return (
    <>
      <p className="m-label">Mobile — 375px</p>
      <div className="m-frame">
        {topbar && <MockTopbar />}
        <div style={{ padding: "16px 16px 24px" }}>
          {children}
        </div>
      </div>
    </>
  );
}

/* ── A: Loading skeleton components */
function LoadingSkeleton({ mobile }: { mobile?: boolean }) {
  const pad = mobile ? "16px" : "24px";
  return (
    <div className={mobile ? undefined : "new-sale-two-col"}>
      {/* form column skeleton */}
      <div className="new-sale-form-col">
        <div className="agent-glass-strong" style={{ padding: pad, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Sk w={180} h={20} delay={0} />
            <Sk w={260} h={14} delay={120} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Sk w="80%" h={40} delay={240} />
          </div>
          <Sk w="60%" h={40} delay={360} />
          <Sk w={160} h={14} delay={480} />
        </div>
      </div>
      {/* right column skeleton — hidden on mobile via CSS */}
      <div className="new-sale-right-col">
        <div className="agent-glass-strong" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Sk w={120} h={16} delay={0} />
          <Sk w="100%" h={38} delay={120} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <Sk w={180} h={13} delay={200} />
            <Sk w={160} h={13} delay={280} />
            <Sk w={200} h={13} delay={360} />
            <Sk w={150} h={13} delay={440} />
          </div>
          <Sk w={130} h={11} delay={520} />
        </div>
      </div>
    </div>
  );
}

/* ── B: Hero card */
function HeroCard({ variant }: { variant: "nodraft" | "draft" | "drag" }) {
  const isDrag = variant === "drag";
  return (
    <div className="agent-glass-strong hero-upload-zone" data-drag={isDrag ? "true" : undefined} style={{
      padding: "40px 32px", textAlign: "center", display: "flex", flexDirection: "column",
      alignItems: "center", gap: 20,
      background: isDrag ? "var(--agent-coral-bg-tint)" : undefined,
      border: isDrag ? `1.5px dashed ${CORAL}` : undefined,
      transition: "background 200ms, border 200ms",
    }}>
      {/* breathing dot */}
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: CORAL,
        animation: "agent-pulse-dot 2.4s ease-in-out infinite" }} />
      <div>
        {isDrag
          ? <h2 style={{ fontSize: 18, fontWeight: 700, color: CORAL, margin: 0 }}>Drop it here.</h2>
          : <h2 style={{ fontSize: 18, fontWeight: 700, color: TP, margin: 0 }}>Ready to add a sale?</h2>}
        <p style={{ fontSize: 13, color: TM, marginTop: 6, transition: "opacity 200ms", opacity: isDrag ? 0 : 1 }}>
          Drop a memo and we&apos;ll fill the form for you.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 260 }}>
        <button className="agent-btn agent-btn-primary agent-btn-md" style={{ width: "100%" }}>
          Drop a memo of sale
        </button>
        <button className="agent-btn agent-btn-secondary agent-btn-md" style={{ width: "100%" }}>
          Fill in manually
        </button>
      </div>
      {variant === "draft" && (
        <div style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 16, width: "100%", textAlign: "left" }}>
          <p style={{ fontSize: 11, color: TM, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
            Resume
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--agent-border-subtle)", borderRadius: 8, padding: "10px 12px" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: TP, margin: 0 }}>14 Hartwell Avenue, Bristol…</p>
              <p style={{ fontSize: 11, color: TM, margin: 0, marginTop: 2 }}>2h ago</p>
            </div>
            <button className="agent-link" style={{ fontSize: 12 }}>
              Load
            </button>
          </div>
          <button className="agent-link agent-link-muted" style={{ marginTop: 8, fontSize: 12 }}>
            View all drafts (3)
          </button>
        </div>
      )}
    </div>
  );
}

/* ── C: MemoStatusBar */
function MemoStatusBar({ variant, slow }: { variant: "reading" | "done" | "missing" | "error"; slow?: boolean }) {
  const borderColor = variant === "reading" ? CORAL : variant === "done" ? SUCCESS : AMBER;
  const fields = ["Address", "Purchase price", "Tenure", "Vendor details", "Purchaser details", "Vendor solicitor", "Purchaser solicitor"];
  return (
    <div className="agent-glass-strong" style={{ borderTop: `3px solid ${borderColor}`, padding: "16px 20px" }}>
      {variant === "reading" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: slow ? 10 : 14 }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${CORAL}`,
              borderTopColor: "transparent", animation: "agent-spin .7s linear infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: TP }}>
              {/* OLD: "Reading your memo…" */}
              Reading your memo…
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {fields.map((f, i) => (
              <span key={f} style={{ fontSize: 11, color: i < 3 ? SUCCESS : TM, display: "flex", alignItems: "center", gap: 4 }}>
                {i < 3 && "✓ "}{f}
              </span>
            ))}
          </div>
          {slow && (
            <p style={{ fontSize: 12, color: TM, marginTop: 10, marginBottom: 0 }}>
              {/* OLD: "Taking longer than expected — cancel and fill manually?" */}
              Still reading — <button className="agent-link" style={{ fontSize: "inherit" }}>cancel and fill manually</button>?
            </p>
          )}
        </>
      )}
      {variant === "done" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, color: SUCCESS }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: TP }}>Memo read · all fields filled</span>
          </div>
          <button className="agent-link" style={{ fontSize: 12 }}>
            Change file
          </button>
        </div>
      )}
      {variant === "missing" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16, color: AMBER }}>⚠</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: TP }}>Memo read · 2 fields need attention</span>
            </div>
            <button className="agent-link" style={{ fontSize: 12 }}>
              Change file
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Purchase type", "Vendor details"].map(f => (
              <button key={f} className="agent-segment-pill agent-segment-pill-sm"
                style={{ background: "var(--agent-warning-bg)", border: `1px solid ${AMBER}`, color: AMBER }}>
                {f}
              </button>
            ))}
          </div>
        </>
      )}
      {variant === "error" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, color: AMBER }}>⚠</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: TP }}>
            {/* OLD: "Couldn't read the memo — fill in the form below" */}
            Couldn&apos;t read this memo — fill in below
          </span>
        </div>
      )}
    </div>
  );
}

/* ── D: Stage 1 fields */
function Stage1Fields({ mode }: { mode: "self" | "outsourced" }) {
  return (
    <Glass style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Who progresses */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: TS, marginBottom: 10 }}>Who will progress this file?</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className={`agent-segment-pill${mode === "self" ? " on" : ""}`}>
            Self-progress
            <span className="agent-segment-pill-note">You manage this file yourself</span>
          </button>
          <button className={`agent-segment-pill${mode === "outsourced" ? " on" : ""}`}>
            Send to us
            {/* OLD: "Hand off to the progression team" */}
            <span className="agent-segment-pill-note">Our team takes it from here</span>
          </button>
        </div>
      </div>
      <Divider />
      {/* Address */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: TS, margin: 0 }}>Property address</p>
          <button className="agent-link" style={{ fontSize: 12 }}>
            Look up this property
          </button>
        </div>
        <FieldRow label="Street address" placeholder="e.g. 14 Hartwell Avenue" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldRow label="City / Town" placeholder="e.g. Bristol" />
          <FieldRow label="Postcode" placeholder="e.g. BS6 7TH" />
        </div>
      </div>
      <Divider />
      {/* Tenure */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: TS, marginBottom: 10 }}>Tenure</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="agent-segment-pill on">
            Freehold
            <span className="agent-segment-pill-note">Management pack not required</span>
          </button>
          <button className="agent-segment-pill">
            Leasehold
            <span className="agent-segment-pill-note">Management pack required</span>
          </button>
        </div>
      </div>
      <Divider />
      {/* Purchase type */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: TS, margin: 0 }}>Purchase type</p>
          {/* OLD: annotation "not on memos" — removed */}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="agent-segment-pill on">
            Mortgage
            {/* OLD: "All mortgage milestones apply" */}
            <span className="agent-segment-pill-note">All steps included</span>
          </button>
          <button className="agent-segment-pill">
            Cash
            {/* OLD: "Mortgage milestones not required" */}
            <span className="agent-segment-pill-note">Mortgage steps not needed</span>
          </button>
          <button className="agent-segment-pill">
            Cash from Proceeds
            <span className="agent-segment-pill-note">Mortgage + deposit not required</span>
          </button>
        </div>
      </div>
      <Divider />
      {/* Continue gate */}
      <div>
        <p style={{ fontSize: 12, color: TM, marginBottom: 10 }}>
          {/* OLD: "That's enough to create the file — continue to add contacts and details" */}
          Address, tenure and purchase type are set — add contacts and details
        </p>
        <button className="agent-btn agent-btn-primary agent-btn-md" style={{ width: "100%" }}>
          Continue — add contacts &amp; details
        </button>
      </div>
    </Glass>
  );
}

/* ── E: Stage 1 summary bar */
function SummaryBar({ mode }: { mode: "self" | "outsourced" }) {
  return (
    <div className="agent-glass-strong" style={{ padding: "12px 20px", display: "flex", alignItems: "center",
      gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: TP, flex: 1, minWidth: 140 }}>
        14 Hartwell Avenue, Bristol BS6 7TH
      </span>
      <span className="agent-segment-pill agent-segment-pill-sm">Freehold</span>
      <span className="agent-segment-pill agent-segment-pill-sm">Mortgage</span>
      <button className="agent-segment-pill agent-segment-pill-sm on" style={{ borderRadius: 20, fontSize: 12 }}>
        {mode === "self" ? "Self-progress ⇄" : "Send to us ⇄"}
      </button>
      <button className="agent-link agent-link-muted" style={{ fontSize: 12 }}>Edit</button>
    </div>
  );
}

/* ── Contact carousel */
function ContactCarousel({ variant, party, outsourced }: {
  variant: "empty-agent" | "empty-outsourced" | "single" | "carousel";
  party: "vendor" | "purchaser";
  outsourced?: boolean;
}) {
  const label = party === "vendor" ? "Vendors" : "Purchasers";
  const singular = party === "vendor" ? "vendor" : "purchaser";
  return (
    <div className="agent-glass-strong" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: TP }}>{label}</span>
          <span className="agent-segment-pill agent-segment-pill-sm"
            style={outsourced ? { background: "var(--agent-warning-bg)", color: AMBER, border: `1px solid ${AMBER}` } : undefined}>
            {/* OLD: "Needed" (outsourced), "Optional" (self-progress) */}
            {outsourced ? "Required" : "Optional"}
          </span>
        </div>
        {variant !== "empty-agent" && variant !== "empty-outsourced" && (
          <button className="agent-link" style={{ fontSize: 12 }}>+ Add</button>
        )}
      </div>

      {variant === "empty-agent" && (
        <div style={{ textAlign: "center", padding: "20px 0", color: TM, fontSize: 13 }}>
          No {singular}s added · you can add them later
        </div>
      )}

      {variant === "empty-outsourced" && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: TP, marginBottom: 6 }}>
            Add a {singular}
          </p>
          <p style={{ fontSize: 13, color: TM, marginBottom: 14 }}>
            {/* OLD: "We need a name and a phone or email to reach them." */}
            Add a name and a phone number or email.
          </p>
          <button className="agent-btn agent-btn-ghost-bordered agent-btn-md">
            + Add {singular}
          </button>
        </div>
      )}

      {variant === "single" && (
        <>
          <div className="contact-card">
            <div className="pp-field">
              {/* OLD: "Full name" / "Full name*" (outsourced adds asterisk) */}
              <label className="pp-flabel">{outsourced ? "Full name*" : "Full name"}</label>
              <div className="pp-finput-pop">Sarah Johnson</div>
            </div>
            <div className="contact-detail-grid">
              <FieldRow label="Phone" value="07700 900123" />
              <FieldRow label="Email" value="sarah@example.com" />
            </div>
            {outsourced && (
              <p style={{ fontSize: 11, color: SUCCESS, display: "flex", alignItems: "center", gap: 5 }}>
                <span>✓</span>
                {/* OLD: "We can reach this vendor" / "We can reach this purchaser" */}
                Contact details set
              </p>
            )}
            {!outsourced && (
              <p style={{ fontSize: 11, color: TM }}>
                {/* OLD: "Eligible for portal invite" */}
                Can be invited to the portal
              </p>
            )}
          </div>
          {outsourced && (
            <p style={{ fontSize: 11, color: AMBER, marginTop: 10 }}>
              {/* OLD: "At least one vendor with name and contact method required" */}
              Add at least one {singular} with a name and a way to contact them
            </p>
          )}
        </>
      )}

      {variant === "carousel" && (
        <>
          <div style={{ position: "relative" }}>
            <div className="contact-card" style={{ animation: "carousel-slide-left 240ms cubic-bezier(.16,1,.3,1) both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: TM, fontWeight: 500 }}>· 1 of 2</span>
                <button className="agent-icon-btn agent-icon-btn-sm" aria-label="Remove vendor 1">×</button>
              </div>
              <div className="pp-field">
                <label className="pp-flabel">Full name</label>
                <div className="pp-finput-pop">Sarah Johnson</div>
              </div>
              <div className="contact-detail-grid">
                <FieldRow label="Phone" value="07700 900123" />
                <FieldRow label="Email" value="sarah@example.com" />
              </div>
              <p style={{ fontSize: 11, color: TM }}>Can be invited to the portal</p>
            </div>
            {/* chevrons */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <button aria-label="Previous" className="carousel-chevron" disabled style={{ width: 28, height: 28, fontSize: 14 }}>‹</button>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <div className="c-dot active" style={{ width: 16 }} />
                <div className="c-dot" style={{ width: 5 }} />
              </div>
              <button aria-label="Next" className="carousel-chevron" style={{ width: 28, height: 28, fontSize: 14 }}>›</button>
            </div>
          </div>
          <button className="agent-link" style={{ marginTop: 12, fontSize: 12 }}>+ Add</button>
        </>
      )}
    </div>
  );
}

/* ── Solicitors section */
function SolicitorsSection({ solicitorsVariant }: { solicitorsVariant: "empty" | "loading" | "populated" | "hint" }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="agent-glass-strong" style={{ overflow: "hidden" }}>
      <div className="agent-acc-hdr" role="button" tabIndex={0} onClick={() => setOpen(v => !v)}
        onKeyDown={e => (e.key === "Enter" || e.key === " ") && setOpen(v => !v)}>
        <span className="agent-acc-title">Solicitors &amp; Broker</span>
        <span style={{ fontSize: 12, color: TM, transition: "transform 200ms cubic-bezier(.16,1,.3,1)", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
      </div>
      <div className={`agent-acc${open ? " open" : ""}`}>
      <div className="agent-acc-in">
      <div className="agent-acc-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Seller solicitor */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: TM, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
            Seller&apos;s solicitor
          </p>
          {solicitorsVariant === "loading" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${CORAL}`,
                borderTopColor: "transparent", animation: "agent-spin .7s linear infinite" }} />
              {/* OLD: "Searching for solicitor…" */}
              <span style={{ fontSize: 13, color: TM }}>Searching…</span>
            </div>
          )}
          {solicitorsVariant === "empty" && (
            <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 8, padding: "28px 0", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: TM }}>Search for a firm or add a new one</p>
            </div>
          )}
          {solicitorsVariant === "populated" && (
            <div style={{ background: "var(--agent-border-subtle)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: TP }}>Smith &amp; Partners Solicitors</span>
                <button className="agent-link agent-link-muted" style={{ fontSize: 12 }}>Change</button>
              </div>
              <p style={{ fontSize: 12, color: TM, margin: 0 }}>
                {/* OLD: "No case handler selected" */}
                No contact selected
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, color: TS, cursor: "pointer" }}>
                <input type="checkbox" style={{ accentColor: CORAL }} />
                Referred by us
              </label>
            </div>
          )}
          {solicitorsVariant === "hint" && (
            <div style={{ border: `1px dashed ${AMBER}`, borderRadius: 8, padding: "12px 14px",
              background: "var(--agent-warning-bg)" }}>
              <p style={{ fontSize: 13, color: AMBER, margin: 0 }}>
                {/* OLD: "We found Smith & Partners on the memo — search above to add" */}
                Smith &amp; Partners is in the memo — search above to add
              </p>
            </div>
          )}
        </div>
        {/* Buyer solicitor */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: TM, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
            Buyer&apos;s solicitor
          </p>
          <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 8, padding: "28px 0", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: TM }}>Search for a firm or add a new one</p>
          </div>
        </div>
        {/* Broker */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: TM, textTransform: "uppercase", letterSpacing: ".06em", margin: 0 }}>
              Mortgage broker
            </p>
            <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 20, background: "var(--agent-border-subtle)", color: TM }}>Optional</span>
          </div>
          <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 8, padding: "20px 0", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: TM }}>Search for a broker</p>
          </div>
        </div>
      </div>
      </div>{/* agent-acc-in */}
      </div>{/* agent-acc */}
    </div>
  );
}

/* ── Price & Fees section */
function PriceFeesSection({ populated }: { populated?: boolean }) {
  const [open, setOpen] = useState(!!populated);
  return (
    <div className="agent-glass-strong" style={{ overflow: "hidden" }}>
      <div className="agent-acc-hdr" role="button" tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => (e.key === "Enter" || e.key === " ") && setOpen(v => !v)}>
        <span className="agent-acc-title">Price &amp; Fees</span>
        <span className="agent-acc-summary">{populated ? "£375,000 · £5,000 fee + VAT" : "Set price and fees"}</span>
      </div>
      <div className={`agent-acc${open && populated ? " open" : ""}`}>
        <div className="agent-acc-in">
          {populated && (
            <div className="agent-acc-body">
              <FieldRow label="Sale price" value="£375,000" />
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <label className="pp-flabel">Agent fee</label>
                    {/* OLD: "not on memos" annotation — removed */}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="agent-segment-pill agent-segment-pill-sm on">Fixed £</button>
                    <button className="agent-segment-pill agent-segment-pill-sm">Percent %</button>
                    <button className="agent-segment-pill agent-segment-pill-sm">+ VAT</button>
                  </div>
                </div>
                <div className="pp-finput-pop">£5,000</div>
                <p style={{ fontSize: 11, color: TM, marginTop: 5 }}>£6,000 total inc VAT @ 20%</p>
              </div>
              <div style={{ background: "var(--agent-success-bg)", border: `1px solid var(--agent-success-border)`,
                borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ fontSize: 11, color: SUCCESS, fontWeight: 600, margin: 0 }}>
                  Net to agency: <strong>£5,000 on a £375,000 sale</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Chain section (collapsed) */
function ChainSection({ expanded }: { expanded?: boolean }) {
  return (
    <div className="agent-glass-strong" style={{ overflow: "hidden" }}>
      <div className="agent-acc-hdr">
        <div>
          <span className="agent-acc-title">Chain</span>
          <span style={{ fontSize: 12, color: TM, marginLeft: 6 }}>(optional)</span>
        </div>
        <span className="agent-acc-summary">{expanded ? "1 link added" : "Add chain (optional)"}</span>
      </div>
      <div className={`agent-acc${expanded ? " open" : ""}`}>
        <div className="agent-acc-in">
          <div className="agent-acc-body">
            {!expanded ? (
              <div style={{ textAlign: "center", paddingTop: 8, paddingBottom: 8 }}>
                <p style={{ fontSize: 13, color: TP, fontWeight: 500, marginBottom: 4 }}>Is this property part of a chain?</p>
                <p style={{ fontSize: 12, color: TM, marginBottom: 14 }}>Adding a chain sends invite links to the other agents involved.</p>
                <button className="agent-btn agent-btn-ghost-bordered agent-btn-sm">
                  + Add chain
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 12, color: TS, fontWeight: 500, margin: 0 }}>Your sale&apos;s position in the chain</p>
                  <button className="agent-link agent-link-muted" style={{ fontSize: 12 }}>× Remove chain</button>
                </div>
                <div style={{ background: "var(--agent-border-subtle)", borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: TP, margin: 0 }}>Your file</p>
                  <p style={{ fontSize: 12, color: TM, margin: "2px 0 0" }}>14 Hartwell Avenue, Bristol BS6 7TH</p>
                </div>
                <div style={{ background: "var(--agent-border-subtle)", borderRadius: 10, padding: "12px 14px",
                  border: `1px solid ${AMBER}`, position: "relative" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: TP, margin: 0 }}>22 Oak Road, Bristol BS3 2AA</p>
                  <p style={{ fontSize: 11, color: AMBER, marginTop: 4, marginBottom: 0 }}>
                    {/* OLD: "Email needed to send invite" */}
                    Add an email address to send an invite
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="agent-link agent-link-muted" style={{ fontSize: 12 }}>Edit</button>
                    <button className="agent-link agent-link-muted" style={{ fontSize: 12 }}>Remove</button>
                  </div>
                </div>
                <button className="agent-btn agent-btn-ghost-bordered agent-btn-sm" style={{ width: "100%", marginTop: 4, borderStyle: "dashed" }}>
                  + Add sale above
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Outsourced banner */
function OutsourcedBanner() {
  return (
    <div className="agent-glass-strong" style={{ background: "var(--agent-coral-bg-tint)", border: `1px solid rgba(var(--agent-coral-rgb),.2)`,
      borderRadius: "var(--agent-radius-lg)", padding: "14px 18px" }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: CORAL, marginBottom: 4 }}>
        {/* OLD: "Outsourced — our team will progress this file" */}
        Our team is handling this file
      </p>
      <p style={{ fontSize: 13, color: TS, margin: 0 }}>
        {/* OLD: "We'll need at least one vendor and one purchaser with a name and contact method so we can reach out from day one." */}
        Add at least one seller and one buyer with a name and a phone number or email.
      </p>
    </div>
  );
}

/* ── Portal invite prompt */
function PortalInvitePrompt() {
  return (
    <div style={{ background: "var(--agent-border-subtle)", border: `0.5px solid ${BORDER}`,
      borderRadius: 10, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: TP, marginBottom: 4 }}>
          Want to invite the buyer or seller to the client portal?
        </p>
        <p style={{ fontSize: 13, color: TM, margin: 0 }}>
          Add their contact details below and you can send portal invites once the file&apos;s created.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <button className="agent-link" style={{ fontSize: 12 }}>
            Tell me more
          </button>
          <button className="agent-link agent-link-muted" style={{ fontSize: 12 }}>
            Skip — I won&apos;t be using the portal
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Right column variants */
function RightColumn({ variant }: { variant: "idle" | "loading" | "error" | "dossier-a" | "dossier-b" | "preview" }) {
  if (variant === "idle") {
    return (
      <div className="agent-glass-strong" style={{ padding: "20px 22px" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: TP, marginBottom: 12 }}>Property Research</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input className="agent-input" placeholder="Enter postcode — e.g. BS6 7TH" style={{ flex: 1 }} readOnly />
        </div>
        <p style={{ fontSize: 12, color: TM, marginBottom: 12 }}>
          Look up any property to see sale history, EPC rating, and more — before filling in the form.
        </p>
        {["Last sold price & date", "EPC energy rating", "Freehold or leasehold", "Full sale price history"].map(f => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <span style={{ color: SUCCESS, fontSize: 12 }}>✓</span>
            <span style={{ fontSize: 12, color: TS }}>{f}</span>
          </div>
        ))}
        <p style={{ fontSize: 11, color: TM, marginTop: 12 }}>Sources: HM Land Registry · EPC Register</p>
      </div>
    );
  }
  if (variant === "loading") {
    return (
      <div className="agent-glass-strong" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        <Sk w={120} h={16} />
        <Sk w="100%" h={38} delay={120} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[180, 155, 200, 145].map((w, i) => <Sk key={i} w={w} h={13} delay={(i + 2) * 120} />)}
        </div>
        <Sk w={130} h={11} delay={720} />
      </div>
    );
  }
  if (variant === "error") {
    return (
      <div className="agent-glass-strong" style={{ padding: "20px 22px" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: TP, marginBottom: 12 }}>Property Research</p>
        <p style={{ fontSize: 13, color: TM, marginBottom: 14 }}>
          We couldn&apos;t find data for this address. The form still works as normal.
        </p>
        <button className="agent-btn agent-btn-ghost-bordered agent-btn-sm">
          Try again
        </button>
      </div>
    );
  }
  if (variant === "dossier-a") {
    return (
      <div className="agent-glass-strong" style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: TP, margin: 0 }}>Area Research · BS6</p>
          <button className="agent-icon-btn agent-icon-btn-sm" aria-label="Clear property research">×</button>
        </div>
        <p style={{ fontSize: 11, color: TM, marginBottom: 14 }}>
          {/* OLD: "Postcode-level data — no specific property matched yet" */}
          Postcode-level data — no exact property found yet
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Last sold", value: "£285,000", sub: "Nov 2019" },
            { label: "EPC (postcode area)", value: "D", sub: "Score 62" },
          ].map(t => (
            <div key={t.label} style={{ background: "var(--agent-border-subtle)", borderRadius: 8, padding: "10px 12px" }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: TM, margin: 0, marginBottom: 4 }}>{t.label}</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: TP, margin: 0 }}>{t.value}</p>
              <p style={{ fontSize: 11, color: TM, margin: 0 }}>{t.sub}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: TM, marginBottom: 8 }}>
          Recent sales nearby
        </p>
        {["32 Hartwell Avenue — £365,000 · Apr 2024", "8 Oak Crescent — £290,000 · Jan 2024"].map(s => (
          <p key={s} style={{ fontSize: 12, color: TS, marginBottom: 6 }}>{s}</p>
        ))}
        <p style={{ fontSize: 11, color: TM, marginTop: 10 }}>Sources: HM Land Registry · EPC Register</p>
      </div>
    );
  }
  if (variant === "dossier-b") {
    return (
      <div className="agent-glass-strong" style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: TP, margin: 0 }}>Property Record</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: "var(--agent-coral-bg-tint)",
              color: CORAL, fontWeight: 500 }}>From memo</span>
            <button className="agent-icon-btn agent-icon-btn-sm" aria-label="Clear property research">×</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Last sold", value: "£285,000", sub: "Nov 2019" },
            { label: "EPC rating", value: "D", sub: "Score 62 · valid 2031" },
            { label: "Tenure", value: "Freehold", sub: "since 1998" },
          ].map(t => (
            <div key={t.label} style={{ background: "var(--agent-border-subtle)", borderRadius: 8, padding: "10px 12px" }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: TM, margin: 0, marginBottom: 4 }}>{t.label}</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: TP, margin: 0 }}>{t.value}</p>
              <p style={{ fontSize: 11, color: TM, margin: 0 }}>{t.sub}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: TM, marginBottom: 8 }}>
          Other recent sales in BS6
        </p>
        {["32 Hartwell Avenue — £365,000 · Apr 2024", "8 Oak Crescent — £290,000 · Jan 2024"].map(s => (
          <p key={s} style={{ fontSize: 12, color: TS, marginBottom: 6 }}>{s}</p>
        ))}
        <p style={{ fontSize: 11, color: TM, marginTop: 10 }}>Sources: HM Land Registry · EPC Register</p>
      </div>
    );
  }
  /* preview */
  return (
    <div className="agent-glass-strong" style={{ padding: "18px 20px", position: "sticky", top: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: TP }}>File Preview</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em",
          color: CORAL, padding: "2px 7px", borderRadius: 20, border: `1px solid ${CORAL}`,
          animation: "agent-pulse-dot 2s ease-in-out infinite" }}>LIVE</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Property */}
        <div>
          <p className="fp-section-label">Property</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: TP, margin: 0 }}>14 Hartwell Avenue, Bristol BS6 7TH</p>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--agent-border-subtle)", color: TS }}>freehold</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--agent-border-subtle)", color: TS }}>Mortgage</span>
          </div>
        </div>
        <hr style={{ border: "none", borderTop: `0.5px solid ${BORDER}`, margin: 0 }} />
        {/* Parties */}
        <div>
          <p className="fp-section-label">Parties</p>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: TM, margin: "0 0 4px" }}>VENDORS</p>
          <p style={{ fontSize: 13, color: TP, margin: "0 0 8px" }}>Sarah Johnson</p>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: TM, margin: "0 0 4px" }}>PURCHASERS</p>
          <p style={{ fontSize: 13, color: TP, margin: 0 }}>James & Emily Chen</p>
        </div>
        <hr style={{ border: "none", borderTop: `0.5px solid ${BORDER}`, margin: 0 }} />
        {/* Price */}
        <div>
          <p className="fp-section-label">Price &amp; Fees</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: TP, margin: "0 0 2px" }}>£375,000</p>
          <p style={{ fontSize: 12, color: TM, margin: 0 }}>£5,000 fee + VAT</p>
        </div>
        <hr style={{ border: "none", borderTop: `0.5px solid ${BORDER}`, margin: 0 }} />
        {/* Milestones */}
        <div>
          <p className="fp-section-label">Milestones (48)</p>
          {[
            { code: "VM2", label: "Memorandum of Sale received", side: "V" },
            { code: "PM2", label: "Memorandum of Sale received", side: "P" },
            { code: "VM3", label: "Draft contract sent", side: "V" },
            { code: "PM3", label: "Solicitor instructed", side: "P" },
          ].map(m => (
            <div key={m.code} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
              borderBottom: `0.5px solid ${BORDER}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: m.side === "V" ? "var(--agent-vendor-accent)" : "var(--agent-purchaser-accent)",
                width: 14, flexShrink: 0 }}>{m.side}</span>
              <span style={{ fontSize: 12, color: TM, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</span>
            </div>
          ))}
          <p style={{ fontSize: 11, color: TM, marginTop: 6 }}>+ 44 more</p>
        </div>
        <hr style={{ border: "none", borderTop: `0.5px solid ${BORDER}`, margin: 0 }} />
        <p style={{ fontSize: 12, color: TM, margin: 0 }}>Add contacts and fees, then create</p>
      </div>
    </div>
  );
}

/* ── Submit area */
function SubmitArea({ state }: { state: "ready" | "submitting" | "novendor" | "vendornocontact" | "nopurchaser" | "purchasernocontact" }) {
  const btnText = {
    ready: "Create transaction",
    submitting: "Creating...",
    /* OLD variants: "Add 1 vendor to continue", "Add a contact method to continue",
       "Add 1 purchaser to continue", "Add a contact method to continue" */
    novendor: "Add a seller to continue",
    vendornocontact: "Add a phone number or email for the seller",
    nopurchaser: "Add a buyer to continue",
    purchasernocontact: "Add a phone number or email for the buyer",
  }[state];
  const isDisabled = state !== "ready";
  const isLoading = state === "submitting";
  const showHint = !["ready", "submitting"].includes(state);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
      {showHint && (
        <div style={{ background: "var(--agent-warning-bg)", border: `1px solid var(--agent-warning-border)`,
          borderRadius: 10, padding: "10px 14px" }}>
          <p style={{ fontSize: 12, color: AMBER, margin: 0, fontWeight: 500 }}>{btnText}</p>
        </div>
      )}
      <button
        className={`agent-btn agent-btn-md${!isDisabled ? " agent-btn-primary" : ""}`}
        disabled={isDisabled}
        style={{ width: "100%", opacity: isLoading ? 0.75 : 1 }}>
        {isLoading && <div className="agent-btn-spinner" />}
        {btnText}
      </button>
      <button className="agent-btn agent-btn-secondary agent-btn-md" style={{ width: "100%" }}>
        {isLoading ? "Saving draft…" : "Save draft"}
      </button>
    </div>
  );
}

/* ── DuplicateAddressModal */
function DuplicateModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="pp-backdrop" onClick={onClose}>
      <div className="pp-modal agent-glass-strong" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 440, width: "90%", padding: "28px 28px 24px" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: TP, marginBottom: 10 }}>Address already exists</p>
        <p style={{ fontSize: 14, color: TS, marginBottom: 20 }}>
          There&apos;s already an active file for 14 Hartwell Avenue, Bristol BS6 7TH. It is assigned to James Bailey.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="agent-btn agent-btn-secondary agent-btn-md" style={{ flex: 1 }} onClick={onClose}>
            View existing file
          </button>
          <button className="agent-btn agent-btn-primary agent-btn-md" style={{ flex: 1 }} onClick={onClose}>
            Create anyway
          </button>
        </div>
        <button className="agent-link agent-link-muted" style={{ width: "100%", marginTop: 8, display: "block", padding: "8px 0", textAlign: "center" }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── ChangeFileModal */
function ChangeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="pp-backdrop" onClick={onClose}>
      <div className="pp-modal agent-glass-strong" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 360, width: "90%", padding: "24px 24px 20px",
          animation: "agent-modal-in 280ms cubic-bezier(.34,1.56,.64,1) both" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: TP, marginBottom: 8 }}>Change memo?</p>
        <p style={{ fontSize: 13, color: TS, marginBottom: 20 }}>
          Changing the memo will reset any edits you&apos;ve made. The form will be re-populated from the new document.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="agent-btn agent-btn-secondary agent-btn-md" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button className="agent-btn agent-btn-primary agent-btn-md" style={{ flex: 1 }} onClick={onClose}>
            Change file
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function NewSaleV2PolishPage() {
  const [rm, setRm] = useState(false);
  const [theme, setTheme] = useState<"sunset"|"coastal"|"heritage"|"slate"|"emerald"|"claret">("sunset");

  /* section state */
  const [heroV, setHeroV] = useState<"nodraft" | "draft" | "drag">("nodraft");
  const [memoV, setMemoV] = useState<"reading" | "done" | "missing" | "error">("done");
  const [memoSlow, setMemoSlow] = useState(false);
  const [stage2Mode, setStage2Mode] = useState<"self" | "outsourced">("self");
  const [submitV, setSubmitV] = useState<"ready" | "submitting" | "novendor" | "vendornocontact" | "nopurchaser" | "purchasernocontact">("ready");
  const [contactV, setContactV] = useState<"empty-agent" | "empty-outsourced" | "single" | "carousel">("carousel");
  const [rightV, setRightV] = useState<"idle" | "loading" | "error" | "dossier-a" | "dossier-b" | "preview">("preview");
  const [solV, setSolV] = useState<"empty" | "loading" | "populated" | "hint">("populated");
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showChangeFile, setShowChangeFile] = useState(false);
  const [chainExpanded, setChainExpanded] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  function toast(msg: string) {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 2800);
  }

  return (
    <div data-theme={theme} data-rm={rm ? "1" : undefined} style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, var(--agent-bg-base) 0%, var(--agent-bg-paper) 50%, var(--agent-bg-base) 100%)",
      padding: "20px 28px 80px",
      fontFamily: "var(--font-geist-sans, -apple-system, system-ui, sans-serif)",
      color: TP,
    }}>
      <style>{CSS}</style>

      {/* ── Top controls bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 8, position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,245,236,.92)", backdropFilter: "blur(12px)",
        borderBottom: `0.5px solid ${BORDER}`, margin: "0 -28px", padding: "12px 28px 10px" }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: TP, margin: 0 }}>
            Stage 2 — New Sale (new-v2)
          </p>
          <p style={{ fontSize: 11, color: TM, margin: 0, marginTop: 2 }}>
            /agent/polish/new-sale-v2 · preview route
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11, color: TM, fontFamily: "monospace" }}>Theme:</span>
            {(["sunset","coastal","heritage","slate","emerald","claret"] as const).map(t => (
              <button key={t} className={`pp-pill${theme === t ? " on" : ""}`} onClick={() => setTheme(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11, color: TM, fontFamily: "monospace" }}>RM:</span>
            <button className={`pp-pill${rm ? " on" : ""}`} onClick={() => setRm(v => !v)}>
              {rm ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>

      {/* ══ JUMP NAV ════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32, paddingTop: 4 }}>
        {[
          ["#sk", "A · Loading"],
          ["#hero", "B · Hero"],
          ["#memo", "C · MemoStatusBar"],
          ["#stage1", "D · Stage 1"],
          ["#stage2", "E · Stage 2"],
          ["#contacts", "F · Contacts"],
          ["#rightcol", "G · Right column"],
          ["#modals", "H · Modals"],
          ["#mobile", "I · Mobile"],
        ].map(([href, label]) => (
          <a key={href} href={href} style={{ fontSize: 11, color: TM, textDecoration: "none", fontFamily: "monospace",
            padding: "3px 8px", background: "rgba(45,24,16,.04)", borderRadius: 4 }}>{label}</a>
        ))}
      </div>

      {/* ══ A — LOADING SKELETON ═════════════════════════════════════════════ */}
      <SL id="sk" text="A — Loading skeleton (new loading.tsx)"
        sub="Shape matches hero state — form col + right col. Right col hidden at <1024px." />
      <LoadingSkeleton />
      <div style={{ marginTop: 20 }}>
        <p className="m-label">Mobile — 375px</p>
        <div className="m-frame">
          <div style={{ padding: 16 }}>
            <LoadingSkeleton mobile />
          </div>
        </div>
      </div>

      {/* ══ B — HERO STATE ═══════════════════════════════════════════════════ */}
      <SL id="hero" text="B — Hero state" />
      <Ctrl label="variant" opts={[
        { v: "nodraft", t: "No draft" },
        { v: "draft", t: "With draft" },
        { v: "drag", t: "Drag-over" },
      ]} val={heroV} set={v => setHeroV(v as typeof heroV)} />
      <div className="new-sale-two-col">
        <div className="new-sale-form-col">
          <PageHeader title="New sale" subtitle="Drop your memo of sale to get started, or fill in manually." />
          <div style={{ marginTop: 16 }}>
            <HeroCard variant={heroV} />
          </div>
        </div>
        <div className="new-sale-right-col">
          <RightColumn variant="idle" />
        </div>
      </div>

      <MobileFrame topbar>
        <PageHeader title="New sale" subtitle="Drop your memo of sale to get started, or fill in manually." />
        <div style={{ marginTop: 14 }}>
          <HeroCard variant={heroV} />
        </div>
      </MobileFrame>

      {/* ══ C — MEMO STATUS BAR ══════════════════════════════════════════════ */}
      <SL id="memo" text="C — MemoStatusBar states"
        sub="Shows in extracting / extracted flow. Right col switches to FilePreview on extraction." />
      <Ctrl label="state" opts={[
        { v: "reading", t: "Reading" },
        { v: "done", t: "Done — all filled" },
        { v: "missing", t: "Done — missing fields" },
        { v: "error", t: "Error" },
      ]} val={memoV} set={v => setMemoV(v as typeof memoV)} />
      {memoV === "reading" && (
        <div className="pp-bar">
          <span className="pp-bar-label">slow timeout (15s):</span>
          <button className={`pp-pill${memoSlow ? " on" : ""}`} onClick={() => setMemoSlow(v => !v)}>
            {memoSlow ? "Showing" : "Hidden"}
          </button>
        </div>
      )}
      <div className="new-sale-two-col">
        <div className="new-sale-form-col" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <MemoStatusBar variant={memoV} slow={memoSlow} />
          {(memoV === "done" || memoV === "missing") && <SummaryBar mode="self" />}
        </div>
        <div className="new-sale-right-col">
          <RightColumn variant={memoV === "done" || memoV === "missing" ? "preview" : "idle"} />
        </div>
      </div>

      {/* ══ D — STAGE 1 MANUAL FLOW ══════════════════════════════════════════ */}
      <SL id="stage1" text="D — Stage 1 — manual flow"
        sub="Shown when 'Fill in manually' clicked. Continue button appears when address + tenure + purchase type set." />
      <div className="new-sale-two-col">
        <div className="new-sale-form-col" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PageHeader title="New sale" subtitle="Drop your memo of sale to get started, or fill in manually." />
          <Stage1Fields mode="self" />
        </div>
        <div className="new-sale-right-col">
          <RightColumn variant="idle" />
        </div>
      </div>

      <MobileFrame topbar>
        <PageHeader title="New sale" subtitle="Drop your memo of sale to get started, or fill in manually." />
        <div style={{ marginTop: 14 }}>
          <Stage1Fields mode="self" />
        </div>
      </MobileFrame>

      {/* ══ E — STAGE 2 FULL FORM ════════════════════════════════════════════ */}
      <SL id="stage2" text="E — Stage 2 — full form"
        sub="SummaryBar + all accordion sections. Toggle self-progress / outsourced." />
      <Ctrl label="mode" opts={[
        { v: "self", t: "Self-progress" },
        { v: "outsourced", t: "Outsourced" },
      ]} val={stage2Mode} set={v => setStage2Mode(v as typeof stage2Mode)} />
      {stage2Mode === "outsourced" && (
        <Ctrl label="submit state" opts={[
          { v: "ready", t: "Ready" },
          { v: "submitting", t: "Submitting" },
          { v: "novendor", t: "No seller" },
          { v: "vendornocontact", t: "Seller no contact" },
          { v: "nopurchaser", t: "No buyer" },
          { v: "purchasernocontact", t: "Buyer no contact" },
        ]} val={submitV} set={v => setSubmitV(v as typeof submitV)} />
      )}

      <div className="new-sale-two-col">
        <div className="new-sale-form-col" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SummaryBar mode={stage2Mode} />

          {/* Banner / portal prompt */}
          <div className="s2-sec s2-s1">
            {stage2Mode === "outsourced" ? <OutsourcedBanner /> : <PortalInvitePrompt />}
          </div>

          {/* Contacts */}
          <div className="s2-sec s2-s2">
            <div className="contacts-section-grid">
              <ContactCarousel variant={stage2Mode === "outsourced" ? "single" : "carousel"} party="vendor" outsourced={stage2Mode === "outsourced"} />
              <ContactCarousel variant={stage2Mode === "outsourced" ? "empty-outsourced" : "carousel"} party="purchaser" outsourced={stage2Mode === "outsourced"} />
            </div>
          </div>

          {/* Solicitors */}
          <div className="s2-sec s2-s3">
            <SolicitorsSection solicitorsVariant={solV} />
          </div>

          {/* Price & Fees */}
          <div className="s2-sec s2-s4">
            <PriceFeesSection populated />
          </div>

          {/* Notes */}
          <div className="s2-sec s2-s4" style={{ animationDelay: "320ms" }}>
            <div className="agent-glass-strong" style={{ overflow: "hidden" }}>
              <div className="agent-acc-hdr">
                <span className="agent-acc-title">Notes</span>
                <span className="agent-acc-summary">Add any context about this transaction</span>
              </div>
            </div>
          </div>

          {/* Chain */}
          <div className="s2-sec s2-s5">
            <div onClick={() => setChainExpanded(v => !v)}>
              <ChainSection expanded={chainExpanded} />
            </div>
          </div>

          {/* Submit */}
          <SubmitArea state={stage2Mode === "self" ? "ready" : submitV} />
        </div>

        <div className="new-sale-right-col">
          <RightColumn variant="preview" />
        </div>
      </div>

      <MobileFrame topbar>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SummaryBar mode={stage2Mode} />
          {stage2Mode === "outsourced" ? <OutsourcedBanner /> : <PortalInvitePrompt />}
          {/* Contacts stack single-column on mobile */}
          <ContactCarousel variant="single" party="vendor" outsourced={stage2Mode === "outsourced"} />
          <ContactCarousel variant="empty-outsourced" party="purchaser" outsourced={stage2Mode === "outsourced"} />
          <SolicitorsSection solicitorsVariant="populated" />
          <PriceFeesSection populated />
          <SubmitArea state={stage2Mode === "self" ? "ready" : "novendor"} />
        </div>
      </MobileFrame>

      {/* ══ F — CONTACT CAROUSEL STATES ══════════════════════════════════════ */}
      <SL id="contacts" text="F — Contact carousel states" />
      <Ctrl label="variant" opts={[
        { v: "empty-agent", t: "Empty — self" },
        { v: "empty-outsourced", t: "Empty — outsourced" },
        { v: "single", t: "Single entry" },
        { v: "carousel", t: "Carousel (2+)" },
      ]} val={contactV} set={v => setContactV(v as typeof contactV)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 720 }}>
        <ContactCarousel variant={contactV} party="vendor" outsourced={contactV === "empty-outsourced"} />
        <ContactCarousel variant={contactV === "empty-agent" ? "empty-agent" : contactV === "empty-outsourced" ? "empty-outsourced" : contactV} party="purchaser" outsourced={contactV === "empty-outsourced"} />
      </div>

      {/* ── Contact card validation feedback states */}
      <SL id="contact-feedback" text="F2 — Contact card per-row feedback (outsourced mode)" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 900 }}>
        {[
          { label: "Name + contact set", msg: "Contact details set", color: SUCCESS, icon: "✓" },
          { label: "Name, no contact", msg: "Add a phone or email", color: AMBER, icon: "⚠" },
          { label: "Self-progress (eligible)", msg: "Can be invited to the portal", color: TM, icon: "·" },
        ].map(s => (
          <div key={s.label} className="contact-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 11, fontFamily: "monospace", color: TM, margin: 0 }}>{s.label}</p>
            <div className="pp-finput-pop">Sarah Johnson</div>
            <p style={{ fontSize: 11, color: s.color, display: "flex", alignItems: "center", gap: 5, margin: 0 }}>
              <span>{s.icon}</span>
              {/* OLD states: "We can reach this vendor", "Add a phone or email so we can reach them", "Eligible for portal invite" */}
              {s.msg}
            </p>
          </div>
        ))}
      </div>

      {/* ── FieldHint / FieldIndicator states */}
      <SL id="fieldhint" text="F3 — FieldHint extraction states" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 }}>
        <div className="pp-field">
          <label className="pp-flabel"><span className="fi fi-ok" /> Street address</label>
          <div className="pp-finput-pop">14 Hartwell Avenue</div>
        </div>
        <div className="pp-field">
          <label className="pp-flabel"><span className="fi fi-warn" /> Purchase price</label>
          <input className="agent-input" placeholder="" readOnly />
          {/* OLD: "We couldn't read this — please add" */}
          <p className="pp-fhint" style={{ color: AMBER }}>Couldn&apos;t be read — add manually</p>
        </div>
        <div className="pp-field">
          <label className="pp-flabel"><span className="fi fi-warn" /> Purchase type</label>
          {/* OLD: "not on memos" annotation removed from label; hint below was "Not on memos — add" */}
          <input className="agent-input" placeholder="" readOnly />
        </div>
        <div className="pp-field">
          <label className="pp-flabel"><span className="fi fi-warn" /> Agent fee</label>
          <input className="agent-input" placeholder="" readOnly />
          {/* OLD: "Not on memos — still needed" */}
          <p className="pp-fhint" style={{ color: TM }}>Not in memos — add if known</p>
        </div>
        <div className="pp-field">
          <label className="pp-flabel">Vendor details</label>
          <input className="agent-input" placeholder="" readOnly />
          {/* OLD: "We couldn't read this — please add contact details" */}
          <p className="pp-fhint" style={{ color: AMBER }}>Couldn&apos;t be read — add contact details</p>
        </div>
        <div className="pp-field">
          <label className="pp-flabel">City / Town</label>
          <input className="agent-input" placeholder="" readOnly />
          {/* OLD: "Not on memos — please complete" */}
          <p className="pp-fhint" style={{ color: TM }}>Not in memos — add manually</p>
        </div>
      </div>

      {/* ══ G — RIGHT COLUMN ═════════════════════════════════════════════════ */}
      <SL id="rightcol" text="G — Right column states"
        sub="Hidden at <1024px via CSS. All five variants." />
      <Ctrl label="variant" opts={[
        { v: "idle", t: "Research — idle" },
        { v: "loading", t: "Research — loading" },
        { v: "error", t: "Research — error" },
        { v: "dossier-a", t: "Dossier — postcode" },
        { v: "dossier-b", t: "Dossier — property" },
        { v: "preview", t: "File preview" },
      ]} val={rightV} set={v => setRightV(v as typeof rightV)} />
      <div key={rightV} style={{ maxWidth: 340, animation: "right-col-fadein 220ms cubic-bezier(.16,1,.3,1) both" }}>
        <RightColumn variant={rightV} />
      </div>

      {/* Solicitors variants (for Stage 2 section toggle) */}
      <SL id="sol-variants" text="G2 — Solicitors section variants" />
      <Ctrl label="variant" opts={[
        { v: "empty", t: "Empty" },
        { v: "loading", t: "Autofill loading" },
        { v: "populated", t: "Populated" },
        { v: "hint", t: "Memo hint" },
      ]} val={solV} set={v => setSolV(v as typeof solV)} />
      <div style={{ maxWidth: 560 }}>
        <SolicitorsSection solicitorsVariant={solV} />
      </div>

      {/* ══ H — MODALS ═══════════════════════════════════════════════════════ */}
      <SL id="modals" text="H — Modals" />
      <div className="pp-bar">
        <button className="pp-pill" onClick={() => setShowDuplicate(true)}>Open DuplicateAddressModal</button>
        <button className="pp-pill" onClick={() => setShowChangeFile(true)}>Open ChangeFileModal</button>
        <button className="pp-pill" onClick={() => toast("Milestone confirmed")}>Toast — success</button>
        <button className="pp-pill" onClick={() => toast("Choose a tenure to continue")}>
          {/* OLD: "Select tenure to continue" */}
          Toast — choose tenure
        </button>
        <button className="pp-pill" onClick={() => toast("Choose a purchase type to continue")}>
          {/* OLD: "Select purchase type to continue" */}
          Toast — choose type
        </button>
      </div>
      {/* Modal inline previews (static) */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280, maxWidth: 440 }}>
          <p style={{ fontSize: 11, fontFamily: "monospace", color: TM, marginBottom: 8 }}>DuplicateAddressModal</p>
          <div className="agent-glass-strong" style={{ padding: "28px 28px 24px" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: TP, marginBottom: 10 }}>Address already exists</p>
            <p style={{ fontSize: 14, color: TS, marginBottom: 20 }}>
              There&apos;s already an active file for 14 Hartwell Avenue, Bristol BS6 7TH. It is assigned to James Bailey.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="agent-btn agent-btn-secondary agent-btn-md" style={{ flex: 1 }}>View existing file</button>
              <button className="agent-btn agent-btn-primary agent-btn-md" style={{ flex: 1 }}>Create anyway</button>
            </div>
            <button className="agent-link agent-link-muted" style={{ width: "100%", marginTop: 8, display: "block", padding: "8px 0", textAlign: "center" }}>Cancel</button>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 260, maxWidth: 360 }}>
          <p style={{ fontSize: 11, fontFamily: "monospace", color: TM, marginBottom: 8 }}>ChangeFileModal (spring easing)</p>
          <div className="agent-glass-strong" style={{ padding: "24px 24px 20px" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: TP, marginBottom: 8 }}>Change memo?</p>
            <p style={{ fontSize: 13, color: TS, marginBottom: 20 }}>
              Changing the memo will reset any edits you&apos;ve made. The form will be re-populated from the new document.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="agent-btn agent-btn-secondary agent-btn-md" style={{ flex: 1 }}>Cancel</button>
              <button className="agent-btn agent-btn-primary agent-btn-md" style={{ flex: 1 }}>Change file</button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ I — MOBILE VIEWS ═════════════════════════════════════════════════ */}
      <SL id="mobile" text="I — Mobile views — 375px frames"
        sub="Right column (FilePreview, ResearchPanel, PropertyDossier) is display:none at <1024px — not shown." />
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* Mobile A: Hero */}
        <div>
          <p className="m-label">Mobile — Hero, with draft</p>
          <div className="m-frame">
            <MockTopbar />
            <div style={{ padding: 16 }}>
              <PageHeader title="New sale" subtitle="Drop your memo of sale to get started, or fill in manually." />
              <div style={{ marginTop: 14 }}>
                <HeroCard variant="draft" />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile B: Stage 1 */}
        <div>
          <p className="m-label">Mobile — Stage 1 (manual)</p>
          <div className="m-frame">
            <MockTopbar />
            <div style={{ padding: 16 }}>
              <PageHeader title="New sale" subtitle="Drop your memo of sale to get started, or fill in manually." />
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
                <Glass style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: TS, marginBottom: 8 }}>Who will progress this file?</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="agent-segment-pill on" style={{ flex: 1 }}>
                        Self-progress
                        <span className="agent-segment-pill-note">You manage this file</span>
                      </button>
                      <button className="agent-segment-pill" style={{ flex: 1 }}>
                        Send to us
                        <span className="agent-segment-pill-note">Our team takes it from here</span>
                      </button>
                    </div>
                  </div>
                  <Divider />
                  <FieldRow label="Street address" placeholder="e.g. 14 Hartwell Avenue" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <FieldRow label="City / Town" placeholder="e.g. Bristol" />
                    <FieldRow label="Postcode" placeholder="e.g. BS6 7TH" />
                  </div>
                  <Divider />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: TS, marginBottom: 8 }}>Tenure</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="agent-segment-pill on" style={{ flex: 1 }}>
                        Freehold
                        <span className="agent-segment-pill-note">No management pack</span>
                      </button>
                      <button className="agent-segment-pill" style={{ flex: 1 }}>
                        Leasehold
                        <span className="agent-segment-pill-note">Management pack needed</span>
                      </button>
                    </div>
                  </div>
                  <Divider />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: TS, marginBottom: 8 }}>Purchase type</p>
                    <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                      <button className="agent-segment-pill on">
                        Mortgage
                        <span className="agent-segment-pill-note">All steps included</span>
                      </button>
                      <button className="agent-segment-pill">
                        Cash
                        <span className="agent-segment-pill-note">Mortgage steps not needed</span>
                      </button>
                    </div>
                  </div>
                  <Divider />
                  <p style={{ fontSize: 12, color: TM }}>
                    Address, tenure and purchase type are set — add contacts and details
                  </p>
                  <button className="agent-btn agent-btn-primary agent-btn-md" style={{ width: "100%" }}>
                    Continue — add contacts &amp; details
                  </button>
                </Glass>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile C: Stage 2 */}
        <div>
          <p className="m-label">Mobile — Stage 2 (self-progress)</p>
          <div className="m-frame">
            <MockTopbar />
            <div style={{ padding: "14px 14px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              <SummaryBar mode="self" />
              <PortalInvitePrompt />
              {/* Contacts stacked single-col on mobile */}
              <ContactCarousel variant="single" party="vendor" />
              <ContactCarousel variant="empty-agent" party="purchaser" />
              <SolicitorsSection solicitorsVariant="empty" />
              <PriceFeesSection />
              <div className="agent-glass-strong" style={{ overflow: "hidden" }}>
                <div className="agent-acc-hdr">
                  <span className="agent-acc-title">Notes</span>
                  <span className="agent-acc-summary">Add context</span>
                </div>
              </div>
              <ChainSection />
              <SubmitArea state="ready" />
            </div>
          </div>
        </div>

        {/* Mobile D: Outsourced, with validation */}
        <div>
          <p className="m-label">Mobile — Stage 2 (outsourced, no seller)</p>
          <div className="m-frame">
            <MockTopbar />
            <div style={{ padding: "14px 14px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              <SummaryBar mode="outsourced" />
              <OutsourcedBanner />
              <ContactCarousel variant="empty-outsourced" party="vendor" outsourced />
              <ContactCarousel variant="empty-outsourced" party="purchaser" outsourced />
              <SubmitArea state="novendor" />
            </div>
          </div>
        </div>

      </div>

      {/* ══ FOOTER NOTE ══════════════════════════════════════════════════════ */}
      <div style={{ marginTop: 64, padding: "16px 20px", background: "rgba(45,24,16,.04)",
        borderRadius: 10, border: `0.5px solid ${BORDER}` }}>
        <p style={{ fontSize: 12, color: TM, margin: 0, fontFamily: "monospace" }}>
          Stage 2 test page · /agent/polish/new-sale-v2 · {" "}
          All copy marked OLD: requires Stage 3 voice review before Stage 4. {" "}
          loading.tsx to be built as a separate file in Stage 4.
        </p>
      </div>

      </div>

      {/* ── Portal-rendered modals (triggered by buttons) */}
      {showDuplicate && <DuplicateModal onClose={() => setShowDuplicate(false)} />}
      {showChangeFile && <ChangeModal onClose={() => setShowChangeFile(false)} />}

      {/* ── Toast */}
      {showToast && (
        <div className="pp-toast">{showToast}</div>
      )}
    </div>
  );
}
