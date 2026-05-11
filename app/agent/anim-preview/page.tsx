"use client";

import { useState, useEffect, useRef } from "react";

/* ─── Token aliases ──────────────────────────────────────────────────────── */
const CORAL   = "#FF6B4A";
const TP      = "#1A1D29";
const TS      = "#4A5162";
const TM      = "#8B91A3";
const SUCCESS = "#10B981";
const AMBER   = "#F59E0B";

/* ─── Inline CSS ─────────────────────────────────────────────────────────── */
const CSS = `
/* ═══ Reduced-motion override ════════════════════════════════════════════ */
/* Simulates prefers-reduced-motion: reduce when the toggle is ON.         */
[data-rm="1"] *,
[data-rm="1"] *::before,
[data-rm="1"] *::after {
  animation-duration:         0.01ms !important;
  animation-iteration-count:  1      !important;
  animation-delay:            0ms    !important;
  transition-duration:        0.01ms !important;
  transition-delay:           0ms    !important;
}

/* ═══ A1 / A3  Dropdown entrance ══════════════════════════════════════════ */
@keyframes _dd {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.prev-dd { animation: _dd 120ms ease-out both; }

/* ═══ B2  Notification panel ══════════════════════════════════════════════ */
@keyframes _ni { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
@keyframes _no { from { opacity:1; transform:translateY(0); }   to { opacity:0; transform:translateY(-5px); } }
.prev-ni { animation: _ni 200ms ease-out both; }
.prev-no { animation: _no 280ms ease-in  both; }

/* ═══ B5  Modal entrance ══════════════════════════════════════════════════ */
@keyframes _mo {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}
.prev-mo { animation: _mo 180ms ease-out both; }

/* ═══ B6  Sheet slide-up ══════════════════════════════════════════════════ */
@keyframes _sh {
  from { opacity: 0.5; transform: translateY(100%); }
  to   { opacity: 1;   transform: translateY(0); }
}
.prev-sh { animation: _sh 260ms cubic-bezier(0.32, 0.72, 0, 1) both; }

/* ═══ F1 / F3  Row confirm flash ══════════════════════════════════════════ */
@keyframes _rf {
  0%   { background: transparent; }
  20%  { background: rgba(16, 185, 129, 0.07); }
  100% { background: transparent; }
}
.prev-rf { animation: _rf 700ms ease-out both; }

/* ═══ Accordion  (B1, B3, B7, E2) ════════════════════════════════════════ */
/* Inner child MUST have overflow:hidden + min-height:0 to collapse to 0fr */
.acc          { display: grid; }
.acc.closed   { grid-template-rows: 0fr; }
.acc.open     { grid-template-rows: 1fr; }
.acc.animated { transition: grid-template-rows 220ms ease; }
.acc-in       { overflow: hidden; min-height: 0; }

/* ═══ A2  Portal button press ════════════════════════════════════════════ */
.portal-press:active { transform: scale(0.97); }

/* ═══ Page chrome ════════════════════════════════════════════════════════ */
.prev-badge {
  font-family: monospace; font-size: 11px; font-weight: 700;
  background: rgba(255,107,74,0.10); color: #FF6B4A;
  border: 1px solid rgba(255,107,74,0.25); border-radius: 6px;
  padding: 1px 7px; display: inline-block; flex-shrink: 0;
}
.prev-sh {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.12em; color: #8B91A3;
  margin: 40px 0 14px; padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,107,74,0.15);
}
.prev-card {
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(255,255,255,0.55);
  border-radius: 16px; padding: 20px; margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.prev-sub {
  font-size: 10px; color: #8B91A3; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;
}
.prev-note {
  font-size: 12px; color: #8B91A3; margin-top: 12px; padding: 8px 11px;
  background: rgba(255,107,74,0.06); border-radius: 8px;
  border-left: 3px solid rgba(255,107,74,0.28); line-height: 1.55;
}
.prev-trig {
  padding: 5px 13px; border-radius: 8px;
  background: rgba(255,107,74,0.10); color: #FF6B4A;
  border: 1px solid rgba(255,107,74,0.22);
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: background 120ms; white-space: nowrap;
}
.prev-trig:hover    { background: rgba(255,107,74,0.17); }
.prev-trig:disabled { opacity: 0.38; pointer-events: none; }
.mob-frame {
  max-width: 375px; margin: 0 auto;
  border: 1.5px solid rgba(0,0,0,0.12); border-radius: 32px;
  overflow: hidden; background: #F8F9FB; position: relative;
}
.side-by-side {
  display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
}

/* ═══ B8 / B11 / B12  Inline reveal ══════════════════════════════════════ */
@keyframes _fi { from { opacity:0; transform:translateY(-3px); } to { opacity:1; transform:translateY(0); } }
@keyframes _fo { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(-3px); } }
.prev-fi { animation: _fi 150ms ease-out both; }
.prev-fo { animation: _fo 150ms ease-in  both; }
`;

/* ─── Primitives ─────────────────────────────────────────────────────────── */

function Badge({ id }: { id: string }) {
  return <span className="prev-badge">{id}</span>;
}

function SH({ children }: { children: React.ReactNode }) {
  return <h2 className="prev-sh">{children}</h2>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="prev-card">{children}</div>;
}

function ItemHead({ id, title, desc }: { id: string; title: string; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
      <Badge id={id} />
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TP }}>{title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: TM, lineHeight: 1.4 }}>{desc}</p>
      </div>
    </div>
  );
}

function Trig({
  children, onClick, disabled,
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button className="prev-trig" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="prev-note">{children}</p>;
}

function Acc({
  open, animated, children,
}: {
  open: boolean; animated: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`acc ${open ? "open" : "closed"} ${animated ? "animated" : ""}`}>
      <div className="acc-in">{children}</div>
    </div>
  );
}

/* ─── Mock milestone row ─────────────────────────────────────────────────── */

