"use client";

// /dev/overlay-align — backdrop alignment bench. Every drawer/modal in the app
// rolls its own scrim, so blur (2/3/4px/none), tint (black / warm-brown /
// blue-black) and z-index (50→2200, i.e. covers-nav-or-not) all drift. This
// page renders the real recipes over a mock app frame so Ellis can compare them
// live and pick ONE alignment. Read-only inventory — changes nothing in the app.

import { useState } from "react";

type Tint = { id: string; label: string; css: string; family: "neutral" | "warm" | "blue"; note?: string };

// The distinct tints actually found in the codebase.
const TINTS: Tint[] = [
  { id: "n35", label: "Neutral 35%", css: "rgba(0,0,0,0.35)", family: "neutral", note: "canonical Modal/Drawer, ChaseDrawer, ChainDrawer…" },
  { id: "n40", label: "Neutral 40%", css: "rgba(0,0,0,0.40)", family: "neutral", note: "WithdrawFileModal" },
  { id: "n55", label: "Neutral 55%", css: "rgba(0,0,0,0.55)", family: "neutral", note: "Welcome modals" },
  { id: "w34", label: "Warm 34%", css: "rgba(45,24,16,0.34)", family: "warm", note: "ComposeEmailModal" },
  { id: "w42", label: "Warm 42%", css: "rgba(45,24,16,0.42)", family: "warm", note: "SentEmailModal, LogUpdateModal" },
  { id: "w36", label: "Warm 42% (cooler)", css: "rgba(36,24,16,0.42)", family: "warm", note: "BringInSaleDrawer" },
  { id: "w20", label: "Warm 32%", css: "rgba(20,14,10,0.32)", family: "warm", note: "AccountShell mobile scrim" },
  { id: "bb55", label: "Blue-black 55%", css: "rgba(10,15,25,0.55)", family: "blue", note: "AddNode confirm" },
  { id: "none", label: "None", css: "transparent", family: "neutral", note: "DesignLabDrawer (no scrim)" },
];

const BLURS = [0, 2, 3, 4, 8, 12];

type Preset = { name: string; tint: string; blur: number; covers: boolean; close: "yes" | "no" | "cond"; used: string };

// The real-world recipes, verbatim from the audit.
const PRESETS: Preset[] = [
  { name: "Canonical — Modal / Drawer", tint: "n35", blur: 4, covers: true, close: "yes", used: "the ui/ primitives · ChaseDrawer · ChainDrawer · ResumeFile · IntroCall" },
  { name: "SentEmailModal (your screenshot)", tint: "w42", blur: 3, covers: false, close: "yes", used: "sent-email preview · z-index 80, below the nav" },
  { name: "ComposeEmailModal", tint: "w34", blur: 3, covers: true, close: "no", used: "compose email · NO click / NO Esc close" },
  { name: "LogUpdateModal", tint: "w42", blur: 3, covers: true, close: "yes", used: "log an update" },
  { name: "BringInSaleDrawer", tint: "w36", blur: 2, covers: false, close: "cond", used: "z-index 200 — ties the nav · ignores click while saving" },
  { name: "Welcome modals", tint: "n55", blur: 4, covers: true, close: "yes", used: "first-run welcome" },
  { name: "AddNode confirm", tint: "bb55", blur: 2, covers: true, close: "yes", used: "chain add-node nested confirm" },
  { name: "AccountShell (mobile nav)", tint: "w20", blur: 0, covers: false, close: "yes", used: "mobile nav scrim · NO blur" },
  { name: "DesignLabDrawer", tint: "none", blur: 0, covers: true, close: "no", used: "design tool — deliberately no scrim" },
];

const tintById = (id: string) => TINTS.find((t) => t.id === id) ?? TINTS[0];

