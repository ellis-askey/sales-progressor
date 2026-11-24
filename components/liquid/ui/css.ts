// Canonical CSS for the forward TSP Liquid-Glass UI — CANDIDATE (not approved).
// Crafted for BOTH light and dark on the approved optical foundation. Material
// doctrine (Apple materials.md): standard/solid materials in the content layer;
// Liquid-Glass (regular variant: blur + luminosity for legibility) on the floating
// functional layer; genuine refraction reserved for selected interactive/floating
// elements. Consistent radii, edge highlights, restrained coral, sentence-case.
export const GLASS_UI_CSS = `
.lg-glass-root{ position:relative; min-height:100%; isolation:isolate; color:var(--lg-ink); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif; letter-spacing:-.01em; -webkit-font-smoothing:antialiased; }

/* ── material system tokens (per theme) ─────────────────────────────────────── */
.lg-ds{ --r-ctl:10px; --r-field:11px; --r-card:14px; --r-over:16px; }
.lg-ds[data-theme="dark"]{
  --edge:rgba(255,255,255,.16); --edge-top:rgba(255,255,255,.42);
  --sh-ctl:0 1px 2px rgba(0,0,0,.34); --sh-pop:0 2px 8px rgba(0,0,0,.34); --sh-over:0 24px 64px -16px rgba(0,0,0,.66), 0 8px 24px rgba(0,0,0,.34);
  --surface:rgba(255,255,255,.055); --surface-2:rgba(255,255,255,.1); --glass:rgba(22,27,38,.72); --track:rgba(0,0,0,.26); --track-inset:rgba(0,0,0,.34);
}
.lg-ds[data-theme="light"]{
  --edge:rgba(20,30,60,.05); --edge-top:rgba(255,255,255,1);
  --sh-ctl:0 1px 2px rgba(20,30,60,.08); --sh-pop:0 2px 8px rgba(20,30,60,.12); --sh-over:0 24px 64px -16px rgba(20,30,60,.22), 0 8px 24px rgba(20,30,60,.1);
  --surface:#ffffff; --surface-2:#ffffff; --glass:rgba(255,255,255,.72); --track:rgba(12,16,28,.05); --track-inset:rgba(12,16,28,.08);
}

/* atmosphere (used by review backdrops, not required by components) */
.tl-scene{ position:fixed; inset:0; z-index:0; pointer-events:none; background:radial-gradient(46% 42% at 10% 6%, rgba(255,107,74,0.1), transparent 66%), radial-gradient(40% 36% at 92% 10%, rgba(56,189,248,0.08), transparent 68%); }
.tl-scene-2{ background:radial-gradient(54% 48% at 74% 96%, rgba(168,120,255,0.09), transparent 70%); animation:tldrift 22s ease-in-out infinite alternate; }
@keyframes tldrift{ from{ transform:translate(-1.5%,-1%) scale(1.02);} to{ transform:translate(2%,1.5%) scale(1.06);} }
.tl-ctl-label{ font-size:13.5px; color:var(--lg-ink); } .tl-ctl-hint{ display:block; font-size:11.5px; color:var(--lg-ink-3); margin-top:1px; }

/* ── Button ─────────────────────────────────────────────────────────────────── */
.tl-btn{ display:inline-flex; align-items:center; justify-content:center; gap:7px; font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; border:none; padding:0 15px; height:36px; border-radius:var(--r-ctl); color:var(--lg-ink); position:relative; transition:filter .16s, background .16s, border-color .16s, box-shadow .2s, transform .06s; }
.tl-btn svg{ width:16px; height:16px; } .tl-btn:disabled{ opacity:.45; cursor:not-allowed; } .tl-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; } .tl-btn:active:not(:disabled){ transform:translateY(.5px); }
.tl-btn--primary{ background:var(--lg-accent); color:#fff; box-shadow:0 1px 2px rgba(224,78,44,.4), inset 0 1px 0 rgba(255,255,255,.32); } .tl-btn--primary:hover:not(:disabled){ filter:brightness(1.05); }
.tl-btn--secondary{ background:var(--surface-2); border:1px solid var(--lg-line); box-shadow:var(--sh-ctl), inset 0 1px 0 var(--edge-top); } .tl-btn--secondary:hover:not(:disabled){ border-color:var(--lg-ink-3); }
.tl-btn--subtle{ background:transparent; color:var(--lg-ink-2); } .tl-btn--subtle:hover:not(:disabled){ background:var(--lg-hover); color:var(--lg-ink); }
.tl-btn--ghost{ background:transparent; color:var(--lg-ink-2); border:1px solid var(--lg-line); } .tl-btn--ghost:hover:not(:disabled){ color:var(--lg-ink); border-color:var(--lg-ink-3); }
.tl-btn--danger{ background:color-mix(in srgb, var(--lg-danger-ink) 14%, transparent); color:var(--lg-danger-ink); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--lg-danger-ink) 22%, transparent); } .tl-btn--danger:hover:not(:disabled){ background:color-mix(in srgb, var(--lg-danger-ink) 20%, transparent); }
.tl-btn--sm{ height:30px; padding:0 12px; font-size:12.5px; border-radius:9px; } .tl-btn--lg{ height:44px; padding:0 20px; font-size:15px; border-radius:12px; } .tl-btn--icon{ padding:0; width:36px; } .tl-btn--icon.tl-btn--sm{ width:30px; } .tl-btn--full{ width:100%; }
.tl-spin{ width:15px; height:15px; border-radius:50%; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; animation:tlspin .7s linear infinite; } .tl-btn--secondary .tl-spin,.tl-btn--ghost .tl-spin{ border-color:var(--lg-line); border-top-color:var(--lg-accent); } @keyframes tlspin{ to{ transform:rotate(360deg);} }

/* ── Checkbox ───────────────────────────────────────────────────────────────── */
.tl-check-row{ display:inline-flex; align-items:center; gap:10px; background:none; border:none; cursor:pointer; padding:0; } .tl-check-row:disabled{ opacity:.45; cursor:not-allowed; }
.tl-check{ width:20px; height:20px; border-radius:6px; background:var(--lg-field); border:1.5px solid var(--lg-line); display:grid; place-items:center; transition:background .18s, border-color .18s; flex-shrink:0; box-shadow:inset 0 1px 1px rgba(0,0,0,.04); } .tl-check[data-on]{ background:var(--lg-accent); border-color:var(--lg-accent); box-shadow:0 1px 2px rgba(224,78,44,.3); }
.tl-check svg{ width:12px; height:12px; } .tl-check svg path{ fill:none; stroke:#fff; stroke-width:2.4; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:16; stroke-dashoffset:16; transition:stroke-dashoffset .28s cubic-bezier(.3,1.2,.4,1); } .tl-check[data-on] svg path{ stroke-dashoffset:0; } .tl-check-row:focus-visible{ outline:none; } .tl-check-row:focus-visible .tl-check{ outline:2px solid var(--lg-accent); outline-offset:2px; }

.tl-slider{ position:relative; display:flex; align-items:center; height:30px; width:100%; touch-action:none; user-select:none; } .tl-slider-track{ position:relative; flex:1; height:6px; border-radius:999px; background:var(--track); box-shadow:inset 0 1px 2px var(--track-inset); } .tl-slider-range{ position:absolute; height:100%; border-radius:999px; background:var(--lg-accent); }

/* ── Field / Input / Textarea ───────────────────────────────────────────────── */
.tl-field{ display:flex; flex-direction:column; gap:6px; width:100%; } .tl-field-label{ font-size:12.5px; font-weight:600; color:var(--lg-ink); letter-spacing:-.006em; } .tl-field-err{ font-size:11.5px; color:var(--lg-danger-ink); display:flex; align-items:center; gap:4px; } .tl-field-hint{ font-size:11.5px; color:var(--lg-ink-3); }
.tl-input{ display:flex; align-items:center; gap:8px; padding:0 12px; height:38px; border-radius:var(--r-field); background:var(--lg-field); border:1px solid var(--lg-line); box-shadow:inset 0 1px 1.5px rgba(0,0,0,.04); transition:border-color .16s, box-shadow .16s; } .tl-input:focus-within{ border-color:var(--lg-accent); box-shadow:0 0 0 3px var(--lg-accent-soft); } .tl-input[data-error]{ border-color:var(--lg-danger-ink); } .tl-input[data-error]:focus-within{ box-shadow:0 0 0 3px color-mix(in srgb, var(--lg-danger-ink) 18%, transparent); }
.tl-input input{ flex:1; min-width:0; background:none; border:none; outline:none; color:var(--lg-ink); font:inherit; font-size:13.5px; } .tl-input input::placeholder{ color:var(--lg-ink-3); }
.tl-input-lead{ display:inline-flex; color:var(--lg-ink-3); } .tl-input-lead svg{ width:16px; height:16px; } .tl-input-clear{ display:inline-grid; place-items:center; width:20px; height:20px; border-radius:50%; background:var(--lg-hover); border:none; color:var(--lg-ink-3); cursor:pointer; } .tl-input-clear:hover{ color:var(--lg-ink); } .tl-input-clear svg{ width:11px; height:11px; }
.tl-textarea{ width:100%; min-height:76px; background:var(--lg-field); border:1px solid var(--lg-line); border-radius:var(--r-field); padding:10px 12px; color:var(--lg-ink); font:inherit; font-size:13.5px; line-height:1.55; resize:vertical; box-shadow:inset 0 1px 1.5px rgba(0,0,0,.04); transition:border-color .16s, box-shadow .16s; } .tl-textarea:focus{ outline:none; border-color:var(--lg-accent); box-shadow:0 0 0 3px var(--lg-accent-soft); } .tl-textarea[data-error]{ border-color:var(--lg-danger-ink); } .tl-textarea::placeholder{ color:var(--lg-ink-3); }

/* ── Select + Date trigger ──────────────────────────────────────────────────── */
.tl-select{ display:inline-flex; align-items:center; justify-content:space-between; gap:10px; width:100%; padding:0 12px; height:38px; border-radius:var(--r-field); background:var(--lg-field); border:1px solid var(--lg-line); color:var(--lg-ink); font:inherit; font-size:13.5px; cursor:pointer; box-shadow:inset 0 1px 1.5px rgba(0,0,0,.04); transition:border-color .16s, box-shadow .16s; } .tl-select:hover{ border-color:var(--lg-ink-3); } .tl-select[data-open]{ border-color:var(--lg-accent); box-shadow:0 0 0 3px var(--lg-accent-soft); } .tl-select:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; } .tl-select svg{ width:15px; height:15px; color:var(--lg-ink-3); flex-shrink:0; } .tl-select-ph{ color:var(--lg-ink-3); } .tl-datebtn{ justify-content:flex-start; }

/* ── frosted surface (Liquid-Glass regular variant for overlays) ────────────── */
.tl-frost{ position:relative; border:1px solid var(--lg-line); background:var(--glass); -webkit-backdrop-filter:blur(22px) saturate(180%); backdrop-filter:blur(22px) saturate(180%); box-shadow:var(--sh-over), inset 0 1px 0 var(--edge-top); animation:tlpop .18s cubic-bezier(.2,.9,.3,1); }
@keyframes tlpop{ from{ opacity:0; transform:translateY(-5px) scale(.985);} to{ opacity:1; transform:none;} }
.tl-cal{ padding:14px; width:272px; } .tl-cal-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; } .tl-cal-head strong{ font-size:13.5px; font-weight:650; } .tl-cal-nav{ width:28px; height:28px; border-radius:8px; display:grid; place-items:center; background:var(--surface-2); border:1px solid var(--lg-line); color:var(--lg-ink-2); cursor:pointer; } .tl-cal-nav:hover{ color:var(--lg-ink); } .tl-cal-nav svg{ width:13px; height:13px; }
.tl-cal-grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:2px; } .tl-cal-dow{ font-size:10.5px; font-weight:600; color:var(--lg-ink-3); text-align:center; padding-bottom:5px; } .tl-cal-day{ aspect-ratio:1; border-radius:8px; border:none; background:none; color:var(--lg-ink); font:inherit; font-size:12.5px; cursor:pointer; transition:background .15s; } .tl-cal-day:hover{ background:var(--lg-hover); } .tl-cal-day[data-on]{ background:var(--lg-accent); color:#fff; font-weight:650; box-shadow:0 1px 3px rgba(224,78,44,.34); } .tl-cal-day:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; }

.tl-portal{ font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif; }
@media (prefers-reduced-motion: reduce){ .lg-ds *, .tl-portal *{ animation:none !important; transition:none !important; } }

/* ── materials: Surface(solid / frost / lens) ───────────────────────────────── */
.tlf-surf{ position:relative; }
.tlf-surf--solid{ background:var(--surface); border:1px solid var(--lg-line); box-shadow:var(--sh-ctl), inset 0 1px 0 var(--edge-top); }
.tlf-surf--frost{ background:var(--glass); -webkit-backdrop-filter:blur(22px) saturate(180%); backdrop-filter:blur(22px) saturate(180%); border:1px solid var(--lg-line); box-shadow:var(--sh-over), inset 0 1px 0 var(--edge-top); }
.tlf-surf--contrast{ border-color:var(--lg-ink-3) !important; }

/* ── travelling selection (the signature — crafted light + dark) ────────────── */
.tlf-sel{ position:relative; display:inline-flex; align-items:center; isolation:isolate; }
.tlf-sel--segmented{ padding:3px; border-radius:11px; background:var(--track); box-shadow:inset 0 1px 2px var(--track-inset); border:1px solid var(--lg-line); }
.tlf-sel--tabs{ padding:4px; border-radius:12px; background:var(--track); border:1px solid var(--lg-line-2); }
.tlf-sel-pill{ position:absolute; top:0; left:0; z-index:0; border-radius:8px; pointer-events:none; }
.tlf-sel--tabs .tlf-sel-pill{ border-radius:9px; }
.tlf-sel-pill-face{ position:absolute; inset:0; border-radius:inherit; background:var(--surface-2); box-shadow:var(--sh-pop), inset 0 1px 0 var(--edge-top); border:.5px solid var(--edge); }
.lg-ds[data-theme="dark"] .tlf-sel-pill-face{ background:linear-gradient(180deg, rgba(255,255,255,.17), rgba(255,255,255,.07)); -webkit-backdrop-filter:blur(8px) saturate(160%); backdrop-filter:blur(8px) saturate(160%); border-color:rgba(255,255,255,.22); }
.tlf-sel[data-rt] .tlf-sel-pill-face{ -webkit-backdrop-filter:none; backdrop-filter:none; background:var(--surface-2); }
.tlf-sel[data-contrast] .tlf-sel-pill-face{ border-color:var(--lg-ink-2); }
.tlf-sel-opt{ position:relative; z-index:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; background:none; border:none; cursor:pointer; font:inherit; font-weight:550; color:var(--lg-ink-3); white-space:nowrap; transition:color .26s cubic-bezier(.3,.9,.3,1); letter-spacing:-.006em; }
.tlf-sel--segmented .tlf-sel-opt{ height:30px; padding:0 15px; font-size:12.5px; border-radius:8px; }
.tlf-sel--sm.tlf-sel--segmented .tlf-sel-opt{ height:26px; padding:0 12px; font-size:12px; }
.tlf-sel--tabs .tlf-sel-opt{ height:34px; padding:0 17px; font-size:13px; border-radius:9px; }
.tlf-sel-opt:hover:not([data-on]){ color:var(--lg-ink-2); } .tlf-sel-opt[data-on]{ color:var(--lg-ink); font-weight:600; } .tlf-sel-opt:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.tlf-sel-ico{ display:inline-flex; } .tlf-sel-ico svg{ width:16px; height:16px; }
`;
