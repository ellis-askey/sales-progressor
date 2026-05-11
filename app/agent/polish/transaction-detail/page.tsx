"use client";
import { useState, useEffect } from "react";
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const CORAL  = "var(--agent-coral-deep)";
const AMBER  = "var(--agent-warning)";
const OK     = "var(--agent-success)";
const TP     = "var(--agent-text-primary)";
const TS     = "var(--agent-text-secondary)";
const TM     = "var(--agent-text-muted)";
const BORDER = "var(--agent-border-default)";

/* ─── Page-level CSS ─────────────────────────────────────────────────────── */
const CSS = `
  [data-rm="1"] *, [data-rm="1"] *::before, [data-rm="1"] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
  .pp-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    color: rgba(30,45,74,.45); margin: 52px 0 14px; padding: 9px 16px;
    background: rgba(30,45,74,.05); border-left: 3px solid rgba(30,45,74,.2);
    border-radius: 0 6px 6px 0; font-family: monospace;
  }
  .pp-sub { font-size: 11px; color: rgba(30,45,74,.4); font-family: monospace; margin: -10px 0 16px; }
  .pp-bar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 14px; }
  .pp-bar-label { font-size: 11px; color: rgba(30,45,74,.45); font-family: monospace; white-space: nowrap; }
  .pp-pill { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(30,45,74,.15);
    font-size: 11px; font-weight: 500; cursor: pointer; background: white; color: rgba(30,45,74,.55);
    transition: all 120ms; }
  .pp-pill.on { background: #1E2D4A; color: white; border-color: #1E2D4A; }
  .m-frame { width: 375px; border: 1.5px solid rgba(30,45,74,.12); border-radius: 16px;
    overflow: hidden; background: var(--agent-bg-base); }
  .m-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    color: rgba(30,45,74,.35); margin: 28px 0 7px; font-family: monospace; }
  .sk { background: rgba(30,45,74,.07); border-radius: 5px; }
  .sk-pulse { animation: agent-skeleton-pulse 1.5s ease-in-out infinite; }
  /* ring-glow-pulse stays local — milestone sidebar only */
  @keyframes ring-glow-pulse {
    0%, 100% { filter: drop-shadow(0 0 4px rgba(var(--agent-coral-rgb), 0.0)); }
    50%       { filter: drop-shadow(0 0 10px rgba(var(--agent-coral-rgb), 0.35)); }
  }
  /* exchange-in — extracted to agent-system.css as agent-modal-in--celebrate in Stage 4 */
  @keyframes exchange-in {
    from { opacity: 0; transform: scale(0.92) translateY(12px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  .exchange-modal { animation: exchange-in 200ms ease both; }
  /* ms- keyframes stay local */
  @keyframes ms-node-pop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.45); }
    70%  { transform: scale(0.9); }
    100% { transform: scale(1); }
  }
  @keyframes ms-node-unlock {
    0%   { transform: scale(0.6); opacity: 0; }
    60%  { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes ms-btn-appear {
    from { opacity: 0; transform: translateX(6px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes ms-shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
  .ms-pop { animation: ms-node-pop 360ms cubic-bezier(.16,1,.3,1) both; }
  .ms-unlock { animation: ms-node-unlock 340ms cubic-bezier(.16,1,.3,1) both; }
  .ms-appear { animation: ms-btn-appear 220ms ease 120ms both; }
  .ms-bar-shimmer {
    background: linear-gradient(90deg, var(--agent-coral-deep) 0%, var(--agent-coral-light) 50%, var(--agent-coral-deep) 100%);
    background-size: 200% 100%;
    animation: ms-shimmer 2.4s linear infinite;
  }
  /* ring-glow */
  .ring-glow { animation: ring-glow-pulse 3s ease-in-out infinite; }
  /* reduced-motion: ms keyframes suppressed already in MilestonePanel; ring-glow + exchange-in need Stage 2 fix */
  @media (prefers-reduced-motion: reduce) {
    .ring-glow { animation: none; }
    .exchange-modal { animation: none; }
  }
  /* drawer panel — inline style-guide block */
  .pp-drawer { width: 460px; background: var(--agent-surface-elevated);
    border: 0.5px solid ${BORDER}; border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0,0,0,.14);
    animation: agent-drawer-in 280ms cubic-bezier(.16,1,.3,1) both; }
  /* overlay drawer — fixed right panel, matches real app */
  .pp-drawer-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.18); backdrop-filter: blur(2px); }
  .pp-overlay-drawer {
    position: absolute; top: 0; right: 0; bottom: 0; width: 480px; overflow-y: auto;
    background: var(--agent-surface-elevated); border-left: 0.5px solid ${BORDER};
    box-shadow: -24px 0 64px rgba(0,0,0,.14);
    animation: agent-drawer-in 280ms cubic-bezier(.16,1,.3,1) both; }
  /* pp-section: card container in test page */
  .pp-section { border: 0.5px solid ${BORDER}; border-radius: 12px; overflow: hidden;
    background: var(--agent-glass-bg); }
  /* row divider */
  .row-div { border-top: 0.5px solid var(--agent-border-subtle); }
  /* milestone dot */
  .ms-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .ms-dot-avail  { background: #3b82f6; border: 2px solid #93c5fd; }
  .ms-dot-done   { background: #10b981; border: 2px solid #6ee7b7; }
  .ms-dot-locked { background: transparent; border: 2px solid rgba(30,45,74,.2); }
  .ms-dot-nr     { background: transparent; border: 2px dashed rgba(30,45,74,.3); }
  /* urgency colours */
  .urg-escalated { color: #dc2626; }
  .urg-overdue   { color: #ea580c; }
  .urg-today     { color: #d97706; }
  .urg-upcoming  { color: ${TS}; }
  .urg-snoozed   { color: #7c3aed; }
  .urg-complete  { color: ${TM}; }
`;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function SL({ id, text, sub }: { id?: string; text: string; sub?: string }) {
  return (
    <>
      <p id={id} className="pp-label">{text}</p>
      {sub && <p className="pp-sub">{sub}</p>}
    </>
  );
}

function Ctrl({ label, opts, val, set }: {
  label: string; opts: { v: string; t: string }[];
  val: string; set: (v: string) => void;
}) {
  return (
    <div className="pp-bar">
      <span className="pp-bar-label">{label}:</span>
      {opts.map(o => (
        <button key={o.v} className={`pp-pill${val === o.v ? " on" : ""}`} onClick={() => set(o.v)}>{o.t}</button>
      ))}
    </div>
  );
}

function Sk({ w, h }: { w: string | number; h: number }) {
  return <div className="sk sk-pulse" style={{ width: w, height: h, flexShrink: 0 }} />;
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="agent-glass" style={{ borderRadius: 12, ...style }}>
      {children}
    </div>
  );
}

function CardHdr({ title, right, badge }: { title: string; right?: React.ReactNode; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px", borderBottom: `0.5px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: TS }}>{title}</span>
        {badge && (
          <span className="agent-badge">{badge}</span>
        )}
      </div>
      {right}
    </div>
  );
}

/* ─── Mock sub-components ────────────────────────────────────────────────── */

/* ─── C3 draw-on progress ring ──────────────────────────────────────────────
 * Matches anim-preview C3 pattern: stroke-dashoffset starts at circ (fully
 * hidden) then transitions to target offset after a 60ms paint delay.
 * Reduced-motion: renders at target immediately, no transition.
 * ring-glow-pulse stays bespoke/local — sidebar only, not a canonical class.
 * ─────────────────────────────────────────────────────────────────────────── */
function SidebarProgressRing({ percent, rm }: { percent: number; rm: boolean }) {
  const r    = 28;
  const circ = 2 * Math.PI * r; // 175.93
  const target = circ * (1 - percent / 100);
  const [offset, setOffset] = useState(rm ? target : circ);

  useEffect(() => {
    if (rm) { setOffset(target); return; }
    setOffset(circ);
    const t = setTimeout(() => setOffset(target), 60);
    return () => clearTimeout(t);
  // target and circ are stable (derived from constant percent/r); rm drives mode switch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rm]);

  return (
    <div className={rm ? "" : "ring-glow"} style={{ position: "relative", flexShrink: 0 }}>
      <svg data-testid="progress-ring-svg" width="72" height="72" viewBox="0 0 72 72"
        style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx="36" cy="36" r={r} fill="none"
          stroke="rgba(30,45,74,0.08)" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none"
          stroke={CORAL} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: rm ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: TP }}>{percent}%</span>
      </div>
    </div>
  );
}