export default function OverlayAlignPage() {
  const [dark, setDark] = useState(true);
  const [tintId, setTintId] = useState("n35");
  const [blur, setBlur] = useState(4);
  const [covers, setCovers] = useState(true);
  const [closeOnClick, setCloseOnClick] = useState(true);
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>("Canonical — Modal / Drawer");
  const [flash, setFlash] = useState(false);

  const tint = tintById(tintId);

  function applyPreset(p: Preset) {
    setTintId(p.tint);
    setBlur(p.blur);
    setCovers(p.covers);
    setCloseOnClick(p.close === "yes");
    setActivePreset(p.name);
    setOpen(true);
  }

  // Scaled z within the mock frame's own stacking context: content 1, nav 20,
  // so overlay 30 (above) covers the nav, 10 (below) leaves it uncovered.
  const overlayZ = covers ? 30 : 10;

  function handleBackdrop() {
    if (closeOnClick) setOpen(false);
    else { setFlash(true); setTimeout(() => setFlash(false), 650); }
  }

  return (
    <div className={`oa-root${dark ? " oa-dark" : ""}`}>
      <style>{OA_CSS}</style>

      <header className="oa-head">
        <div>
          <h1 className="oa-title">Overlay alignment bench</h1>
          <p className="oa-sub">Every drawer/modal scrim in the app, over a mock frame. Compare them, then pick one standard. Read-only — nothing here changes the app.</p>
        </div>
        <button className="oa-themebtn" onClick={() => setDark((d) => !d)}>
          {dark ? "☾ Dark frame" : "☀ Light frame"}
        </button>
      </header>

      <div className="oa-grid">
        {/* ── Live preview frame ─────────────────────────────── */}
        <section className="oa-previewwrap">
          <div className={`oa-frame${dark ? " oa-fdark" : ""}`}>
            {/* mock top bar */}
            <div className="oa-topbar" style={{ zIndex: 20 }}>
              <div className="oa-search">Search…</div>
              <div className="oa-avatar" />
            </div>
            {/* mock sidebar */}
            <nav className="oa-side" style={{ zIndex: 20 }}>
              <div className="oa-logo">Sales Progressor</div>
              {["Hub", "Focus", "Reminders", "Enquiries", "Completions", "Chains"].map((l, i) => (
                <div key={l} className={`oa-navitem${i === 0 ? " on" : ""}`}>{l}</div>
              ))}
            </nav>
            {/* mock content (gives the blur something to chew on) */}
            <main className="oa-content">
              <div className="oa-row">
                {["30 Chiltern Avenue", "19 Bodge Piece", "67a Blackberry Lane"].map((a) => (
                  <div key={a} className="oa-card">
                    <div className="oa-cardttl">{a}</div>
                    <div className="oa-line w70" /><div className="oa-line w90" /><div className="oa-line w50" />
                    <div className="oa-chip">Chasing</div>
                  </div>
                ))}
              </div>
              <div className="oa-paragraph">
                The quick brown fox jumps over the lazy dog. Sharp body text sits behind the scrim so the blur amount is legible — 2px barely softens the serifs, 4px smears them, 12px turns this into frosted glass. Watch the sidebar and the top bar when you switch covers-nav on and off.
              </div>
            </main>

            {/* the overlay under test, scoped to the frame */}
            {open && (
              <div
                className="oa-ovl"
                onClick={handleBackdrop}
                style={{
                  zIndex: overlayZ,
                  background: tint.css,
                  backdropFilter: blur ? `blur(${blur}px)` : "none",
                  WebkitBackdropFilter: blur ? `blur(${blur}px)` : "none",
                }}
              >
                <div className={`oa-dialog${flash ? " oa-shake" : ""}`} onClick={(e) => e.stopPropagation()}>
                  <div className="oa-dttl">Sample dialog</div>
                  <div className="oa-dbody">
                    This is the dialog on top of the scrim. Click the dimmed area to test close-on-backdrop.
                  </div>
                  <div className="oa-dfoot">
                    <button className="oa-btn ghost" onClick={() => setOpen(false)}>Close</button>
                    <button className="oa-btn primary" onClick={() => setOpen(false)}>Confirm</button>
                  </div>
                </div>
                {!closeOnClick && flash && <div className="oa-nope">Backdrop click does nothing — close-on-click is off</div>}
              </div>
            )}
          </div>

          {!open && (
            <button className="oa-open" onClick={() => setOpen(true)}>Open overlay in the frame</button>
          )}
          {open && (
            <div className="oa-recipe">
              <strong>{activePreset ?? "Custom"}</strong>
              <span>{tint.label} · blur {blur}px · {covers ? "covers nav" : "below nav"} · {closeOnClick ? "click-closes" : "no click-close"}</span>
            </div>
          )}
        </section>

        {/* ── Controls ──────────────────────────────────────── */}
        <section className="oa-controls">
          <div className="oa-block">
            <div className="oa-lbl">Load a real recipe</div>
            <div className="oa-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  className={`oa-preset${activePreset === p.name ? " on" : ""}`}
                  onClick={() => applyPreset(p)}
                  title={p.used}
                >
                  <span className="oa-pname">{p.name}</span>
                  <span className="oa-pmeta">
                    <i className="oa-sw" style={{ background: tintById(p.tint).css }} />
                    blur {p.blur} · {p.covers ? "covers" : "below"} nav · close {p.close === "yes" ? "✓" : p.close === "no" ? "✕" : "~"}
                  </span>
                  <span className="oa-pused">{p.used}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="oa-block">
            <div className="oa-lbl">Tint</div>
            <div className="oa-swatches">
              {TINTS.map((t) => (
                <button
                  key={t.id}
                  className={`oa-swbtn${tintId === t.id ? " on" : ""}`}
                  onClick={() => { setTintId(t.id); setActivePreset(null); if (!open) setOpen(true); }}
                  title={t.note}
                >
                  <i className={`oa-swdot fam-${t.family}`} style={{ background: t.css === "transparent" ? undefined : t.css }} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="oa-block">
            <div className="oa-lbl">Blur</div>
            <div className="oa-segs">
              {BLURS.map((b) => (
                <button key={b} className={`oa-seg${blur === b ? " on" : ""}`} onClick={() => { setBlur(b); setActivePreset(null); if (!open) setOpen(true); }}>
                  {b === 0 ? "none" : `${b}px`}
                </button>
              ))}
            </div>
          </div>

          <div className="oa-block oa-row2">
            <div>
              <div className="oa-lbl">Covers the nav?</div>
              <div className="oa-segs">
                <button className={`oa-seg${!covers ? " on" : ""}`} onClick={() => { setCovers(false); setActivePreset(null); }}>Below nav</button>
                <button className={`oa-seg${covers ? " on" : ""}`} onClick={() => { setCovers(true); setActivePreset(null); }}>Covers nav</button>
              </div>
            </div>
            <div>
              <div className="oa-lbl">Click backdrop to close?</div>
              <div className="oa-segs">
                <button className={`oa-seg${!closeOnClick ? " on" : ""}`} onClick={() => { setCloseOnClick(false); setActivePreset(null); }}>No</button>
                <button className={`oa-seg${closeOnClick ? " on" : ""}`} onClick={() => { setCloseOnClick(true); setActivePreset(null); }}>Yes</button>
              </div>
            </div>
          </div>

          <div className="oa-proposed">
            <div className="oa-lbl">Proposed standard — this is what every overlay would align to</div>
            <div className="oa-reciperow">
              <i className="oa-sw big" style={{ background: tint.css === "transparent" ? "repeating-conic-gradient(#8883 0% 25%, transparent 0% 50%) 50% / 12px 12px" : tint.css }} />
              <code>background: {tint.css}; backdrop-filter: blur({blur}px);</code>
            </div>
            <div className="oa-recipetags">
              <span>{covers ? "z-index above nav (dims sidebar + top bar)" : "z-index below nav (sidebar + top bar stay sharp)"}</span>
              <span>{closeOnClick ? "closes on backdrop click + Esc" : "no backdrop-click close"}</span>
            </div>
            <p className="oa-note">Tell me the pick (tint · blur · nav policy · close) and I&apos;ll align the primitives + migrate the bespoke scrims to it.</p>
          </div>
        </section>
      </div>

      {/* ── Blur ladder (same tint, every blur) ─────────────── */}
      <section className="oa-ladder">
        <div className="oa-lbl">Blur ladder — same {tint.label} tint, every blur, over text</div>
        <div className="oa-ladderrow">
          {BLURS.map((b) => (
            <div key={b} className="oa-lcell">
              <div className="oa-ltext">30 Chiltern Avenue · Chasing · HP22 3BR</div>
              <div className="oa-lscrim" style={{ background: tint.css, backdropFilter: b ? `blur(${b}px)` : "none", WebkitBackdropFilter: b ? `blur(${b}px)` : "none" }}>
                <span>{b === 0 ? "none" : `${b}px`}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const OA_CSS = `
.oa-root{--bg:#f3f0ea;--panel:#fff;--ink:#1b1712;--mut:#6c6459;--line:rgba(20,16,10,.12);--coral:#f0562c;
  min-height:100vh;background:var(--bg);color:var(--ink);padding:28px 32px 60px;
  font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
.oa-root.oa-dark{--bg:#0d1017;--panel:#161b26;--ink:#eef1f6;--mut:#9aa3b2;--line:rgba(255,255,255,.1);}
.oa-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px;}
.oa-title{font-size:22px;font-weight:700;margin:0 0 4px;}
.oa-sub{font-size:13px;color:var(--mut);margin:0;max-width:640px;line-height:1.5;}
.oa-themebtn{flex-shrink:0;padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-size:13px;font-weight:600;cursor:pointer;}
.oa-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(320px,1fr);gap:24px;align-items:start;}
@media(max-width:980px){.oa-grid{grid-template-columns:1fr;}}

/* preview frame */
.oa-previewwrap{display:flex;flex-direction:column;gap:12px;}
.oa-frame{position:relative;height:460px;border-radius:16px;overflow:hidden;border:1px solid var(--line);
  background:#f3f0ea;color:#1b1712;box-shadow:0 12px 40px rgba(0,0,0,.14);isolation:isolate;}
.oa-frame.oa-fdark{background:#0d1017;color:#eef1f6;}
.oa-topbar{position:absolute;top:0;left:180px;right:0;height:50px;display:flex;align-items:center;justify-content:space-between;
  padding:0 16px;background:rgba(255,255,255,.72);backdrop-filter:blur(10px);border-bottom:1px solid rgba(20,16,10,.1);}
.oa-fdark .oa-topbar{background:rgba(22,27,38,.72);border-bottom:1px solid rgba(255,255,255,.08);}
.oa-search{font-size:12px;color:#8a8275;background:rgba(0,0,0,.05);padding:7px 12px;border-radius:8px;width:220px;}
.oa-fdark .oa-search{background:rgba(255,255,255,.06);color:#9aa3b2;}
.oa-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f0562c,#ffb199);}
.oa-side{position:absolute;top:0;left:0;bottom:0;width:180px;padding:14px 12px;background:rgba(255,255,255,.66);backdrop-filter:blur(10px);border-right:1px solid rgba(20,16,10,.1);}
.oa-fdark .oa-side{background:rgba(18,23,33,.7);border-right:1px solid rgba(255,255,255,.07);}
.oa-logo{font-size:13px;font-weight:700;margin-bottom:14px;}
.oa-navitem{font-size:12.5px;color:#6c6459;padding:8px 10px;border-radius:8px;margin-bottom:2px;}
.oa-fdark .oa-navitem{color:#9aa3b2;}
.oa-navitem.on{background:var(--coral);color:#fff;font-weight:600;}
.oa-content{position:absolute;top:50px;left:180px;right:0;bottom:0;padding:16px;overflow:hidden;}
.oa-row{display:flex;gap:12px;margin-bottom:14px;}
.oa-card{flex:1;background:rgba(255,255,255,.9);border:1px solid rgba(20,16,10,.1);border-radius:12px;padding:12px;}
.oa-fdark .oa-card{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08);}
.oa-cardttl{font-size:12.5px;font-weight:700;margin-bottom:8px;}
.oa-line{height:7px;border-radius:4px;background:rgba(20,16,10,.1);margin-bottom:6px;}
.oa-fdark .oa-line{background:rgba(255,255,255,.1);}
.oa-line.w70{width:70%}.oa-line.w90{width:90%}.oa-line.w50{width:50%}
.oa-chip{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;color:var(--coral);background:rgba(240,86,44,.12);padding:3px 8px;border-radius:6px;}
.oa-paragraph{font-size:12.5px;line-height:1.55;color:#4a443b;max-width:560px;}
.oa-fdark .oa-paragraph{color:#aeb6c2;}

/* overlay under test */
.oa-ovl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;animation:oafade .2s ease both;}
@keyframes oafade{from{opacity:0}to{opacity:1}}
.oa-dialog{width:300px;background:#fffdf9;border-top:2px solid var(--coral);border-radius:14px;padding:18px;
  box-shadow:0 24px 60px rgba(0,0,0,.3);}
.oa-fdark .oa-dialog{background:#1b2130;color:#eef1f6;}
.oa-dttl{font-size:15px;font-weight:700;margin-bottom:6px;}
.oa-dbody{font-size:12.5px;color:var(--mut);line-height:1.5;margin-bottom:16px;}
.oa-dfoot{display:flex;justify-content:flex-end;gap:8px;}
.oa-btn{padding:7px 14px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid transparent;}
.oa-btn.ghost{background:transparent;border-color:var(--line);color:var(--ink);}
.oa-btn.primary{background:var(--coral);color:#fff;}
.oa-shake{animation:oashake .4s ease;}
@keyframes oashake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.oa-nope{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);background:#1b1712;color:#fff;font-size:11.5px;padding:7px 12px;border-radius:8px;white-space:nowrap;}
.oa-open{align-self:flex-start;padding:9px 16px;border-radius:10px;border:none;background:var(--coral);color:#fff;font-size:13px;font-weight:600;cursor:pointer;}
.oa-recipe{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--mut);}
.oa-recipe strong{color:var(--ink);font-size:13px;}

/* controls */
.oa-controls{display:flex;flex-direction:column;gap:18px;}
.oa-block{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;}
.oa-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);margin-bottom:10px;}
.oa-presets{display:flex;flex-direction:column;gap:6px;}
.oa-preset{text-align:left;background:transparent;border:1px solid var(--line);border-radius:10px;padding:9px 11px;cursor:pointer;display:flex;flex-direction:column;gap:3px;color:var(--ink);}
.oa-preset.on{border-color:var(--coral);background:rgba(240,86,44,.07);}
.oa-pname{font-size:12.5px;font-weight:600;}
.oa-pmeta{font-size:11px;color:var(--mut);display:flex;align-items:center;gap:6px;}
.oa-pused{font-size:10.5px;color:var(--mut);opacity:.8;}
.oa-sw{width:12px;height:12px;border-radius:3px;border:1px solid var(--line);display:inline-block;}
.oa-sw.big{width:22px;height:22px;border-radius:6px;flex-shrink:0;}
.oa-swatches{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.oa-swbtn{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:9px;border:1px solid var(--line);background:transparent;color:var(--ink);font-size:11.5px;cursor:pointer;}
.oa-swbtn.on{border-color:var(--coral);background:rgba(240,86,44,.07);}
.oa-swdot{width:16px;height:16px;border-radius:5px;border:1px solid var(--line);flex-shrink:0;}
.oa-swdot.fam-warm{box-shadow:inset 0 0 0 10px transparent;}
.oa-segs{display:flex;gap:6px;flex-wrap:wrap;}
.oa-seg{padding:7px 12px;border-radius:9px;border:1px solid var(--line);background:transparent;color:var(--ink);font-size:12px;font-weight:600;cursor:pointer;}
.oa-seg.on{border-color:var(--coral);background:var(--coral);color:#fff;}
.oa-row2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.oa-proposed{background:var(--panel);border:1px dashed var(--coral);border-radius:14px;padding:14px;}
.oa-reciperow{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.oa-reciperow code{font-size:11.5px;background:rgba(0,0,0,.05);padding:6px 9px;border-radius:7px;overflow-x:auto;}
.oa-fdark .oa-reciperow code{background:rgba(255,255,255,.06);}
.oa-recipetags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}
.oa-recipetags span{font-size:11px;color:var(--mut);background:rgba(0,0,0,.04);padding:4px 9px;border-radius:7px;}
.oa-fdark .oa-recipetags span{background:rgba(255,255,255,.05);}
.oa-note{font-size:11.5px;color:var(--mut);line-height:1.5;margin:0;}

/* blur ladder */
.oa-ladder{margin-top:26px;}
.oa-ladderrow{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;}
@media(max-width:780px){.oa-ladderrow{grid-template-columns:repeat(3,1fr);}}
.oa-lcell{position:relative;height:84px;border-radius:11px;overflow:hidden;border:1px solid var(--line);background:linear-gradient(135deg,#f0562c22,#4a90d222);isolation:isolate;}
.oa-ltext{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:8px;font-size:12px;font-weight:700;text-align:center;color:var(--ink);}
.oa-lscrim{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:7px;}
.oa-lscrim span{font-size:11px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6);}
`;
