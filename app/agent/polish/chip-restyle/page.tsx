"use client";

import type { ReactNode } from "react";

// Throwaway preview for the milestone-chip restyle (Awaiting Nd / Exchange
// gate / slowness / client-chase / confirmation tails). Renders inside the
// real agent shell so the background, glass and BOTH themes are the true
// production values — flip the light/dark toggle top-right to compare.
// DELETE once Ellis picks A / B / C. Not wired to any data.

const OPTIONS = [
  {
    key: "a",
    title: "Option A · Token tint",
    note: "The app's own chip idiom (same as the coral “Due today” badge): soft token fill, hairline border, leading dot, 11px/600 tabular. The safe native fix.",
  },
  {
    key: "b",
    title: "Option B · Glass + shine",
    note: "Option A plus a top sheen, an inner light edge and a faint drop shadow, so each chip reads like a tiny glass card matching the surfaces around it.",
  },
  {
    key: "c",
    title: "Option C · Icon-led, quiet",
    note: "Signal tags lose the box entirely (icon + coloured text); only the confirmed tails keep a soft pill. Least visual noise.",
  },
] as const;

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function Clock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
function Gauge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4" /><path d="M12 2a10 10 0 1 0 8 4" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
    </svg>
  );
}
function NoEntry() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M8 12h8" />
    </svg>
  );
}

// Chip renderer for a given option. `tone` maps to real agent tokens.
function Chip({ opt, tone, icon, children }: { opt: "a" | "b" | "c"; tone: "warn" | "coral" | "ok" | "info" | "snoozed"; icon: "clock" | "gauge" | "arrow" | "noentry" | "check"; children: ReactNode }) {
  const Icon = icon === "clock" ? Clock : icon === "gauge" ? Gauge : icon === "arrow" ? Arrow : icon === "noentry" ? NoEntry : Check;
  const isConfirm = icon === "check";
  // Option C: signal chips are borderless icon+text; confirm tails keep a pill.
  const cls = opt === "c" && !isConfirm ? `cr-c cr-${tone}` : `cr-${opt} cr-${tone}`;
  return (
    <span className={cls}>
      {opt === "c" ? <Icon /> : isConfirm ? <Icon /> : <span className="cr-lead" />}
      {children}
    </span>
  );
}

function Rows({ opt }: { opt: "a" | "b" | "c" }) {
  return (
    <div className="cr-card">
      <div className="cr-row">
        <span className="cr-dot cr-avail" />
        <div className="cr-grow">
          <span className="cr-name">Buyer&apos;s solicitor has received the search results
            <span className="cr-chips">
              <Chip opt={opt} tone="warn" icon="clock">Awaiting 40 days</Chip>
              <Chip opt={opt} tone="coral" icon="arrow">Last step before exchange</Chip>
            </span>
          </span>
        </div>
        <button className="cr-btn">Confirm</button>
      </div>

      <div className="cr-row">
        <span className="cr-dot cr-avail" />
        <div className="cr-grow">
          <span className="cr-name">Buyer has booked a Level 2 or Level 3 survey
            <span className="cr-chips">
              <Chip opt={opt} tone="warn" icon="gauge">6 days slower than typical</Chip>
              <Chip opt={opt} tone="snoozed" icon="noentry">Client opted out</Chip>
            </span>
          </span>
        </div>
        <button className="cr-btn">Confirm</button>
      </div>

      <div className="cr-row">
        <span className="cr-dot cr-done" />
        <div className="cr-grow">
          <span className="cr-name cr-muted">Seller&apos;s solicitor has issued the draft contract pack
            <span className="cr-chips">
              <Chip opt={opt} tone="info" icon="check">Client confirmed</Chip>
              <Chip opt={opt} tone="ok" icon="check">Confirmed by Meldone</Chip>
            </span>
          </span>
          <p className="cr-meta">Completed 3 Jul 2026 · Event: 2 Jul 2026</p>
        </div>
        <span className="cr-undo">Undo</span>
      </div>
    </div>
  );
}

export default function ChipRestylePage() {
  return (
    <div className="cr-wrap">
      <style>{CSS}</style>
      <header className="cr-head">
        <p className="cr-kicker">Milestone chips · restyle</p>
        <h1 className="cr-h1">Same chips, on the real surface</h1>
        <p className="cr-lede">
          Rendered inside the live agent shell, so this is the true background, the true glass and the true
          tokens. Use the theme toggle in the top bar to check light and dark. Every option drops
          &ldquo;Exchange gate&rdquo; for &ldquo;Last step before exchange&rdquo; in coral (the one step that
          actually gates exchange carries the brand colour).
        </p>
      </header>

      {OPTIONS.map((o) => (
        <section key={o.key} className="cr-section">
          <h2 className="cr-h2">{o.title}</h2>
          <p className="cr-note">{o.note}</p>
          <Rows opt={o.key} />
        </section>
      ))}

      <p className="cr-foot">Tell me A, B or C (mixing is fine, e.g. B for signals + C&apos;s tighter icon for the confirmed tails) and I&apos;ll build it as the single canonical chip, then delete this page.</p>
    </div>
  );
}