function MockSidebar({ rm, onEditDetails }: { rm: boolean; onEditDetails?: () => void }) {
  return (
    <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Progress */}
      <GlassCard>
        <div style={{ padding: "16px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.06em", color: CORAL, marginBottom: 12 }}>Progress</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* C3 draw-on ring — matches anim-preview pattern */}
            <SidebarProgressRing percent={75} rm={rm} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span className="agent-pill agent-pill-active" style={{ fontSize: 10 }}>On track</span>
              </div>
              <p style={{ fontSize: 11, color: TM }}>6 weeks elapsed</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Exchange Forecast */}
      <GlassCard>
        <div style={{ padding: "12px 16px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.06em", color: CORAL, marginBottom: 10 }}>Exchange Forecast</p>
          {[
            ["12-week target", "3 Jul 2025"],
            ["Expected exchange", "28 Jun 2025"],
            ["Completion date", "Not set"],
            ["Weeks to exchange", "~3 weeks"],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: TM }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: TP }}>{val}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Price & Fees */}
      <GlassCard>
        <div style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.06em", color: CORAL }}>Price & Fees</p>
            {/* OLD: <button style={{ fontSize:11, color:"#60a5fa" }}>Edit details</button> */}
            <button className="agent-link" style={{ fontSize: 11 }} onClick={onEditDetails}>Edit details</button>
          </div>
          {[
            ["Purchase price", "£375,000"],
            ["Agent fee", "£5,000 + VAT"],
            ["Solicitor referral", "£300"],
            ["Progressor fee", "Self-managed · £59 inc. VAT"],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between",
              alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: TM }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: TP }}>{val}</span>
            </div>
          ))}
          <div style={{ borderTop: `2px solid rgba(255,255,255,0.4)`, paddingTop: 10, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: TM }}>Net income</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--agent-success)" }}>£5,241</span>
            </div>
            <p style={{ fontSize: 10, color: TM, marginTop: 2 }}>Agent fee excludes VAT</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function MilestoneRowMock({
  name, state, flash
}: { name: string; state: "available" | "loading" | "done" | "locked" | "nr" | "event-date" | "counterpart"; flash?: boolean }) {
  const dotClass =
    state === "done" ? "ms-dot ms-dot-done" :
    state === "locked" ? "ms-dot ms-dot-locked" :
    state === "nr" ? "ms-dot ms-dot-nr" :
    "ms-dot ms-dot-avail";

  return (
    <div key={flash ? "flash" : "noflash"}
      className={flash ? "agent-row-flash" : ""}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
        borderBottom: `0.5px solid ${BORDER}` }}>
      <div className={state === "done" ? `${dotClass} ms-pop` : dotClass} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: state === "locked" ? 400 : 600,
          color: state === "locked" ? TM : TP, textDecoration: state === "nr" ? "line-through" : "none" }}>
          {name}
        </p>
        {state === "done" && (
          <p style={{ fontSize: 10, color: TM }}>Completed 3 days ago</p>
        )}
        {state === "locked" && (
          <p style={{ fontSize: 10, color: TM }}>Previous steps must be completed first</p>
        )}
        {state === "counterpart" && (
          <div className="agent-reveal-in" style={{ fontSize: 10, color: AMBER, marginTop: 2 }}>
            Both sides need to be ready before you can confirm exchange.
          </div>
        )}
        {state === "event-date" && (
          <div className="agent-reveal-in" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <input className="agent-input agent-input-sm" style={{ width: 130 }} type="date" />
            {/* OLD: <button style={{fontSize:11, color:"#60a5fa"}}>Confirm</button> */}
            <button className="agent-btn agent-btn-sm agent-btn-primary">Confirm</button>
            {/* OLD: <button style={{fontSize:11, color: TM}}>Cancel</button> */}
            <button className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Cancel</button>
          </div>
        )}
      </div>
      {state === "available" && (
        <button className="ms-appear agent-btn agent-btn-sm agent-btn-primary">Confirm</button>
      )}
      {state === "loading" && (
        <button className="agent-btn agent-btn-sm agent-btn-primary" disabled>
          <span className="agent-btn-spinner" />
          {/* OLD: "Confirming…" text-only */}
          Confirming…
        </button>
      )}
      {state === "done" && (
        /* OLD: <button style={{fontSize:11, color: TM}}>Undo</button> */
        <button className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Undo</button>
      )}
      {state === "nr" && (
        <span style={{ fontSize: 10, color: TM }}>Skipped</span>
      )}
    </div>
  );
}