function MsRow({
  label, status, onConfirm, flashing, animated,
}: {
  label: string;
  status: "done" | "active" | "locked";
  onConfirm?: () => void;
  flashing?: boolean;
  animated?: boolean;
}) {
  return (
    <div
      className={animated && flashing ? "prev-rf" : ""}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 14px",
        borderBottom: "1px solid rgba(255,107,74,0.07)",
      }}
    >
      <div style={{
        width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
        background:
          status === "done"   ? SUCCESS :
          status === "active" ? "#3B82F6" :
          "rgba(15,23,42,0.18)",
        boxShadow: status === "active" ? "0 0 0 3px rgba(59,130,246,0.20)" : "none",
      }} />
      <span style={{
        flex: 1, fontSize: 13, color: status === "locked" ? TM : TP,
        fontWeight: status === "active" ? 600 : 400,
      }}>
        {label}
      </span>
      {status === "done" && (
        <span style={{ fontSize: 11, color: SUCCESS, fontWeight: 600 }}>Done</span>
      )}
      {status === "active" && onConfirm && (
        <button onClick={onConfirm} style={{
          padding: "3px 11px", borderRadius: 6,
          background: "rgba(59,130,246,0.10)", color: "#3B82F6",
          border: "1px solid rgba(59,130,246,0.18)",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>Confirm</button>
      )}
      {status === "locked" && (
        <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
          <rect x="1" y="5.5" width="9" height="6.5" rx="1.5" stroke="rgba(15,23,42,0.22)" strokeWidth="1.3" />
          <path d="M3 5.5V3.5a2.5 2.5 0 015 0V5.5" stroke="rgba(15,23,42,0.22)" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   A1 — Dropdown open animation
   ════════════════════════════════════════════════════════════════════════════ */

function DropdownMenu({
  open, animated, onClose,
}: {
  open: boolean; animated: boolean; onClose: () => void;
}) {
  const statuses = [
    { label: "Active",    dot: SUCCESS   },
    { label: "On hold",   dot: AMBER     },
    { label: "Withdrawn", dot: "#EF4444" },
    { label: "Complete",  dot: "#3B82F6" },
  ];
  if (!open) return null;
  return (
    <div
      className={animated ? "prev-dd" : ""}
      style={{
        position: "absolute", top: "calc(100% + 4px)", left: 0,
        background: "rgba(255,255,255,0.97)",
        border: "1px solid rgba(255,255,255,0.60)",
        borderRadius: 12, padding: 4,
        boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
        minWidth: 156, zIndex: 10,
      }}
    >
      {statuses.map(s => (
        <button key={s.label} onClick={onClose} style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "7px 11px", borderRadius: 8, border: "none", background: "none",
          fontSize: 13, color: TP, cursor: "pointer", textAlign: "left",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot }} />
          {s.label}
        </button>
      ))}
    </div>
  );
}

function A1Demo({ rm }: { rm: boolean }) {
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [ddKey, setDdKey] = useState(0);

  const chevron = (open: boolean) => (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 180ms", flexShrink: 0 }}>
      <path d="M1 1l4 4 4-4" stroke={TM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const trigStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 13px", borderRadius: 10,
    background: "rgba(255,255,255,0.65)",
    border: "0.5px solid rgba(255,107,74,0.25)",
    fontSize: 13, fontWeight: 600, color: TP, cursor: "pointer",
  };

  return (
    <Card>
      <ItemHead id="A1" title="Dropdown open animation" desc="Status picker, snooze menu, tone selector — 120ms ease-out + 4px slide" />
      <div className="side-by-side">
        <div>
          <p className="prev-sub">Before — instant snap</p>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button style={trigStyle} onClick={() => setOpen1(v => !v)}>
              Active {chevron(open1)}
            </button>
            <DropdownMenu open={open1} animated={false} onClose={() => setOpen1(false)} />
          </div>
        </div>
        <div>
          <p className="prev-sub">After — 120ms fade + 4px slide</p>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button style={trigStyle} onClick={() => {
              setOpen2(v => { if (!v) setDdKey(k => k + 1); return !v; });
            }}>
              Active {chevron(open2)}
            </button>
            {open2 && (
              <div key={ddKey}>
                <DropdownMenu open={open2} animated={!rm} onClose={() => setOpen2(false)} />
              </div>
            )}
          </div>
        </div>
      </div>
      <Note>
        Direction note: this page shows downward-opening only. When a dropdown opens near the bottom of the
        viewport (upward), the translate direction must flip to +4px → 0. Production implementation should
        detect viewport proximity before applying the class. Reduced-motion: instant snap (no class applied).
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   A2 — Button press scale
   ════════════════════════════════════════════════════════════════════════════ */

function A2Demo({ rm: _rm }: { rm: boolean }) {
  return (
    <Card>
      <ItemHead id="A2" title="Button active/press scale" desc="Tactile press feedback — .agent-btn already has it; portal buttons don't" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }}>
        <div>
          <p className="prev-sub">Agent btn — scale(0.98) already ships</p>
          <button className="agent-btn agent-btn-primary agent-btn-md">
            Confirm milestone
          </button>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: TM }}>
            Press + hold — scale(0.98) via .agent-btn:active (already in CSS)
          </p>
        </div>
        <div>
          <p className="prev-sub">Portal CTA — no press (before)</p>
          <button style={{
            padding: "11px 22px", borderRadius: 12, background: CORAL, color: "#fff",
            border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}>
            Confirm action
          </button>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: TM }}>
            Press + hold — nothing happens
          </p>
        </div>
        <div>
          <p className="prev-sub">Portal CTA — scale(0.97) proposed (after)</p>
          <button className="portal-press" style={{
            padding: "11px 22px", borderRadius: 12, background: CORAL, color: "#fff",
            border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer",
            transition: "transform 80ms ease",
          }}>
            Confirm action
          </button>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: TM }}>
            Press + hold — scale(0.97) on :active
          </p>
        </div>
      </div>
      <Note>
        .agent-btn already has scale(0.98) — the gap is portal buttons and any inline-styled CTAs.
        Reduced-motion: .portal-press:active still fires at 80ms, which is acceptable (it&apos;s not decorative motion,
        it&apos;s physical feedback). If you want to suppress it, wrap in a @media query or skip the class entirely.
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   A3 — User nav dropdown
   ════════════════════════════════════════════════════════════════════════════ */

function A3Demo({ rm }: { rm: boolean }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);

  return (
    <Card>
      <ItemHead id="A3" title="User nav dropdown" desc="Free with A1 — same keyframe, sidebar context, opens upward" />
      <div style={{
        background: "rgba(255,255,255,0.55)", borderRadius: 14,
        padding: "10px 14px",
        border: "0.5px solid rgba(255,107,74,0.18)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        maxWidth: 270, position: "relative",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: `linear-gradient(135deg, ${CORAL}, #FF9642)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
          }}>EA</div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TP }}>Ellis Askey</p>
            <p style={{ margin: 0, fontSize: 11, color: TM }}>Director</p>
          </div>
        </div>
        <button onClick={() => {
          setOpen(v => { if (!v) setKey(k => k + 1); return !v; });
        }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 180ms" }}>
            <path d="M3 6l5 5 5-5" stroke={TM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div key={key} className={rm ? "" : "prev-dd"} style={{
            position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0,
            background: "rgba(255,255,255,0.97)", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.60)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.10)", padding: 4, zIndex: 10,
          }}>
            {["Account settings", "Help & support", "Sign out"].map(item => (
              <button key={item} onClick={() => setOpen(false)} style={{
                display: "block", width: "100%", padding: "8px 12px",
                border: "none", background: "none", textAlign: "left",
                fontSize: 13, color: item === "Sign out" ? "#EF4444" : TP,
                cursor: "pointer", borderRadius: 8,
              }}>{item}</button>
            ))}
          </div>
        )}
      </div>
      <Note>
        This opens upward (above the user strip) — correct translate direction is +4px → 0, opposite of A1.
        Verify which direction the real AgentShell menu opens before shipping. If it opens downward, A1&apos;s
        direction applies. Reduced-motion: instant show, no class.
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   B1 — Milestone section expand/collapse
   ════════════════════════════════════════════════════════════════════════════ */

