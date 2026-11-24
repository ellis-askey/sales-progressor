// Scoped styles for the portal preview. The nav glass, the phone frame, the
// ambient and the dev chrome. Everything under .ppv-root. The frosted recipe is
// the phone-accurate fallback (what iOS/Safari/Firefox actually render).

export const PPV_CSS = `
.ppv-root{ --ppv-ink:#1A1D29; --ppv-mut:#8B91A3; --ppv-accent:#FF6B4A; --ppv-cardbg:#ffffff;
  min-height:100vh; background:#eceae6; color:#1b1a18; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",sans-serif; -webkit-font-smoothing:antialiased; }
.ppv-root[data-theme="dark"]{ --ppv-ink:#e8ebf0; --ppv-mut:#9aa0ab; --ppv-cardbg:#1a2029; background:#0c0e12; color:#edeef2; }

.ppv-wrap{ max-width:1280px; margin:0 auto; padding:30px 24px 70px; display:flex; flex-direction:column; align-items:center; gap:20px; }
.ppv-stage{ display:flex; gap:36px; align-items:flex-start; justify-content:center; flex-wrap:wrap; width:100%; }
.ppv-col{ display:flex; flex-direction:column; align-items:center; gap:16px; width:420px; max-width:100%; }
.ppv-col-title{ margin:0; font-size:12px; font-weight:750; letter-spacing:0.06em; text-transform:uppercase; color:var(--ppv-mut); display:flex; align-items:center; gap:9px; }
.ppv-col-title span{ font-size:10.5px; font-weight:600; letter-spacing:0; text-transform:none; opacity:0.8; padding:2px 9px; border-radius:999px; background:rgba(125,125,135,0.15); }
.ppv-header{ text-align:center; max-width:640px; }
.ppv-h1{ margin:0; font-size:22px; font-weight:680; letter-spacing:-0.02em; }
.ppv-sub{ margin:7px 0 0; font-size:13.5px; line-height:1.55; color:#6c6760; }
.ppv-root[data-theme="dark"] .ppv-sub{ color:#9aa0ab; }

.ppv-controls{ display:flex; flex-wrap:wrap; gap:22px; align-items:center; justify-content:center; padding:13px 20px; border-radius:14px;
  background:var(--ppv-cardbg); border:1px solid rgba(20,16,10,0.08); }
.ppv-root[data-theme="dark"] .ppv-controls{ border-color:rgba(255,255,255,0.08); }
.ppv-ctl{ display:inline-flex; align-items:center; gap:10px; font-size:12.5px; }
.ppv-ctl-lbl{ font-size:10.5px; font-weight:750; letter-spacing:0.07em; text-transform:uppercase; color:var(--ppv-mut); }
.ppv-switch{ display:inline-flex; background:rgba(125,125,135,0.14); border-radius:10px; padding:3px; }
.ppv-switch button{ border:none; background:none; font:inherit; font-size:13px; font-weight:600; color:var(--ppv-mut); padding:6px 14px; border-radius:8px; cursor:pointer; }
.ppv-switch button[data-on]{ background:var(--ppv-cardbg); color:var(--ppv-ink); box-shadow:0 1px 4px rgba(0,0,0,0.14); }
.ppv-check{ display:inline-flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; color:var(--ppv-ink); font-weight:550; }
.ppv-check input{ accent-color:var(--ppv-accent); width:15px; height:15px; }

/* ── Phone frame ───────────────────────────────────────────────────────────── */
.ppv-phone{ position:relative; width:402px; height:840px; border-radius:50px; overflow:hidden; background:#000;
  border:10px solid #0a0a0c; box-shadow:0 2px 0 2px rgba(0,0,0,0.55), 0 42px 90px rgba(10,12,22,0.45); }
.ppv-notch{ position:absolute; top:11px; left:50%; transform:translateX(-50%); width:120px; height:30px; background:#0a0a0c; border-radius:16px; z-index:40; }
.ppv-ambient{ position:absolute; inset:0; z-index:0;
  background-color:#f6f8fc;
  background-image:
   radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.16), transparent 70%),
   radial-gradient(75% 55% at 8% 6%, rgba(255,188,168,0.28), transparent 72%),
   radial-gradient(70% 50% at 92% 12%, rgba(196,180,255,0.26), transparent 72%),
   radial-gradient(85% 60% at 50% 96%, rgba(255,208,176,0.30), transparent 75%); }
.ppv-root[data-theme="dark"] .ppv-ambient{ background-color:#0b0f14;
  background-image:
   radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.10), transparent 70%),
   radial-gradient(75% 55% at 8% 6%, rgba(120,80,70,0.30), transparent 72%),
   radial-gradient(70% 50% at 92% 12%, rgba(90,80,140,0.28), transparent 72%),
   radial-gradient(85% 60% at 50% 96%, rgba(120,90,70,0.30), transparent 75%); }
.ppv-screen-scroll{ position:absolute; inset:0; z-index:1; overflow-y:auto; overflow-x:hidden; background:transparent; -webkit-overflow-scrolling:touch; }
.ppv-screen-scroll::-webkit-scrollbar{ display:none; }
.ppv-screen{ padding:92px 16px 134px; }
.ppv-screen--hero{ padding:20px 16px 134px; }

/* ── Nav glass material ───────────────────────────────────────────────────── */
.ppv-glass{ position:relative; }
.ppv-glass > *{ position:relative; z-index:1; }
.ppv-frost{ overflow:hidden;
  background:var(--ppv-tint, rgba(255,247,243,0.72));
  -webkit-backdrop-filter:blur(var(--ppv-blur,24px)) saturate(var(--ppv-sat,190%)); backdrop-filter:blur(var(--ppv-blur,24px)) saturate(var(--ppv-sat,190%));
  border:1px solid var(--ppv-edge, rgba(255,255,255,0.66));
  box-shadow:var(--ppv-shadow, 0 10px 30px rgba(255,138,101,0.14)), inset 0 1px 0 var(--ppv-edge-hi, rgba(255,255,255,0.75)); }
.ppv-grain{ position:absolute; inset:0; z-index:0; border-radius:inherit; pointer-events:none; opacity:var(--ppv-grain,0.42); mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
  background-size:120px 120px; }
.ppv-root[data-theme="dark"] .ppv-grain{ mix-blend-mode:soft-light; }

/* Real-refraction base (LiquidGlass adds .lgx-surface). Shares the tunable edge + shadow. */
.ppv-root .lgx-surface{ position:relative; border:1px solid var(--ppv-edge, rgba(255,255,255,0.6));
  box-shadow:var(--ppv-shadow, 0 10px 30px rgba(255,138,101,0.14));
  -webkit-backdrop-filter:blur(2px) saturate(var(--ppv-sat,185%)); backdrop-filter:blur(2px) saturate(var(--ppv-sat,185%)); }
.ppv-root .lgx-surface::before{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.65),transparent) top/100% 1px no-repeat; opacity:.75; }
.ppv-root .lgx-filter-svg{ position:absolute; width:0; height:0; overflow:hidden; pointer-events:none; }

/* ── Nav layers ───────────────────────────────────────────────────────────── */
.ppv-top-layer{ position:absolute; top:0; left:0; right:0; z-index:20; padding-top:50px; pointer-events:none; }
.ppv-top-layer button{ pointer-events:auto; }
.ppv-bottom-layer{ position:absolute; bottom:0; left:0; right:0; z-index:20; display:flex; justify-content:center; padding-bottom:22px; pointer-events:none; }
.ppv-bottom-layer button{ pointer-events:auto; }

/* ── Top: expandable corner ──────────────────────────────────────────────── */
.ppv-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:0 14px; color:var(--ppv-ink); }
.ppv-greet{ display:inline-flex; align-items:center; padding:10px 17px; font-size:14px; font-weight:620; color:var(--ppv-ink); }
.ppv-corner{ position:relative; display:flex; flex-direction:column; align-items:flex-end; }
.ppv-menu{ width:40px; height:40px; display:inline-flex; align-items:center; justify-content:center; }
.ppv-menu-btn{ width:100%; height:100%; border:none; background:none; color:var(--ppv-ink); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
/* Menu options: each its own glass pill, matching the greeting container. */
.ppv-fan{ position:absolute; top:50px; right:0; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
.ppv-fan-item{ display:inline-flex; }
.ppv-fan-pill{ display:inline-flex; }
.ppv-fan-pill-btn{ display:inline-flex; align-items:center; padding:10px 17px; border:none; background:none; color:var(--ppv-ink); font:inherit; font-size:14px; font-weight:620; white-space:nowrap; border-radius:999px; cursor:pointer; transition:color .15s ease; }
.ppv-fan-pill-btn:hover{ color:var(--ppv-accent); }

/* ── Bottom: magnify dock + selected label ───────────────────────────────── */
.ppv-dock{ display:inline-flex; align-items:center; gap:4px; padding:7px; }
.ppv-mt{ position:relative; display:inline-flex; align-items:center; gap:7px; height:46px; padding:0 13px; border:none; background:none; cursor:pointer; color:var(--ppv-mut); border-radius:16px;
  transition:background .25s ease, box-shadow .25s ease, transform .3s cubic-bezier(.3,1.1,.4,1); }
.ppv-mt[data-on]{ color:var(--ppv-accent); }
.ppv-mt-ico{ position:relative; display:inline-flex; transition:transform .3s cubic-bezier(.3,1.1,.4,1), filter .25s ease; }
.ppv-mt[data-on] .ppv-mt-ico{ transform:scale(1.08); }
.ppv-mt-lbl{ font-size:13.5px; font-weight:650; max-width:0; opacity:0; overflow:hidden; white-space:nowrap;
  transition:max-width .32s cubic-bezier(.2,.8,.2,1), opacity .24s ease; }
.ppv-mt-lbl[data-on]{ max-width:96px; opacity:1; }

/* ── "You're here" indicators (selectable) ───────────────────────────────── */
.ppv-act-underline .ppv-mt[data-on]::after{ content:""; position:absolute; left:50%; bottom:3px; transform:translateX(-50%); width:20px; height:3px; border-radius:999px; background:var(--ppv-accent); }
.ppv-act-dot .ppv-mt[data-on]::after{ content:""; position:absolute; left:50%; bottom:3px; transform:translateX(-50%); width:5px; height:5px; border-radius:999px; background:var(--ppv-accent); }
.ppv-act-topbar .ppv-mt[data-on]::before{ content:""; position:absolute; left:50%; top:1px; transform:translateX(-50%); width:22px; height:3px; border-radius:999px; background:var(--ppv-accent); }
.ppv-act-lift .ppv-mt[data-on] .ppv-mt-ico{ transform:translateY(-3px) scale(1.15); filter:drop-shadow(0 5px 9px color-mix(in srgb, var(--ppv-accent) 45%, transparent)); }
.ppv-act-glass .ppv-mt[data-on]{ background:rgba(255,255,255,0.55); box-shadow:inset 0 1px 0 rgba(255,255,255,0.85), 0 3px 10px rgba(15,23,42,0.1); }
.ppv-root[data-theme="dark"] .ppv-act-glass .ppv-mt[data-on]{ background:rgba(255,255,255,0.12); box-shadow:inset 0 1px 0 rgba(255,255,255,0.14), 0 3px 10px rgba(0,0,0,0.32); }
.ppv-act-outline .ppv-mt[data-on]{ box-shadow:inset 0 0 0 1.5px var(--ppv-accent); }
.ppv-act-solid .ppv-mt[data-on]{ background:var(--ppv-accent); color:#fff; box-shadow:0 5px 15px color-mix(in srgb, var(--ppv-accent) 45%, transparent); }

/* ── Indicator picker chips ──────────────────────────────────────────────── */
.ppv-ctl--wrap{ flex-wrap:wrap; }
.ppv-chips{ display:flex; flex-wrap:wrap; gap:6px; }
.ppv-chip{ border:1px solid rgba(20,16,10,0.12); background:transparent; color:var(--ppv-mut); font:inherit; font-size:12px; font-weight:600; padding:5px 11px; border-radius:999px; cursor:pointer; transition:.15s; }
.ppv-root[data-theme="dark"] .ppv-chip{ border-color:rgba(255,255,255,0.12); }
.ppv-chip:hover{ color:var(--ppv-ink); }
.ppv-chip[data-on]{ background:var(--ppv-ink); color:var(--ppv-cardbg); border-color:var(--ppv-ink); }
.ppv-badge{ position:absolute; top:-5px; right:-9px; min-width:16px; height:16px; padding:0 4px; border-radius:9px; background:var(--ppv-accent); color:#fff;
  font-size:10px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; border:2px solid var(--ppv-cardbg); }

/* Glass tuning sliders */
.ppv-sliders{ display:grid; grid-template-columns:repeat(2,1fr); gap:11px 18px; width:100%;
  padding:14px 18px; border-radius:14px; background:var(--ppv-cardbg); border:1px solid rgba(20,16,10,0.08); }
.ppv-root[data-theme="dark"] .ppv-sliders{ border-color:rgba(255,255,255,0.08); }
.ppv-sliders-head{ grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; }
.ppv-reset{ border:1px solid rgba(20,16,10,0.12); background:transparent; color:var(--ppv-mut); font:inherit; font-size:12px; font-weight:600; padding:5px 12px; border-radius:999px; cursor:pointer; }
.ppv-root[data-theme="dark"] .ppv-reset{ border-color:rgba(255,255,255,0.12); }
.ppv-slider{ display:flex; flex-direction:column; gap:5px; }
.ppv-slider-top{ display:flex; justify-content:space-between; font-size:11.5px; font-weight:600; color:var(--ppv-mut); }
.ppv-slider-val{ color:var(--ppv-ink); font-variant-numeric:tabular-nums; }
.ppv-slider input{ width:100%; accent-color:var(--ppv-accent); }

@media (prefers-reduced-motion: reduce){
  .ppv-mt-lbl, .ppv-mt-ico{ transition:none; }
}
`;