function ReminderRowMock({ label, urgency, snoozed }: {
  label: string; urgency: "escalated"|"overdue"|"today"|"upcoming"|"snoozed"|"complete"; snoozed?: string;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const cls = urgency === "escalated" ? "urg-escalated" :
    urgency === "overdue" ? "urg-overdue" :
    urgency === "today" ? "urg-today" :
    urgency === "snoozed" ? "urg-snoozed" :
    urgency === "complete" ? "urg-complete" : "urg-upcoming";
  return (
    <div style={{ padding: "8px 12px", borderBottom: `0.5px solid ${BORDER}`,
      display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: TP }}>{label}</p>
        <p className={cls} style={{ fontSize: 10 }}>
          {urgency === "escalated" ? "Escalated" :
           urgency === "overdue" ? "3d overdue" :
           urgency === "today" ? "Due today" :
           urgency === "snoozed" ? `Wakes ${snoozed}` :
           urgency === "complete" ? "Completed" : "Active from 12 Jun"}
        </p>
      </div>
      {urgency !== "complete" && urgency !== "snoozed" && (
        <>
          {/* OLD: <button style={{fontSize:10, color: TM}}>🕐</button> — no canonical */}
          <div style={{ position: "relative" }}>
            <button className="agent-icon-btn agent-icon-btn-sm" onClick={() => setSnoozeOpen(v => !v)}>
              🕐
            </button>
            {snoozeOpen && (
              <div className="agent-dropdown-in agent-surface-elevated" style={{
                position: "absolute", right: 0, top: "100%", marginTop: 4,
                borderRadius: 8, border: `0.5px solid ${BORDER}`,
                boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 20, minWidth: 100,
              }}>
                {/* OLD: inline style buttons with onMouseOver/Out hover */}
                {["24 h", "48 h", "72 h", "7 days"].map(t => (
                  <button key={t} className="agent-dropdown-item">{t}</button>
                ))}
              </div>
            )}
          </div>
          {/* OLD: <button style={{fontSize:10, color: OK}}>✓ Done</button> */}
          <button className="agent-btn agent-btn-sm agent-btn-ghost" style={{ fontSize: 10, color: OK }}>✓ Done</button>
        </>
      )}
      {urgency === "snoozed" && (
        /* OLD: <button style={{fontSize:10, color: TP}}>Wake up</button> */
        <button className="agent-link" style={{ fontSize: 10 }}>Wake up</button>
      )}
    </div>
  );
}

/* ─── Main page component ────────────────────────────────────────────────── */

const THEMES = ["sunset","coastal","heritage","slate","emerald","claret"];

export default function TransactionDetailPolish() {
  const [theme, setTheme] = useState("sunset");
  const [rm, setRm] = useState(false);
  const [status, setStatus] = useState<"active"|"on_hold"|"withdrawn"|"completed">("active");
  const [tab, setTab] = useState<"overview"|"milestones"|"reminders"|"todos"|"activity">("overview");
  const [msFlash, setMsFlash] = useState(false);
  const [showExchange, setShowExchange] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [showSurveyNr, setShowSurveyNr] = useState(false);
  const [showMortgage, setShowMortgage] = useState(false);
  const [showChase, setShowChase] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [chainState, setChainState] = useState<"no-chain"|"loading"|"empty"|"populated">("populated");
  const [nextMsState, setNextMsState] = useState<"hasNext"|"gatePending"|"completionPending"|"allComplete">("hasNext");
  const [msSide, setMsSide] = useState<"vendor"|"purchaser">("vendor");
  const [sectionOpen, setSectionOpen] = useState(true);
  const [statusDropOpen, setStatusDropOpen] = useState(false);
  const [chaseChannel, setChaseChannel] = useState<"email"|"whatsapp">("email");
  const [commsStep, setCommsStep] = useState(0); // 0=collapsed 1..4
  const [commsType, setCommsType] = useState<"note"|"outbound"|"inbound">("outbound");
  const [intelState, setIntelState] = useState<"loading"|"error"|"data">("data");
  const [editDirty, setEditDirty] = useState(false);
  const [propsaveStage, setPropSaveStage] = useState<"idle"|"tenure_preview"|"addr_modal">("idle");
  const [noSolicitor, setNoSolicitor] = useState(false);
  const [contactInviteState, setContactInviteState] = useState<"idle"|"sending"|"sent">("idle");
  const [composeState, setComposeState] = useState<"compose"|"no-sender"|"sent">("compose");
  const [toneDropOpen, setToneDropOpen] = useState(false);
  const [fileHealthType, setFileHealthType] = useState<"none"|"behind"|"overdue">("overdue");

  const TABS = ["Overview","Steps","Reminders","To-Do","Activity"];
  const tabKeys = ["overview","milestones","reminders","todos","activity"] as const;
  const activeTabIdx = tabKeys.indexOf(tab);
  const { btnRefs: tabBtnRefs, ind: tabInd } = useTabIndicator(activeTabIdx);

  const statusLabel = status === "active" ? "Active" : status === "on_hold" ? "On hold" :
    status === "withdrawn" ? "Withdrawn" : "Completed";
  const statusPillCls = status === "active" ? "agent-pill agent-pill-active" :
    status === "on_hold" ? "agent-pill agent-pill-hold" :
    status === "withdrawn" ? "agent-pill agent-pill-withdrawn" : "agent-pill agent-pill-completed";

  return (
    <div data-theme={theme} data-rm={rm ? "1" : undefined} className="agent-bg"
      style={{ padding: "40px 48px", minHeight: "100vh", fontFamily: "inherit" }}>
      <style>{CSS}</style>

      {/* ── Chrome ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: TP, marginBottom: 16 }}>
          Stage 2 — Transaction Detail
        </h1>
        <div className="pp-bar">
          <span className="pp-bar-label">Theme:</span>
          {THEMES.map(t => (
            <button key={t} className={`pp-pill${theme === t ? " on" : ""}`} onClick={() => setTheme(t)}>{t}</button>
          ))}
        </div>
        <div className="pp-bar">
          <span className="pp-bar-label">Reduced motion:</span>
          <button className={`pp-pill${rm ? " on" : ""}`} onClick={() => setRm(v => !v)}>{rm ? "ON" : "off"}</button>
        </div>
        <Ctrl label="Status" val={status} set={v => setStatus(v as typeof status)}
          opts={[{v:"active",t:"Active"},{v:"on_hold",t:"On hold"},{v:"withdrawn",t:"Withdrawn"},{v:"completed",t:"Completed"}]} />
        <Ctrl label="File health" val={fileHealthType} set={v => setFileHealthType(v as typeof fileHealthType)}
          opts={[{v:"none",t:"None"},{v:"behind",t:"Behind"},{v:"overdue",t:"Overdue"}]} />
        <Ctrl label="Next milestone" val={nextMsState} set={v => setNextMsState(v as typeof nextMsState)}
          opts={[{v:"hasNext",t:"Has next"},{v:"gatePending",t:"Gate pending"},{v:"completionPending",t:"Completion pending"},{v:"allComplete",t:"All complete"}]} />
        <Ctrl label="Intel card" val={intelState} set={v => setIntelState(v as typeof intelState)}
          opts={[{v:"loading",t:"Loading"},{v:"error",t:"Error"},{v:"data",t:"Data"}]} />
        <Ctrl label="Compose email" val={composeState} set={v => setComposeState(v as typeof composeState)}
          opts={[{v:"compose",t:"Compose"},{v:"no-sender",t:"No sender"},{v:"sent",t:"Sent"}]} />
        <div className="pp-bar">
          <span className="pp-bar-label">Modals:</span>
          <button className="pp-pill" onClick={() => setShowExchange(true)}>Exchange celebration</button>
          <button className="pp-pill" onClick={() => setShowUndo(true)}>Undo milestone</button>
          <button className="pp-pill" onClick={() => setShowSurveyNr(true)}>Survey NR</button>
          <button className="pp-pill" onClick={() => setShowMortgage(true)}>Mortgage</button>
        </div>
        <div className="pp-bar">
          <span className="pp-bar-label">Drawers:</span>
          <button className="pp-pill" onClick={() => setShowChase(true)}>Chase drawer</button>
          <button className="pp-pill" onClick={() => setShowEditDetails(true)}>Edit details</button>
          <button className="pp-pill" onClick={() => setShowReconciliation(true)}>Reconciliation</button>
          <button className="pp-pill" onClick={() => setShowAddNode(true)}>Add node</button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 1 — Loading skeleton
      ══════════════════════════════════════════════════════════ */}
      <SL text="1 — Loading skeleton" sub="loading.tsx: hero shimmer 96px + 3 content blocks" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Sk w="100%" h={96} />
        <Sk w="100%" h={160} />
        <Sk w="100%" h={200} />
        <Sk w="100%" h={140} />
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 2 — PropertyHero
      ══════════════════════════════════════════════════════════ */}
      <SL text="2 — PropertyHero + FileHealthBanner" sub="Status variants, back link → .agent-link, dropdown → .agent-dropdown-in" />

      {/* FileHealthBanner */}
      {fileHealthType !== "none" && (
        <div className="agent-reveal-in" style={{ marginBottom: 8,
          background: fileHealthType === "overdue" ? "var(--agent-danger-bg)" : "var(--agent-warning-bg)",
          border: `0.5px solid ${fileHealthType === "overdue" ? "var(--agent-danger-border)" : "var(--agent-warning-border)"}`,
          borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 600,
            color: fileHealthType === "overdue" ? "var(--agent-danger)" : "var(--agent-warning)" }}>
            {fileHealthType === "overdue" ? "3 reminders overdue" : "File may be behind schedule"}
          </span>
          {/* OLD: <a style={{fontSize:12, color:"#2563eb"}}>View reminders →</a> */}
          <button className="agent-link" style={{ fontSize: 12 }}>View reminders →</button>
        </div>
      )}

      {/* Hero */}
      <div style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(24px)",
        border: `0.5px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", marginBottom: 0 }}>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            {/* OLD: <a style={{fontSize:11, color:"#60a5fa"}}>← Back</a> */}
            <button className="agent-link agent-link-muted" style={{ fontSize: 11, marginBottom: 8 }}>← Back</button>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: TP, margin: "0 0 8px" }}>
              14 High Street, Maidstone ME15 9PQ
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Status badge — toggles via Ctrl */}
              <div style={{ position: "relative" }}>
                <button className={statusPillCls}
                  style={{ cursor: "pointer" }}
                  onClick={() => setStatusDropOpen(v => !v)}>
                  {statusLabel}
                </button>
                {statusDropOpen && (
                  /* OLD: appeared instantly, no animation */
                  <div className="agent-dropdown-in" style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30,
                    background: "var(--agent-surface-elevated)", border: `0.5px solid ${BORDER}`,
                    borderRadius: 10, minWidth: 140, boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
                    {/* OLD: inline style buttons with onMouseOver/Out hover */}
                    {["Active","On hold","Completed","Withdrawn"].map(s => (
                      <button key={s} className="agent-dropdown-item"
                        onClick={() => { setStatusDropOpen(false); }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, color: TM }}>J. Smith · 6 weeks active</span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 4, background: "rgba(30,45,74,.08)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "75%",
            background: `linear-gradient(90deg, ${CORAL}, var(--agent-coral-light))`,
            transition: "width 700ms ease-out" }} />
        </div>
        {/* Tab bar with sliding underline (A5 pattern) */}
        <div className="agent-tab-bar" style={{ padding: "0 20px", borderTop: `0.5px solid ${BORDER}` }}>
          {TABS.map((t, i) => (
            /* OLD: plain <button> with inline styles + onFocus/onBlur input-glow — incorrect for tabs */
            <button key={t}
              ref={el => { tabBtnRefs.current[i] = el; }}
              className="agent-tab"
              aria-selected={tab === tabKeys[i]}
              onClick={() => setTab(tabKeys[i])}>
              {t}
            </button>
          ))}
          {/* A5 sliding underline */}
          {tabInd && (
            <div style={{ position: "absolute", bottom: 0, height: 2, borderRadius: 1,
              background: CORAL, left: tabInd.left, width: tabInd.width,
              transition: rm ? "none" : "left 200ms ease, width 200ms ease" }} />
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 3 — Main layout: sidebar + tab content
      ══════════════════════════════════════════════════════════ */}
      <SL text="3 — Main layout" sub="Two-column: tab content (fluid) + sidebar (300px). Sidebar tokens verified." />
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Tab content area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ─── OVERVIEW TAB ─────────────────────────────────────── */}
          {tab === "overview" && (
            <>
              {/* NextMilestoneWidget */}
              {nextMsState !== "allComplete" && (
                <GlassCard>
                  <CardHdr title="Next steps" />
                  {(["Vendor","Purchaser"] as const).map(side => {
                    const st = nextMsState;
                    return (
                      <div key={side} style={{ display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 16px", borderBottom: `0.5px solid ${BORDER}` }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                          background: st === "gatePending" ? "var(--agent-warning-bg)" : "var(--agent-info-bg)",
                          border: `2px solid ${st === "gatePending" ? "var(--agent-warning-border)" : "var(--agent-info-border)"}` }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 10, fontWeight: 600, color: TM }}>{side}</p>
                          <p style={{ fontSize: 11, fontWeight: 600, color: TP }}>
                            {st === "gatePending" ? "Awaiting exchange-readiness" :
                             st === "completionPending" ? "Completion due 15 Aug" :
                             "Draft contract received"}
                          </p>
                        </div>
                        {st === "hasNext" && (
                          /* OLD: <button className="agent-btn-color-primary" style={{fontSize:11, padding:"4px 10px", borderRadius:8}}>Complete</button> */
                          <button className="agent-btn agent-btn-sm agent-btn-primary">Complete</button>
                        )}
                      </div>
                    );
                  })}
                </GlassCard>
              )}

              {/* RemindersWidget */}
              <GlassCard>
                <CardHdr title="Reminders" badge="3"
                  right={
                    /* OLD: <a style={{fontSize:11, color:"#2563eb"}}>View all →</a> */
                    <button className="agent-link" style={{ fontSize: 11 }}>View all →</button>
                  } />
                {[
                  { label: "Draft contract received", days: "3d overdue" },
                  { label: "Enquiries raised", days: "Due today" },
                  { label: "Search results received", days: "From 20 Jun" },
                ].map(r => (
                  <div key={r.label} style={{ padding: "8px 16px", borderBottom: `0.5px solid ${BORDER}`,
                    display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: TP }}>{r.label}</span>
                    <span style={{ fontSize: 10, color: TM }}>{r.days}</span>
                  </div>
                ))}
              </GlassCard>

              {/* RecentActivityWidget */}
              <GlassCard>
                <CardHdr title="Recent activity"
                  right={
                    /* OLD: <a style={{fontSize:11, color:"#2563eb"}}>View all →</a> */
                    <button className="agent-link" style={{ fontSize: 11 }}>View all →</button>
                  } />
                {[
                  { type: "→ Outbound", label: "Chased vendor solicitor", time: "2h ago" },
                  { type: "Step confirmed", label: "Memorandum of Sale received", time: "3 days ago" },
                  { type: "Internal", label: "Vendor wants to exchange before July", time: "5 days ago" },
                ].map(a => (
                  <div key={a.label} style={{ padding: "8px 16px", borderBottom: `0.5px solid ${BORDER}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 10, color: CORAL, fontWeight: 600 }}>{a.type}</span>
                      <p style={{ fontSize: 11, color: TP }}>{a.label}</p>
                    </div>
                    <span style={{ fontSize: 10, color: TM }}>{a.time}</span>
                  </div>
                ))}
              </GlassCard>

              {/* RiskScoreWidget */}
              <GlassCard>
                <CardHdr title="Fall-through risk" />
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: TM }}>Risk score</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TP }}>22 / 100</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(30,45,74,.08)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: "22%", height: "100%", background: "var(--agent-success)",
                      borderRadius: 3, transition: "width 700ms ease-out" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: TM }}>Low</span>
                    <span style={{ fontSize: 10, color: TM }}>High</span>
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: TP, marginTop: 8 }}>Low</p>
                  <p style={{ fontSize: 10, color: TM }}>From your file data</p>
                </div>
              </GlassCard>

              {/* ContactsSection */}
              <GlassCard>
                <CardHdr title="Contacts" badge="2"
                  right={
                    /* OLD: <button style={{fontSize:11, color:"#3b82f6"}}>+ Add contact</button> */
                    <button className="agent-link" style={{ fontSize: 11 }}>+ Add contact</button>
                  } />
                {[
                  { name: "John Smith", role: "Vendor", phone: "07700 900001", email: "john@example.com", hasToken: true },
                  { name: "Sarah Jones", role: "Purchaser", phone: "07700 900002", email: "sarah@example.com", hasToken: false },
                ].map(c => (
                  <div key={c.name} style={{ padding: "10px 16px", borderBottom: `0.5px solid ${BORDER}`,
                    display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="agent-avatar agent-avatar-sm">{c.name[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: TP }}>{c.name}</span>
                        <span style={{ fontSize: 10, background: c.role === "Vendor" ? "rgba(59,130,246,.1)" : "rgba(34,197,94,.1)",
                          color: c.role === "Vendor" ? "#3b82f6" : "#16a34a",
                          borderRadius: 4, padding: "1px 6px" }}>{c.role}</span>
                      </div>
                      {/* OLD: <p style={{ fontSize: 10, color: TM }}>{c.phone} · {c.email}</p> — plain text, no hover */}
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        <a href={`tel:${c.phone.replace(/\s/g,"")}`} className="agent-link agent-link-muted" style={{ fontSize: 10 }}>{c.phone}</a>
                        <a href={`mailto:${c.email}`} className="agent-link agent-link-muted" style={{ fontSize: 10 }}>{c.email}</a>
                      </div>
                    </div>
                    {c.hasToken ? (
                      /* OLD: <button style={{fontSize:10, background:"#3b82f6", color:"white", borderRadius:6, padding:"3px 8px"}}>Send invite</button> */
                      contactInviteState === "sent"
                        ? <button className="agent-btn agent-btn-sm agent-btn-primary" disabled>✓ Sent</button>
                        : contactInviteState === "sending"
                        ? <button className="agent-btn agent-btn-sm agent-btn-primary" disabled>Sending…</button>
                        : <button className="agent-btn agent-btn-sm agent-btn-primary"
                            onClick={() => { setContactInviteState("sending"); setTimeout(() => setContactInviteState("sent"), 1200); }}>
                            Send invite
                          </button>
                    ) : (
                      <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered">Set up portal</button>
                    )}
                    {/* OLD: hover-only edit/remove — inline handlers, no canonical class */}
                    <button className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Edit</button>
                    <button className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Remove</button>
                  </div>
                ))}
              </GlassCard>

              {/* SolicitorSection */}
              <GlassCard>
                <CardHdr title="Solicitors" />
                {["Vendor solicitor","Purchaser solicitor"].map((label, i) => (
                  <div key={label} style={{ padding: "12px 16px", borderBottom: i === 0 ? `0.5px solid ${BORDER}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: TM }}>{label}</span>
                      {/* OLD: <button style={{fontSize:11, color:"#3b82f6"}}>Edit</button> */}
                      <button className="agent-link" style={{ fontSize: 11 }}>
                        {noSolicitor ? "+ Add" : "Edit"}
                      </button>
                    </div>
                    {noSolicitor ? (
                      <p style={{ fontSize: 11, fontStyle: "italic", color: TM, marginTop: 4 }}>None added</p>
                    ) : (
                      <div style={{ marginTop: 6 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: TP }}>Smithson & Partners LLP</p>
                        <p style={{ fontSize: 11, color: TM }}>James Hawkins</p>
                        <div style={{ marginTop: 4, display: "flex", gap: 8 }}>
                          <span style={{ fontSize: 10, background: "rgba(16,185,129,.1)", color: "#059669",
                            borderRadius: 4, padding: "2px 6px" }}>Fast · 12 files · Avg 8w</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </GlassCard>

              {/* PropertyIntelCard */}
              <GlassCard>
                <CardHdr title="Property Intel" />
                {intelState === "loading" && (
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    <Sk w="100%" h={16} />
                    <Sk w="80%" h={16} />
                    <Sk w="60%" h={16} />
                  </div>
                )}
                {intelState === "error" && (
                  <div style={{ padding: 16 }}>
                    <p style={{ fontSize: 11, color: "var(--agent-danger)" }}>Could not load property data.</p>
                  </div>
                )}
                {intelState === "data" && (
                  <div style={{ padding: 14 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      {["Rightmove","Zoopla","Land Reg"].map(l => (
                        <button key={l} className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                          style={{ fontSize: 10 }}>{l}</button>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: TS, marginBottom: 6 }}>Price Paid History</p>
                    {[["Mar 2019","£295,000"],["Jun 2012","£218,000"]].map(([d,p]) => (
                      <div key={d} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: TM }}>{d}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: TP }}>{p}</span>
                      </div>
                    ))}
                    <p style={{ fontSize: 11, fontWeight: 600, color: TS, margin: "10px 0 6px" }}>EPC</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: CORAL, color: "white", fontSize: 16, fontWeight: 700,
                        width: 28, height: 28, borderRadius: 4, display: "flex", alignItems: "center",
                        justifyContent: "center" }}>C</span>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: TP }}>72 / 100</p>
                        <p style={{ fontSize: 10, color: TM }}>Inspected 14 Jan 2023</p>
                      </div>
                      <button className="agent-link" style={{ fontSize: 10, marginLeft: "auto" }}>View on GOV.UK →</button>
                    </div>
                    <p style={{ fontSize: 10, color: TM, marginTop: 10, fontStyle: "italic" }}>
                      Data sourced from Land Registry and EPC Register. Always verify before use.
                    </p>
                  </div>
                )}
              </GlassCard>

              {/* TransactionNotes */}
              <GlassCard>
                <CardHdr title="Notes" />
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {[
                      { text: "Vendor confirmed mortgage in principle issued.", time: "3 days ago" },
                      { text: "Solicitor requested ID docs — chased 2×.", time: "1 week ago" },
                    ].map(n => (
                      <div key={n.text} className="group" style={{ padding: "8px 10px",
                        background: "rgba(255,255,255,0.5)", borderRadius: 8,
                        border: `0.5px solid ${BORDER}`, position: "relative" }}>
                        <p style={{ fontSize: 12, color: TP }}>{n.text}</p>
                        <p style={{ fontSize: 10, color: TM, marginTop: 4 }}>{n.time}</p>
                        {/* OLD: opacity-0 with onMouseOver/Out — keyboard-invisible */}
                        <button className="agent-icon-btn agent-icon-btn-sm"
                          style={{ position: "absolute", top: 6, right: 6, opacity: 0.35 }}
                          onMouseOver={e => (e.currentTarget.style.opacity = "1")}
                          onFocus={e => (e.currentTarget.style.opacity = "1")}
                          onMouseOut={e => (e.currentTarget.style.opacity = "0.35")}
                          onBlur={e => (e.currentTarget.style.opacity = "0.35")}
                          aria-label="Delete note">×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <textarea className="agent-textarea" placeholder="Add a note…"
                      style={{ flex: 1, minHeight: 60, resize: "none" }} />
                    {/* OLD: <button className="agent-btn-color-primary" style={{fontSize:12}}>Add note</button> */}
                    <button className="agent-btn agent-btn-sm agent-btn-primary" style={{ alignSelf: "flex-end" }}>Add note</button>
                  </div>
                </div>
              </GlassCard>
            </>
          )}

          {/* ─── MILESTONES TAB ────────────────────────────────────── */}
          {tab === "milestones" && (
            <>
              <SL text="5 — Milestones tab" sub="Side tabs → .agent-segment-pill, section accordions → .agent-acc-hdr + .agent-acc" />

              {/* Progress bar */}
              <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.6)",
                borderRadius: 10, border: `0.5px solid ${BORDER}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: TM }}>Exchange progress</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: TP }}>75%</span>
                </div>
                <div style={{ height: 6, background: "rgba(30,45,74,.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div className="ms-bar-shimmer" style={{ width: "75%", height: "100%", borderRadius: 3,
                    transition: "width 700ms ease-out" }} />
                </div>
                <p style={{ fontSize: 10, color: TM, marginTop: 4 }}>18 of 24 steps complete</p>
              </div>

              {/* Side tabs: Vendor / Purchaser → .agent-segment-pill */}
              <div style={{ display: "flex", gap: 8 }}>
                {/* OLD: <button style={{background:"rgba(255,255,255,0.6)", borderRadius:8, boxShadow:"0 1px 3px rgba(0,0,0,.1)"}}>Vendor</button> */}
                <button className={`agent-segment-pill${msSide === "vendor" ? " on" : ""}`}
                  onClick={() => setMsSide("vendor")}>Vendor
                  <span className="agent-segment-pill-note">10/12</span>
                </button>
                <button className={`agent-segment-pill${msSide === "purchaser" ? " on" : ""}`}
                  onClick={() => setMsSide("purchaser")}>Purchaser
                  <span className="agent-segment-pill-note">8/12</span>
                </button>
              </div>

              {/* Section accordion — .agent-acc-hdr + .agent-acc */}
              <div className="pp-section">
                {/* OLD: plain div with group + transition-all */}
                <div className="agent-acc-hdr" role="button" tabIndex={0}
                  onClick={() => setSectionOpen(v => !v)}
                  onKeyDown={e => (e.key === "Enter" || e.key === " ") && setSectionOpen(v => !v)}
                  aria-expanded={sectionOpen}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="agent-acc-title">Conveyancing</span>
                    <span className="agent-badge">3/5</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transition: "transform 200ms", transform: sectionOpen ? "rotate(180deg)" : "rotate(0deg)",
                      color: TM }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div className={`agent-acc${sectionOpen ? " open" : ""}`}>
                  <div className="agent-acc-in">
                    <MilestoneRowMock name="Draft contract received" state="done" />
                    <MilestoneRowMock name="Enquiries raised" state="available" />
                    <MilestoneRowMock name="Enquiries replied" state="locked" />
                    <MilestoneRowMock name="Mortgage offer received" state="event-date" />
                    <MilestoneRowMock name="Confirmation milestone" state="loading" />
                    {/* Flash demo */}
                    <div style={{ padding: "8px 16px", borderBottom: `0.5px solid ${BORDER}`,
                      display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: TM }}>Row flash demo</span>
                      <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                        onClick={() => { setMsFlash(true); setTimeout(() => setMsFlash(false), 800); }}>
                        Trigger flash
                      </button>
                    </div>
                    <MilestoneRowMock name="Search results received" state="available" flash={msFlash} />
                  </div>
                </div>
              </div>

              {/* Exchange ready banner */}
              <div style={{ background: "rgba(16,185,129,.08)", border: "0.5px solid rgba(16,185,129,.25)",
                borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>✓</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-success)" }}>
                    Ready to exchange
                  </p>
                  <p style={{ fontSize: 11, color: "var(--agent-success)" }}>
                    All blocking steps are complete on both sides
                  </p>
                </div>
              </div>

              {/* NR section */}
              <div className="pp-section">
                <div className="agent-acc-hdr" style={{ borderBottom: "none" }}>
                  <span className="agent-acc-title">Skipped</span>
                  <span className="agent-badge">3</span>
                </div>
                {["Private survey booked","Survey report received","Leasehold pack received"].map(n => (
                  <div key={n} style={{ padding: "8px 16px", borderTop: `0.5px solid ${BORDER}`,
                    display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="ms-dot ms-dot-nr" />
                    <p style={{ fontSize: 11, color: TM, flex: 1, textDecoration: "line-through" }}>{n}</p>
                    {/* OLD: <button style={{fontSize:11, color:"#3b82f6"}}>Reinstate</button> */}
                    <button className="agent-link" style={{ fontSize: 11 }}>Reinstate</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ─── REMINDERS TAB ─────────────────────────────────────── */}
          {tab === "reminders" && (
            <>
              <SL text="6 — Reminders tab" sub="Urgency groups → .agent-acc-hdr, snooze menus → .agent-dropdown-in, Chase CTAs" />
              {(["Escalated","Overdue","Due today","Coming up"] as const).map((group, gi) => {
                const urgMap: Record<string, "escalated"|"overdue"|"today"|"upcoming"> = {
                  Escalated: "escalated", Overdue: "overdue", "Due today": "today", "Coming up": "upcoming",
                };
                return (
                  <div key={group} className="pp-section">
                    <div className="agent-acc-hdr agent-acc-hdr" style={{ borderBottom: "none" }}>
                      <span className={`agent-acc-title ${urgMap[group] === "escalated" ? "urg-escalated" : urgMap[group] === "overdue" ? "urg-overdue" : ""}`}>
                        {group}
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span className="agent-badge">2 items</span>
                        {/* OLD: <button style={{fontSize:10}}>Hide</button> — no canonical */}
                        <button className="agent-link agent-link-muted" style={{ fontSize: 10 }}>Hide</button>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 0 }}>
                      {/* Seller column */}
                      <div style={{ flex: 1, borderRight: `0.5px solid ${BORDER}` }}>
                        <div style={{ padding: "6px 12px", borderBottom: `0.5px solid ${BORDER}` }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: TM }}>Seller</span>
                        </div>
                        <ReminderRowMock label="Draft contract received" urgency={urgMap[group]} />
                        <div style={{ padding: "8px 12px", display: "flex", gap: 8 }}>
                          {/* OLD: <button style={{background:"#ea580c", color:"white"}}>Chase</button> */}
                          <button className="agent-btn agent-btn-sm agent-btn-primary" onClick={() => setShowChase(true)}>Chase</button>
                          {/* OLD: <button style={{fontSize:10, color:TM}}>🕐 Snooze all</button> */}
                          <button className="agent-btn agent-btn-sm agent-btn-ghost">🕐 Snooze all</button>
                        </div>
                      </div>
                      {/* Buyer column */}
                      <div style={{ flex: 1 }}>
                        <div style={{ padding: "6px 12px", borderBottom: `0.5px solid ${BORDER}` }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: TM }}>Buyer</span>
                        </div>
                        <ReminderRowMock label="Enquiries raised" urgency={urgMap[group]} />
                        <div style={{ padding: "8px 12px", display: "flex", gap: 8 }}>
                          <button className="agent-btn agent-btn-sm agent-btn-primary">Chase all (2)</button>
                          <button className="agent-btn agent-btn-sm agent-btn-ghost">🕐 Snooze all</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Snoozed group */}
              <div className="pp-section">
                <div className="agent-acc-hdr" style={{ borderBottom: "none" }}>
                  <span className="agent-acc-title urg-snoozed">Snoozed</span>
                  <span className="agent-badge">1</span>
                </div>
                <ReminderRowMock label="Mortgage offer received" urgency="snoozed" snoozed="Tomorrow 09:00" />
              </div>

              {/* Empty state */}
              <div className="pp-section">
                <div style={{ padding: "32px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: TP, marginBottom: 4 }}>No active reminders</p>
                  <p style={{ fontSize: 11, color: TM }}>Reminders are set up — they&apos;ll appear here as they come due.</p>
                </div>
              </div>
            </>
          )}

          {/* ─── TO-DO TAB ─────────────────────────────────────────── */}
          {tab === "todos" && (
            <>
              <SL text="7 — To-Do tab" sub="ManualTaskList — my tasks + agent requests, optimistic add" />
              <GlassCard>
                <CardHdr title="To-Do" />
                {["Draft mortgage instruction letter","Chase vendor solicitor re: ID","Book valuation visit"].map((task, i) => (
                  <div key={task} style={{ padding: "10px 16px", borderBottom: `0.5px solid ${BORDER}`,
                    display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={i === 0} readOnly
                      style={{ width: 14, height: 14, accentColor: CORAL }} />
                    <span style={{ fontSize: 12, color: TP, textDecoration: i === 0 ? "line-through" : "none",
                      flex: 1 }}>{task}</span>
                    <button className="agent-icon-btn agent-icon-btn-sm">×</button>
                  </div>
                ))}
                {/* Show done filter */}
                <div style={{ padding: "8px 16px" }}>
                  {/* OLD: <button style={{fontSize:11, color: TM}}>Show 1 done</button> */}
                  <button className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Show 1 done</button>
                </div>
              </GlassCard>

              {/* Agent requests */}
              <GlassCard>
                <CardHdr title="With Sales Progressor" badge="1" />
                <div style={{ padding: "10px 16px", borderBottom: `0.5px solid ${BORDER}` }}>
                  <p style={{ fontSize: 12, color: TP, marginBottom: 4 }}>Can you chase vendor solicitor urgently?</p>
                  <p style={{ fontSize: 10, color: TM }}>Your note · 2h ago</p>
                </div>
              </GlassCard>
            </>
          )}

          {/* ─── ACTIVITY TAB ──────────────────────────────────────── */}
          {tab === "activity" && (
            <>
              <SL text="8 — Activity tab" sub="Filter → .agent-segment-pill, search → agent-focus, CommsEntry wizard" />

              {/* Filter bar */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                {/* OLD: <button style={{background:"rgba(30,45,74,.15)", borderRadius:20}}>All</button> */}
                {["All","Steps","Comms","Automated","Notes"].map((f, fi) => (
                  <button key={f} className={`agent-segment-pill agent-segment-pill-sm${fi === 0 ? " on" : ""}`}>
                    {f}
                  </button>
                ))}
                {/* Search */}
                <div style={{ marginLeft: "auto" }}>
                  {/* OLD: focus:ring-1 focus:ring-blue-300/50 — not agent-focus */}
                  <input className="agent-input agent-input-sm agent-focus" placeholder="Search…"
                    style={{ width: 160 }} />
                </div>
              </div>

              {/* Timeline entries */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Milestone entry */}
                <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.6)",
                  borderRadius: 10, border: `0.5px solid ${BORDER}` }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, background: "rgba(16,185,129,.1)", color: "#059669",
                      borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>Step confirmed</span>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: TP }}>Memorandum of Sale received</p>
                  <p style={{ fontSize: 10, color: TM }}>Auto-confirmed · 3 days ago</p>
                </div>

                {/* Comm entry */}
                <div className="group" style={{ padding: "10px 14px", background: "rgba(255,255,255,0.6)",
                  borderRadius: 10, border: `0.5px solid ${BORDER}`, position: "relative" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, background: "rgba(255,107,74,.1)", color: CORAL,
                      borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>→ Outbound</span>
                    <span style={{ fontSize: 10, color: TM }}>Email</span>
                  </div>
                  <p style={{ fontSize: 12, color: TP }}>Chased vendor solicitor re: draft contract</p>
                  <p style={{ fontSize: 10, color: TM }}>J. Smith · 2h ago</p>
                  {/* OLD: opacity-0 with onMouseOver/Out — keyboard-invisible */}
                  <button className="agent-icon-btn agent-icon-btn-sm"
                    style={{ position: "absolute", top: 8, right: 10, opacity: 0.35 }}
                    onMouseOver={e => (e.currentTarget.style.opacity = "1")}
                    onFocus={e => (e.currentTarget.style.opacity = "1")}
                    onMouseOut={e => (e.currentTarget.style.opacity = "0.35")}
                    onBlur={e => (e.currentTarget.style.opacity = "0.35")}
                    aria-label="Delete entry">×</button>
                </div>

                <button className="agent-link agent-link-muted" style={{ fontSize: 11, alignSelf: "flex-start" }}>
                  Show 8 earlier updates…
                </button>
              </div>

              {/* CommsEntry wizard */}
              <div style={{ marginTop: 8 }}>
                {commsStep === 0 ? (
                  /* OLD: inline styled dashed button with onMouseOver/Out hover handlers */
                  <button onClick={() => setCommsStep(1)}
                    className="agent-btn agent-btn-ghost-bordered"
                    style={{ width: "100%", justifyContent: "flex-start",
                      borderStyle: "dashed", borderRadius: 10, fontSize: 12, padding: "12px 16px" }}>
                    + Add a note or log a communication…
                  </button>
                ) : (
                  <div className="agent-reveal-in" style={{ padding: "16px", background: "rgba(255,255,255,0.7)",
                    borderRadius: 12, border: `0.5px solid ${BORDER}` }}>
                    {/* Step indicator */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                      {[1,2,3,4].map(s => (
                        <div key={s} style={{ width: 8, height: 8, borderRadius: "50%",
                          background: s < commsStep ? "var(--agent-success)" : s === commsStep ? CORAL : "rgba(30,45,74,.15)" }} />
                      ))}
                      <button className="agent-link agent-link-muted" style={{ fontSize: 11, marginLeft: "auto" }}
                        onClick={() => setCommsStep(0)}>Start over</button>
                    </div>

                    {commsStep === 1 && (
                      <div className="agent-reveal-in">
                        <p style={{ fontSize: 11, color: TM, marginBottom: 10 }}>What type of entry is this?</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          {[{t:"📝 Internal note",v:"note"},{t:"→ Outbound",v:"outbound"},{t:"← Inbound",v:"inbound"}].map(opt => (
                            <button key={opt.v}
                              className={`agent-segment-pill${commsType === opt.v ? " on" : ""}`}
                              onClick={() => { setCommsType(opt.v as typeof commsType); setCommsStep(opt.v === "note" ? 4 : 2); }}>
                              {opt.t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {commsStep === 2 && (
                      <div className="agent-reveal-in">
                        <p style={{ fontSize: 11, color: TM, marginBottom: 10 }}>How was this communication made?</p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {["✉ Email","📞 Phone","💬 SMS","📱 Voicemail","📲 WhatsApp","📮 Post"].map(m => (
                            <button key={m} className="agent-segment-pill agent-segment-pill-sm"
                              onClick={() => setCommsStep(3)}>{m}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {commsStep === 3 && (
                      <div className="agent-reveal-in">
                        <p style={{ fontSize: 11, color: TM, marginBottom: 10 }}>Who was involved?</p>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                          {["John Smith","Sarah Jones"].map(c => (
                            <button key={c} className="agent-segment-pill agent-segment-pill-sm">{c}</button>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {/* OLD: <button style={{fontSize:11, color: TM}}>Skip</button> */}
                          <button className="agent-link agent-link-muted" style={{ fontSize: 11 }}
                            onClick={() => setCommsStep(4)}>Skip</button>
                          <button className="agent-btn agent-btn-sm agent-btn-primary"
                            onClick={() => setCommsStep(4)}>Continue</button>
                        </div>
                      </div>
                    )}

                    {commsStep === 4 && (
                      <div className="agent-reveal-in">
                        <textarea className="agent-textarea"
                          placeholder={commsType === "note" ? "Add an internal note…" : "What was discussed or communicated?"}
                          style={{ width: "100%", marginBottom: 10 }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* OLD: <button style={{background:"#3b82f6", color:"white"}}>Save</button> */}
                          <button className="agent-btn agent-btn-sm agent-btn-primary">Save</button>
                          <button className="agent-link agent-link-muted" style={{ fontSize: 11 }}
                            onClick={() => setCommsStep(0)}>Cancel</button>
                          {commsType !== "note" && (
                            <label style={{ display: "flex", alignItems: "center", gap: 6,
                              fontSize: 11, color: TM, marginLeft: "auto" }}>
                              <input type="checkbox" style={{ accentColor: CORAL }} />
                              Share with client
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* EmailParseWidget */}
              <div style={{ position: "relative", marginTop: 8 }}>
                <div style={{ opacity: 0.6, pointerEvents: "none", padding: "12px 16px",
                  background: "rgba(255,255,255,0.5)", borderRadius: 10, border: `0.5px solid ${BORDER}` }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: TP }}>Email reader — coming soon</p>
                  <p style={{ fontSize: 11, color: TM }}>
                    Paste an email and we&apos;ll suggest which steps to update. Available soon.
                  </p>
                </div>
                <button className="agent-icon-btn agent-icon-btn-sm"
                  style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>×</button>
              </div>

              {/* ComposeEmail */}
              <div style={{ marginTop: 8 }}>
                {composeState === "no-sender" && (
                  <div className="agent-reveal-in" style={{ background: "var(--agent-warning-bg)",
                    border: `0.5px solid var(--agent-warning-border)`, borderRadius: 10,
                    padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: AMBER }}>No verified sending address</p>
                      <p style={{ fontSize: 11, color: AMBER }}>
                        Go to <button className="agent-link" style={{ fontSize: 11 }}>Settings → Sending addresses</button> to verify a work email address before sending.
                      </p>
                    </div>
                    <button className="agent-icon-btn agent-icon-btn-sm">×</button>
                  </div>
                )}
                {composeState === "compose" && (
                  <div style={{ padding: "16px", background: "rgba(255,255,255,0.6)",
                    borderRadius: 12, border: `0.5px solid ${BORDER}` }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: TP, marginBottom: 12 }}>Compose email</p>
                    {[["From","updates@agency.co.uk"],["To",""],["Subject",""]].map(([label, val]) => (
                      <div key={label} style={{ marginBottom: 8 }}>
                        <label className="agent-label">{label}</label>
                        <input className="agent-input agent-input-sm" defaultValue={val}
                          placeholder={label === "To" ? "recipient@example.com" : label === "Subject" ? "Re: 14 Grosvenor Square" : undefined} />
                      </div>
                    ))}
                    <label className="agent-label">Message</label>
                    <textarea className="agent-textarea" placeholder="Write your email here…" style={{ marginBottom: 10 }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      {/* OLD: <button className="agent-btn-color-primary">Send</button> */}
                      <button className="agent-btn agent-btn-sm agent-btn-primary">Send</button>
                      <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered">Cancel</button>
                    </div>
                  </div>
                )}
                {composeState === "sent" && (
                  <div className="agent-reveal-in" style={{ padding: "12px 16px",
                    background: "var(--agent-success-bg)", border: `0.5px solid var(--agent-success-border)`,
                    borderRadius: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-success)" }}>✓ Email sent</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <MockSidebar rm={rm} onEditDetails={() => setShowEditDetails(true)} />
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 9 — Drawers (shown below, inline)
      ══════════════════════════════════════════════════════════ */}
      <SL text="9 — Drawers & modals" sub="All drawer/modal variants. Close buttons → .agent-icon-btn, Cancel → .agent-btn-ghost-bordered" />

      {/* Chase Drawer */}
      <div className="pp-bar" style={{ marginBottom: 10 }}>
        <span className="pp-bar-label">Chase channel:</span>
        <button className={`pp-pill${chaseChannel === "email" ? " on" : ""}`} onClick={() => setChaseChannel("email")}>Email</button>
        <button className={`pp-pill${chaseChannel === "whatsapp" ? " on" : ""}`} onClick={() => setChaseChannel("whatsapp")}>WhatsApp</button>
        <span className="pp-bar-label" style={{ marginLeft: 16 }}>Tone dropdown:</span>
        <button className="pp-pill" onClick={() => setToneDropOpen(v => !v)}>Toggle tone picker</button>
      </div>
      {showChase && (
      <div style={{ position: "fixed", inset: 0, zIndex: 200 }} data-theme={theme} data-rm={rm ? "1" : undefined}>
        <div className="pp-drawer-backdrop" onClick={() => setShowChase(false)} />
        <div className="pp-overlay-drawer">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `0.5px solid ${BORDER}` }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: TP }}>Chase</p>
            <p style={{ fontSize: 11, color: TM }}>Draft contract received · 14 High Street</p>
          </div>
          <button className="agent-icon-btn agent-icon-btn-md" onClick={() => setShowChase(false)}>×</button>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Channel tabs */}
          <div>
            <p style={{ fontSize: 11, color: TM, marginBottom: 6 }}>Send via</p>
            <div style={{ display: "flex", gap: 8 }}>
              {/* OLD: bespoke button styling for channel tabs */}
              <button className={`agent-segment-pill${chaseChannel === "email" ? " on" : ""}`}
                onClick={() => setChaseChannel("email")}>Email</button>
              <button className={`agent-segment-pill${chaseChannel === "whatsapp" ? " on" : ""}`}
                onClick={() => setChaseChannel("whatsapp")}>WhatsApp</button>
            </div>
          </div>

          {/* CC toggle (email only) */}
          {chaseChannel === "email" && (
            <div className="agent-reveal-in">
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TS }}>
                <input type="checkbox" style={{ accentColor: CORAL }} />
                CC Smithson & Partners LLP (solicitor)
              </label>
            </div>
          )}

          {/* Tone dropdown */}
          <div style={{ position: "relative" }}>
            <p style={{ fontSize: 11, color: TM, marginBottom: 4 }}>Tone
              <span style={{ fontSize: 10, color: TM, marginLeft: 6 }}>Auto-selected · override if needed</span>
            </p>
            <button className="agent-btn agent-btn-sm agent-btn-secondary"
              style={{ width: "100%", justifyContent: "space-between" }}
              onClick={() => setToneDropOpen(v => !v)}>
              <span>Professional</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {toneDropOpen && (
              /* OLD: appeared instantly, no animation */
              <div className="agent-dropdown-in" style={{
                position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)",
                background: "var(--agent-surface-elevated)", border: `0.5px solid ${BORDER}`,
                borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 20 }}>
                {/* OLD: inline style buttons with onMouseOver/Out hover */}
                {["Professional","Friendly","Urgent (polite)","Final notice"].map((t, ti) => (
                  <button key={t} className="agent-dropdown-item" style={{ justifyContent: "space-between" }}
                    onClick={() => setToneDropOpen(false)}>
                    {t}
                    {ti === 0 && <span style={{ fontSize: 10, color: CORAL }}>Recommended</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Generate */}
          <button className="agent-btn agent-btn-md agent-btn-primary" style={{ width: "100%" }}>Generate message</button>

          {/* Message area */}
          <textarea className="agent-textarea"
            placeholder={chaseChannel === "email"
              ? "Generate a message above, or type your own…"
              : "Generate a WhatsApp message above, or type your own…"}
            style={{ minHeight: 100 }}
            defaultValue="Dear Smithson & Partners, I'm following up regarding the draft contract for 14 High Street, Maidstone..." />

          {/* Recipient note */}
          <p style={{ fontSize: 11, color: TM }}>
            {chaseChannel === "email" ? "To: james@smithsonpartners.co.uk" : "We'll log this and open WhatsApp"}
          </p>

          {/* Send */}
          <button className="agent-btn agent-btn-md agent-btn-primary" style={{ width: "100%" }}>
            {chaseChannel === "email" ? "Send chase" : "Send via WhatsApp"}
          </button>
        </div>
        </div>
      </div>
      )} {/* end showChase */}

      {/* Chain Drawer — always visible (state-driven content, no open/close toggle needed) */}
      <div className="pp-bar">
        <span className="pp-bar-label">Chain state:</span>
        {(["no-chain","loading","empty","populated"] as const).map(s => (
          <button key={s} className={`pp-pill${chainState === s ? " on" : ""}`}
            onClick={() => setChainState(s)}>{s}</button>
        ))}
      </div>
      <div className="pp-drawer" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `0.5px solid ${BORDER}` }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: TP }}>Chain progress</p>
            <p style={{ fontSize: 11, color: TM }}>Track progress across every linked sale</p>
          </div>
          <button className="agent-icon-btn agent-icon-btn-md">×</button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {chainState === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0,1,2].map(i => <Sk key={i} w="100%" h={60} />)}
            </div>
          )}
          {chainState === "no-chain" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: TP, marginBottom: 6 }}>No chain linked to this sale</p>
              <p style={{ fontSize: 11, color: TM, marginBottom: 14 }}>
                Create a chain to track where your sale sits and invite other agents to share updates.
              </p>
              {/* OLD: bespoke blue button */}
              <button className="agent-btn agent-btn-md agent-btn-primary">+ Create chain</button>
            </div>
          )}
          {chainState === "empty" && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: TP, marginBottom: 6 }}>Chain created — add the first sale</p>
              <p style={{ fontSize: 11, color: TM, marginBottom: 14 }}>
                Add the sale above or below this one to start tracking the chain together.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {/* OLD: agent-hover-link dashed buttons → now agent-btn-ghost-bordered with dashed style */}
                <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                  style={{ borderStyle: "dashed" }}>+ Add sale above</button>
                <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                  style={{ borderStyle: "dashed" }}>+ Add sale below</button>
              </div>
            </div>
          )}
          {chainState === "populated" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Add above */}
              {/* OLD: agent-hover-link */}
              <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                style={{ borderStyle: "dashed", width: "100%" }}>+ Add sale above</button>

              {/* Link cards */}
              {[
                { addr: "22 Church Lane, Maidstone", agency: "Countrywide", status: "active", invited: true },
                { addr: "14 High Street (this sale)", agency: "Your agency", status: "this", invited: false },
                { addr: "8 Orchard Road, Bearsted", agency: "Connells", status: "active", invited: false },
              ].map((link, li) => (
                <div key={li} style={{ padding: "10px 14px",
                  background: link.status === "this" ? "var(--agent-coral-bg-tint)" : "rgba(255,255,255,0.6)",
                  borderRadius: 10, border: `0.5px solid ${link.status === "this" ? "var(--agent-coral-pale)" : BORDER}` }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: TP }}>{link.addr}</p>
                  <p style={{ fontSize: 11, color: TM }}>{link.agency}</p>
                  {!link.invited && link.status !== "this" && (
                    <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                      <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ fontSize: 10 }}>
                        Resend invite
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Add below */}
              <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                style={{ borderStyle: "dashed", width: "100%" }}>+ Add sale below</button>

              {/* Bulk invite footer */}
              <div style={{ marginTop: 8, padding: "10px 14px",
                background: "rgba(255,255,255,0.5)", borderRadius: 10, border: `0.5px solid ${BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: TM }}>1 agent ready to invite</span>
                <button className="agent-btn agent-btn-sm agent-btn-primary">Send invites</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EditSaleDetailsDrawer */}
      <div className="pp-bar">
        <span className="pp-bar-label">Edit details — open:</span>
        <button className={`pp-pill${!showEditDetails ? " on" : ""}`} onClick={() => setShowEditDetails(false)}>Hidden</button>
        <button className={`pp-pill${showEditDetails ? " on" : ""}`} onClick={() => setShowEditDetails(true)}>Open</button>
        <span className="pp-bar-label" style={{ marginLeft: 16 }}>State:</span>
        <button className={`pp-pill${!editDirty ? " on" : ""}`} onClick={() => setEditDirty(false)}>Clean</button>
        <button className={`pp-pill${editDirty ? " on" : ""}`} onClick={() => setEditDirty(true)}>Dirty (unsaved)</button>
        <span className="pp-bar-label" style={{ marginLeft: 12 }}>PropSaveStage:</span>
        {(["idle","tenure_preview","addr_modal"] as const).map(s => (
          <button key={s} className={`pp-pill${propsaveStage === s ? " on" : ""}`}
            onClick={() => setPropSaveStage(s)}>{s}</button>
        ))}
      </div>
      {showEditDetails && (
      <div style={{ position: "fixed", inset: 0, zIndex: 200 }} data-theme={theme} data-rm={rm ? "1" : undefined}>
        <div className="pp-drawer-backdrop" onClick={() => setShowEditDetails(false)} />
        <div className="pp-overlay-drawer">
        {/* Dirty chips */}
        {editDirty && (
          <div className="agent-reveal-in" style={{ padding: "8px 16px", borderBottom: `0.5px solid ${BORDER}`,
            display: "flex", gap: 8, background: "var(--agent-warning-bg)" }}>
            <span style={{ fontSize: 10, color: AMBER }}>1 unsaved section</span>
            <button className="agent-badge" style={{ cursor: "pointer" }}>Price & Fees · unsaved</button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `0.5px solid ${BORDER}` }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: TP }}>Edit sale details</p>
            <p style={{ fontSize: 11, color: TM }}>Changes save per section</p>
          </div>
          <button className="agent-icon-btn agent-icon-btn-md" onClick={() => setShowEditDetails(false)}>×</button>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Property section */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.06em", color: CORAL, marginBottom: 10 }}>Property</p>
            {[["Address","14 High Street, Maidstone ME15 9PQ"],["Tenure",""],["Purchase type",""]].map(([label, val]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <label className="agent-label">{label}</label>
                {label === "Tenure" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    {/* OLD: plain styled buttons */}
                    <button className="agent-segment-pill on">Freehold</button>
                    <button className="agent-segment-pill">Leasehold</button>
                  </div>
                ) : label === "Purchase type" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="agent-segment-pill on">Mortgage</button>
                    <button className="agent-segment-pill">Cash buyer</button>
                    <button className="agent-segment-pill">Cash from proceeds</button>
                  </div>
                ) : (
                  <input className="agent-input" defaultValue={val} />
                )}
              </div>
            ))}

            {/* Tenure preview (PropSaveStage) */}
            {propsaveStage === "tenure_preview" && (
              <div className="agent-reveal-in" style={{ padding: "12px", background: "rgba(16,185,129,.06)",
                border: "0.5px solid rgba(16,185,129,.2)", borderRadius: 8, marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-success)", marginBottom: 6 }}>
                  Steps that will be skipped
                </p>
                <p style={{ fontSize: 11, color: TP }}>Leasehold pack received</p>
                <p style={{ fontSize: 11, color: TP }}>Management info received</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="agent-btn agent-btn-sm agent-btn-primary">
                {propsaveStage === "tenure_preview" ? "Confirm changes" :
                 propsaveStage === "idle" ? "Preview & save" : "Checking…"}
              </button>
              {/* OLD: <button style={{fontSize:11, color: TM}}>Cancel</button> */}
              <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered">Cancel</button>
            </div>
          </div>

          {/* Price & Fees section */}
          <div style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.06em", color: CORAL, marginBottom: 10 }}>Price & Fees</p>
            {[["Purchase price","£375,000"],["Agent fee","£5,000"]].map(([label, val]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <label className="agent-label">{label}</label>
                <input className="agent-input" defaultValue={val} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button className="agent-segment-pill on">Fixed £</button>
              <button className="agent-segment-pill">Percentage %</button>
              <button className="agent-segment-pill on" style={{ marginLeft: "auto" }}>+ VAT</button>
              <button className="agent-segment-pill">Inc VAT</button>
            </div>
            <button className="agent-btn agent-btn-sm agent-btn-primary">
              {editDirty ? "Save" : "Save"}
            </button>
          </div>

          {/* Timeline section */}
          <div style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.06em", color: CORAL, marginBottom: 10 }}>Timeline</p>
            <label className="agent-label">Expected exchange date</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input className="agent-input" defaultValue="28 Jun 2025" style={{ flex: 1 }} />
              {/* OLD: <button style={{fontSize:11, color:"#60a5fa"}}>Set override</button> */}
              <button className="agent-link" style={{ fontSize: 11 }}>Use a different date</button>
            </div>
            <button className="agent-btn agent-btn-sm agent-btn-primary">Save</button>
          </div>
        </div>
        </div>
      </div>
      )} {/* end showEditDetails */}

      {/* Reconciliation Drawer */}
      <div className="pp-bar">
        <span className="pp-bar-label">Reconciliation — open:</span>
        <button className={`pp-pill${!showReconciliation ? " on" : ""}`} onClick={() => setShowReconciliation(false)}>Hidden</button>
        <button className={`pp-pill${showReconciliation ? " on" : ""}`} onClick={() => setShowReconciliation(true)}>Open</button>
      </div>
      {showReconciliation && (
      <div style={{ position: "fixed", inset: 0, zIndex: 200 }} data-theme={theme} data-rm={rm ? "1" : undefined}>
        <div className="pp-drawer-backdrop" onClick={() => setShowReconciliation(false)} />
        <div className="pp-overlay-drawer">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `0.5px solid ${BORDER}` }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: TP }}>Confirm exchange</p>
          <button className="agent-icon-btn agent-icon-btn-md" onClick={() => setShowReconciliation(false)}>×</button>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="agent-label">Date contracts exchanged</label>
            <input className="agent-input" type="date" defaultValue="2025-06-20" />
            <p style={{ fontSize: 10, color: TM, marginTop: 4 }}>Pre-filled with today — change if it was different</p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: TS, marginBottom: 6 }}>Steps not yet confirmed</p>
            <p style={{ fontSize: 10, color: TM, marginBottom: 10 }}>
              Tick the steps below that are done. We&apos;ll check them off at exchange. Leave a step unticked to exclude it.
            </p>
            {[["Vendor","Mortgage offer received"],["Purchaser","Search results received"]].map(([side, ms]) => (
              <div key={ms} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input type="checkbox" style={{ accentColor: CORAL }} />
                <span style={{ fontSize: 11, color: TP }}>{side} — {ms}</span>
                <input className="agent-input agent-input-sm" type="date" style={{ marginLeft: "auto", width: 140 }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: `0.5px solid ${BORDER}` }}>
            <button className="agent-btn agent-btn-md agent-btn-primary" style={{ flex: 1 }}>Confirm exchange</button>
            {/* OLD: <button style={{fontSize:12, color: TM}}>Cancel</button> */}
            <button className="agent-btn agent-btn-md agent-btn-ghost-bordered"
              onClick={() => setShowReconciliation(false)}>Cancel</button>
          </div>
        </div>
        </div>
      </div>
      )} {/* end showReconciliation */}

      {/* AddNodeDrawer */}
      <div className="pp-bar">
        <span className="pp-bar-label">Add node — open:</span>
        <button className={`pp-pill${!showAddNode ? " on" : ""}`} onClick={() => setShowAddNode(false)}>Hidden</button>
        <button className={`pp-pill${showAddNode ? " on" : ""}`} onClick={() => setShowAddNode(true)}>Open</button>
      </div>
      {showAddNode && (
      <div style={{ position: "fixed", inset: 0, zIndex: 200 }} data-theme={theme} data-rm={rm ? "1" : undefined}>
        <div className="pp-drawer-backdrop" onClick={() => setShowAddNode(false)} />
        <div className="pp-overlay-drawer">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `0.5px solid ${BORDER}` }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: TP }}>Add sale above</p>
            <p style={{ fontSize: 11, color: TM }}>Tell us about this sale</p>
          </div>
          <button className="agent-icon-btn agent-icon-btn-md" onClick={() => setShowAddNode(false)}>×</button>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[["Property address",""],["Agency name",""],["Agent name","(optional)"],["Agent email","(optional — add email to send invite)"]].map(([label, hint]) => (
            <div key={label}>
              <label className="agent-label">{label}
                {hint && <span style={{ fontSize: 10, color: TM, fontWeight: 400 }}> {hint}</span>}
              </label>
              <input className="agent-input" />
            </div>
          ))}
          <p style={{ fontSize: 10, color: TM }}>Property address and agency name are required</p>
          <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: `0.5px solid ${BORDER}` }}>
            <button className="agent-btn agent-btn-md agent-btn-primary" style={{ flex: 1 }}>Save and add above</button>
            <button className="agent-btn agent-btn-md agent-btn-ghost-bordered"
              onClick={() => setShowAddNode(false)}>Cancel</button>
          </div>
        </div>
        </div>
      </div>
      )} {/* end showAddNode */}

      {/* ══════════════════════════════════════════════════════════
          Modals (overlaid)
      ══════════════════════════════════════════════════════════ */}

      {/* ExchangeCelebration */}
      {showExchange && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <div className="agent-backdrop-overlay" style={{ position: "absolute", inset: 0 }}
            onClick={() => setShowExchange(false)} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="exchange-modal agent-modal" style={{
              padding: 32, maxWidth: 400, textAlign: "center", position: "relative", zIndex: 1 }}>
              <p style={{ fontSize: 28 }}>🎉</p>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: TP, margin: "12px 0 4px" }}>Exchange confirmed</h2>
              <p style={{ fontSize: 14, color: TP, marginBottom: 4 }}>14 High Street, Maidstone ME15 9PQ</p>
              {/* OLD: "Contracts are now legally exchanged. Your fee is crystallised — congratulations." */}
              <p style={{ fontSize: 13, color: TS, marginBottom: 20 }}>
                Contracts are now legally exchanged. Your fee is crystallised.
              </p>
              <button className="agent-btn agent-btn-md agent-btn-primary" style={{ width: "100%" }}
                onClick={() => setShowExchange(false)}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* UndoMilestoneModal */}
      {showUndo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <div className="agent-backdrop-overlay" style={{ position: "absolute", inset: 0 }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="agent-modal">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: TP }}>Undo step</h3>
                <button className="agent-icon-btn agent-icon-btn-sm" onClick={() => setShowUndo(false)}>×</button>
              </div>
              <p style={{ fontSize: 13, color: TS, marginBottom: 16 }}>
                Enquiries raised — what would you like to do?
              </p>
              {/* Undo options */}
              {[
                { title: "Undo this step only", desc: "This step is undone — steps that follow stay as they are.", delta: "75% → 71%" },
                { title: "Undo this step and linked steps", desc: "This step and all completed steps that follow are undone.", delta: "75% → 58%" },
              ].map((opt, oi) => (
                <label key={oi} style={{ display: "flex", gap: 10, padding: "10px 12px", marginBottom: 8,
                  borderRadius: 8, border: `0.5px solid ${BORDER}`, cursor: "pointer" }}>
                  <input type="radio" name="undoMode" defaultChecked={oi === 0}
                    style={{ marginTop: 2, accentColor: CORAL }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: TP }}>{opt.title}</p>
                    <p style={{ fontSize: 11, color: TM }}>{opt.desc}</p>
                    <p style={{ fontSize: 10, color: TM, marginTop: 4 }}>Progress: {opt.delta}</p>
                  </div>
                </label>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="agent-btn agent-btn-md agent-btn-primary" style={{ flex: 1 }}>Undo step</button>
                {/* OLD: <button style={{fontSize:12, color: TM}}>Cancel</button> */}
                <button className="agent-btn agent-btn-md agent-btn-ghost-bordered"
                  onClick={() => setShowUndo(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SurveyNrConfirmModal */}
      {showSurveyNr && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <div className="agent-backdrop-overlay" style={{ position: "absolute", inset: 0 }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="agent-modal">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: TP }}>No private survey required?</h3>
                <button className="agent-icon-btn agent-icon-btn-sm" onClick={() => setShowSurveyNr(false)}>×</button>
              </div>
              <p style={{ fontSize: 13, color: TS, marginBottom: 20 }}>
                Please confirm the buyer doesn&apos;t need a private survey.
                The survey report step will also be skipped.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="agent-btn agent-btn-md agent-btn-primary" style={{ flex: 1 }}
                  onClick={() => setShowSurveyNr(false)}>Yes, skip these</button>
                <button className="agent-btn agent-btn-md agent-btn-ghost-bordered"
                  onClick={() => setShowSurveyNr(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MortgageModal */}
      {showMortgage && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <div className="agent-backdrop-overlay" style={{ position: "absolute", inset: 0 }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="agent-modal">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: TP }}>Is this buyer now using a mortgage?</h3>
                <button className="agent-icon-btn agent-icon-btn-sm" onClick={() => setShowMortgage(false)}>×</button>
              </div>
              <p style={{ fontSize: 13, color: TS, marginBottom: 20 }}>
                Reinstating this will re-open the mortgage steps and update the purchase type.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* OLD: plain button styling */}
                <button className="agent-btn agent-btn-md agent-btn-primary" style={{ width: "100%" }}
                  onClick={() => setShowMortgage(false)}>Yes — mortgage buyer</button>
                <button className="agent-btn agent-btn-md agent-btn-ghost-bordered" style={{ width: "100%" }}
                  onClick={() => setShowMortgage(false)}>Reinstate without changing purchase type</button>
                <button className="agent-link agent-link-muted" style={{ fontSize: 12, alignSelf: "center" }}
                  onClick={() => setShowMortgage(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SECTION 10 — Mobile view (375px frame)
      ══════════════════════════════════════════════════════════ */}
      <SL text="10 — Mobile (375px)" sub="Single column: hero (sticky) + scrollable tab bar + stacked sidebar below" />
      <p className="m-label">Mobile frame</p>
      <div className="m-frame">
        {/* Mobile hero */}
        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(28px)",
          borderBottom: `0.5px solid ${BORDER}`, padding: "12px 14px", position: "sticky", top: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <button className="agent-link agent-link-muted" style={{ fontSize: 11 }}>← Back</button>
            <span className="agent-pill agent-pill-active" style={{ fontSize: 10 }}>Active</span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: TP }}>14 High Street, Maidstone</p>
          <p style={{ fontSize: 11, color: TM }}>ME15 9PQ</p>
          {/* Progress bar */}
          <div style={{ height: 3, background: "rgba(30,45,74,.08)", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
            <div style={{ width: "75%", height: "100%", background: `linear-gradient(90deg, ${CORAL}, var(--agent-coral-light))` }} />
          </div>
        </div>

        {/* Mobile tab bar (scrollable) */}
        <div style={{ overflowX: "auto", whiteSpace: "nowrap", borderBottom: `0.5px solid ${BORDER}`,
          display: "flex", padding: "0 8px", background: "rgba(255,255,255,0.7)" }}>
          {TABS.map((t, i) => (
            <button key={t} style={{ padding: "10px 10px", fontSize: 11,
              fontWeight: tab === tabKeys[i] ? 600 : 400,
              color: tab === tabKeys[i] ? TP : TM,
              background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === tabKeys[i] ? `2px solid ${CORAL}` : "2px solid transparent" }}>
              {t}
            </button>
          ))}
        </div>

        {/* Mobile content */}
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* NextMilestoneWidget */}
          <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 10,
            border: `0.5px solid ${BORDER}`, overflow: "hidden" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: TS, padding: "8px 12px",
              borderBottom: `0.5px solid ${BORDER}` }}>Next steps</p>
            {["Vendor","Purchaser"].map(s => (
              <div key={s} style={{ padding: "8px 12px", borderBottom: `0.5px solid ${BORDER}`,
                display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--agent-info-bg)",
                  border: "2px solid var(--agent-info-border)", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 9, fontWeight: 600, color: TM }}>{s}</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: TP }}>Draft contract received</p>
                </div>
                <button className="agent-btn agent-btn-sm agent-btn-primary" style={{ fontSize: 10 }}>Complete</button>
              </div>
            ))}
          </div>

          {/* Sidebar stacked below on mobile */}
          <p style={{ fontSize: 10, color: TM, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.06em", marginTop: 4 }}>File details</p>
          <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 10,
            border: `0.5px solid ${BORDER}`, padding: "12px" }}>
            {[["Purchase price","£375,000"],["Agent fee","£5,000 + VAT"],["Net income","£5,241"]].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: TM }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: TP }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Toast examples
      ══════════════════════════════════════════════════════════ */}
      <SL text="Toasts" sub="All toast variants used on this page" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
        {[
          { type: "success", title: "Draft contract received", desc: undefined },
          { type: "success", title: "Step undone", desc: undefined },
          { type: "success", title: "Skipped", desc: undefined },
          { type: "success", title: "Reminders are set up", desc: "Check the Reminders tab to see what needs following up." },
          { type: "success", title: "MOS confirmed for both sides", desc: "Seller and buyer MOS received steps confirmed." },
          { type: "error", title: "Couldn't confirm step — try again.", desc: undefined },
        ].map(t => (
          <div key={t.title} className={`agent-toast agent-toast-${t.type}`}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: TP }}>{t.title}</p>
              {t.desc && <p style={{ fontSize: 11, color: TS, marginTop: 2 }}>{t.desc}</p>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 80 }} />
    </div>
  );
}