function MilestoneSection({ animated, rm }: { animated: boolean; rm: boolean }) {
  const [open, setOpen] = useState(true);
  const rows: Array<{ label: string; status: "done" | "active" | "locked" }> = [
    { label: "Memorandum of Sale received", status: "done"   },
    { label: "Draft contract received",     status: "active" },
    { label: "Enquiries raised",            status: "locked" },
  ];
  return (
    <div style={{
      background: "rgba(255,255,255,0.60)", borderRadius: 14, overflow: "hidden",
      border: "0.5px solid rgba(255,107,74,0.15)",
    }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "12px 14px", border: "none", background: "none", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13 }}>📝</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: TP }}>Contract Preparation</span>
          <span style={{
            fontSize: 11, color: TM,
            background: "rgba(15,23,42,0.06)", borderRadius: 6, padding: "1px 7px",
          }}>3</span>
        </div>
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{
          transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms", flexShrink: 0,
        }}>
          <path d="M1 1.5l5 5 5-5" stroke={TM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <Acc open={open} animated={animated && !rm}>
        <div>
          {rows.map(r => <MsRow key={r.label} label={r.label} status={r.status} />)}
        </div>
      </Acc>
      <div style={{ padding: "8px 12px", display: "flex", justifyContent: "flex-end", borderTop: "1px solid rgba(255,107,74,0.07)" }}>
        <Trig onClick={() => setOpen(v => !v)}>
          {open ? "↑ Collapse" : "↓ Expand"}
        </Trig>
      </div>
    </div>
  );
}

function B1Demo({ rm }: { rm: boolean }) {
  return (
    <Card>
      <ItemHead id="B1" title="Milestone section expand/collapse" desc="grid-template-rows: 0fr ↔ 1fr, 220ms ease — most-used accordion in the app" />
      <div className="side-by-side">
        <div>
          <p className="prev-sub">Before — content snaps</p>
          <MilestoneSection animated={false} rm={rm} />
        </div>
        <div>
          <p className="prev-sub">After — 220ms ease both directions</p>
          <MilestoneSection animated={true} rm={rm} />
        </div>
      </div>
      <Note>
        Test collapse as carefully as expand — 0fr requires the inner child to have{" "}
        <code>overflow: hidden</code> and <code>min-height: 0</code> or the grid won&apos;t collapse.
        If content clips or jumps on close, that&apos;s the culprit. Reduced-motion: instant toggle (animation
        class omitted, accordion still fully functional).
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   B2 — Notification feedback panel
   ════════════════════════════════════════════════════════════════════════════ */

function B2Demo({ rm }: { rm: boolean }) {
  const [vis, setVis]       = useState(false);
  const [exiting, setExit]  = useState(false);

  function trigger() {
    if (vis) return;
    setExit(false);
    setVis(true);
    if (rm) {
      setTimeout(() => setVis(false), 3000);
    } else {
      setTimeout(() => {
        setExit(true);
        setTimeout(() => { setVis(false); setExit(false); }, 300);
      }, 3000);
    }
  }

  return (
    <Card>
      <ItemHead id="B2" title="Notification feedback panel" desc="Fades in on milestone confirm — auto-dismisses at 3s (5s in production)" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Trig onClick={trigger} disabled={vis}>↺ Trigger (auto-dismisses in 3s)</Trig>
        {vis && (
          <div
            className={exiting ? "prev-no" : "prev-ni"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 14px", borderRadius: 10,
              background: "rgba(16,185,129,0.10)",
              border: "1px solid rgba(16,185,129,0.22)",
              fontSize: 13, color: SUCCESS, fontWeight: 500,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke={SUCCESS} strokeWidth="1.4" />
              <path d="M4.5 7l2 2 3-3" stroke={SUCCESS} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Notification sent to both parties
          </div>
        )}
      </div>
      <Note>
        Exit animation needs a two-step state: set fading=true → CSS plays 280ms exit → then unmount.
        Without this pattern, React removes the element instantly and the exit keyframe never runs.
        Reduced-motion: panel appears and disappears instantly (transitions suppressed by override).
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   B3 — Event date input reveal
   ════════════════════════════════════════════════════════════════════════════ */

function B3Demo({ rm }: { rm: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <ItemHead id="B3" title="Event date input reveal" desc="Same grid-template-rows as B1, smaller — milestone row inline date expand" />
      <div style={{
        background: "rgba(255,255,255,0.60)", borderRadius: 12, overflow: "hidden",
        border: "0.5px solid rgba(255,107,74,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
          <div style={{
            width: 9, height: 9, borderRadius: "50%", background: "#3B82F6", flexShrink: 0,
            boxShadow: "0 0 0 3px rgba(59,130,246,0.20)",
          }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TP }}>Enquiries raised</span>
          <button onClick={() => setOpen(v => !v)} style={{
            padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "rgba(255,107,74,0.08)", color: CORAL,
            border: "1px solid rgba(255,107,74,0.20)", cursor: "pointer",
          }}>
            {open ? "Cancel" : "Set date"}
          </button>
        </div>
        <Acc open={open} animated={!rm}>
          <div style={{ padding: "0 14px 12px" }}>
            <input type="date" style={{
              width: "100%", padding: "7px 12px", borderRadius: 8,
              border: "0.5px solid rgba(255,107,74,0.25)",
              background: "rgba(255,255,255,0.80)",
              fontSize: 14, color: TP, outline: "none",
            }} />
          </div>
        </Acc>
      </div>
      <Note>Zero extra work once B1 is built — same pattern, same two-line CSS change, smaller content.</Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   B5 — Status modal entrance
   ════════════════════════════════════════════════════════════════════════════ */

function B5Demo({ rm }: { rm: boolean }) {
  const [open, setOpen] = useState(false);
  const [key, setKey]   = useState(0);

  function show() { setKey(k => k + 1); setOpen(true); }

  return (
    <Card>
      <ItemHead id="B5" title="Status / withdrawal modal entrance" desc="scale(0.96)→1 + translateY(8px)→0 over 180ms — reuses existing agent-modal-in keyframe" />
      <Trig onClick={show}>Open withdrawal modal</Trig>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            key={key}
            className={rm ? "" : "prev-mo"}
            onClick={e => e.stopPropagation()}
            style={{
              background: "rgba(255,255,255,0.97)", borderRadius: 20,
              padding: "28px 28px 24px", maxWidth: 380, width: "90%",
              boxShadow: "0 16px 48px rgba(0,0,0,0.14)",
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: TP }}>Mark as withdrawn?</p>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: TS, lineHeight: 1.55 }}>
              This will move the file to your withdrawn archive. All parties will lose portal access immediately.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setOpen(false)} style={{
                padding: "9px 18px", borderRadius: 10,
                border: "0.5px solid rgba(15,23,42,0.15)",
                background: "transparent", fontSize: 13, fontWeight: 600, color: TM, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={() => setOpen(false)} style={{
                padding: "9px 18px", borderRadius: 10, border: "none",
                background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Withdraw file</button>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 11, color: TM, textAlign: "center" }}>
              Click backdrop to dismiss · ↺ Replay by clicking &quot;Open&quot; again
            </p>
          </div>
        </div>
      )}
      <Note>
        agent-modal-in is already defined in agent-system.css — this costs zero new CSS.
        Exit is instant (same as today). If you want an exit, use the B2 fading-state pattern.
        Reduced-motion: modal appears instantly (no scale/translate), still fades in via opacity
        if you want a graceful reduced-motion fallback rather than a hard snap.
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   B6 — Portal milestone sheet (mobile)
   ════════════════════════════════════════════════════════════════════════════ */

function B6Demo({ rm }: { rm: boolean }) {
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [sheetKey, setSheetKey]     = useState(0);
  const [confirmed, setConfirmed]   = useState(false);

  function openSheet() { setSheetKey(k => k + 1); setSheetOpen(true); }

  return (
    <Card>
      <ItemHead id="B6" title="Portal milestone sheet entrance" desc="Buyer/seller tap → sheet slides up, 260ms cubic-bezier(0.32,0.72,0,1)" />
      <p style={{ fontSize: 11, color: TM, marginBottom: 12 }}>
        Mobile frame — test on phone at 375px
      </p>
      <div className="mob-frame" style={{ height: 440 }}>
        <div style={{ padding: 16, overflowY: "auto", height: "100%" }}>
          {/* mini portal hero */}
          <div style={{
            background: "linear-gradient(135deg, #FF8A65 0%, #FFB74D 100%)",
            borderRadius: 16, padding: "14px 16px", marginBottom: 14,
          }}>
            <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Your purchase of
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 700, color: "#fff" }}>
              14 Highfield Road, ME15 9PQ
            </p>
          </div>

          <p style={{ margin: "0 0 10px", fontSize: 10, color: TM, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Next step
          </p>
          <button
            onClick={openSheet}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 14,
              background: "#fff", border: "1px solid rgba(15,23,42,0.08)",
              textAlign: "left", cursor: "pointer",
              boxShadow: "0 2px 8px rgba(15,23,42,0.06)", display: "block",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TP }}>Survey commissioned</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: TM }}>
              Let us know once your surveyor has been booked →
            </p>
          </button>

          {confirmed && (
            <div style={{
              marginTop: 12, padding: "12px 14px", borderRadius: 12,
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.20)",
            }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SUCCESS }}>
                ✓ Survey milestone confirmed
              </p>
            </div>
          )}
        </div>

        {/* sheet */}
        {sheetOpen && (
          <div
            key={sheetKey}
            className={rm ? "" : "prev-sh"}
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "#fff", borderRadius: "20px 20px 0 0",
              padding: "18px 20px 28px",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.10)",
            }}
          >
            <div style={{
              width: 40, height: 4, borderRadius: 2,
              background: "rgba(15,23,42,0.12)", margin: "0 auto 16px",
            }} />
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: TP }}>Survey commissioned</p>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: TS, lineHeight: 1.5 }}>
              Has your surveyor confirmed an appointment date?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setSheetOpen(false)} style={{
                flex: 1, padding: "11px", borderRadius: 12,
                border: "0.5px solid rgba(15,23,42,0.12)",
                background: "transparent", fontSize: 14, fontWeight: 600, color: TM, cursor: "pointer",
              }}>Not yet</button>
              <button onClick={() => { setSheetOpen(false); setConfirmed(true); }} style={{
                flex: 2, padding: "11px", borderRadius: 12, border: "none",
                background: CORAL, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>Yes, confirmed</button>
            </div>
          </div>
        )}
      </div>
      <Note>
        Sheet exit is currently instant — add exit animation via fading-state pattern (same as B2) when
        both directions are required. Priority is the entrance. Reduced-motion: sheet appears at bottom of
        frame without sliding (transition suppressed, content still works).
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   B7 — Portal group expand/collapse
   ════════════════════════════════════════════════════════════════════════════ */

