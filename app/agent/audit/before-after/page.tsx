"use client";

import { useState, useEffect } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { SectionAccordion } from "@/components/transactions-v2/form/SectionAccordion";

/* ─── Theme names (verified from app/agent/styles/themes.css) ─────────────── */
const THEMES = ["sunset", "coastal", "heritage", "slate", "emerald", "claret"] as const;
type Theme = (typeof THEMES)[number];

/* ─── Choice state types ─────────────────────────────────────────────────── */
type ChoiceValue = "join" | "different" | "a" | "b" | "c" | "keep";
type Choices = Record<string, ChoiceValue>;
type Reasons = Record<string, string>;

/* ─── Gallery page CSS (chrome only — no agent-system overrides) ────────── */
const PAGE_CSS = `
.aba-page {
  font-family: system-ui, -apple-system, sans-serif;
  min-height: 100vh;
  background: #f0ede8;
  color: #1a1a1a;
}
.aba-topbar {
  position: sticky;
  top: 0;
  z-index: 200;
  background: rgba(255,255,255,0.96);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0,0,0,0.08);
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.aba-title {
  font-size: 12px;
  font-weight: 700;
  color: #111;
  margin-right: 6px;
  white-space: nowrap;
}
.aba-theme-btn {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 5px;
  border: 1px solid rgba(0,0,0,0.12);
  background: transparent;
  cursor: pointer;
  color: #555;
  transition: all 100ms;
}
.aba-theme-btn:hover { background: rgba(0,0,0,0.05); }
.aba-theme-btn.active { background: #FF6B4A; color: white; border-color: transparent; }
.aba-toggle {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 5px;
  border: 1px solid rgba(0,0,0,0.12);
  background: transparent;
  cursor: pointer;
  color: #555;
  white-space: nowrap;
}
.aba-toggle.active { background: #1e293b; color: #e2e8f0; border-color: transparent; }
.aba-decision-count {
  font-size: 11px;
  color: #9ca3af;
  margin-left: auto;
  white-space: nowrap;
}
.aba-body {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 20px 100px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* Category accordion */
.aba-cat {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.08);
  background: white;
}
.aba-cat-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 18px;
  cursor: pointer;
  background: #fafaf9;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  user-select: none;
}
.aba-cat-hdr:hover { background: #f4f3f1; }
.aba-cat-label {
  font-size: 13px;
  font-weight: 700;
  color: #111;
}
.aba-cat-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 99px;
  background: rgba(255,107,74,0.10);
  color: #FF6B4A;
  border: 1px solid rgba(255,107,74,0.20);
}
.aba-cat-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Two-column aligned/drift layout */
.aba-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
.aba-col-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #9ca3af;
  margin-bottom: 10px;
}
.aba-aligned-panel {
  background: #f8f9fa;
  border: 1px solid rgba(0,0,0,0.07);
  border-radius: 10px;
  padding: 14px;
}
.aba-drift-panel {
  background: #fff;
  border: 1px solid rgba(0,0,0,0.09);
  border-radius: 10px;
  overflow: hidden;
}
.aba-no-drift {
  background: #f0fdf4;
  border: 1px solid rgba(34,197,94,0.20);
  border-radius: 10px;
  padding: 14px;
  font-size: 12px;
  color: #166534;
  font-weight: 500;
}

/* Drift item */
.aba-drift-item {
  border-bottom: 1px solid rgba(0,0,0,0.06);
  padding: 14px;
}
.aba-drift-item:last-child { border-bottom: none; }
.aba-item-hdr {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
}
.aba-item-id {
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 4px;
  background: rgba(37,99,235,0.08);
  color: #2563eb;
  border: 1px solid rgba(37,99,235,0.16);
}
.aba-item-id.uncertain {
  background: rgba(245,158,11,0.10);
  color: #b45309;
  border-color: rgba(245,158,11,0.24);
}
.aba-item-id.nochange {
  background: rgba(100,116,139,0.08);
  color: #64748b;
  border-color: rgba(100,116,139,0.16);
}
.aba-item-title {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
}
.aba-file-badge {
  font-family: monospace;
  font-size: 9px;
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 0px 5px;
  border-radius: 3px;
}

/* Before/After pair inside a drift item */
.aba-ba-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}
.aba-panel {
  border-radius: 7px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.07);
}
.aba-panel-lbl {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.aba-panel-lbl.before { background: #fef2f2; color: #b91c1c; }
.aba-panel-lbl.after  { background: #f0fdf4; color: #166534; }
.aba-panel-lbl.opt-a  { background: #eff6ff; color: #1d4ed8; }
.aba-panel-lbl.opt-b  { background: #fefce8; color: #92400e; }
.aba-panel-content {
  padding: 12px;
  background: white;
  min-height: 52px;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
}
.aba-panel-content.theme-bg {
  background: var(--agent-bg, #fdf8f3);
}
.aba-note {
  font-size: 10px;
  color: #6b7280;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 5px;
  padding: 6px 10px;
  line-height: 1.5;
  margin-bottom: 8px;
}
.aba-note.warn {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}

/* Choice controls */
.aba-choice {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}
.aba-choice-label {
  font-size: 10px;
  color: #9ca3af;
  font-weight: 600;
}
.aba-choice-btn {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 99px;
  border: 1px solid rgba(0,0,0,0.12);
  background: transparent;
  cursor: pointer;
  color: #555;
  transition: all 100ms;
}
.aba-choice-btn:hover { background: rgba(0,0,0,0.05); }
.aba-choice-btn.chosen { background: #1e293b; color: white; border-color: transparent; }
.aba-choice-btn.chosen-a { background: #2563eb; color: white; border-color: transparent; }
.aba-choice-btn.chosen-b { background: #d97706; color: white; border-color: transparent; }
.aba-reason-input {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 5px;
  border: 1px solid rgba(0,0,0,0.12);
  background: white;
  color: #374151;
  width: 160px;
}
.aba-reason-input:focus {
  outline: none;
  border-color: #2563eb;
}

/* Export section */
.aba-export {
  background: white;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 20px;
}
.aba-export-pre {
  font-family: monospace;
  font-size: 11px;
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  white-space: pre-wrap;
  line-height: 1.6;
  margin-top: 12px;
}

/* Misc demo helpers */
.demo-ghost-bar {
  height: 12px;
  border-radius: 4px;
  background: rgba(148,163,184,0.30);
  margin-bottom: 6px;
}
`;

