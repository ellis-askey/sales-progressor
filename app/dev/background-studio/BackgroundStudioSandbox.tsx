"use client";

// The moving-background colour studio, in the sandbox. Everything you see is
// driven by the REAL WebGL shaders:
//   - full-screen backdrop  → <AppBackground light dark /> (Iridescence / SoftAurora)
//   - card preview tiles     → small live Iridescence + SoftAurora instances
// The light/dark mode is flipped by writing data-theme on <html> (exactly how
// the live app's theme toggle works), so AppBackground swaps shader on its own.
//
// Dev-only. No persistence — Save logs the payload we'd write to
// agentPreferences.auroraColours. Light is a single Iridescence tint; dark is
// the two SoftAurora bands.

import { useCallback, useEffect, useState } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { Iridescence } from "@/components/decor/Iridescence";
import { SoftAurora } from "@/components/decor/SoftAurora";
import { Palette, Sun, Moon, PencilSimple, ArrowCounterClockwise } from "@phosphor-icons/react";

type Mode = "light" | "dark";
type Pair = [string, string];
type Colours = { light: Pair; dark: Pair };

const DEFAULTS: Colours = { light: ["#ffffff", "#ffffff"], dark: ["#5b8cff", "#a8ff60"] };

const LOOKS: Array<{ name: string; c: Colours }> = [
  { name: "Aurora", c: { light: ["#9fe8ff", "#c9b6ff"], dark: ["#5b8cff", "#a8ff60"] } },
  { name: "Ocean", c: { light: ["#bfe8ff", "#a8d8ff"], dark: ["#2563eb", "#22d3ee"] } },
  { name: "Violet", c: { light: ["#e5d6ff", "#ffd0ec"], dark: ["#7c3aed", "#ec4899"] } },
  { name: "Forest", c: { light: ["#d2f5d8", "#eaf6c2"], dark: ["#16a34a", "#a3e635"] } },
  { name: "Sunset", c: { light: ["#ffe0cf", "#ffd0dd"], dark: ["#f43f5e", "#fb923c"] } },
  { name: "Mono", c: { light: ["#eef0f3", "#dfe3e8"], dark: ["#64748b", "#cbd5e1"] } },
];

const eqPair = (a: Pair, b: Pair) =>
  a[0].toLowerCase() === b[0].toLowerCase() && a[1].toLowerCase() === b[1].toLowerCase();
const same = (a: Colours, b: Colours) => eqPair(a.light, b.light) && eqPair(a.dark, b.dark);

// Small live previews of the two real shaders, each pinned to its own mode so
// the card always shows both regardless of the full-screen mode.
function LightTile({ colours }: { colours: Pair }) {
  return (
    <div className="bgs-tilecanvas" style={{ background: "#ffffff" }}>
      <Iridescence color={colours[0]} color2={colours[1]} speed={0.05} amplitude={0.3} mouseReact={false} opacity={0.18} />
    </div>
  );
}
function DarkTile({ colours }: { colours: [string, string] }) {
  return (
    <div className="bgs-tilecanvas" style={{ background: "#06060c" }}>
      <SoftAurora
        speed={0.1}
        scale={2.4}
        brightness={0.6}
        color1={colours[0]}
        color2={colours[1]}
        noiseFrequency={0.5}
        noiseAmplitude={7.5}
        bandHeight={0.5}
        bandSpread={1}
        octaveDecay={0.16}
        layerOffset={1}
        colorSpeed={0.5}
        enableMouseInteraction={false}
      />
    </div>
  );
}