function PortalGroup({ animated, rm }: { animated: boolean; rm: boolean }) {
  const [open, setOpen] = useState(true);
  const items = [
    { label: "Searches ordered",               done: true  },
    { label: "Searches received",              done: false },
    { label: "Local authority search clear",   done: false },
    { label: "Water & drainage search clear",  done: false },
  ];
  return (
    <div style={{
      background: "#fff", borderRadius: 16, overflow: "hidden",
      boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
    }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "13px 16px", border: "none", background: "none", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>⚖️</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: TP }}>Searches & Legal</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: TM }}>1/4</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none"
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>
            <path d="M1 1.5l5 5 5-5" stroke={TM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
      <Acc open={open} animated={animated && !rm}>
        <div style={{ borderTop: "1px solid rgba(15,23,42,0.05)" }}>
          {items.map(it => (
            <div key={it.label} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px", borderBottom: "1px solid rgba(15,23,42,0.04)",
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: it.done ? SUCCESS : "rgba(15,23,42,0.15)",
              }} />
              <span style={{ fontSize: 13, color: it.done ? TP : TS, fontWeight: it.done ? 500 : 400 }}>
                {it.label}
              </span>
              {it.done && (
                <span style={{ marginLeft: "auto", fontSize: 11, color: SUCCESS, fontWeight: 600 }}>Done</span>
              )}
            </div>
          ))}
        </div>
      </Acc>
    </div>
  );
}

