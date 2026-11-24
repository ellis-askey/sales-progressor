// Scoped stylesheet for the portal-nav lab. Everything is under .pnl-root so it
// touches nothing global. Light + dark are peers. The glass material reads from
// CSS vars set on .pnl-root from the live Settings.

export const LAB_CSS = `
.pnl-root{ --pg:#efece6; --panel:#ffffff; --ink:#1b1a18; --muted:#6c6760; --line:rgba(20,16,10,0.1); --accent:var(--pnl-accent,#FF6B4A);
  min-height:100vh; background:
    radial-gradient(900px 500px at 15% -5%, rgba(255,120,90,0.05), transparent 60%),
    radial-gradient(800px 460px at 100% 0%, rgba(90,110,255,0.05), transparent 55%),
    var(--pg);
  color:var(--ink); font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; -webkit-font-smoothing:antialiased; }
.pnl-root[data-theme="dark"]{ --pg:#0c0e12; --panel:#15181e; --ink:#edeef2; --muted:#9aa0ab; --line:rgba(255,255,255,0.09); }

.pnl-wrap{ max-width:1320px; margin:0 auto; padding:30px 26px 90px; }
.pnl-header{ display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:20px; }
.pnl-h1{ margin:0; font-size:23px; font-weight:680; letter-spacing:-0.02em; }
.pnl-h1-sub{ margin:6px 0 0; font-size:13.5px; color:var(--muted); max-width:720px; line-height:1.55; }
.pnl-support{ display:inline-block; margin-left:4px; font-weight:600; color:#b4792a; }
.pnl-support[data-ok]{ color:#2fa36b; }
.pnl-header-right{ display:flex; flex-direction:column; align-items:flex-end; gap:8px; flex-shrink:0; }
.pnl-combo-badge{ font-size:13px; font-weight:650; padding:5px 12px; border-radius:999px; background:var(--panel); border:1px solid var(--line); white-space:nowrap; }
.pnl-favtoggle{ display:inline-flex; align-items:center; gap:7px; font-size:12.5px; color:var(--muted); cursor:pointer; }
.pnl-favtoggle input{ accent-color:var(--accent); }

/* ── Controls ─────────────────────────────────────────────────────────────── */
.pnl-controls{ background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:16px 18px; margin-bottom:22px; display:flex; flex-direction:column; gap:15px; }
.pnl-ctl-row{ display:flex; flex-wrap:wrap; gap:26px; align-items:center; }
.pnl-ctl{ display:flex; align-items:center; gap:11px; }
.pnl-ctl-block{ display:flex; flex-direction:column; gap:9px; }
.pnl-ctl-lbl{ font-size:10.5px; font-weight:750; letter-spacing:0.07em; text-transform:uppercase; color:var(--muted); }
.pnl-switch{ display:inline-flex; background:rgba(125,125,135,0.13); border-radius:10px; padding:3px; }
.pnl-switch button{ border:none; background:none; font:inherit; font-size:13px; font-weight:600; color:var(--muted); padding:6px 15px; border-radius:8px; cursor:pointer; transition:.16s; }
.pnl-switch button[data-on]{ background:var(--panel); color:var(--ink); box-shadow:0 1px 4px rgba(0,0,0,0.14); }
.pnl-swatches{ display:inline-flex; gap:8px; }
.pnl-swatch{ width:24px; height:24px; border-radius:50%; border:2px solid transparent; cursor:pointer; transition:.16s; box-shadow:0 1px 4px rgba(0,0,0,0.14); }
.pnl-swatch[data-on]{ box-shadow:0 0 0 2px var(--pg),0 0 0 4px var(--ink); }
.pnl-check{ display:inline-flex; align-items:center; gap:8px; font-size:13px; color:var(--ink); cursor:pointer; }
.pnl-check input{ accent-color:var(--accent); width:15px; height:15px; }
.pnl-chips{ display:flex; flex-wrap:wrap; gap:7px; }
.pnl-chip{ border:1px solid var(--line); background:transparent; color:var(--muted); font:inherit; font-size:12.5px; font-weight:600; padding:6px 13px; border-radius:999px; cursor:pointer; transition:.16s; }
.pnl-chip:hover{ color:var(--ink); }
.pnl-chip[data-on]{ background:var(--ink); color:var(--pg); border-color:var(--ink); }
.pnl-sliders{ display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:14px 22px; }
.pnl-slider{ display:flex; flex-direction:column; gap:6px; }
.pnl-slider-top{ display:flex; justify-content:space-between; font-size:12px; font-weight:600; color:var(--muted); }
.pnl-slider-val{ color:var(--ink); font-variant-numeric:tabular-nums; }
.pnl-slider input{ width:100%; accent-color:var(--accent); }

/* ── Layout ───────────────────────────────────────────────────────────────── */
.pnl-main{ display:grid; grid-template-columns:auto 1fr; gap:36px; align-items:start; }
@media (max-width:1040px){ .pnl-main{ grid-template-columns:1fr; } }
.pnl-phone-col{ position:sticky; top:22px; justify-self:center; }
.pnl-right{ display:flex; flex-direction:column; gap:28px; min-width:0; }

/* ── Phone ────────────────────────────────────────────────────────────────── */
.pnl-phone{ position:relative; width:392px; height:812px; border-radius:48px; overflow:hidden; background:#000;
  border:10px solid #090a0c; box-shadow:0 2px 0 2px rgba(0,0,0,0.55), 0 40px 90px rgba(10,12,22,0.45); }
.pnl-notch{ position:absolute; top:11px; left:50%; transform:translateX(-50%); width:118px; height:30px; background:#090a0c; border-radius:16px; z-index:30; }
.pnl-screen{ position:absolute; inset:0; overflow-y:auto; overflow-x:hidden; background:var(--pg); -webkit-overflow-scrolling:touch; }
.pnl-screen::-webkit-scrollbar{ display:none; }

.pnl-hero{ position:relative; height:376px; }
.pnl-hero--mini{ height:150px; }
.pnl-hero-art{ position:absolute; inset:0; }
.pnl-hero-copy{ position:absolute; left:22px; right:22px; bottom:26px; color:#fff; z-index:1; }
.pnl-hero-sub{ margin:0 0 4px; font-size:12px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; opacity:0.85; }
.pnl-hero-addr{ margin:0; font-size:28px; font-weight:690; letter-spacing:-0.02em; text-shadow:0 2px 24px rgba(0,0,0,0.32); }
.pnl-hero-town{ margin:3px 0 0; font-size:14px; opacity:0.92; }

/* Backgrounds to test glass against */
.pnl-phone[data-bg="photo"] .pnl-hero-art,
.pnl-phone[data-bg="content"] .pnl-hero-art{ background:linear-gradient(180deg,rgba(10,12,24,0) 40%,rgba(8,10,20,0.72) 100%),linear-gradient(135deg,#f0a86a 0%,#c9718f 46%,#4a4e92 100%); }
.pnl-phone[data-bg="gradient"] .pnl-hero-art{ background:linear-gradient(180deg,rgba(10,12,24,0) 45%,rgba(8,10,20,0.6) 100%),linear-gradient(135deg,var(--accent),#7c5cff 120%); }
.pnl-phone[data-bg="illustration"] .pnl-hero-art{ background:
  radial-gradient(120px 120px at 78% 30%,#ffd98a,transparent 70%),
  linear-gradient(180deg,#9fd0e8 0%,#bfe0d0 60%,#e8d9b8 100%); }
.pnl-phone[data-bg="busy"] .pnl-hero-art{ background:
  repeating-linear-gradient(45deg,#111 0 14px,#f4f4f4 14px 28px),
  repeating-linear-gradient(-45deg,rgba(255,80,80,0.5) 0 20px,rgba(60,120,255,0.5) 20px 40px); background-blend-mode:overlay; }
.pnl-phone[data-bg="dark"] .pnl-screen{ background:#0a0b0f; }
.pnl-phone[data-bg="dark"] .pnl-hero-art{ background:linear-gradient(135deg,#1a1d2b,#0c0d14); }
.pnl-phone[data-bg="cards"] .pnl-hero{ height:120px; }
.pnl-phone[data-bg="cards"] .pnl-hero-art{ background:var(--pg); }
.pnl-phone[data-bg="cards"] .pnl-hero-copy{ color:var(--ink); bottom:18px; }
.pnl-phone[data-bg="cards"] .pnl-hero-addr{ text-shadow:none; }
.pnl-phone[data-bg="content"] .pnl-hero{ height:150px; }

.pnl-body{ padding:16px 15px 0; display:flex; flex-direction:column; gap:12px; }
.pnl-c{ background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:15px 16px; }
.pnl-c--ghost{ background:transparent; border-style:dashed; text-align:center; }
.pnl-c-head{ display:flex; justify-content:space-between; align-items:center; font-size:14px; font-weight:650; margin-bottom:10px; }
.pnl-c-pct{ color:var(--accent); font-weight:700; }
.pnl-c-prog{ height:7px; border-radius:99px; background:rgba(125,125,135,0.2); overflow:hidden; }
.pnl-c-prog span{ display:block; height:100%; border-radius:99px; background:var(--accent); }
.pnl-c-kick{ margin:0 0 5px; font-size:10.5px; font-weight:750; letter-spacing:0.06em; text-transform:uppercase; color:var(--muted); }
.pnl-c-title{ margin:0 0 5px; font-size:16px; font-weight:650; letter-spacing:-0.01em; }
.pnl-c-note{ margin:8px 0 0; font-size:13px; line-height:1.5; color:var(--muted); }
.pnl-c-meta{ margin:9px 0 0; font-size:11.5px; color:var(--muted); opacity:0.85; }

/* ── Nav layers ───────────────────────────────────────────────────────────── */
.pnl-top-layer{ position:absolute; top:0; left:0; right:0; z-index:20; padding-top:46px; pointer-events:none; }
.pnl-top-layer button, .pnl-top-layer [role="button"]{ pointer-events:auto; }
.pnl-bottom-layer{ position:absolute; bottom:0; left:0; right:0; z-index:20; padding-bottom:var(--pnl-gap,20px); display:flex; justify-content:center;
  transition:transform .42s cubic-bezier(.3,.9,.3,1), opacity .3s ease; }
.pnl-scaler{ transform-origin:center; }
.pnl-top-layer .pnl-scaler{ transform-origin:top center; }
.pnl-bottom-layer .pnl-scaler{ transform-origin:bottom center; }

/* ── Glass material ───────────────────────────────────────────────────────── */
.pnl-surface{ position:relative; }
.pnl-surface > *{ position:relative; z-index:1; }
.pnl-frost{ -webkit-backdrop-filter:blur(var(--pnl-blur,18px)) saturate(185%); backdrop-filter:blur(var(--pnl-blur,18px)) saturate(185%);
  border:1px solid var(--pnl-edge-color,rgba(255,255,255,0.5)); box-shadow:var(--pnl-shadow), inset 0 1px 0 var(--pnl-edge-hi,rgba(255,255,255,0.4)); }
/* Base for the real refraction engine (LiquidGlass adds .lgx-surface). */
.pnl-root .lgx-surface{ position:relative; border:1px solid var(--pnl-edge-color,rgba(255,255,255,0.5));
  -webkit-backdrop-filter:blur(var(--pnl-blur,18px)) saturate(185%); backdrop-filter:blur(var(--pnl-blur,18px)) saturate(185%);
  box-shadow:var(--pnl-shadow); transition:transform .4s cubic-bezier(.2,.8,.2,1), box-shadow .4s ease; }
.pnl-root .lgx-surface::before{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  background:linear-gradient(90deg,transparent,var(--pnl-edge-hi,rgba(255,255,255,0.5)),transparent) top/100% 1px no-repeat; opacity:.7; }
.pnl-root .lgx-filter-svg{ position:absolute; width:0; height:0; overflow:hidden; pointer-events:none; }

.pnl-method{ position:absolute; top:-7px; right:6px; z-index:3; font-size:8.5px; font-weight:700; letter-spacing:0.03em; text-transform:uppercase;
  padding:2px 6px; border-radius:999px; background:rgba(20,16,10,0.55); color:#fff; pointer-events:none; }
.pnl-method[data-real]{ background:rgba(47,163,107,0.85); }
.pnl-tile-scale .pnl-method{ display:none; }

.pnl-unread{ position:absolute; top:-5px; right:-7px; min-width:15px; height:15px; padding:0 4px; border-radius:99px; background:#ff4d4f; color:#fff;
  font-size:9.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 0 0 2px rgba(255,255,255,0.3); }
.pnl-ripple{ position:absolute; width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,0.5); transform:translate(-50%,-50%); animation:pnl-rip .5s ease-out forwards; pointer-events:none; }
@keyframes pnl-rip{ to{ width:120px; height:120px; opacity:0; } }

/* ── Ink colours inside glass (per theme) ─────────────────────────────────── */
.pnl-root[data-theme="light"]{ --gink:#1a1a1c; --gmut:#6a6760; }
.pnl-root[data-theme="dark"]{ --gink:#f2f3f7; --gmut:#aeb4bf; }

/* ── TOP navs ─────────────────────────────────────────────────────────────── */
.pnl-t{ display:flex; align-items:center; gap:10px; padding:0 var(--pnl-gap,20px); width:100%; color:var(--gink); }
.pnl-t--center{ justify-content:center; }
.pnl-t--spread{ justify-content:space-between; }
.pnl-t--right{ justify-content:flex-end; }
.pnl-t--flush{ padding:0; }
.pnl-t-round{ display:inline-flex; }
.pnl-t-round-btn{ width:42px; height:42px; border-radius:50%; border:none; background:none; color:var(--gink); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
.pnl-t-ico{ width:34px; height:34px; border-radius:50%; border:none; background:rgba(125,125,135,0.14); color:var(--gink); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.pnl-t-ico--sm{ width:28px; height:28px; }
.pnl-t-dot{ width:8px; height:8px; border-radius:50%; background:var(--accent); flex-shrink:0; }
.pnl-t-island{ display:inline-flex; align-items:center; gap:9px; padding:9px 10px 9px 15px; }
.pnl-t-island-txt{ font-size:13.5px; font-weight:620; white-space:nowrap; }
.pnl-t-greet{ display:inline-flex; align-items:center; gap:8px; font-size:14px; font-weight:620; }
.pnl-t-capsule{ flex:1; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 10px 9px 16px; }
.pnl-t-edge{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 18px 14px; }
.pnl-t-orbgroup{ display:inline-flex; gap:9px; }
.pnl-t-dyn{ display:inline-flex; align-items:center; gap:4px; padding:8px 10px 8px 15px; }
.pnl-t-dyn-core{ display:inline-flex; align-items:center; gap:9px; border:none; background:none; color:var(--gink); cursor:pointer; font:inherit; }
.pnl-t-dyn-more{ display:inline-flex; align-items:center; gap:4px; overflow:hidden; }
.pnl-t-morph{ display:inline-flex; align-items:center; gap:4px; padding:9px 12px; }
.pnl-t-morph-core{ border:none; background:none; color:var(--gink); font:inherit; font-size:14px; font-weight:620; cursor:pointer; white-space:nowrap; }
.pnl-t-morph-row{ display:inline-flex; align-items:center; gap:4px; overflow:hidden; }
.pnl-t-ribbon{ flex:1; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:6px 8px 6px 14px; }
.pnl-t-ribbon-txt{ display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:580; color:var(--gink); }
.pnl-t-corner{ position:relative; display:inline-flex; flex-direction:column; align-items:center; }
.pnl-t-corner-btn{ width:42px; height:42px; border:none; background:none; color:var(--gink); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
.pnl-t-corner-stack{ position:absolute; top:52px; display:flex; flex-direction:column; gap:9px; }
.pnl-t-chip{ display:inline-flex; }
.pnl-t-chip-btn{ display:inline-flex; align-items:center; gap:6px; padding:9px 15px 9px 12px; border:none; background:none; color:var(--gink); font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; }
.pnl-t-status{ display:inline-flex; align-items:center; gap:9px; padding:7px 15px 7px 7px; }
.pnl-t-ring{ width:30px; height:30px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; }
.pnl-t-ring-hole{ width:22px; height:22px; border-radius:50%; background:var(--panel); display:inline-flex; align-items:center; justify-content:center; font-size:9.5px; font-weight:700; color:var(--gink); }
.pnl-t-status-txt{ font-size:13px; font-weight:620; color:var(--gink); }
.pnl-t-vision{ position:relative; display:inline-flex; }
.pnl-t-vision-back{ position:absolute; inset:-7px -5px auto; height:100%; opacity:0.6; transform:translateY(5px) scale(1.04); }
.pnl-t-vision-front{ position:relative; display:inline-flex; align-items:center; gap:9px; padding:9px 10px 9px 15px; }

/* ── BOTTOM navs ──────────────────────────────────────────────────────────── */
.pnl-b-pill{ display:inline-flex; align-items:center; gap:4px; padding:7px; }
.pnl-b-pill--tight{ gap:4px; padding:6px; position:relative; }
.pnl-b-pill--mini{ gap:7px; padding:8px 11px; }
.pnl-b-tab{ display:inline-flex; flex-direction:column; align-items:center; gap:3px; width:76px; padding:9px 0 7px; border:none; background:none; color:var(--gmut); cursor:pointer; border-radius:16px; transition:color .2s; font:inherit; }
.pnl-b-tab--grow{ flex:1; width:auto; }
.pnl-b-ico{ position:relative; display:inline-flex; }
.pnl-b-lbl{ font-size:10.5px; font-weight:600; }
.pnl-b-seg{ position:relative; display:inline-flex; padding:6px; }
.pnl-b-seg-ind{ position:absolute; top:6px; left:6px; width:calc((100% - 12px)/3); height:calc(100% - 12px); border-radius:16px; }
.pnl-b-seg-tab{ position:relative; z-index:1; display:inline-flex; flex-direction:column; align-items:center; gap:3px; width:82px; padding:8px 0; border:none; background:none; color:var(--gmut); cursor:pointer; font:inherit; }
.pnl-b-bubbles{ display:inline-flex; gap:12px; }
.pnl-b-bubble{ width:58px; height:58px; display:inline-flex; align-items:center; justify-content:center; }
.pnl-b-bubble.on{ transform:translateY(-4px); }
.pnl-b-bubble-btn{ width:100%; height:100%; border:none; background:none; color:var(--gmut); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; position:relative; }
.pnl-b-mag{ display:inline-flex; align-items:center; gap:8px; height:46px; padding:0 15px; border:none; background:none; color:var(--gmut); border-radius:15px; cursor:pointer; transition:.28s cubic-bezier(.3,1,.3,1); font:inherit; }
.pnl-b-mag.on{ color:#fff; }
.pnl-b-mag-lbl{ font-size:13.5px; font-weight:650; white-space:nowrap; }
.pnl-b-mgfy{ display:inline-flex; align-items:center; justify-content:center; width:56px; height:46px; border:none; background:none; color:var(--gmut); cursor:pointer; transition:transform .3s cubic-bezier(.3,1.1,.4,1); }
.pnl-b-orb-wrap, .pnl-b-handle-wrap{ position:relative; display:inline-flex; justify-content:center; align-items:flex-end; min-height:60px; }
.pnl-b-orb-row{ display:inline-flex; overflow:hidden; }
.pnl-b-orb{ position:absolute; bottom:0; width:60px; height:60px; display:inline-flex; align-items:center; justify-content:center; }
.pnl-b-orb-btn, .pnl-b-handle-btn{ width:100%; height:100%; border:none; background:none; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
.pnl-b-handle{ width:132px; height:30px; display:inline-flex; align-items:center; justify-content:center; }
.pnl-b-handle-btn span{ width:46px; height:5px; border-radius:99px; background:var(--gmut); display:block; }
.pnl-b-liquid-blob{ position:absolute; top:6px; left:6px; width:calc((100% - 12px)/3); height:calc(100% - 12px); border-radius:15px; z-index:0; }
.pnl-b-liquid-tab{ position:relative; z-index:1; display:inline-flex; align-items:center; justify-content:center; width:66px; height:46px; border:none; background:none; color:var(--gmut); cursor:pointer; }
.pnl-b-stretch{ position:absolute; bottom:8px; left:7px; width:calc((100% - 14px)/3); height:3px; border-radius:99px; transform-origin:center; }
.pnl-b-emerge{ display:inline-flex; flex-direction:column; align-items:center; gap:5px; width:76px; padding:6px 0; border:none; background:none; color:var(--gmut); cursor:pointer; font:inherit; }
.pnl-b-emerge-ico{ width:40px; height:34px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; position:relative; transition:.28s cubic-bezier(.3,1,.3,1); }
.pnl-b-emerge-ico.on{ transform:translateY(-6px); }
.pnl-b-mini{ position:relative; display:inline-flex; flex-direction:column; align-items:center; gap:5px; width:48px; padding:6px 0; border:none; background:none; color:var(--gmut); cursor:pointer; }
.pnl-b-mini-dot{ width:5px; height:5px; border-radius:50%; background:transparent; }
.pnl-b-centre{ gap:8px; }
.pnl-b-fab{ width:52px; height:52px; border-radius:50%; border:none; color:#fff; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 8px 20px rgba(0,0,0,0.25); }
.pnl-b-radial{ position:relative; width:120px; height:64px; display:flex; align-items:flex-end; justify-content:center; }
.pnl-b-radial-item{ position:absolute; bottom:6px; width:46px; height:46px; display:inline-flex; align-items:center; justify-content:center; }
.pnl-b-radial-btn{ width:100%; height:100%; border:none; background:none; color:var(--gink); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
.pnl-b-radial-core{ position:relative; width:58px; height:58px; display:inline-flex; align-items:center; justify-content:center; }
.pnl-b-radial-core-btn{ width:48px; height:48px; border-radius:50%; border:none; background:none; color:var(--gink); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; transition:.2s; }
.pnl-b-edge{ width:100%; display:flex; justify-content:space-around; padding:12px 8px calc(14px + env(safe-area-inset-bottom)); margin-bottom:calc(-1 * var(--pnl-gap,20px)); }
.pnl-b-gather{ display:inline-flex; }
.pnl-b-gather-tab{ display:inline-flex; align-items:center; justify-content:center; width:58px; height:46px; border:none; background:none; color:var(--gmut); cursor:pointer; position:relative; }
.pnl-b-follow{ position:relative; display:inline-flex; padding:6px; }
.pnl-b-follow-bubble{ position:absolute; top:6px; left:6px; width:calc((100% - 12px)/3); height:calc(100% - 12px); border-radius:999px; z-index:0; }
.pnl-b-follow-tab{ position:relative; z-index:1; display:inline-flex; align-items:center; justify-content:center; width:56px; height:44px; border:none; background:none; color:var(--gmut); cursor:pointer; }
.pnl-b-tiles{ display:inline-flex; gap:10px; }
.pnl-b-tile{ width:78px; }
.pnl-b-tile-btn{ width:100%; display:inline-flex; flex-direction:column; align-items:center; gap:5px; padding:12px 0; border:none; background:none; color:var(--gmut); cursor:pointer; position:relative; font:inherit; }
.pnl-b-tile-lbl{ font-size:10.5px; font-weight:600; }
.pnl-b-watch{ display:inline-flex; gap:6px; padding:7px; }
.pnl-b-watch-tab{ width:46px; height:46px; border-radius:50%; border:none; background:rgba(125,125,135,0.12); color:var(--gmut); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; position:relative; transition:.2s; }

/* ── Gallery ──────────────────────────────────────────────────────────────── */
.pnl-gallery{ display:flex; flex-direction:column; gap:26px; }
.pnl-gal-title{ margin:0 0 13px; font-size:12px; font-weight:750; letter-spacing:0.06em; text-transform:uppercase; color:var(--muted); display:flex; align-items:center; gap:8px; }
.pnl-gal-title span{ font-size:11px; padding:1px 7px; border-radius:999px; background:rgba(125,125,135,0.16); color:var(--ink); }
.pnl-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(176px,1fr)); gap:14px; }
.pnl-tile{ display:flex; flex-direction:column; gap:8px; padding:10px; border:1px solid var(--line); border-radius:16px; background:var(--panel); cursor:pointer; transition:.16s; }
.pnl-tile:hover{ border-color:var(--accent); }
.pnl-tile.on{ border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); }
.pnl-tile-stage{ position:relative; height:84px; border-radius:11px; overflow:hidden; }
.pnl-tile-stage--top{ display:flex; align-items:flex-start; }
.pnl-tile-bg{ position:absolute; inset:0; background:linear-gradient(135deg,#c9718f,#4a4e92); }
.pnl-tile-stage[data-theme] .pnl-tile-bg{ }
.pnl-root[data-theme="dark"] .pnl-tile-bg{ background:linear-gradient(135deg,#553f66,#2b2e55); }
.pnl-tile-scale{ position:absolute; left:50%; width:392px; transform:translateX(-50%) scale(0.45); pointer-events:none !important; }
.pnl-tile-scale *{ pointer-events:none !important; }
.pnl-tile-scale--top{ top:-46px; transform-origin:top center; }
.pnl-tile-scale--bottom{ bottom:-16px; transform-origin:bottom center; }
.pnl-tile-scale .pnl-t{ padding-top:56px; color:#fff; }
.pnl-tile-scale .pnl-b-lbl, .pnl-tile-scale .pnl-b-tab, .pnl-tile-scale .pnl-b-seg-tab{ color:#fff; }
.pnl-tile-meta{ display:flex; justify-content:space-between; align-items:center; gap:8px; }
.pnl-tile-name{ font-size:12.5px; color:var(--muted); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pnl-tile-name b{ color:var(--ink); margin-right:4px; }
.pnl-tile-acts{ display:inline-flex; gap:4px; flex-shrink:0; }
.pnl-tile-act{ border:none; background:none; color:var(--muted); font-size:13px; cursor:pointer; padding:2px 4px; border-radius:6px; line-height:1; }
.pnl-tile-act:hover{ background:rgba(125,125,135,0.14); color:var(--ink); }
.pnl-tile-act.on{ color:var(--accent); }
.pnl-tile-note{ margin:0; font-size:11.5px; line-height:1.4; color:var(--muted); }

/* ── Compare ──────────────────────────────────────────────────────────────── */
.pnl-compare{ margin-top:32px; }
.pnl-compare-head{ display:flex; justify-content:space-between; align-items:center; }
.pnl-clear{ border:1px solid var(--line); background:var(--panel); color:var(--muted); font:inherit; font-size:12px; font-weight:600; padding:5px 12px; border-radius:999px; cursor:pointer; }
.pnl-compare-row{ display:flex; gap:18px; flex-wrap:wrap; }
.pnl-compare-cell{ display:flex; flex-direction:column; gap:8px; }
.pnl-compare-stage{ position:relative; width:320px; height:210px; border-radius:26px; overflow:hidden; border:1px solid var(--line); }
.pnl-compare-stage .pnl-hero{ height:100%; }
.pnl-compare-nav{ position:absolute; bottom:16px; left:0; right:0; display:flex; justify-content:center; }

/* ── Combined systems ─────────────────────────────────────────────────────── */
.pnl-combo-row{ display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:12px; }
.pnl-combo{ display:flex; flex-direction:column; gap:3px; padding:13px 15px; border:1px solid var(--line); border-radius:14px; background:var(--panel); cursor:pointer; text-align:left; transition:.16s; }
.pnl-combo:hover{ border-color:var(--accent); }
.pnl-combo.on{ border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); }
.pnl-combo-name{ font-size:14px; font-weight:650; color:var(--ink); }
.pnl-combo-ids{ font-size:11.5px; font-weight:600; color:var(--accent); }
.pnl-combo-note{ font-size:11.5px; color:var(--muted); line-height:1.4; }

/* Real top-bar content: greeting pill + drawer-section chips */
.pnl-t-greet-bubble{ display:inline-flex; align-items:center; padding:9px 16px; color:var(--gink); font-size:13.5px; font-weight:620; white-space:nowrap; }
.pnl-t-sec{ font-size:11px; font-weight:600; padding:5px 9px; border-radius:9px; background:rgba(125,125,135,0.2); color:var(--gink); white-space:nowrap; }
.pnl-t-sec-stack{ position:absolute; top:52px; right:0; display:flex; flex-direction:column; gap:6px; align-items:flex-end; }
.pnl-t-morph-core{ overflow:hidden; display:inline-block; white-space:nowrap; }
.pnl-t-morph-row{ gap:6px; }

/* Raised centre tab (real middle destination lifted) */
.pnl-b-centre-mid{ display:inline-flex; flex-direction:column; align-items:center; gap:3px; margin:0 2px; transform:translateY(-12px); }
.pnl-b-centre-lbl{ font-size:10.5px; font-weight:600; color:var(--gmut); }

@media (prefers-reduced-motion: reduce){
  .pnl-bottom-layer, .pnl-root .lgx-surface, .pnl-b-mag, .pnl-b-mgfy, .pnl-b-emerge-ico, .pnl-b-radial-core-btn{ transition:none; }
  .pnl-ripple{ animation:none; }
}
`;