export function BackgroundStudioSandbox() {
  const [saved, setSaved] = useState<Colours>(DEFAULTS);
  const [draft, setDraft] = useState<Colours>(DEFAULTS);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<Mode>("light");

  // Flip the real app theme so AppBackground swaps Iridescence <-> SoftAurora,
  // exactly like the live theme toggle. (ThemeModeBoot sets an initial value;
  // we take over here.)
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const live = editing ? draft : saved;

  const patch = useCallback((key: Mode, i: 0 | 1, hex: string) => {
    setDraft((d) => {
      const np: Pair = [d[key][0], d[key][1]];
      np[i] = hex;
      return { ...d, [key]: np };
    });
  }, []);

  const startEdit = () => {
    setDraft(saved);
    setEditing(true);
  };
  const cancel = () => {
    setDraft(saved);
    setEditing(false);
  };
  const save = () => {
    setSaved(draft);
    setEditing(false);
    // What the real server action would persist on agentPreferences.auroraColours.
    // eslint-disable-next-line no-console
    console.log("[background-studio] would save:", JSON.stringify(draft));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editing) cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !same(draft, saved);
  const hintColour = mode === "light" ? draft.light[0] : draft.dark[0];

  return (
    <div className="bgs">
      <style>{CSS}</style>

      {/* The real full-screen backdrop. Card view shows the saved colours; the
          editor shows the live draft so every pick updates the whole screen. */}
      <AppBackground light={live.light} dark={live.dark} />

      {/* Global light/dark toggle (top-right) — realistic, and lets you view
          either mode full-screen before you even start editing. */}
      <div className="bgs-modeglobal">
        <button type="button" className={mode === "light" ? "on" : ""} onClick={() => setMode("light")} aria-pressed={mode === "light"}>
          <Sun size={14} weight="bold" /> Light
        </button>
        <button type="button" className={mode === "dark" ? "on" : ""} onClick={() => setMode("dark")} aria-pressed={mode === "dark"}>
          <Moon size={14} weight="bold" /> Dark
        </button>
      </div>

      {/* ── CARD VIEW ── */}
      {!editing && (
        <div className="bgs-cardwrap">
          <span className="bgs-devtag">/dev/background-studio — real shaders, no persistence</span>
          <div className="bgs-card">
            <div className="bgs-card-h">
              <span className="bgs-card-ic"><Palette size={20} weight="fill" /></span>
              <div>
                <p className="bgs-card-t">Moving background</p>
                <p className="bgs-card-s">The living backdrop behind your whole workspace. Pick its colours for each mode.</p>
              </div>
            </div>

            <div className="bgs-tiles">
              <div className="bgs-tile">
                <LightTile colours={saved.light} />
                <div className="bgs-tile-meta">
                  <span className="bgs-tile-name"><Sun size={13} weight="bold" /> Light</span>
                  <span className="bgs-dots"><i className="bgs-dot" style={{ background: saved.light[0] }} /><i className="bgs-dot" style={{ background: saved.light[1] }} /></span>
                </div>
              </div>
              <div className="bgs-tile">
                <DarkTile colours={saved.dark} />
                <div className="bgs-tile-meta">
                  <span className="bgs-tile-name"><Moon size={13} weight="bold" /> Dark</span>
                  <span className="bgs-dots"><i className="bgs-dot" style={{ background: saved.dark[0] }} /><i className="bgs-dot" style={{ background: saved.dark[1] }} /></span>
                </div>
              </div>
            </div>

            <div className="bgs-card-f">
              <small>Changes preview live across the whole screen before you save.</small>
              <button type="button" className="bgs-btn bgs-btn-primary" onClick={startEdit}>
                <PencilSimple size={15} weight="bold" /> Edit colours
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FULL-SCREEN EDITOR ── */}
      {editing && (
        <>
          <div className="bgs-hint" style={{ ["--hintc" as string]: hintColour }}>
            <span className="bgs-livedot" /> Editing <b>{mode}</b> · the whole screen is live
          </div>

          <div className="bgs-dock" role="dialog" aria-label="Edit moving background colours">
            <div className="bgs-dock-row bgs-between">
              <div className="bgs-seg" role="tablist" aria-label="Mode">
                <button type="button" role="tab" aria-selected={mode === "light"} className={mode === "light" ? "on" : ""} onClick={() => setMode("light")}>
                  <Sun size={14} weight="bold" /> Light
                </button>
                <button type="button" role="tab" aria-selected={mode === "dark"} className={mode === "dark" ? "on" : ""} onClick={() => setMode("dark")}>
                  <Moon size={14} weight="bold" /> Dark
                </button>
              </div>

              <div className="bgs-looks">
                {LOOKS.map((l) => (
                  <button
                    key={l.name}
                    type="button"
                    className={`bgs-look${same(l.c, draft) ? " on" : ""}`}
                    onClick={() => setDraft(l.c)}
                    title={l.name}
                  >
                    <span className="bgs-look-chip" style={{ background: `linear-gradient(90deg, ${l.c.dark[0]}, ${l.c.dark[1]})` }} />
                    <span>{l.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bgs-dock-row bgs-between">
              <div className="bgs-swatches">
                <span className="bgs-seplabel">{mode === "light" ? "Tints" : "Bands"}</span>
                {mode === "light" ? (
                  <>
                    <Swatch label="Tint one" value={draft.light[0]} onChange={(hex) => patch("light", 0, hex)} />
                    <Swatch label="Tint two" value={draft.light[1]} onChange={(hex) => patch("light", 1, hex)} />
                  </>
                ) : (
                  <>
                    <Swatch label="Band one" value={draft.dark[0]} onChange={(hex) => patch("dark", 0, hex)} />
                    <Swatch label="Band two" value={draft.dark[1]} onChange={(hex) => patch("dark", 1, hex)} />
                  </>
                )}
              </div>

              <div className="bgs-actions">
                <button type="button" className="bgs-dbtn bgs-dbtn-reset" onClick={() => setDraft(DEFAULTS)}>
                  <ArrowCounterClockwise size={13} weight="bold" /> Reset
                </button>
                <span className="bgs-divider" aria-hidden="true" />
                <button type="button" className="bgs-dbtn bgs-dbtn-cancel" onClick={cancel}>Cancel</button>
                <button type="button" className="bgs-dbtn bgs-dbtn-save" onClick={save} disabled={!dirty}>Save background</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <div className="bgs-sw">
      <label style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      </label>
      <span className="bgs-sw-tx">
        <b>{label}</b>
        <span>{value}</span>
      </span>
    </div>
  );
}

const CSS = `
.bgs{ position:relative; z-index:0; min-height:100vh; font-family:var(--agent-font-sans, system-ui,-apple-system,"Segoe UI",Roboto,sans-serif); }
.bgs *{ box-sizing:border-box; }

/* global mode toggle, top-right */
.bgs-modeglobal{ position:fixed; top:16px; right:16px; z-index:30; display:inline-flex; gap:2px; padding:3px;
  background:rgba(20,20,26,.42); border:1px solid rgba(255,255,255,.16); border-radius:999px;
  -webkit-backdrop-filter:blur(16px); backdrop-filter:blur(16px); }
.bgs-modeglobal button{ appearance:none; border:none; background:none; cursor:pointer; color:rgba(255,255,255,.7);
  font:inherit; font-size:12px; font-weight:650; padding:6px 13px; border-radius:999px; display:inline-flex; align-items:center; gap:6px; transition:background .18s,color .18s; }
.bgs-modeglobal button.on{ background:#fff; color:#141418; }

/* card view */
.bgs-cardwrap{ position:relative; z-index:10; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; padding:24px; }
.bgs-devtag{ font-size:11px; font-weight:600; letter-spacing:.04em; color:#fff; background:rgba(20,20,26,.5); padding:5px 12px; border-radius:999px;
  -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,.14); }
.bgs-card{ width:min(560px, calc(100vw - 40px)); border-radius:18px; overflow:hidden;
  background:rgba(255,255,255,.62); border:1px solid rgba(255,255,255,.7);
  -webkit-backdrop-filter:blur(26px) saturate(170%); backdrop-filter:blur(26px) saturate(170%);
  box-shadow:0 30px 70px -32px rgba(20,16,30,.55); }
:root[data-theme="dark"] .bgs-card{ background:rgba(26,30,40,.62); border-color:rgba(255,255,255,.1); }
.bgs-card-h{ display:flex; gap:13px; align-items:flex-start; padding:20px 20px 4px; }
.bgs-card-ic{ flex-shrink:0; width:40px; height:40px; border-radius:11px; display:grid; place-items:center; color:#fff;
  background:linear-gradient(160deg, var(--agent-coral, #ff6b4a), var(--agent-coral-deep, #e8502f));
  box-shadow:0 6px 16px -6px rgba(var(--agent-coral-rgb,255,107,74),.6), inset 0 1px 0 rgba(255,255,255,.35); }
.bgs-card-t{ margin:0; font-size:15.5px; font-weight:750; letter-spacing:-.01em; color:var(--agent-text-primary,#2d1810); }
.bgs-card-s{ margin:3px 0 0; font-size:12.5px; line-height:1.45; color:var(--agent-text-muted,rgba(45,24,16,.56)); }
.bgs-tiles{ display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:16px 20px 4px; }
@media (max-width:460px){ .bgs-tiles{ grid-template-columns:1fr; } }
.bgs-tile{ border:1px solid var(--agent-border-default,rgba(45,24,16,.12)); border-radius:13px; overflow:hidden; background:var(--agent-bg-paper,#fff); }
.bgs-tilecanvas{ height:96px; position:relative; overflow:hidden; }
.bgs-tile-meta{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:9px 11px; }
.bgs-tile-name{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; color:var(--agent-text-primary,#2d1810); }
.bgs-dots{ display:flex; gap:5px; }
.bgs-dot{ width:15px; height:15px; border-radius:5px; border:1px solid rgba(0,0,0,.14); box-shadow:inset 0 1px 0 rgba(255,255,255,.3); }
.bgs-card-f{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 20px 18px; flex-wrap:wrap; }
.bgs-card-f small{ font-size:11.5px; color:var(--agent-text-muted,rgba(45,24,16,.5)); max-width:30ch; }
.bgs-btn{ appearance:none; font:inherit; font-size:13px; font-weight:650; cursor:pointer; border-radius:10px; padding:9px 18px; border:none; display:inline-flex; align-items:center; gap:7px; transition:transform .12s, box-shadow .2s; }
.bgs-btn-primary{ color:var(--agent-text-on-coral,#fff); background:linear-gradient(180deg, var(--agent-coral,#ff6b4a), var(--agent-coral-deep,#e8502f)); box-shadow:0 8px 20px -8px rgba(var(--agent-coral-rgb,255,107,74),.6), inset 0 1px 0 rgba(255,255,255,.3); }
.bgs-btn-primary:hover{ transform:translateY(-1px); }
.bgs-btn:focus-visible{ outline:2px solid var(--agent-coral-deep,#e8502f); outline-offset:2px; }

/* top hint */
.bgs-hint{ position:fixed; top:22px; left:50%; transform:translateX(-50%); z-index:20;
  font-size:12px; font-weight:600; padding:8px 15px; border-radius:999px; display:flex; align-items:center; gap:8px;
  background:rgba(20,20,26,.5); color:#fff; border:1px solid rgba(255,255,255,.14);
  -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px); }
.bgs-hint b{ color:var(--hintc,#9fe8ff); font-weight:800; text-transform:capitalize; }
.bgs-livedot{ width:7px; height:7px; border-radius:50%; background:#4ade80; box-shadow:0 0 0 0 rgba(74,222,128,.6); animation:bgsPulse 2s infinite; }
@keyframes bgsPulse{ 0%{box-shadow:0 0 0 0 rgba(74,222,128,.55)} 70%{box-shadow:0 0 0 7px rgba(74,222,128,0)} 100%{box-shadow:0 0 0 0 rgba(74,222,128,0)} }
@media (prefers-reduced-motion:reduce){ .bgs-livedot{ animation:none; } }

/* dock */
.bgs-dock{ position:fixed; left:50%; bottom:26px; transform:translateX(-50%); z-index:20; width:min(700px, calc(100vw - 28px));
  background:rgba(18,18,24,.52); border:1px solid rgba(255,255,255,.14); border-radius:18px; color:#fff;
  -webkit-backdrop-filter:blur(28px) saturate(150%); backdrop-filter:blur(28px) saturate(150%);
  box-shadow:0 30px 70px -30px rgba(0,0,0,.7); padding:14px 16px; display:flex; flex-direction:column; gap:13px; }
.bgs-dock-row{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.bgs-between{ justify-content:space-between; }
.bgs-seg{ display:inline-flex; background:rgba(255,255,255,.1); border-radius:10px; padding:3px; gap:2px; }
.bgs-seg button{ appearance:none; border:none; background:none; font:inherit; font-size:12.5px; font-weight:650; color:rgba(255,255,255,.65); padding:6px 14px; border-radius:8px; cursor:pointer; transition:color .18s,background .18s; display:inline-flex; align-items:center; gap:6px; }
.bgs-seg button.on{ color:#141418; background:#fff; }
.bgs-seplabel{ font-size:10.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:rgba(255,255,255,.5); }
.bgs-swatches{ display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
.bgs-sw{ display:flex; align-items:center; gap:9px; }
.bgs-sw label{ position:relative; width:38px; height:38px; border-radius:10px; cursor:pointer; flex-shrink:0; overflow:hidden; border:1px solid rgba(255,255,255,.25); box-shadow:inset 0 1px 0 rgba(255,255,255,.3); }
.bgs-sw label input{ position:absolute; inset:-6px; width:160%; height:160%; opacity:0; cursor:pointer; border:none; padding:0; }
.bgs-sw-tx{ display:flex; flex-direction:column; line-height:1.25; }
.bgs-sw-tx b{ font-size:12px; font-weight:650; }
.bgs-sw-tx span{ font-size:10.5px; color:rgba(255,255,255,.55); font-family:ui-monospace,monospace; }
.bgs-looks{ display:flex; gap:7px; flex-wrap:wrap; }
.bgs-look{ appearance:none; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.05); cursor:pointer; border-radius:9px; padding:5px 7px 6px; display:flex; flex-direction:column; align-items:center; gap:5px; transition:transform .12s,border-color .15s; }
.bgs-look:hover{ transform:translateY(-2px); border-color:rgba(255,255,255,.4); }
.bgs-look.on{ border-color:#fff; }
.bgs-look-chip{ width:40px; height:16px; border-radius:5px; }
.bgs-look span{ font-size:10px; font-weight:600; color:rgba(255,255,255,.72); }
.bgs-actions{ display:flex; align-items:center; gap:9px; }
.bgs-dbtn{ appearance:none; font:inherit; font-size:12.5px; font-weight:650; cursor:pointer; border-radius:9px; padding:8px 16px; border:none; display:inline-flex; align-items:center; gap:6px; transition:background .18s,transform .12s; }
.bgs-dbtn:focus-visible{ outline:2px solid #fff; outline-offset:2px; }
.bgs-dbtn-save{ background:#fff; color:#141418; }
.bgs-dbtn-save:hover:not(:disabled){ transform:translateY(-1px); }
.bgs-dbtn-save:disabled{ opacity:.45; cursor:default; }
.bgs-dbtn-cancel{ background:rgba(255,255,255,.1); color:#fff; }
.bgs-dbtn-cancel:hover{ background:rgba(255,255,255,.18); }
.bgs-dbtn-reset{ background:none; color:rgba(255,255,255,.65); padding:8px 6px; }
.bgs-dbtn-reset:hover{ color:#fff; }
.bgs-divider{ width:1px; height:28px; background:rgba(255,255,255,.14); }
@media (max-width:620px){ .bgs-divider{ display:none; } }
`;