function B7Demo({ rm }: { rm: boolean }) {
  return (
    <Card>
      <ItemHead id="B7" title="Portal group expand/collapse" desc="Same grid-template-rows as B1 — chevron already rotates, content currently snaps" />
      <div className="side-by-side">
        <div>
          <p className="prev-sub">Before — content snaps</p>
          <div className="mob-frame" style={{ borderRadius: 20 }}>
            <div style={{ padding: 12 }}>
              <PortalGroup animated={false} rm={rm} />
            </div>
          </div>
        </div>
        <div>
          <p className="prev-sub">After — 220ms ease</p>
          <div className="mob-frame" style={{ borderRadius: 20 }}>
            <div style={{ padding: 12 }}>
              <PortalGroup animated={true} rm={rm} />
            </div>
          </div>
        </div>
      </div>
      <Note>
        Zero extra code once B1 is built. Test collapse direction on both. If this is the only change
        on the portal, it&apos;s a 5-minute diff.
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   C3 — Portal progress circle
   ════════════════════════════════════════════════════════════════════════════ */

function ProgressRing({ percent, rm }: { percent: number; rm: boolean }) {
  const r    = 38;
  const circ = 2 * Math.PI * r;  // 238.76
  const target = circ * (1 - percent / 100);
  const [offset, setOffset] = useState(rm ? target : circ);

  useEffect(() => {
    if (rm) { setOffset(target); return; }
    setOffset(circ);
    const t = setTimeout(() => setOffset(target), 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const color =
    percent >= 75 ? SUCCESS :
    percent >= 40 ? CORAL   : AMBER;

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <svg width={96} height={96} viewBox="0 0 96 96"
          style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx={48} cy={48} r={r} fill="none"
            stroke="rgba(255,107,74,0.12)" strokeWidth={6} />
          <circle
            cx={48} cy={48} r={r} fill="none"
            stroke={color} strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{
              transition: rm
                ? "none"
                : "stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: TP }}>{percent}</span>
          <span style={{ fontSize: 10, color: TM }}>%</span>
        </div>
      </div>
      <p style={{ margin: "6px 0 4px", fontSize: 12, color: TM }}>
        {percent >= 75 ? "Nearly there" : percent >= 40 ? "In progress" : "Just started"}
      </p>
    </div>
  );
}

function C3Demo({ rm }: { rm: boolean }) {
  const percents = [10, 50, 90];
  const [keys, setKeys] = useState([0, 0, 0]);
  const replay = (i: number) =>
    setKeys(prev => prev.map((k, j) => (j === i ? k + 1 : k)));

  return (
    <Card>
      <ItemHead id="C3" title="Portal progress circle" desc="stroke-dashoffset: circ → target on mount, 900ms cubic-bezier(0.4,0,0.2,1)" />
      <div style={{ display: "flex", gap: 36, alignItems: "flex-start", flexWrap: "wrap" }}>
        {percents.map((p, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <ProgressRing key={keys[i]} percent={p} rm={rm} />
            <Trig onClick={() => replay(i)}>↺ Replay</Trig>
          </div>
        ))}
      </div>
      <Note>
        Three percentages to check easing at different arc lengths. At 10%, the short arc should ease
        smoothly — watch for a snap at the end of the transition. Reduced-motion: ring renders at
        final percentage instantly (no stroke-dashoffset transition).
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   E2 — Reminder card expand/collapse
   ════════════════════════════════════════════════════════════════════════════ */

function ReminderCardDemo({ animated, rm }: { animated: boolean; rm: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: "rgba(255,255,255,0.70)", borderRadius: 14,
      border: "0.5px solid rgba(255,107,74,0.18)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden",
    }}>
      <div style={{ display: "flex" }}>
        <div style={{ width: 3, background: "#EF4444", flexShrink: 0 }} />
        <button onClick={() => setOpen(v => !v)} style={{
          flex: 1, display: "flex", alignItems: "center", gap: 12,
          padding: "11px 14px", border: "none", background: "none",
          cursor: "pointer", textAlign: "left",
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TP }}>
              Enquiries overdue — chaser needed
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: TM }}>
              14 Highfield Road · 3 days overdue
            </p>
          </div>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 180ms",
          }}>
            <path d="M1 1.5l5 5 5-5" stroke={TM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <Acc open={open} animated={animated && !rm}>
        <div style={{ padding: "0 14px 12px 17px", borderTop: "1px solid rgba(255,107,74,0.07)" }}>
          <p style={{ margin: "10px 0 8px", fontSize: 12, color: TS, lineHeight: 1.55 }}>
            Vendor&apos;s solicitor hasn&apos;t responded to enquiries in 8 days. Standard next step is a direct
            phone call followed by a written chaser email.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{
              padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${CORAL}, #FF9642)`,
              color: "#fff", fontSize: 12, fontWeight: 600,
            }}>Chase now</button>
            <button style={{
              padding: "5px 12px", borderRadius: 8,
              border: "0.5px solid rgba(15,23,42,0.14)",
              background: "transparent", color: TM, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>Snooze 24h</button>
          </div>
        </div>
      </Acc>
    </div>
  );
}

function E2Demo({ rm }: { rm: boolean }) {
  return (
    <Card>
      <ItemHead id="E2" title="Reminder card expand/collapse" desc="Same grid-template-rows pattern as B1, work queue context" />
      <div className="side-by-side">
        <div>
          <p className="prev-sub">Before — content snaps</p>
          <ReminderCardDemo animated={false} rm={rm} />
        </div>
        <div>
          <p className="prev-sub">After — 220ms ease</p>
          <ReminderCardDemo animated={true} rm={rm} />
        </div>
      </div>
      <Note>Free with B1 — same two-line change on the reminder card wrapper. No additional implementation cost.</Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   F1 — Milestone confirm row flash
   ════════════════════════════════════════════════════════════════════════════ */

function ConfirmSection({ animated, rm }: { animated: boolean; rm: boolean }) {
  const [confirmed, setConfirmed] = useState(false);
  const [flashing,  setFlashing]  = useState(false);

  function handleConfirm() {
    if (animated && !rm) {
      setFlashing(true);
      setTimeout(() => setFlashing(false), 700);
    }
    setConfirmed(true);
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.60)", borderRadius: 14, overflow: "hidden",
      border: "0.5px solid rgba(255,107,74,0.15)",
    }}>
      <MsRow label="Memorandum of Sale received" status="done" />
      <MsRow
        label="Draft contract received"
        status={confirmed ? "done" : "active"}
        onConfirm={confirmed ? undefined : handleConfirm}
        flashing={flashing}
        animated={animated}
      />
      <MsRow label="Enquiries raised" status="locked" />
      {confirmed && (
        <div style={{ padding: "8px 12px", display: "flex", justifyContent: "flex-end" }}>
          <Trig onClick={() => { setConfirmed(false); setFlashing(false); }}>↺ Reset</Trig>
        </div>
      )}
    </div>
  );
}

function F1Demo({ rm }: { rm: boolean }) {
  return (
    <Card>
      <ItemHead id="F1" title="Milestone confirm row flash" desc="rgba(16,185,129,0.07) wash over 700ms — intentionally at the edge of perceptible" />
      <div className="side-by-side">
        <div>
          <p className="prev-sub">Before — instant state change only</p>
          <ConfirmSection animated={false} rm={rm} />
        </div>
        <div>
          <p className="prev-sub">After — subtle green wash 700ms</p>
          <ConfirmSection animated={true} rm={rm} />
        </div>
      </div>
      <Note>
        Intentionally restrained. The dot pop (ms-node-pop, already shipping) is the primary signal —
        this wash is ambient acknowledgement. If it reads as invisible after testing, raise opacity from
        0.07 to 0.10 before discarding it entirely. Reduced-motion: state updates instantly, no flash.
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   F3 — Portal confirm row flash
   ════════════════════════════════════════════════════════════════════════════ */

function PortalMsRow({
  label, done, onConfirm, flashing,
}: {
  label: string; done: boolean; onConfirm?: () => void; flashing?: boolean;
}) {
  return (
    <div
      className={flashing ? "prev-rf" : ""}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 16px", borderBottom: "1px solid rgba(15,23,42,0.05)",
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
        background: done ? SUCCESS : "rgba(15,23,42,0.15)",
      }} />
      <span style={{ flex: 1, fontSize: 13, color: done ? TS : TP, fontWeight: done ? 400 : 500 }}>
        {label}
      </span>
      {done && <span style={{ fontSize: 11, color: SUCCESS, fontWeight: 600 }}>Done</span>}
      {!done && onConfirm && (
        <button onClick={onConfirm} style={{
          padding: "4px 12px", borderRadius: 8, border: "none",
          background: CORAL, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>Confirm</button>
      )}
    </div>
  );
}

function F3Demo({ rm }: { rm: boolean }) {
  const [confirmed, setConfirmed] = useState(false);
  const [flashing,  setFlashing]  = useState(false);

  function handleConfirm() {
    if (!rm) { setFlashing(true); setTimeout(() => setFlashing(false), 700); }
    setConfirmed(true);
  }

  const rows = [
    { label: "Solicitor instructed",              done: true      },
    { label: "ID documents provided",             done: confirmed },
    { label: "Property searches ordered",         done: false     },
  ];

  return (
    <Card>
      <ItemHead id="F3" title="Portal confirm row flash" desc="Same rgba(16,185,129,0.07) wash — portal context, free with F1" />
      <p style={{ fontSize: 11, color: TM, marginBottom: 12 }}>Mobile frame</p>
      <div className="mob-frame" style={{ borderRadius: 20 }}>
        <div style={{ padding: 12 }}>
          <div style={{
            background: "#fff", borderRadius: 14, overflow: "hidden",
            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          }}>
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid rgba(15,23,42,0.05)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>⚖️</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: TP }}>Searches & Legal</span>
            </div>
            {rows.map((r, i) => (
              <PortalMsRow
                key={i}
                label={r.label}
                done={r.done}
                onConfirm={i === 1 && !r.done ? handleConfirm : undefined}
                flashing={i === 1 && flashing}
              />
            ))}
          </div>
          {confirmed && (
            <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
              <Trig onClick={() => { setConfirmed(false); setFlashing(false); }}>↺ Reset</Trig>
            </div>
          )}
        </div>
      </div>
      <Note>Reduced-motion: state changes instantly, no flash. Same fallback as F1.</Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   A5 — Tab active indicator
   ════════════════════════════════════════════════════════════════════════════ */

function SimpleTabBar() {
  const tabs = ["Overview", "Milestones", "Chase"];
  const [active, setActive] = useState(0);
  const content = [
    "Overview — notes, contacts, price & fees.",
    "Milestones — VM1 done · VM2 active · VM3 locked",
    "Chase — 2 sent today · next due tomorrow",
  ];
  return (
    <div style={{
      background: "rgba(255,255,255,0.55)", borderRadius: 12, overflow: "hidden",
      border: "0.5px solid rgba(255,107,74,0.15)",
    }}>
      <div style={{ display: "flex", borderBottom: "1.5px solid rgba(255,107,74,0.12)" }}>
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActive(i)} style={{
            padding: "9px 16px", border: "none", background: "none", cursor: "pointer",
            fontSize: 13, fontWeight: active === i ? 700 : 500,
            color: active === i ? CORAL : TM,
          }}>{tab}</button>
        ))}
      </div>
      <div style={{ padding: "14px", minHeight: 48, fontSize: 13, color: TS }}>{content[active]}</div>
    </div>
  );
}