const CSS = `
.cr-wrap { max-width: 900px; margin: 0 auto; padding: 32px 24px 96px; }
.cr-kicker { margin:0 0 8px; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--agent-coral-deep); }
.cr-h1 { margin:0 0 10px; font-size:26px; font-weight:700; letter-spacing:-0.02em; color:var(--agent-text-primary); }
.cr-lede { margin:0; font-size:14px; line-height:1.6; color:var(--agent-text-secondary); max-width:64ch; }
.cr-section { margin-top:40px; }
.cr-h2 { margin:0 0 4px; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--agent-text-muted); }
.cr-note { margin:0 0 14px; font-size:13px; line-height:1.55; color:var(--agent-text-secondary); max-width:62ch; }

.cr-card { border:0.5px solid var(--agent-border-default); border-radius:14px; background:var(--agent-surface-elevated); overflow:hidden; box-shadow:var(--agent-glass-shadow, 0 8px 30px rgba(0,0,0,0.06)); }
.cr-row { display:flex; align-items:center; gap:12px; padding:13px 18px; border-top:0.5px solid var(--agent-border-default); }
.cr-row:first-child { border-top:0; }
.cr-grow { flex:1 1 auto; min-width:0; }
.cr-dot { width:9px; height:9px; border-radius:999px; flex:0 0 auto; }
.cr-dot.cr-avail { background:var(--agent-coral); box-shadow:0 0 0 3px rgba(var(--agent-coral-rgb),0.14); }
.cr-dot.cr-done { background:var(--agent-success); }
.cr-name { font-size:12.5px; font-weight:600; color:var(--agent-text-primary); }
.cr-name.cr-muted { color:var(--agent-text-muted); }
.cr-meta { margin:2px 0 0; font-size:10.5px; color:var(--agent-text-muted); }
.cr-chips { display:inline-flex; flex-wrap:wrap; gap:6px; margin-left:8px; vertical-align:middle; }
.cr-btn { flex:0 0 auto; font-size:12px; font-weight:600; color:var(--agent-text-on-coral); background:var(--agent-coral); border:none; border-radius:8px; padding:6px 13px; cursor:pointer; }
.cr-undo { flex:0 0 auto; font-size:11px; color:var(--agent-text-muted); cursor:pointer; }
.cr-foot { margin-top:44px; padding-top:18px; border-top:0.5px solid var(--agent-border-default); font-size:13px; line-height:1.6; color:var(--agent-text-secondary); }

/* shared chip innards */
.cr-a, .cr-b, .cr-c { font-variant-numeric: tabular-nums; white-space:nowrap; }
.cr-a svg, .cr-b svg { width:12px; height:12px; }
.cr-c svg { width:13px; height:13px; }
.cr-lead { width:5px; height:5px; border-radius:999px; flex:0 0 auto; }

/* tone → real tokens */
.cr-warn    { --t: var(--agent-warning);     --trgb: var(--agent-warning-rgb); }
.cr-coral   { --t: var(--agent-coral-deep);   --trgb: var(--agent-coral-rgb); }
.cr-ok      { --t: var(--agent-success);      --trgb: var(--agent-success-rgb); }
.cr-info    { --t: var(--agent-info);         --trgb: var(--agent-info-rgb); }
.cr-snoozed { --t: var(--agent-snoozed);      --trgb: var(--agent-snoozed-rgb); }

/* Option A — token tint */
.cr-a { display:inline-flex; align-items:center; gap:5px; height:20px; padding:0 9px 0 8px; border-radius:999px; font-size:11px; font-weight:600; letter-spacing:0.004em; color:var(--t); background:rgba(var(--trgb),0.12); border:0.5px solid rgba(var(--trgb),0.30); }
.cr-a .cr-lead { background:var(--t); }

/* Option B — glass + shine */
.cr-b { position:relative; display:inline-flex; align-items:center; gap:5px; height:21px; padding:0 10px 0 8px; border-radius:999px; font-size:11px; font-weight:600; letter-spacing:0.004em; color:var(--t); background-color:rgba(var(--trgb),0.14); border:0.5px solid rgba(var(--trgb),0.34); background-image:linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 62%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 2px rgba(var(--trgb),0.18); }
.cr-b .cr-lead { background:var(--t); box-shadow:0 0 0 2px rgba(255,255,255,0.35); }
[data-theme="dark"] .cr-b { background-image:linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 60%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 1px 2px rgba(0,0,0,0.35); }
[data-theme="dark"] .cr-b .cr-lead { box-shadow:0 0 0 2px rgba(255,255,255,0.10); }

/* Option C — icon-led signal (borderless) + confirm pill */
.cr-c { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; letter-spacing:0.004em; color:var(--t); }
/* confirm tails in option C reuse the .cr-c class name space only when NOT a signal;
   here the check chips fall back to .cr-c too, so give them a soft pill: */
.cr-c:has(svg polyline) { height:20px; padding:0 9px; border-radius:999px; background-color:rgba(var(--trgb),0.13); border:0.5px solid rgba(var(--trgb),0.30); background-image:linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 62%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(var(--trgb),0.10); }
.cr-c:has(svg polyline) svg { width:11px; height:11px; }
[data-theme="dark"] .cr-c:has(svg polyline) { background-image:linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 60%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.3); }
`;