/* ─── SVG Chevron helper ─────────────────────────────────────────────────── */
function Chev({ deg = 0, size = 12 }: { deg?: number; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: "transform 200ms", transform: `rotate(${deg}deg)`, flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ─── Category block ─────────────────────────────────────────────────────── */
function CatBlock({ id, label, pill, children }: { id: string; label: string; pill: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="aba-cat" id={id}>
      <div className="aba-cat-hdr" onClick={() => setOpen((v) => !v)}>
        <span className="aba-cat-label">{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="aba-cat-pill">{pill}</span>
          <Chev deg={open ? 180 : 0} size={13} />
        </div>
      </div>
      {open && <div className="aba-cat-body">{children}</div>}
    </div>
  );
}

/* ─── Two-column aligned/drift layout ───────────────────────────────────── */
function AlignedDrift({ aligned, drift }: { aligned: React.ReactNode; drift: React.ReactNode }) {
  return (
    <div className="aba-cols">
      <div>
        <div className="aba-col-label">Already aligned — canonical reference</div>
        <div className="aba-aligned-panel">{aligned}</div>
      </div>
      <div>
        <div className="aba-col-label">Drift / Options</div>
        <div className="aba-drift-panel">{drift}</div>
      </div>
    </div>
  );
}

function NoDrift({ aligned }: { aligned: React.ReactNode }) {
  return (
    <div className="aba-cols">
      <div>
        <div className="aba-col-label">Already aligned — canonical reference</div>
        <div className="aba-aligned-panel">{aligned}</div>
      </div>
      <div>
        <div className="aba-col-label">Drift</div>
        <div className="aba-no-drift">No drift in this category — all instances consistent.</div>
      </div>
    </div>
  );
}

/* ─── Drift item wrapper ─────────────────────────────────────────────────── */
function DriftItem({ id, title, file, uncertain = false, noChange = false, children }: {
  id: string; title: string; file?: string; uncertain?: boolean; noChange?: boolean; children: React.ReactNode;
}) {
  const cls = noChange ? "nochange" : uncertain ? "uncertain" : "";
  return (
    <div className="aba-drift-item" data-item={id}>
      <div className="aba-item-hdr">
        <span className={`aba-item-id ${cls}`}>{id}</span>
        <span className="aba-item-title">{title}</span>
        {file && <span className="aba-file-badge">{file}</span>}
      </div>
      {children}
    </div>
  );
}

/* ─── Before/After pair ──────────────────────────────────────────────────── */
function BAPair({ before, after, blbl = "BEFORE", albl = "AFTER", useBg = false }: {
  before: React.ReactNode; after: React.ReactNode; blbl?: string; albl?: string; useBg?: boolean;
}) {
  return (
    <div className="aba-ba-pair">
      <div className="aba-panel">
        <div className="aba-panel-lbl before">{blbl}</div>
        <div className={`aba-panel-content${useBg ? " theme-bg" : ""}`}>{before}</div>
      </div>
      <div className="aba-panel">
        <div className="aba-panel-lbl after">{albl}</div>
        <div className={`aba-panel-content${useBg ? " theme-bg" : ""}`}>{after}</div>
      </div>
    </div>
  );
}

/* ─── Option A/B pair ────────────────────────────────────────────────────── */
function OptPair({ optA, optB, useBg = false }: { optA: React.ReactNode; optB: React.ReactNode; useBg?: boolean }) {
  return (
    <div className="aba-ba-pair">
      <div className="aba-panel">
        <div className="aba-panel-lbl opt-a">OPTION A</div>
        <div className={`aba-panel-content${useBg ? " theme-bg" : ""}`}>{optA}</div>
      </div>
      <div className="aba-panel">
        <div className="aba-panel-lbl opt-b">OPTION B</div>
        <div className={`aba-panel-content${useBg ? " theme-bg" : ""}`}>{optB}</div>
      </div>
    </div>
  );
}

function Note({ children, warn = false }: { children: React.ReactNode; warn?: boolean }) {
  return <p className={`aba-note${warn ? " warn" : ""}`}>{children}</p>;
}

/* ─── Choice control ─────────────────────────────────────────────────────── */
function ChoiceControl({ id, uncertain = false, choices, reasons, setChoices, setReasons }: {
  id: string;
  uncertain?: boolean;
  choices: Choices;
  reasons: Reasons;
  setChoices: (fn: (prev: Choices) => Choices) => void;
  setReasons: (fn: (prev: Reasons) => Reasons) => void;
}) {
  const current = choices[id];
  const pick = (v: ChoiceValue) => setChoices((p) => ({ ...p, [id]: v }));

  if (uncertain) {
    return (
      <div className="aba-choice">
        <span className="aba-choice-label">Choice:</span>
        {(["a", "b", "c"] as const).map((v) => (
          <button key={v} className={`aba-choice-btn${current === v ? " chosen-a" : ""}`} onClick={() => pick(v)}>
            Option {v.toUpperCase()}
          </button>
        ))}
        <button className={`aba-choice-btn${current === "keep" ? " chosen" : ""}`} onClick={() => pick("keep")}>
          Keep current
        </button>
        {current === "different" && (
          <input
            className="aba-reason-input"
            placeholder="Reason..."
            value={reasons[id] ?? ""}
            onChange={(e) => setReasons((p) => ({ ...p, [id]: e.target.value }))}
          />
        )}
      </div>
    );
  }

  return (
    <div className="aba-choice">
      <span className="aba-choice-label">Decision:</span>
      <button className={`aba-choice-btn${current === "join" ? " chosen-a" : ""}`} onClick={() => pick("join")}>
        Join aligned group
      </button>
      <button className={`aba-choice-btn${current === "different" ? " chosen-b" : ""}`} onClick={() => pick("different")}>
        Stay different
      </button>
      {current === "different" && (
        <input
          className="aba-reason-input"
          placeholder="Reason..."
          value={reasons[id] ?? ""}
          onChange={(e) => setReasons((p) => ({ ...p, [id]: e.target.value }))}
        />
      )}
    </div>
  );
}

/* ─── Dropdown demo (with/without exit animation) ───────────────────────── */
function DropdownDemo({ withExit }: { withExit: boolean }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  function close() {
    if (withExit) { setClosing(true); setOpen(false); }
    else { setOpen(false); }
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => { open || closing ? close() : setOpen(true); }}
        style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: "#FF6B4A", color: "white", border: "none", cursor: "pointer" }}
      >
        Snooze {open || closing ? "▲" : "▼"}
      </button>
      {(open || closing) && (
        <div
          className={withExit && closing ? "agent-dropdown-out" : "agent-dropdown-in"}
          onAnimationEnd={() => { if (closing) setClosing(false); }}
          style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, zIndex: 50, background: "rgba(255,255,255,0.97)", borderRadius: 9, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)", minWidth: 100, overflow: "hidden" }}
        >
          {["24 h", "48 h", "72 h", "7 days"].map((l) => (
            <div key={l} onClick={close} style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer" }}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Caret accordion demo (live toggle) ────────────────────────────────── */
function CaretDemo({ mode }: { mode: "swap" | "rotate" }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen((v) => !v)}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--nv2-text-ghost, #9ca3af)", padding: "7px 12px", background: "rgba(255,255,255,0.08)", borderRadius: 8, border: "0.5px solid rgba(255,255,255,0.12)", cursor: "pointer", userSelect: "none" }}
    >
      Section title
      {mode === "swap"
        ? (open
          ? <CaretUp size={14} weight="bold" color="var(--nv2-text-ghost, #9ca3af)" />
          : <CaretDown size={14} weight="bold" color="var(--nv2-text-ghost, #9ca3af)" />)
        : <CaretDown size={14} weight="bold" color="var(--nv2-text-ghost, #9ca3af)" style={{ transition: "transform 200ms", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      }
    </div>
  );
}

/* ─── Ghost bar row ──────────────────────────────────────────────────────── */
function GhostBlock({ opacity, label }: { opacity: number; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ opacity, marginBottom: 4 }}>
        <div className="demo-ghost-bar" style={{ width: 80 }} />
        <div className="demo-ghost-bar" style={{ width: 60 }} />
        <div className="demo-ghost-bar" style={{ width: 72 }} />
      </div>
      <span style={{ fontSize: 9, color: "#9ca3af" }}>opacity: {opacity}</span>
      <div style={{ fontSize: 9, color: "#6b7280" }}>{label}</div>
    </div>
  );
}

/* ─── Urgency border strip ───────────────────────────────────────────────── */
function UrgencyStrip({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
      <div style={{ width: 4, height: 28, background: color, borderRadius: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{label}</div>
        <div style={{ fontSize: 9, fontFamily: "monospace", color: "#9ca3af" }}>{value}</div>
      </div>
    </div>
  );
}

/* ─── Activity tone chip ─────────────────────────────────────────────────── */
function ToneChip({ bg, fg, dot, label }: { bg: string; fg: string; dot: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: bg, color: fg }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

/* ═══ MAIN PAGE ════════════════════════════════════════════════════════════ */
export default function AuditBeforeAfterPage() {
  const [theme, setTheme] = useState<Theme>("sunset");
  const [night, setNight] = useState(false);
  const [solid, setSolid] = useState(false);
  const [rm, setRm] = useState(false);
  const [choices, setChoices] = useState<Choices>({});
  const [reasons, setReasons] = useState<Reasons>({});

  /* Solid mode applies to documentElement (matches SolidModeToggle.tsx pattern) */
  useEffect(() => {
    if (solid) document.documentElement.setAttribute("data-solid", "");
    else document.documentElement.removeAttribute("data-solid");
    return () => document.documentElement.removeAttribute("data-solid");
  }, [solid]);

  const DRIFT_IDS = [
    "1A","1B","2A","2B","3A","3B","5A","6A",
    "7A","7B","7C","9A","10A","10C","11A","11B",
    "16A","16C","16D","16EFG","17A","NC2A",
  ];
  const UNCERTAIN_IDS = [
    "U3C","U7D","U7E","U7F","U13B","U16I","U16K","U17B",
  ];
  const allIds = [...DRIFT_IDS, ...UNCERTAIN_IDS];
  const decidedCount = allIds.filter((id) => choices[id] !== undefined).length;

  /* Shortcut for choice controls */
  function CC({ id, uncertain = false }: { id: string; uncertain?: boolean }) {
    return (
      <ChoiceControl
        id={id}
        uncertain={uncertain}
        choices={choices}
        reasons={reasons}
        setChoices={setChoices}
        setReasons={setReasons}
      />
    );
  }

  /* Export text */
  const exportText = allIds
    .filter((id) => choices[id] !== undefined)
    .map((id) => {
      const v = choices[id];
      const r = reasons[id] ? ` — ${reasons[id]}` : "";
      return `${id}: ${v}${r}`;
    })
    .join("\n");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <div className="aba-page">

        {/* ── Sticky top bar (outside theme wrapper — intentional) ─────── */}
        <div className="aba-topbar">
          <span className="aba-title">Before/After Gallery — Cross-page audit 2026-05-17</span>

          {THEMES.map((t) => (
            <button
              key={t}
              className={`aba-theme-btn${theme === t ? " active" : ""}`}
              onClick={() => setTheme(t)}
            >
              {t}
            </button>
          ))}

          <button
            className={`aba-toggle${solid ? " active" : ""}`}
            onClick={() => setSolid((v) => !v)}
            title="Matches SolidModeToggle.tsx — sets data-solid on documentElement"
          >
            {solid ? "◧ Solid" : "◈ Glass"}
          </button>

          <button
            className={`aba-toggle${night ? " active" : ""}`}
            onClick={() => setNight((v) => !v)}
            title="Sets data-night='' on .agent-shell-root (≤1024px override). Night mode is normally mobile-only."
          >
            {night ? "◑ Night ON" : "◯ Night OFF"}
          </button>

          <button
            className={`aba-toggle${rm ? " active" : ""}`}
            onClick={() => setRm((v) => !v)}
          >
            {rm ? "⚡ Anim OFF" : "✦ Anim ON"}
          </button>

          <span className="aba-decision-count">
            {decidedCount} of {allIds.length} decided
          </span>
        </div>

        {/* ── Preview wrapper — ALL gallery content lives inside this ─── */}
        <div
          className="agent-shell-root"
          data-theme={theme}
          data-night={night ? "" : undefined}
          data-rm={rm ? "1" : undefined}
          style={{ background: "var(--agent-bg)", minHeight: "calc(100vh - 56px)" }}
        >
          <div className="aba-body">

            {/* ═════════════════════════════════════════════════════════════
                CAT 1 — Accordions
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat1" label="CAT 1 — Accordions" pill="2 CHANGE · 2 NO CHANGE">

              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 8 }}>
                      Canonical: single CaretDown, inline transform rotation
                    </div>
                    <div style={{ fontSize: 10, color: "var(--agent-text-disabled)", marginBottom: 6 }}>
                      CommsActivityFeed.tsx:72 · AgentTodoList.tsx:270
                    </div>
                    <CaretDown
                      style={{ width: 14, height: 14, color: "var(--agent-text-muted)", flexShrink: 0, transition: "transform 200ms", transform: "rotate(180deg)" }}
                    />
                    <div style={{ fontSize: 10, color: "var(--agent-text-disabled)", marginTop: 6 }}>
                      style={`{{ transform: "rotate(180deg)" }}`} — expanded
                    </div>
                  </div>
                }
                drift={
                  <>
                    <DriftItem id="1A" title="SectionAccordion — CaretUp/CaretDown swap" file="SectionAccordion.tsx:31-33">
                      <Note>BEFORE: imports CaretUp + CaretDown, swaps between them. Only accordion in codebase that imports CaretUp. AFTER: single CaretDown with inline rotation.</Note>
                      <BAPair
                        blbl="BEFORE — icon swap (live)"
                        albl="AFTER — rotating caret (live)"
                        useBg
                        before={<CaretDemo mode="swap" />}
                        after={<CaretDemo mode="rotate" />}
                      />
                      <Note>Click either element to toggle. SectionAccordion component is imported directly for BEFORE — it already has this exact swap pattern.</Note>
                      <CC id="1A" />
                    </DriftItem>

                    <DriftItem id="1B" title="CompletionsGroupList — Tailwind rotate-180 → inline style" file="CompletionsGroupList.tsx:72">
                      <BAPair
                        useBg
                        blbl="BEFORE — Tailwind class"
                        albl="AFTER — inline style + token"
                        before={
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--agent-surface-glass)", borderRadius: 6, cursor: "pointer" }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", flex: 1 }}>Exchange (3)</span>
                            <CaretDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-900/40 transition-transform duration-200 rotate-180" />
                          </div>
                        }
                        after={
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--agent-surface-glass)", borderRadius: 6, cursor: "pointer" }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", flex: 1 }}>Exchange (3)</span>
                            <CaretDown style={{ width: 14, height: 14, color: "var(--agent-text-muted)", flexShrink: 0, transition: "transform 200ms", transform: "rotate(180deg)" }} />
                          </div>
                        }
                      />
                      <Note>Visual output identical (caret rotated up = group open). BEFORE: Tailwind rotate-180 + text-slate-900/40 hardcoded colour. AFTER: inline transform style + var(--agent-text-muted) token — theme-aware.</Note>
                      <CC id="1B" />
                    </DriftItem>

                    <DriftItem id="NC" title="No changes" noChange>
                      <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.8 }}>
                        <li>No change for agent-acc-body omission in AgentRemindersList / FileAlertsStrip</li>
                        <li>No change for TransactionNotes &ldquo;Show N more&rdquo; text expand (text-only toggle, no caret needed)</li>
                      </ul>
                    </DriftItem>
                  </>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 2 — Dropdowns
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat2" label="CAT 2 — Dropdowns" pill="2 CHANGE · 1 NO CHANGE">
              <AlignedDrift
                aligned={
                  <div style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Canonical: closing state → agent-dropdown-out → onAnimationEnd unmount</div>
                    <div style={{ fontSize: 10, color: "var(--agent-text-disabled)" }}>TransactionListWithSearch · ActivityVerbChip</div>
                    <div style={{ marginTop: 8 }}>
                      <DropdownDemo withExit={true} />
                    </div>
                  </div>
                }
                drift={
                  <>
                    <DriftItem id="2A" title="SideSnoozeMenu — missing agent-dropdown-out exit" file="AgentRemindersList.tsx:86-150">
                      <BAPair
                        blbl="BEFORE — instant unmount"
                        albl="AFTER — animated exit"
                        useBg
                        before={<DropdownDemo withExit={false} />}
                        after={<DropdownDemo withExit={true} />}
                      />
                      <Note>Click Snooze, then click again to close. BEFORE: open &amp;&amp; … — instant unmount. AFTER: closing state + agent-dropdown-out class + onAnimationEnd unmount.</Note>
                      <CC id="2A" />
                    </DriftItem>

                    <DriftItem id="2B" title="RowSnoozeMenu — same pattern as 2A" file="AgentRemindersList.tsx:152-219">
                      <Note>Identical fix to 2A. RowSnoozeMenu also uses plain open &amp;&amp; with instant unmount. Apply closing state + agent-dropdown-out + onAnimationEnd.</Note>
                      <CC id="2B" />
                    </DriftItem>

                    <DriftItem id="NC" title="No changes for other dropdowns" noChange>
                      <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.8 }}>
                        <li>All other dropdown instances use canonical in/out pattern</li>
                      </ul>
                    </DriftItem>
                  </>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 3 — Card surfaces
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat3" label="CAT 3 — Card surfaces" pill="2 CHANGE · 1 UNCERTAIN · 1 NO CHANGE">
              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 6 }}>
                      Canonical empty state: agent-glass-strong
                    </div>
                    <div style={{ fontSize: 10, color: "var(--agent-text-disabled)", marginBottom: 8 }}>hub/page.tsx · work-queue/page.tsx · transaction-list</div>
                    <div className="agent-glass-strong" style={{ padding: "20px 16px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>All caught up.</p>
                    </div>
                  </div>
                }
                drift={
                  <>
                    <DriftItem id="3A" title="comms page empty state — glass-card → agent-glass-strong" file="comms/page.tsx:96">
                      <BAPair
                        useBg
                        before={
                          <div className="glass-card" style={{ padding: "20px 16px", textAlign: "center", width: "100%" }}>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>No milestone activity yet.</p>
                            <div style={{ fontSize: 9, color: "var(--agent-text-disabled)", marginTop: 4 }}>class: glass-card</div>
                          </div>
                        }
                        after={
                          <div className="agent-glass-strong" style={{ padding: "20px 16px", textAlign: "center", width: "100%" }}>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>No milestone activity yet.</p>
                            <div style={{ fontSize: 9, color: "var(--agent-text-disabled)", marginTop: 4 }}>class: agent-glass-strong</div>
                          </div>
                        }
                      />
                      <CC id="3A" />
                    </DriftItem>

                    <DriftItem id="3B" title="completions page empty state — glass-card px-6 py-12 → agent-glass-strong" file="completions/page.tsx:116">
                      <BAPair
                        useBg
                        before={
                          <div className="glass-card" style={{ padding: "20px 16px", textAlign: "center", width: "100%" }}>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>No completions.</p>
                            <div style={{ fontSize: 9, color: "var(--agent-text-disabled)", marginTop: 4 }}>class: glass-card px-6 py-12</div>
                          </div>
                        }
                        after={
                          <div className="agent-glass-strong" style={{ padding: "20px 16px", textAlign: "center", width: "100%" }}>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>No completions.</p>
                            <div style={{ fontSize: 9, color: "var(--agent-text-disabled)", marginTop: 4 }}>class: agent-glass-strong</div>
                          </div>
                        }
                      />
                      <CC id="3B" />
                    </DriftItem>

                    <DriftItem id="U3C" title="AgentTodoList whole-page empty state — glass-card or agent-glass-strong?" file="AgentTodoList.tsx:119" uncertain>
                      <Note warn>UNCERTAIN — to-do page uses glass-card for task group cards. Does the empty state belong with them (B) or with hub/work-queue empty states (A)?</Note>
                      <OptPair
                        useBg
                        optA={
                          <div className="agent-glass-strong" style={{ padding: "20px 16px", textAlign: "center", width: "100%" }}>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>Nothing here yet.</p>
                            <div style={{ fontSize: 9, color: "var(--agent-text-disabled)", marginTop: 4 }}>agent-glass-strong — consistent with hub/work-queue</div>
                          </div>
                        }
                        optB={
                          <div className="glass-card" style={{ padding: "20px 16px", textAlign: "center", width: "100%" }}>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>Nothing here yet.</p>
                            <div style={{ fontSize: 9, color: "var(--agent-text-disabled)", marginTop: 4 }}>glass-card — matches task group card class on same page</div>
                          </div>
                        }
                      />
                      <CC id="U3C" uncertain />
                    </DriftItem>

                    <DriftItem id="NC" title="SplitFileCard header rgba(255,255,255,0.28) — no change" noChange>
                      <Note>Intentional semi-transparent header within card. Changing it would flatten visual hierarchy.</Note>
                    </DriftItem>
                  </>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 4 — Buttons
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat4" label="CAT 4 — Buttons" pill="0 CHANGE">
              <NoDrift
                aligned={
                  <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.9 }}>
                    <li>TransactionTable sort header buttons — bespoke table pattern, intentional</li>
                    <li>agent-link used as button (Show/Hide, Cancel) — consistent visual pattern</li>
                    <li>All .agent-btn instances canonical</li>
                  </ul>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 5 — Links
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat5" label="CAT 5 — Links" pill="1 CHANGE · 2 NO CHANGE">
              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 6 }}>Canonical: agent-link class</div>
                    <div style={{ fontSize: 10, color: "var(--agent-text-disabled)", marginBottom: 8 }}>Provides coral colour, hover underline, and focus ring via agent-system.css</div>
                    <a className="agent-link" style={{ fontSize: 13, fontWeight: 600 }}>14 Maple Close, Bristol</a>
                  </div>
                }
                drift={
                  <>
                    <DriftItem id="5A" title="AgentTodoList transaction address link — hover:underline → agent-link" file="AgentTodoList.tsx:298-304">
                      <Note>BEFORE: className=&quot;hover:underline&quot; with inline color: var(--agent-text-primary). No focus ring, no canonical colour. AFTER: className=&quot;agent-link&quot; with fontSize/fontWeight inline only.</Note>
                      <BAPair
                        useBg
                        before={
                          <a style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textDecoration: "none", cursor: "pointer" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}>
                            14 Maple Close, Bristol
                          </a>
                        }
                        after={
                          <a className="agent-link" style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            14 Maple Close, Bristol
                          </a>
                        }
                      />
                      <CC id="5A" />
                    </DriftItem>

                    <DriftItem id="NC" title="Page-specific link classes accepted" noChange>
                      <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.8 }}>
                        <li>coming-up-link (hub page) — page-specific, intentional</li>
                        <li>comms-tx-link (comms component) — page-scoped, intentional</li>
                      </ul>
                    </DriftItem>
                  </>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 6 — Segment pills
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat6" label="CAT 6 — Segment pills" pill="1 CHANGE · 1 NO CHANGE">
              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 8 }}>Canonical: agent-segment-pill [.on]</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <span className="agent-segment-pill agent-segment-pill-sm on">All milestones</span>
                      <span className="agent-segment-pill agent-segment-pill-sm">Client confirmations</span>
                    </div>
                  </div>
                }
                drift={
                  <>
                    <DriftItem id="6A" title="comms page filter bar — comms-filter-pill → agent-segment-pill" file="comms/page.tsx:77-89">
                      <Note>comms-filter-pill is a page-specific class that duplicates pill behaviour. BEFORE markup from comms/page.tsx lines 77-89 verbatim.</Note>
                      <BAPair
                        useBg
                        blbl="BEFORE — comms-filter-pill"
                        albl="AFTER — agent-segment-pill"
                        before={
                          <div className="comms-filter-bar" style={{ display: "flex", gap: 4 }}>
                            <a className="comms-filter-pill on" style={{ cursor: "pointer" }}>All milestones</a>
                            <a className="comms-filter-pill" style={{ cursor: "pointer" }}>Client confirmations</a>
                          </div>
                        }
                        after={
                          <div style={{ display: "flex", gap: 4 }}>
                            <a className="agent-segment-pill agent-segment-pill-sm on" style={{ cursor: "pointer" }}>All milestones</a>
                            <a className="agent-segment-pill agent-segment-pill-sm" style={{ cursor: "pointer" }}>Client confirmations</a>
                          </div>
                        }
                      />
                      <CC id="6A" />
                    </DriftItem>

                    <DriftItem id="NC" title="All other segment pill instances canonical" noChange>
                      <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.8 }}>
                        <li>AgentRemindersList All/Seller/Buyer filter — canonical</li>
                        <li>ForecastStrip month pills — canonical</li>
                        <li>AddManualTaskForm ownership toggle — canonical</li>
                      </ul>
                    </DriftItem>
                  </>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 7 — Status indicators
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat7" label="CAT 7 — Status indicators" pill="3 CHANGE · 3 UNCERTAIN">
              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 8 }}>
                      Canonical: inline token-based colours via var(--agent-*)
                    </div>
                    <ToneChip bg="rgba(var(--agent-success-rgb, 16,185,129), 0.10)" fg="var(--agent-success, #059669)" dot="var(--agent-success, #10b981)" label="Moving" />
                    <div style={{ marginTop: 4 }}>
                      <ToneChip bg="rgba(var(--agent-danger-rgb, 239,68,68), 0.10)" fg="var(--agent-danger, #dc2626)" dot="var(--agent-danger, #ef4444)" label="Stale" />
                    </div>
                  </div>
                }
                drift={
                  <>
                    <DriftItem id="7A" title="TransactionRowView risk stripe — bg-red-500 etc. → var(--agent-danger/warning/success)" file="TransactionRowView.tsx:241">
                      <BAPair
                        useBg
                        before={
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <div style={{ width: 4, height: 48, background: "#ef4444", borderRadius: 2 }} />
                            <div style={{ width: 4, height: 48, background: "#fbbf24", borderRadius: 2 }} />
                            <div style={{ width: 4, height: 48, background: "#10b981", borderRadius: 2 }} />
                            <span style={{ fontSize: 9, color: "var(--agent-text-disabled)" }}>bg-red-500 / bg-amber-400 / bg-emerald-500</span>
                          </div>
                        }
                        after={
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <div style={{ width: 4, height: 48, background: "var(--agent-danger, #ef4444)", borderRadius: 2 }} />
                            <div style={{ width: 4, height: 48, background: "var(--agent-warning, #fbbf24)", borderRadius: 2 }} />
                            <div style={{ width: 4, height: 48, background: "var(--agent-success, #10b981)", borderRadius: 2 }} />
                            <span style={{ fontSize: 9, color: "var(--agent-text-disabled)" }}>var(--agent-danger/warning/success)</span>
                          </div>
                        }
                      />
                      <Note>Visual output identical in default theme. Change theme to see token-based version adapt; Tailwind version stays fixed.</Note>
                      <CC id="7A" />
                    </DriftItem>

                    <DriftItem id="7B" title="TransactionRowView ACTIVITY_TONE — all hardcoded hex/rgba → RGB token composition" file="TransactionRowView.tsx:88-92">
                      <BAPair
                        useBg
                        blbl="BEFORE — hardcoded hex"
                        albl="AFTER — RGB tokens"
                        before={
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <ToneChip bg="rgba(16,185,129,0.10)" fg="#059669" dot="#10b981" label="Moving · 2d ago" />
                            <ToneChip bg="rgba(245,158,11,0.12)" fg="#b45309" dot="#f59e0b" label="Stalled · 10d" />
                            <ToneChip bg="rgba(239,68,68,0.10)" fg="#dc2626" dot="#ef4444" label="Stale · 21d" />
                          </div>
                        }
                        after={
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <ToneChip bg="rgba(var(--agent-success-rgb, 16,185,129), 0.10)" fg="var(--agent-success, #059669)" dot="var(--agent-success, #10b981)" label="Moving · 2d ago" />
                            <ToneChip bg="rgba(var(--agent-warning-rgb, 245,158,11), 0.12)" fg="var(--agent-warning, #b45309)" dot="var(--agent-warning, #f59e0b)" label="Stalled · 10d" />
                            <ToneChip bg="rgba(var(--agent-danger-rgb, 239,68,68), 0.10)" fg="var(--agent-danger, #dc2626)" dot="var(--agent-danger, #ef4444)" label="Stale · 21d" />
                          </div>
                        }
                      />
                      <Note>Change theme in the top bar to see AFTER chips adapt while BEFORE stays fixed.</Note>
                      <CC id="7B" />
                    </DriftItem>

                    <DriftItem id="7C" title="CompletionFileRowView GROUP_STYLES dot colours — bg-red-500 etc. → token dotColor" file="CompletionFileRowView.tsx:33-38">
                      <BAPair
                        useBg
                        before={
                          <div style={{ display: "flex", gap: 10 }}>
                            {[
                              { dot: "#ef4444", label: "Overdue", cls: "#dc2626" },
                              { dot: "#f59e0b", label: "This week", cls: "#d97706" },
                              { dot: "#3b82f6", label: "Next week", cls: "#2563eb" },
                            ].map(({ dot, label, cls }) => (
                              <div key={label} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />
                                <span style={{ fontSize: 10, color: cls, fontWeight: 700 }}>{label}</span>
                              </div>
                            ))}
                          </div>
                        }
                        after={
                          <div style={{ display: "flex", gap: 10 }}>
                            {[
                              { dot: "var(--agent-danger, #ef4444)", label: "Overdue", fg: "var(--agent-danger, #dc2626)" },
                              { dot: "var(--agent-warning, #f59e0b)", label: "This week", fg: "var(--agent-warning, #d97706)" },
                              { dot: "var(--agent-info, #3b82f6)", label: "Next week", fg: "var(--agent-info, #2563eb)" },
                            ].map(({ dot, label, fg }) => (
                              <div key={label} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />
                                <span style={{ fontSize: 10, color: fg, fontWeight: 700 }}>{label}</span>
                              </div>
                            ))}
                          </div>
                        }
                      />
                      <Note>later (slate-400 → #94a3b8) and no_date (slate-300 → #cbd5e1) have no semantic token — see UNCERTAIN 16K for those two entries.</Note>
                      <CC id="7C" />
                    </DriftItem>

                    <DriftItem id="U7D" title="GROUP_CONFIG label/badge Tailwind classes — inline tokens or leave?" file="AgentRemindersList.tsx:23-28" uncertain>
                      <Note warn>UNCERTAIN — E1 code comment in file explicitly flags GROUP_CONFIG as intentional semantic colour-coding. Option A: inline token styles. Option B: leave Tailwind (single object, explicit comment).</Note>
                      <OptPair
                        useBg
                        optA={
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {[
                              { label: "Escalated", c: "var(--agent-danger, #dc2626)", bg: "rgba(var(--agent-danger-rgb, 220,38,38), 0.10)" },
                              { label: "Overdue", c: "#ea580c", bg: "rgba(234,88,12,0.10)" },
                              { label: "Due today", c: "var(--agent-warning, #d97706)", bg: "rgba(var(--agent-warning-rgb, 217,119,6), 0.10)" },
                              { label: "Coming up", c: "var(--agent-text-muted)", bg: "rgba(148,163,184,0.10)" },
                            ].map(({ label, c, bg }) => (
                              <div key={label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{label}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: bg, color: c }}>2</span>
                              </div>
                            ))}
                            <span style={{ fontSize: 9, color: "var(--agent-text-disabled)" }}>Token-based inline styles — adapts to theme</span>
                          </div>
                        }
                        optB={
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <span className="text-red-700" style={{ fontSize: 11, fontWeight: 700 }}>Escalated <span className="bg-red-100 text-red-700" style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99 }}>2</span></span>
                            <span className="text-orange-700" style={{ fontSize: 11, fontWeight: 700 }}>Overdue <span className="bg-orange-100 text-orange-700" style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99 }}>2</span></span>
                            <span className="text-amber-700" style={{ fontSize: 11, fontWeight: 700 }}>Due today <span className="bg-amber-100 text-amber-700" style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99 }}>2</span></span>
                            <span className="text-slate-600" style={{ fontSize: 11, fontWeight: 700 }}>Coming up <span className="bg-slate-100 text-slate-600" style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99 }}>2</span></span>
                            <span style={{ fontSize: 9, color: "var(--agent-text-disabled)" }}>Tailwind — contained in one object, E1 comment endorses</span>
                          </div>
                        }
                      />
                      <CC id="U7D" uncertain />
                    </DriftItem>

                    <DriftItem id="U7E" title="Seller #ea580c / buyer #3b82f6 — new tokens or map to existing vendor/purchaser-accent?" file="AgentRemindersList.tsx:250-252" uncertain>
                      <Note warn>UNCERTAIN — themes.css header comment lists --agent-vendor-accent and --agent-purchaser-accent. Option A: confirm they exist in all theme blocks and use them. Option B: map to --agent-warning/--agent-info (semantically imperfect).</Note>
                      <OptPair
                        useBg
                        optA={
                          <div style={{ display: "flex", gap: 16 }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--agent-vendor-accent, #ea580c)" }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-vendor-accent, #ea580c)" }}>SELLER</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--agent-purchaser-accent, #3b82f6)" }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-purchaser-accent, #3b82f6)" }}>BUYER</span>
                            </div>
                          </div>
                        }
                        optB={
                          <div style={{ display: "flex", gap: 16 }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--agent-warning, #f59e0b)" }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-warning, #b45309)" }}>SELLER</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--agent-info, #3b82f6)" }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-info, #2563eb)" }}>BUYER</span>
                            </div>
                          </div>
                        }
                      />
                      <CC id="U7E" uncertain />
                    </DriftItem>

                    <DriftItem id="U7F" title="CommsActivityFeed badge system — portal/agent confirmation + vendor/purchaser badges" file="CommsActivityFeed.tsx:90-104" uncertain>
                      <Note warn>UNCERTAIN — violet (portal-confirmed) has no existing token. Option A: define tokens. Option B: leave as-is (one component, semantically unique violet). Option C (keep current) also available.</Note>
                      <OptPair
                        useBg
                        optA={
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(124,58,237,0.10)", color: "#7c3aed" }}>Client confirmed</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(16,185,129,0.10)", color: "#059669" }}>Agent confirmed</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(59,130,246,0.06)", color: "#2563eb" }}>Vendor</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(16,185,129,0.06)", color: "#059669" }}>Purchaser</span>
                            <div style={{ fontSize: 9, color: "var(--agent-text-disabled)", width: "100%" }}>New tokens defined in themes.css</div>
                          </div>
                        }
                        optB={
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            <span className="bg-violet-50 text-violet-600 border border-violet-200" style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99 }}>Client confirmed</span>
                            <span className="bg-emerald-100 text-emerald-700" style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99 }}>Agent confirmed</span>
                            <span className="bg-blue-50 text-blue-600" style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99 }}>Vendor</span>
                            <span className="bg-emerald-50 text-emerald-700" style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99 }}>Purchaser</span>
                            <div style={{ fontSize: 9, color: "var(--agent-text-disabled)", width: "100%" }}>Leave as-is — violet unique, semantically distinct</div>
                          </div>
                        }
                      />
                      <CC id="U7F" uncertain />
                    </DriftItem>
                  </>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 8 — Skeletons
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat8" label="CAT 8 — Skeletons" pill="0 CHANGE">
              <NoDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 8 }}>All instances use .agent-skeleton canonically</div>
                    <div className="agent-skeleton" style={{ height: 12, borderRadius: 4, width: 140, marginBottom: 6 }} />
                    <div className="agent-skeleton" style={{ height: 12, borderRadius: 4, width: 100 }} />
                  </div>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 9 — Ghost opacity
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat9" label="CAT 9 — Ghost opacity" pill="3 CHANGE">
              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 6 }}>Canonical: opacity 0.35</div>
                    <div style={{ fontSize: 10, color: "var(--agent-text-disabled)", marginBottom: 8 }}>completions/page.tsx:134 · AgentTodoList.tsx:131</div>
                    <GhostBlock opacity={0.35} label="canonical (completions, todo)" />
                  </div>
                }
                drift={
                  <>
                    <DriftItem id="9A" title="hub/page.tsx — 3 locations at opacity 0.3 → 0.35" file="hub/page.tsx:147,172,204">
                      <BAPair
                        useBg
                        before={<GhostBlock opacity={0.3} label="hub/page.tsx ×3" />}
                        after={<GhostBlock opacity={0.35} label="→ 0.35" />}
                      />
                      <Note>Lines 147 (pipeline health grid), 172 (attention panel), 204 (exchange forecast grid). All three become 0.35.</Note>
                      <CC id="9A" />
                    </DriftItem>

                    <DriftItem id="9B" title="comms/page.tsx — opacity 0.4 → 0.35" file="comms/page.tsx:114">
                      <BAPair
                        useBg
                        before={<GhostBlock opacity={0.4} label="comms/page.tsx:114" />}
                        after={<GhostBlock opacity={0.35} label="→ 0.35" />}
                      />
                      <CC id="9B" />
                    </DriftItem>

                    <DriftItem id="9C" title="work-queue/page.tsx — opacity 0.5 → 0.35" file="work-queue/page.tsx:90">
                      <BAPair
                        useBg
                        before={<GhostBlock opacity={0.5} label="work-queue/page.tsx:90" />}
                        after={<GhostBlock opacity={0.35} label="→ 0.35" />}
                      />
                      <CC id="9C" />
                    </DriftItem>
                  </>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 10 — Borders
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat10" label="CAT 10 — Borders" pill="4 CHANGE · 1 NO CHANGE">
              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 6 }}>Canonical: var(--agent-border-subtle)</div>
                    <div style={{ padding: "8px 12px", borderBottom: "0.5px solid var(--agent-border-subtle, rgba(148,163,184,0.25))", fontSize: 12, color: "var(--agent-text-primary)" }}>Row with canonical border</div>
                    <div style={{ padding: "8px 12px", borderBottom: "0.5px solid var(--agent-border-subtle, rgba(148,163,184,0.25))", fontSize: 12, color: "var(--agent-text-primary)" }}>Another row</div>
                  </div>
                }
                drift={
                  <>
                    <DriftItem id="10A" title="CommsActivityFeed — divide-white/15 → borderTop on each row" file="CommsActivityFeed.tsx:87">
                      <BAPair
                        useBg
                        before={
                          <div className="divide-y divide-white/15" style={{ width: "100%" }}>
                            <div style={{ padding: "6px 0", fontSize: 11, color: "var(--agent-text-primary)" }}>Milestone row</div>
                            <div style={{ padding: "6px 0", fontSize: 11, color: "var(--agent-text-primary)" }}>Milestone row</div>
                          </div>
                        }
                        after={
                          <div style={{ width: "100%" }}>
                            <div style={{ padding: "6px 0", fontSize: 11, color: "var(--agent-text-primary)" }}>Milestone row</div>
                            <div style={{ padding: "6px 0", borderTop: "0.5px solid var(--agent-border-subtle, rgba(148,163,184,0.25))", fontSize: 11, color: "var(--agent-text-primary)" }}>Milestone row</div>
                          </div>
                        }
                      />
                      <CC id="10A" />
                    </DriftItem>

                    <DriftItem id="10B" title="comms/page.tsx — border-b border-white/20 → style borderBottom" file="comms/page.tsx:124">
                      <BAPair
                        useBg
                        before={
                          <div className="px-4 py-2.5 border-b border-white/20" style={{ fontSize: 11, color: "var(--agent-text-primary)", width: "100%" }}>
                            Ghost day-bucket header (border-b border-white/20)
                          </div>
                        }
                        after={
                          <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-subtle, rgba(148,163,184,0.25))", fontSize: 11, color: "var(--agent-text-primary)", width: "100%" }}>
                            Ghost day-bucket header (var(--agent-border-subtle))
                          </div>
                        }
                      />
                      <CC id="10B" />
                    </DriftItem>

                    <DriftItem id="10C" title="AgentRemindersList — rgba(15,23,42,0.06) → var(--agent-border-subtle)" file="AgentRemindersList.tsx:326,360">
                      <BAPair
                        useBg
                        blbl="BEFORE — hardcoded rgba"
                        albl="AFTER — token"
                        before={
                          <div style={{ borderBottom: "1px solid rgba(15,23,42,0.06)", padding: "8px 12px", fontSize: 11, color: "var(--agent-text-primary)", width: "100%" }}>
                            SideColumn row divider
                          </div>
                        }
                        after={
                          <div style={{ borderBottom: "1px solid var(--agent-border-subtle)", padding: "8px 12px", fontSize: 11, color: "var(--agent-text-primary)", width: "100%" }}>
                            SideColumn row divider
                          </div>
                        }
                      />
                      <Note>Lines 326 and 360 — row dividers within SideColumn. rgba(15,23,42,0.06) is the daylight-mode equivalent of --agent-border-subtle. Also covered by CHANGE 16B.</Note>
                      <CC id="10C" />
                    </DriftItem>

                    <DriftItem id="10D" title="AddManualTaskForm — border-t border-white/20 → style borderTop" file="AddManualTaskForm.tsx:142">
                      <BAPair
                        useBg
                        blbl="BEFORE — Tailwind border-white/20"
                        albl="AFTER — inline borderTop token"
                        before={
                          <div className="px-4 py-2.5 border-t border-white/20" style={{ fontSize: 11, color: "var(--agent-text-primary)", width: "100%" }}>
                            Form footer separator (border-t border-white/20)
                          </div>
                        }
                        after={
                          <div style={{ padding: "10px 16px", borderTop: "0.5px solid var(--agent-border-subtle)", fontSize: 11, color: "var(--agent-text-primary)", width: "100%" }}>
                            Form footer separator (var(--agent-border-subtle))
                          </div>
                        }
                      />
                      <Note>Not completed in Stage 4 — border-white/20 is still present in the file. Change pending.</Note>
                      <CC id="10D" />
                    </DriftItem>

                    <DriftItem id="NC" title="Completions urgency card borders — intentional semantic distinction" noChange>
                      <Note>No change — border-red-200/40, border-amber-200/40 etc. communicate urgency level on file cards. Single border token would lose that signal.</Note>
                    </DriftItem>
                  </>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 11 — Focus rings
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat11" label="CAT 11 — Focus rings" pill="2 CHANGE">
              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 6 }}>Canonical: var(--agent-focus-ring)</div>
                    <div style={{ fontSize: 10, color: "var(--agent-text-disabled)", marginBottom: 8 }}>agent-btn · agent-link · agent-segment-pill · agent-tab</div>
                    <button className="agent-btn agent-btn-sm" style={{ marginRight: 6 }}>Focused button</button>
                    <a className="agent-link" style={{ fontSize: 12 }}>Focus link</a>
                  </div>
                }
                drift={
                  <>
                    <DriftItem id="11A" title="agent-system.css — add .agent-acc-hdr:focus-visible rule" file="agent-system.css">
                      <Note>div role=button tabIndex=0 accordion headers in CommsActivityFeed.tsx:63-67 and CompletionsGroupList.tsx:49-54 have no focus treatment. Add to existing :focus-visible block in agent-system.css.</Note>
                      <BAPair
                        useBg
                        blbl="BEFORE — tab to focus, no ring"
                        albl="AFTER — focus ring shown (permanent demo)"
                        before={
                          <div
                            role="button"
                            tabIndex={0}
                            className="agent-acc-hdr"
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>Day bucket header</span>
                            <CaretDown style={{ width: 14, height: 14, color: "var(--agent-text-muted)", transition: "transform 200ms" }} />
                          </div>
                        }
                        after={
                          <div
                            role="button"
                            tabIndex={0}
                            className="agent-acc-hdr"
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", boxShadow: "var(--agent-focus-ring, 0 0 0 2px rgba(255,107,74,0.40))", outline: "none" }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>Day bucket header</span>
                            <CaretDown style={{ width: 14, height: 14, color: "var(--agent-text-muted)", transition: "transform 200ms" }} />
                          </div>
                        }
                      />
                      <CC id="11A" />
                    </DriftItem>

                    <DriftItem id="11B" title="AgentTodoList task completion circle — add agent-circle-btn class" file="AgentTodoList.tsx:348-361">
                      <Note>Add .agent-circle-btn:focus-visible rule to agent-system.css. Add className=&quot;p-2 -m-2 agent-circle-btn&quot; to button. Focus ring shown permanently to demo the proposed class.</Note>
                      <BAPair
                        useBg
                        blbl="BEFORE — no focus treatment"
                        albl="AFTER — agent-circle-btn (demo permanent)"
                        before={
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button
                              className="p-2 -m-2"
                              style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid var(--agent-info-border, #94a3b8)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 150ms" }}
                            />
                            <span style={{ fontSize: 12, color: "var(--agent-text-primary)" }}>Mark as done</span>
                          </div>
                        }
                        after={
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button
                              className="p-2 -m-2"
                              style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid var(--agent-info-border, #94a3b8)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 150ms", boxShadow: "var(--agent-focus-ring, 0 0 0 2px rgba(255,107,74,0.40))", outline: "none" }}
                            />
                            <span style={{ fontSize: 12, color: "var(--agent-text-primary)" }}>Mark as done</span>
                          </div>
                        }
                      />
                      <CC id="11B" />
                    </DriftItem>
                  </>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 12 — Animations
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat12" label="CAT 12 — Animations" pill="see CAT 2">
              <NoDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 6 }}>No additional animation changes beyond CAT 2 dropdown-out</div>
                    <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.8 }}>
                      <li>agent-reveal-in — canonical across all pages</li>
                      <li>agent-row-exit — canonical</li>
                      <li>agent-row-flash — canonical</li>
                      <li>agent-acc open/close — canonical</li>
                    </ul>
                  </div>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 13 — Caret rotation
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat13" label="CAT 13 — Caret rotation" pill="1 CHANGE (see 1A) · 1 UNCERTAIN">
              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 4 }}>CHANGE 13A = CHANGE 1A (SectionAccordion.tsx)</div>
                    <div style={{ fontSize: 10, color: "var(--agent-text-disabled)" }}>Covered in CAT 1 above.</div>
                  </div>
                }
                drift={
                  <DriftItem id="U13B" title="Text-only Show/Hide toggles — add CaretDown or leave text-only?" file="AgentRemindersList.tsx:751-756 · FileAlertsStrip.tsx" uncertain>
                    <Note warn>UNCERTAIN — text-only is unambiguous in a colour-coded urgency header where space is constrained. Adding caret may be redundant. Option A: add rotating CaretDown. Option B: leave text-only.</Note>
                    <OptPair
                      useBg
                      optA={
                        <button style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--agent-text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                          Hide
                          <CaretDown size={10} style={{ transition: "transform 200ms", transform: "rotate(180deg)" }} />
                        </button>
                      }
                      optB={
                        <button style={{ fontSize: 12, color: "var(--agent-text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                          Hide
                        </button>
                      }
                    />
                    <CC id="U13B" uncertain />
                  </DriftItem>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 14 — Solid/glass parity
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat14" label="CAT 14 — Solid/glass parity" pill="0 CHANGE">
              <NoDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 4 }}>isSolid dead-code branches accepted</div>
                    <div style={{ fontSize: 10, color: "var(--agent-text-disabled)" }}>HeroCard.tsx and DraftPanel.tsx — code comment endorses current state. Use the Solid toggle in the top bar to preview data-solid on documentElement.</div>
                  </div>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 15 — Card shade consistency
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat15" label="CAT 15 — Card shade consistency" pill="0 CHANGE">
              <NoDrift
                aligned={
                  <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.9 }}>
                    <li>Dropdown rgba(255,255,255,0.97) — consistent across all 5 dropdown instances</li>
                    <li>SplitFileCard header rgba(255,255,255,0.28) — intentional visual hierarchy</li>
                    <li>All CSS-class-defined surfaces accepted</li>
                  </ul>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 16 — Hardcoded colours
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat16" label="CAT 16 — Hardcoded colours" pill="7 CHANGE · 5 UNCERTAIN">
              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 8 }}>Canonical: var(--agent-text-muted) · var(--agent-text-disabled) · var(--agent-border-subtle)</div>
                    <div style={{ fontSize: 12, color: "var(--agent-text-muted)", marginBottom: 4 }}>6 reminders (text-muted)</div>
                    <div style={{ fontSize: 11, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>Seller is all up to date (text-disabled)</div>
                  </div>
                }
                drift={
                  <>
                    <DriftItem id="16A" title="rgba(15,23,42,0.35) → var(--agent-text-muted) — 2 locations" file="AgentRemindersList.tsx:296,313">
                      <BAPair
                        useBg
                        before={<span style={{ fontSize: 12, color: "rgba(15,23,42,0.35)" }}>6 reminders</span>}
                        after={<span style={{ fontSize: 12, color: "var(--agent-text-muted, rgba(15,23,42,0.55))" }}>6 reminders</span>}
                      />
                      <Note>Line 296 (reminder count span) + line 313 (urgencyColor fallback for &ldquo;upcoming&rdquo; state).</Note>
                      <CC id="16A" />
                    </DriftItem>

                    <DriftItem id="16C" title="rgba(15,23,42,0.28) → var(--agent-text-disabled)" file="AgentRemindersList.tsx:426">
                      <BAPair
                        useBg
                        before={<span style={{ fontSize: 11, color: "rgba(15,23,42,0.28)", fontStyle: "italic" }}>Seller is all up to date</span>}
                        after={<span style={{ fontSize: 11, color: "var(--agent-text-disabled, rgba(15,23,42,0.35))", fontStyle: "italic" }}>Seller is all up to date</span>}
                      />
                      <CC id="16C" />
                    </DriftItem>

                    <DriftItem id="16D" title="rgba(180,87,9,0.40) → rgba(var(--agent-warning-rgb), 0.40)" file="TransactionRowView.tsx:201">
                      <BAPair
                        useBg
                        before={<span style={{ fontSize: 12, color: "rgba(180,87,9,0.40)" }}>Names not set</span>}
                        after={<span style={{ fontSize: 12, color: "rgba(var(--agent-warning-rgb, 180,87,9), 0.40)" }}>Names not set</span>}
                      />
                      <Note>VendorBuyerLine muted warning text — adapts to theme when token is present.</Note>
                      <CC id="16D" />
                    </DriftItem>

                    <DriftItem id="16EFG" title="GROUP_LEFT_BORDER: escalated/due_today/upcoming — hex → tokens" file="AgentRemindersList.tsx:65-71">
                      <BAPair
                        useBg
                        blbl="BEFORE — hardcoded hex"
                        albl="AFTER — tokens"
                        before={
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <UrgencyStrip color="#dc2626" label="escalated" value="#dc2626" />
                            <UrgencyStrip color="#d97706" label="due_today" value="#d97706" />
                            <UrgencyStrip color="rgba(148,163,184,0.35)" label="upcoming" value="rgba(148,163,184,0.35)" />
                          </div>
                        }
                        after={
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <UrgencyStrip color="var(--agent-danger, #dc2626)" label="escalated" value="var(--agent-danger)" />
                            <UrgencyStrip color="var(--agent-warning, #d97706)" label="due_today" value="var(--agent-warning)" />
                            <UrgencyStrip color="var(--agent-border-subtle, rgba(148,163,184,0.35))" label="upcoming" value="var(--agent-border-subtle)" />
                          </div>
                        }
                      />
                      <Note>overdue (#ea580c) is left unchanged — see UNCERTAIN 7E/16H for the orange seller-party colour decision.</Note>
                      <CC id="16EFG" />
                    </DriftItem>

                    <DriftItem id="U16I" title="GROUP_LEFT_BORDER.snoozed rgba(168,85,247,0.5) — use --agent-snoozed or leave?" file="AgentRemindersList.tsx:70" uncertain>
                      <Note warn>UNCERTAIN — themes.css header lists --agent-snoozed, --agent-snoozed-bg, --agent-snoozed-border, --agent-snoozed-rgb. Option A: confirm they exist in all theme blocks and use var(--agent-snoozed). Option B: leave hardcoded (single usage, distinctive purple).</Note>
                      <OptPair
                        useBg
                        optA={<UrgencyStrip color="var(--agent-snoozed, rgba(168,85,247,0.5))" label="snoozed" value="var(--agent-snoozed)" />}
                        optB={<UrgencyStrip color="rgba(168,85,247,0.5)" label="snoozed" value="rgba(168,85,247,0.5) — leave" />}
                      />
                      <CC id="U16I" uncertain />
                    </DriftItem>

                    <DriftItem id="U16K" title="GROUP_STYLES later/no_date dot colours — leave Tailwind or convert to raw hex?" file="CompletionFileRowView.tsx:37-38" uncertain>
                      <Note warn>UNCERTAIN — only matters if CHANGE 7C is implemented (all dots become inline style). If 7C adopted, must convert to raw hex. If 7C keeps className for later/no_date, leave as Tailwind.</Note>
                      <OptPair
                        useBg
                        optA={
                          <div style={{ display: "flex", gap: 10 }}>
                            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8" }} />
                              <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontWeight: 700 }}>later (#94a3b8)</span>
                            </div>
                            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#cbd5e1" }} />
                              <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontWeight: 700 }}>no_date (#cbd5e1)</span>
                            </div>
                          </div>
                        }
                        optB={
                          <div style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>
                            Leave as <code style={{ fontSize: 9, background: "rgba(0,0,0,0.06)", padding: "1px 4px", borderRadius: 3 }}>bg-slate-400</code> / <code style={{ fontSize: 9, background: "rgba(0,0,0,0.06)", padding: "1px 4px", borderRadius: 3 }}>bg-slate-300</code> Tailwind — no semantic token needed, no theme meaning
                          </div>
                        }
                      />
                      <CC id="U16K" uncertain />
                    </DriftItem>
                  </>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                CAT 17 — Hover-row
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="cat17" label="CAT 17 — Hover-row" pill="1 CHANGE · 1 UNCERTAIN">
              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 8 }}>Canonical: agent-hover-row utility class</div>
                    <div className="agent-hover-row" style={{ padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "var(--agent-text-primary)", border: "0.5px solid var(--agent-border-subtle)" }}>
                      Hover me — background tint on hover
                    </div>
                  </div>
                }
                drift={
                  <>
                    <DriftItem id="17A" title="CompletionsGroupList file cards — hover:shadow-md → agent-hover-row" file="CompletionsGroupList.tsx:92">
                      <BAPair
                        useBg
                        blbl="BEFORE — hover:shadow-md (Tailwind)"
                        albl="AFTER — agent-hover-row"
                        before={
                          <div className="glass-card" style={{ padding: "12px 16px", fontSize: 12, color: "var(--agent-text-primary)", cursor: "pointer", width: "100%" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
                            14 Maple Close, Bristol
                            <div style={{ fontSize: 9, color: "var(--agent-text-disabled)", marginTop: 3 }}>hover: box-shadow increases</div>
                          </div>
                        }
                        after={
                          <div className="glass-card agent-hover-row" style={{ padding: "12px 16px", fontSize: 12, color: "var(--agent-text-primary)", cursor: "pointer", width: "100%" }}>
                            14 Maple Close, Bristol
                            <div style={{ fontSize: 9, color: "var(--agent-text-disabled)", marginTop: 3 }}>hover: background tint</div>
                          </div>
                        }
                      />
                      <CC id="17A" />
                    </DriftItem>

                    <DriftItem id="U17B" title="AgentTodoList task rows — add agent-hover-row or leave no hover?" file="AgentTodoList.tsx:340-345" uncertain>
                      <Note warn>UNCERTAIN — task rows have inline interactive elements (circle toggle, address link). Full-row hover background could imply the row is clickable (it is not). Option B (no hover) may be clearer about interaction model.</Note>
                      <OptPair
                        useBg
                        optA={
                          <div className="agent-hover-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer" }}>
                            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid var(--agent-info-border, #94a3b8)", flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: "var(--agent-text-primary)" }}>Chase: Solicitor pack request</span>
                            <span style={{ fontSize: 10, color: "var(--agent-text-disabled)", marginLeft: "auto" }}>2d</span>
                          </div>
                        }
                        optB={
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
                            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid var(--agent-info-border, #94a3b8)", flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: "var(--agent-text-primary)" }}>Chase: Solicitor pack request</span>
                            <span style={{ fontSize: 10, color: "var(--agent-text-disabled)", marginLeft: "auto" }}>2d</span>
                          </div>
                        }
                      />
                      <CC id="U17B" uncertain />
                    </DriftItem>
                  </>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                NC1 — --nv2-* token namespace
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="nc1" label="NC1 — --nv2-* token namespace" pill="0 CHANGE · KEEP SEPARATE">
              <NoDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 8 }}>--nv2-* and --agent-* are intentionally separate namespaces</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--agent-text-muted)", marginBottom: 4 }}>--nv2-* (form context)</div>
                        {["--nv2-surface-glass", "--nv2-surface-raised", "--nv2-border-glass", "--nv2-border-dark", "--nv2-text-faint", "--nv2-text-ghost", "--nv2-text-muted"].map((t) => (
                          <div key={t} style={{ fontSize: 9, fontFamily: "monospace", color: "var(--agent-text-disabled)", lineHeight: 1.9 }}>{t}</div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--agent-text-muted)", marginBottom: 4 }}>Nearest --agent-* counterpart</div>
                        {["--agent-glass-bg", "--agent-surface-elevated", "--agent-glass-border", "--agent-border-strong", "--agent-text-tertiary", "--agent-text-disabled", "--agent-text-muted"].map((t) => (
                          <div key={t} style={{ fontSize: 9, fontFamily: "monospace", color: "var(--agent-text-disabled)", lineHeight: 1.9 }}>{t}</div>
                        ))}
                      </div>
                    </div>
                    <Note>Add a comment block to the new-v2 form&apos;s first component documenting namespace separation. Do not merge namespaces.</Note>
                  </div>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                NC2 — Inline hover handlers
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="nc2" label="NC2 — Inline hover handlers" pill="1 CHANGE">
              <AlignedDrift
                aligned={
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 6 }}>Canonical: CSS hover rule via agent-system.css or style block</div>
                    <div style={{ fontSize: 10, color: "var(--agent-text-disabled)" }}>agent-hover-row · agent-note-item (proposed)</div>
                  </div>
                }
                drift={
                  <DriftItem id="NC2A" title="TransactionNotes.tsx — onMouseEnter/onMouseLeave → CSS hover rule" file="TransactionNotes.tsx:97-98">
                    <BAPair
                      useBg
                      blbl="BEFORE — JS handler (hover me)"
                      albl="AFTER — CSS class (hover me)"
                      before={
                        <div>
                          <div
                            style={{ background: "var(--agent-surface-glass)", borderRadius: 6, padding: "8px 12px", marginBottom: 6, fontSize: 11, color: "var(--agent-text-primary)", cursor: "default" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(148,163,184,0.14)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                          >
                            Note row — JS handler sets rgba directly
                          </div>
                          <div style={{ fontSize: 9, color: "var(--agent-text-disabled)" }}>onMouseEnter/Leave mutate .style.background with hardcoded rgba</div>
                        </div>
                      }
                      after={
                        <div>
                          <div
                            className="agent-hover-row"
                            style={{ background: "var(--agent-surface-glass)", borderRadius: 6, padding: "8px 12px", marginBottom: 6, fontSize: 11, color: "var(--agent-text-primary)", cursor: "default" }}
                          >
                            Note row — CSS class controls hover tint
                          </div>
                          <div style={{ fontSize: 9, color: "var(--agent-text-disabled)" }}>agent-hover-row:hover uses var(--agent-hover-tint) — theme-aware</div>
                        </div>
                      }
                    />
                    <Note>Visual output is identical. AFTER uses agent-hover-row (existing canonical class) instead of imperative JS handlers. Also delete opacity onMouseEnter/onMouseLeave on delete button (lines 113-116) — those are discrete interactions, keep them.</Note>
                    <CC id="NC2A" />
                  </DriftItem>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                NC3–NC8 — Additional patterns
            ══════════════════════════════════════════════════════════════ */}
            <CatBlock id="nc3-8" label="NC3–NC8 — Additional patterns" pill="0 CHANGE">
              <NoDrift
                aligned={
                  <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.9 }}>
                    <li>NC3: agent-press-cell (hub only) — page-scoped, acceptable</li>
                    <li>NC4: avatar/initials inline style — single instance, no canonicalisation needed</li>
                    <li>NC5: agent-section-in (new-v2 only) — inline animation reference, acceptable</li>
                    <li>NC6: wq-split-body, wq-urgency-bar-* — page-scoped CSS group, acceptable</li>
                    <li>NC7: card header patterns — partial canonicalisation, no new inconsistencies</li>
                    <li>NC8: tl-* class family — transaction-list page-scoped, acceptable</li>
                  </ul>
                }
              />
            </CatBlock>

            {/* ═════════════════════════════════════════════════════════════
                EXPORT DECISIONS
            ══════════════════════════════════════════════════════════════ */}
            <div className="aba-export" style={{ background: "white" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 4 }}>
                Export decisions ({decidedCount} of {allIds.length})
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
                Copy-paste into <code style={{ fontSize: 10 }}>docs/polish-pass/audits/cross-page-audit-decisions.md</code>
              </div>
              {decidedCount === 0 ? (
                <div style={{ fontSize: 12, color: "#9ca3af", padding: "16px", background: "#f9fafb", borderRadius: 8 }}>
                  No decisions made yet — use the choice controls above.
                </div>
              ) : (
                <pre className="aba-export-pre">{exportText}</pre>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