function AnimatedTabBar({ rm }: { rm: boolean }) {
  const tabs = ["Overview", "Milestones", "Chase"];
  const [active, setActive] = useState(0);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);
  const content = [
    "Overview — notes, contacts, price & fees.",
    "Milestones — VM1 done · VM2 active · VM3 locked",
    "Chase — 2 sent today · next due tomorrow",
  ];

  useEffect(() => {
    const el = btnRefs.current[active];
    if (!el) return;
    setInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  return (
    <div style={{
      background: "rgba(255,255,255,0.55)", borderRadius: 12, overflow: "hidden",
      border: "0.5px solid rgba(255,107,74,0.15)",
    }}>
      <div style={{ position: "relative", borderBottom: "1.5px solid rgba(255,107,74,0.12)" }}>
        <div style={{ display: "flex" }}>
          {tabs.map((tab, i) => (
            <button
              key={tab}
              ref={(el) => { btnRefs.current[i] = el; }}
              onClick={() => setActive(i)}
              style={{
                padding: "9px 16px", border: "none", background: "none", cursor: "pointer",
                fontSize: 13, fontWeight: active === i ? 700 : 500,
                color: active === i ? CORAL : TM,
                transition: "color 150ms",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        {ind && (
          <div style={{
            position: "absolute", bottom: 0, height: 2, borderRadius: 1,
            background: CORAL, left: ind.left, width: ind.width,
            transition: rm ? "none" : "left 200ms ease, width 200ms ease",
          }} />
        )}
      </div>
      <div style={{ padding: "14px", minHeight: 48, fontSize: 13, color: TS }}>{content[active]}</div>
    </div>
  );
}

function A5Demo({ rm }: { rm: boolean }) {
  return (
    <Card>
      <ItemHead id="A5" title="Tab active indicator" desc="PropertyFileTabs — sliding 2px strip via useRef measurement, transition: left/width 200ms ease" />
      <div className="side-by-side">
        <div>
          <p className="prev-sub">Before — no indicator, instant switch</p>
          <SimpleTabBar />
        </div>
        <div>
          <p className="prev-sub">After — 200ms sliding underline</p>
          <AnimatedTabBar rm={rm} />
        </div>
      </div>
      <Note>
        useRef array measures each button&apos;s offsetLeft + offsetWidth on mount and on tab change.
        Indicator only renders after first measurement (null guard avoids the 0,0 flash on mount).
        Reduced-motion: strip snaps to position, no transition. The 150ms color transition on tab labels
        is non-spatial and stays even in reduced-motion mode.
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   B8 — Inline edit entry / exit
   ════════════════════════════════════════════════════════════════════════════ */

function InlineEditRow({ animated, rm }: { animated: boolean; rm: boolean }) {
  const [editing, setEditing] = useState(false);
  const [exiting, setExiting] = useState(false);

  function cancelEdit() {
    if (animated && !rm) {
      setExiting(true);
      setTimeout(() => { setEditing(false); setExiting(false); }, 150);
    } else {
      setEditing(false);
    }
  }

  const fields = [
    { placeholder: "Full name", value: "Sarah Whitmore" },
    { placeholder: "Phone",     value: "07712 345678"   },
    { placeholder: "Email",     value: "sarah@email.com" },
  ];

  return (
    <div style={{
      background: "rgba(255,255,255,0.70)", borderRadius: 12, overflow: "hidden",
      border: "0.5px solid rgba(255,107,74,0.15)",
    }}>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TP }}>Sarah Whitmore</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: TM }}>07712 345678 · sarah@email.com</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} style={{
            padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "rgba(15,23,42,0.05)", color: TM,
            border: "1px solid rgba(15,23,42,0.10)", cursor: "pointer",
          }}>Edit</button>
        )}
      </div>
      {editing && (
        <div
          className={animated && !rm ? (exiting ? "prev-fo" : "prev-fi") : ""}
          style={{
            borderTop: "1px solid rgba(255,107,74,0.08)",
            padding: "12px 14px",
            display: "flex", flexDirection: "column", gap: 8,
          }}
        >
          {fields.map(f => (
            <input
              key={f.placeholder}
              placeholder={f.placeholder}
              defaultValue={f.value}
              style={{
                padding: "6px 10px", borderRadius: 7, fontSize: 13, color: TP,
                border: "0.5px solid rgba(255,107,74,0.25)",
                background: "rgba(255,255,255,0.80)", outline: "none",
                width: "100%", boxSizing: "border-box",
              }}
            />
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={cancelEdit} style={{
              flex: 1, padding: "6px", borderRadius: 7,
              border: "0.5px solid rgba(15,23,42,0.15)",
              background: "transparent", fontSize: 12, fontWeight: 600, color: TM, cursor: "pointer",
            }}>Cancel</button>
            <button onClick={cancelEdit} style={{
              flex: 2, padding: "6px", borderRadius: 7, border: "none",
              background: CORAL, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

function B8Demo({ rm }: { rm: boolean }) {
  return (
    <Card>
      <ItemHead id="B8" title="Inline edit entry / exit" desc="Contact / solicitor rows — 150ms fade + 3px slide on reveal, mirrored on dismiss" />
      <div className="side-by-side">
        <div>
          <p className="prev-sub">Before — instant appear / disappear</p>
          <InlineEditRow animated={false} rm={rm} />
        </div>
        <div>
          <p className="prev-sub">After — 150ms ease-out in, ease-in out</p>
          <InlineEditRow animated={true} rm={rm} />
        </div>
      </div>
      <Note>
        Exit uses the two-step state pattern: exiting=true → 150ms _fo plays → unmount (same as B2).
        Applies identically to ContactsSection and SolicitorSection — same diff for both.
        Reduced-motion: form snaps in and out instantly.
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   B10 — Portal help / survey sheets  (free with B6, note only)
   ════════════════════════════════════════════════════════════════════════════ */

function B10Note() {
  return (
    <Card>
      <ItemHead id="B10" title="Portal help / survey sheets" desc="Free with B6 — same _sh keyframe, different trigger context in PortalHomeView" />
      <Note>
        B6 ships the slide-up entrance on the milestone confirmation sheet. B10 is the same className
        applied to the help overlay and survey-response sheets in PortalHomeView — no new CSS, no new
        keyframes. One-line addition. Ship alongside B6.
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   B11 — Error / validation message fade
   ════════════════════════════════════════════════════════════════════════════ */

function ErrorFadeRow({ animated, rm }: { animated: boolean; rm: boolean }) {
  const [errKey, setErrKey] = useState(0);
  const [shown, setShown]   = useState(false);

  function submit() { setErrKey(k => k + 1); setShown(true); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        type="text"
        placeholder="Postcode"
        style={{
          padding: "8px 12px", borderRadius: 9, fontSize: 13, color: TP,
          border: shown ? "1px solid rgba(239,68,68,0.50)" : "0.5px solid rgba(255,107,74,0.25)",
          background: shown ? "rgba(239,68,68,0.03)" : "rgba(255,255,255,0.80)",
          outline: "none", transition: "border-color 150ms, background 150ms",
        }}
      />
      {shown && (
        <p
          key={animated ? errKey : 0}
          className={animated && !rm ? "prev-fi" : ""}
          style={{ margin: 0, fontSize: 12, color: "#EF4444", fontWeight: 500 }}
        >
          Please enter a valid UK postcode
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} style={{
          padding: "6px 14px", borderRadius: 8, border: "none",
          background: CORAL, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>Submit</button>
        {shown && (
          <button onClick={() => setShown(false)} style={{
            padding: "6px 14px", borderRadius: 8,
            border: "0.5px solid rgba(15,23,42,0.14)",
            background: "transparent", fontSize: 12, fontWeight: 600, color: TM, cursor: "pointer",
          }}>↺ Reset</button>
        )}
      </div>
    </div>
  );
}

function B11Demo({ rm }: { rm: boolean }) {
  return (
    <Card>
      <ItemHead id="B11" title="Error / validation message fade" desc="150ms ease-out from translateY(-3px) — same _fi keyframe as B8, zero extra CSS" />
      <div className="side-by-side">
        <div>
          <p className="prev-sub">Before — error snaps in</p>
          <ErrorFadeRow animated={false} rm={rm} />
        </div>
        <div>
          <p className="prev-sub">After — 150ms fade + 3px slide</p>
          <ErrorFadeRow animated={true} rm={rm} />
        </div>
      </div>
      <Note>
        key={"{errKey}"} forces remount on repeated submit so the animation replays even if the error was
        already visible. Hit Submit several times to verify. Reduced-motion: error appears instantly.
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   B12 — EditSaleDetailsDrawer delta preview
   ════════════════════════════════════════════════════════════════════════════ */

function DeltaRow({ animated, rm }: { animated: boolean; rm: boolean }) {
  const [val, setVal]       = useState("");
  const saved               = "£350,000";
  const hasDelta            = val.trim() !== "" && val.trim() !== saved;
  const prevHasDelta        = useRef(false);
  const [deltaKey, setDeltaKey] = useState(0);

  useEffect(() => {
    if (hasDelta && !prevHasDelta.current) setDeltaKey(k => k + 1);
    prevHasDelta.current = hasDelta;
  }, [hasDelta]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: TS }}>Purchase price</label>
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={saved}
        style={{
          padding: "8px 12px", borderRadius: 9, fontSize: 13, color: TP,
          border: "0.5px solid rgba(255,107,74,0.25)", background: "rgba(255,255,255,0.80)",
          outline: "none",
        }}
      />
      {hasDelta && (
        <div
          key={animated ? deltaKey : 0}
          className={animated && !rm ? "prev-fi" : ""}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 10px", borderRadius: 7,
            background: "rgba(255,107,74,0.06)",
            border: "0.5px solid rgba(255,107,74,0.15)",
            fontSize: 12,
          }}
        >
          <span style={{ color: TM, textDecoration: "line-through" }}>{saved}</span>
          <span style={{ color: TM }}>→</span>
          <span style={{ color: CORAL, fontWeight: 700 }}>{val}</span>
        </div>
      )}
      {val && (
        <button onClick={() => setVal("")} style={{
          padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: "rgba(15,23,42,0.05)", color: TM,
          border: "1px solid rgba(15,23,42,0.10)", cursor: "pointer", alignSelf: "flex-start",
        }}>↺ Clear</button>
      )}
    </div>
  );
}

function B12Demo({ rm }: { rm: boolean }) {
  return (
    <Card>
      <ItemHead id="B12" title="EditSaleDetailsDrawer delta preview" desc="Delta row fades in when value diverges from saved — 150ms _fi, zero extra CSS" />
      <div className="side-by-side">
        <div>
          <p className="prev-sub">Before — delta appears instantly</p>
          <DeltaRow animated={false} rm={rm} />
        </div>
        <div>
          <p className="prev-sub">After — 150ms fade-in on diverge</p>
          <DeltaRow animated={true} rm={rm} />
        </div>
      </div>
      <Note>
        Type any value other than &quot;£350,000&quot; to trigger the delta. The key forces a remount each time the
        delta appears (false → true transition), so typing away and back re-triggers the animation.
        Reduced-motion: delta appears instantly.
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   H1 — Status badge crossfade
   ════════════════════════════════════════════════════════════════════════════ */

function StatusBadgeControl({ animated, rm }: { animated: boolean; rm: boolean }) {
  const statuses: Array<{ label: string; dot: string; rgb: string }> = [
    { label: "Active",    dot: SUCCESS,   rgb: "16,185,129" },
    { label: "On hold",   dot: AMBER,     rgb: "245,158,11" },
    { label: "Withdrawn", dot: "#EF4444", rgb: "239,68,68"  },
  ];
  const [active, setActive] = useState(0);
  const [shown,  setShown]  = useState(0);
  const [fading, setFading] = useState(false);

  function pick(i: number) {
    if (i === active) return;
    setActive(i);
    if (!animated || rm) {
      setShown(i);
    } else {
      setFading(true);
      setTimeout(() => { setShown(i); setFading(false); }, 150);
    }
  }

  const s = statuses[shown];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "5px 12px 5px 9px",
        background: `rgba(${s.rgb}, 0.10)`,
        border: `1px solid rgba(${s.rgb}, 0.28)`,
        borderRadius: 10,
        opacity: (animated && !rm && fading) ? 0 : 1,
        transition: animated && !rm ? "opacity 150ms ease" : "none",
      }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: TP }}>{s.label}</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {statuses.map((st, i) => (
          <button key={st.label} onClick={() => pick(i)} style={{
            padding: "4px 11px", borderRadius: 7, fontSize: 12, cursor: "pointer",
            border: "1px solid rgba(15,23,42,0.14)",
            background: active === i ? "rgba(15,23,42,0.07)" : "transparent",
            color: TP, fontWeight: active === i ? 600 : 400,
          }}>{st.label}</button>
        ))}
      </div>
    </div>
  );
}

function H1Demo({ rm }: { rm: boolean }) {
  return (
    <Card>
      <ItemHead id="H1" title="Status badge crossfade" desc="Fade out 150ms → swap label → fade in 150ms — borderline, verify it reads as polish not lag" />
      <div className="side-by-side">
        <div>
          <p className="prev-sub">Before — label snaps instantly</p>
          <StatusBadgeControl animated={false} rm={rm} />
        </div>
        <div>
          <p className="prev-sub">After — 300ms total crossfade</p>
          <StatusBadgeControl animated={true} rm={rm} />
        </div>
      </div>
      <Note>
        Borderline. If the crossfade reads as sluggish, drop to 100ms per half (200ms total) or cut H1
        entirely — the instant snap is defensible here. Reduced-motion: instant swap, no opacity transition.
      </Note>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Round Two section wrapper
   ════════════════════════════════════════════════════════════════════════════ */

function Round2Section({ rm }: { rm: boolean }) {
  return (
    <>
      <div style={{
        margin: "56px 0 0", paddingTop: 32,
        borderTop: "2px solid rgba(255,107,74,0.20)",
      }}>
        <div style={{
          background: "rgba(255,107,74,0.05)",
          border: "1px solid rgba(255,107,74,0.15)",
          borderRadius: 16, padding: "20px 24px", marginBottom: 4,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TP }}>
            Round Two — Additional Candidates
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: TS, lineHeight: 1.6, maxWidth: 660 }}>
            Second pass scanning by interaction surface. 5 shortlisted + 1 free-with-B6 note.
            All new animations share the same two keyframes (_fi / _fo) — zero extra CSS.
            Reduced-motion toggle above applies to everything below.
          </p>
        </div>
      </div>

      <SH>Micro-feedback — continued</SH>
      <A5Demo rm={rm} />

      <SH>State Transitions — continued</SH>
      <B8Demo rm={rm} />
      <B10Note />
      <B11Demo rm={rm} />
      <B12Demo rm={rm} />

      <SH>Moments Worth Marking — continued</SH>
      <H1Demo rm={rm} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Page root
   ════════════════════════════════════════════════════════════════════════════ */

export default function AnimPreview() {
  const [rm, setRm] = useState(false);

  return (
    <div
      data-rm={rm ? "1" : "0"}
      style={{ minHeight: "100vh", padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.72)",
        border: "0.5px solid rgba(255,107,74,0.20)",
        borderRadius: 16, padding: "20px 24px", marginBottom: 4,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TP }}>
              Animation Preview
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: TS, lineHeight: 1.6, maxWidth: 660 }}>
              Round One: 13 candidates. Round Two adds 5 more below (A5, B8–12, H1).
              Toggle <strong>Reduced Motion</strong> to see fallback behaviour — every animation must pass.
              Portal items (B6, B7, F3, C3) are mobile-first: test on your phone at 375px.
              Each item has a <strong>↺ Replay</strong> or collapse/expand control.
            </p>
          </div>
          <button
            onClick={() => setRm(v => !v)}
            style={{
              flexShrink: 0, padding: "8px 16px", borderRadius: 10, cursor: "pointer",
              fontWeight: 700, fontSize: 13,
              background: rm ? "rgba(245,158,11,0.12)" : "rgba(15,23,42,0.06)",
              border: rm
                ? "1px solid rgba(245,158,11,0.35)"
                : "1px solid rgba(15,23,42,0.12)",
              color: rm ? "#92400E" : TM,
              transition: "all 200ms",
            }}
          >
            Reduced motion: {rm ? "ON ✓" : "OFF"}
          </button>
        </div>
      </div>

      {/* Micro-feedback */}
      <SH>Micro-feedback</SH>
      <A1Demo rm={rm} />
      <A2Demo rm={rm} />
      <A3Demo rm={rm} />

      {/* State transitions */}
      <SH>State Transitions</SH>
      <B1Demo rm={rm} />
      <B2Demo rm={rm} />
      <B3Demo rm={rm} />
      <B5Demo rm={rm} />
      <B6Demo rm={rm} />
      <B7Demo rm={rm} />

      {/* Data arrival */}
      <SH>Data Arrival</SH>
      <C3Demo rm={rm} />

      {/* Layout shifts */}
      <SH>Layout Shifts</SH>
      <E2Demo rm={rm} />

      {/* Moments worth marking */}
      <SH>Moments Worth Marking</SH>
      <F1Demo rm={rm} />
      <F3Demo rm={rm} />

      <Round2Section rm={rm} />

      <div style={{ height: 48 }} />
    </div>
  );
}
