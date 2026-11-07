// Workspace Lab — "the bench" (v3). Art-directed around one idea: a pro's working
// surface, not a property website. A luminous pearl bench carrying one connected
// story; layered materials (raised surface, recessed wells, engraved separators,
// crafted controls); glass reserved for the floating dock. Self-contained, /dev only.

export const LAB_CSS = String.raw`
.wl-root {
  --ink: #232831;
  --ink-2: #596170;
  --ink-3: #8891a0;
  --ink-4: #aeb6c2;
  --line: rgba(36,46,66,0.10);
  --line-soft: rgba(36,46,66,0.06);
  --line-strong: rgba(36,46,66,0.16);
  --hi: rgba(255,255,255,0.9);
  --co: #e65c38;
  --co-deep: #d44a28;
  --co-tint: rgba(230,92,56,0.1);
  --t-amber: #c98a2e;
  --t-blue: #4a7fc4;
  --t-green: #3b9b6d;
  --t-slate: #8891a0;
  --t-coral: #e65c38;
  --display: "Segoe UI Variable Display", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
  --sans: "Segoe UI Variable Text", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  --r-sm: 10px; --r-md: 14px; --r-lg: 20px; --r-xl: 28px;

  min-height: 100vh;
  font-family: var(--sans);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  background:
    radial-gradient(900px 620px at 88% -6%, #fdeee2 0%, transparent 44%),
    radial-gradient(1100px 820px at 2% 102%, #e4ebf3 0%, transparent 52%),
    radial-gradient(700px 500px at 60% 40%, rgba(255,255,255,0.5) 0%, transparent 60%),
    linear-gradient(168deg, #f4f6f8 0%, #edf0f3 60%, #e9ecf0 100%);
  background-attachment: fixed;
}
.wl-root::before {
  content: ""; position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.025; mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.wl-root *::selection { background: rgba(230,92,56,0.18); }
.wl-root *::-webkit-scrollbar { width: 9px; height: 9px; }
.wl-root *::-webkit-scrollbar-thumb { background: rgba(36,46,66,0.16); border-radius: 99px; border: 3px solid transparent; background-clip: padding-box; }
.wl-root *::-webkit-scrollbar-thumb:hover { background: rgba(36,46,66,0.28); background-clip: padding-box; }
.wl-num { font-variant-numeric: tabular-nums; letter-spacing: 0; }

.wl-shell { position: relative; z-index: 1; display: grid; grid-template-columns: 72px minmax(0,1fr); gap: 20px; max-width: 1440px; margin: 0 auto; padding: 22px 24px 30px; min-height: 100vh; align-items: start; }

/* ── the dock (the only true glass) ───────────────────────────────────────── */
.wl-dock { position: sticky; top: 22px; height: calc(100vh - 52px); display: flex; flex-direction: column; align-items: center; padding: 14px 0 12px;
  background: linear-gradient(160deg, rgba(255,255,255,0.62), rgba(255,255,255,0.4));
  backdrop-filter: blur(30px) saturate(1.8); -webkit-backdrop-filter: blur(30px) saturate(1.8);
  border: 1px solid rgba(255,255,255,0.7); border-radius: 26px;
  box-shadow: 0 0 0 0.5px rgba(36,46,66,0.05), 0 1px 2px rgba(36,46,66,0.06), 0 22px 50px -24px rgba(36,46,66,0.32), inset 0 1px 0 rgba(255,255,255,0.9);
  animation: wl-rise 0.55s cubic-bezier(0.2,0.85,0.25,1) both;
}
.wl-mark { width: 34px; height: 34px; border-radius: 11px; background: linear-gradient(150deg, #2b313c, #1b2028); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 15px; letter-spacing: -0.04em; box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 8px rgba(20,25,35,0.3); }
.wl-dock-group { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 12px; width: 100%; }
.wl-nav-ico { width: 40px; height: 40px; border-radius: 12px; border: none; background: transparent; color: var(--ink-3); display: grid; place-items: center; cursor: pointer; transition: color 0.18s, background 0.18s, box-shadow 0.18s; }
.wl-nav-ico svg { width: 19px; height: 19px; }
.wl-nav-ico:hover { color: var(--ink); background: rgba(255,255,255,0.6); }
.wl-nav-ico[data-on] { color: var(--co-deep); background: rgba(255,255,255,0.85); box-shadow: inset 0 0 0 0.5px var(--line), 0 2px 6px -1px rgba(36,46,66,0.16); }
.wl-dock-rule { width: 30px; height: 1px; margin: 12px 0; background: var(--line); box-shadow: 0 1px 0 var(--hi); }
.wl-dock-cap { font-size: 9.5px; font-weight: 650; letter-spacing: 0.04em; color: var(--ink-4); margin-bottom: 8px; }

.wl-book { display: flex; flex-direction: column; gap: 10px; width: 100%; align-items: center; overflow-y: auto; overflow-x: visible; padding: 2px 0 4px; scrollbar-width: none; }
.wl-book::-webkit-scrollbar { display: none; }
.wl-thumb { position: relative; width: 44px; height: 44px; border-radius: 13px; border: none; padding: 0; cursor: pointer; background-size: cover; background-position: center;
  filter: grayscale(0.72) brightness(1.04) contrast(0.94); opacity: 0.72;
  box-shadow: 0 1px 3px rgba(20,25,35,0.22), inset 0 0 0 1px rgba(255,255,255,0.3);
  transition: transform 0.3s cubic-bezier(0.2,0.9,0.25,1), box-shadow 0.3s, filter 0.3s, opacity 0.3s, border-radius 0.3s; outline: none; }
.wl-thumb:hover { filter: grayscale(0.2) brightness(1.02); opacity: 1; transform: scale(1.08) translateX(2px); box-shadow: 0 6px 14px rgba(20,25,35,0.28); }
.wl-thumb[data-on] { filter: none; opacity: 1; transform: scale(1.12); border-radius: 15px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.9), 0 6px 16px -3px rgba(36,46,66,0.4), inset 0 0 0 1px rgba(255,255,255,0.25); }
.wl-thumb[data-on]::before { content: ""; position: absolute; left: -11px; top: 50%; transform: translateY(-50%); width: 3px; height: 20px; border-radius: 2px; background: var(--co); box-shadow: 0 0 7px rgba(230,92,56,0.6); }
.wl-thumb-dot { position: absolute; top: -2px; right: -2px; width: 11px; height: 11px; border-radius: 50%; border: 2.5px solid #f1f3f6; box-shadow: 0 1px 2px rgba(0,0,0,0.2); z-index: 2; }
.wl-thumb-label { position: absolute; left: 56px; top: 50%; transform: translateY(-50%) translateX(-4px); white-space: nowrap; background: rgba(27,32,40,0.94); backdrop-filter: blur(10px); color: #fff; font-size: 12px; font-weight: 500; padding: 7px 12px; border-radius: 9px; opacity: 0; pointer-events: none; transition: opacity 0.18s, transform 0.18s; box-shadow: 0 10px 26px rgba(0,0,0,0.3); z-index: 30; }
.wl-thumb-label b { font-weight: 650; } .wl-thumb-label span { color: #9aa2ad; margin-left: 2px; }
.wl-thumb-label::before { content: ""; position: absolute; left: -4px; top: 50%; transform: translateY(-50%) rotate(45deg); width: 9px; height: 9px; background: rgba(27,32,40,0.94); border-radius: 2px; }
.wl-thumb:hover .wl-thumb-label { opacity: 1; transform: translateY(-50%) translateX(0); }
.wl-dock-foot { margin-top: auto; padding-top: 10px; display: flex; flex-direction: column; align-items: center; }
.wl-me { width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.8); background: linear-gradient(150deg, #cdd6e2, #aab6c6); color: #3a434f; display: grid; place-items: center; font-weight: 650; font-size: 12px; cursor: pointer; box-shadow: 0 2px 6px rgba(36,46,66,0.2), inset 0 1px 0 rgba(255,255,255,0.6); transition: transform 0.2s; }
.wl-me:hover { transform: scale(1.07); }

/* ── the bench (one surface, two regions) ─────────────────────────────────── */
.wl-bench { display: grid; grid-template-columns: minmax(0,1fr) 1px 352px; min-height: calc(100vh - 52px);
  background: linear-gradient(176deg, rgba(255,255,255,0.78), rgba(252,253,255,0.62));
  backdrop-filter: blur(16px) saturate(1.15); -webkit-backdrop-filter: blur(16px) saturate(1.15);
  border: 1px solid rgba(255,255,255,0.85); border-radius: var(--r-xl);
  box-shadow: 0 0 0 0.5px rgba(36,46,66,0.055), 0 1px 2px rgba(36,46,66,0.05), 0 2px 5px rgba(36,46,66,0.04), 0 30px 70px -36px rgba(36,46,66,0.28), inset 0 1px 0 rgba(255,255,255,0.95);
  overflow: hidden; animation: wl-rise 0.55s cubic-bezier(0.2,0.85,0.25,1) 0.06s both; }
.wl-seam { background: linear-gradient(180deg, transparent, var(--line) 12%, var(--line) 88%, transparent); box-shadow: 1px 0 0 var(--hi); }

/* narrative region */
.wl-story { padding: 30px 34px 30px; min-width: 0; display: flex; flex-direction: column; }
.wl-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.wl-addr { font-family: var(--display); font-size: 33px; line-height: 1.02; letter-spacing: -0.025em; font-weight: 370; margin: 0; color: var(--ink); }
.wl-addr-sub { font-size: 13px; color: var(--ink-3); margin: 9px 0 0; font-weight: 500; }
.wl-price { text-align: right; flex-shrink: 0; }
.wl-price b { font-family: var(--display); font-size: 19px; font-weight: 600; letter-spacing: -0.01em; display: block; color: var(--ink); }
.wl-price span { font-size: 11.5px; color: var(--ink-3); font-weight: 550; }

.wl-plate { position: relative; margin-top: 20px; border-radius: var(--r-md); overflow: hidden; height: 172px;
  box-shadow: 0 1px 2px rgba(20,25,35,0.14), 0 10px 26px -14px rgba(20,25,35,0.4), inset 0 0 0 1px rgba(255,255,255,0.22), inset 0 0 0 0.5px rgba(20,25,35,0.14); }
.wl-plate img { width: 100%; height: 100%; object-fit: cover; display: block; animation: wl-kenburns 20s ease-out both; }
.wl-plate::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(14,10,8,0.5) 0%, transparent 42%); }
.wl-plate-cap { position: absolute; left: 15px; bottom: 13px; z-index: 2; display: flex; align-items: center; gap: 9px; }
.wl-plate-stage { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 600; color: #fff; }
.wl-plate-stage i { width: 7px; height: 7px; border-radius: 50%; background: var(--tc, var(--co)); box-shadow: 0 0 0 2.5px rgba(255,255,255,0.25); }
.wl-plate-pct { position: absolute; right: 14px; bottom: 13px; z-index: 2; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.82); font-variant-numeric: tabular-nums; }

/* the hold-up */
.wl-hold { margin-top: 26px; }
.wl-hold-top { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.wl-hold-h { font-family: var(--display); font-size: 20px; font-weight: 560; letter-spacing: -0.02em; line-height: 1.22; margin: 0; max-width: 32ch; }
.wl-metric { flex-shrink: 0; text-align: right; }
.wl-metric b { font-family: var(--display); font-size: 17px; font-weight: 600; color: var(--co-deep); font-variant-numeric: tabular-nums; }
.wl-metric span { display: block; font-size: 10.5px; color: var(--ink-3); font-weight: 550; margin-top: 1px; }
.wl-hold-sum { font-size: 14px; color: var(--ink-2); line-height: 1.5; margin: 9px 0 0; max-width: 56ch; }

/* conversation well (recessed material) */
.wl-well { margin-top: 18px; padding: 16px 18px; border-radius: var(--r-md);
  background: linear-gradient(180deg, rgba(234,238,243,0.7), rgba(239,242,246,0.5));
  box-shadow: inset 0 1px 3px rgba(36,46,66,0.09), inset 0 0 0 0.5px rgba(36,46,66,0.05); }
.wl-well-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px; }
.wl-well-h span { font-size: 11.5px; font-weight: 600; color: var(--ink-3); }
.wl-well-more { font: inherit; font-size: 11.5px; font-weight: 600; color: var(--ink-3); background: none; border: none; cursor: pointer; padding: 0; transition: color 0.16s; }
.wl-well-more:hover { color: var(--co-deep); }
.wl-note { display: grid; grid-template-columns: 26px 1fr; gap: 11px; padding: 9px 0; }
.wl-note + .wl-note { border-top: 1px solid var(--line-soft); }
.wl-note-av { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font-size: 10px; font-weight: 700; flex-shrink: 0; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5); margin-top: 1px; }
.wl-note[data-side="solicitor"] .wl-note-av { background: #dde7f4; color: #35608f; }
.wl-note[data-side="you"] .wl-note-av { background: linear-gradient(150deg, var(--co), var(--co-deep)); color: #fff; }
.wl-note[data-side="seller"] .wl-note-av { background: #e3edda; color: #51702f; }
.wl-note-h { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 2px; }
.wl-note-from { font-size: 12.5px; font-weight: 650; color: var(--ink); }
.wl-note-when { font-size: 11px; color: var(--ink-4); white-space: nowrap; }
.wl-note-body { font-size: 13px; color: var(--ink-2); line-height: 1.48; }
.wl-note-collapsed { max-height: 0; overflow: hidden; transition: max-height 0.44s cubic-bezier(0.2,0.85,0.25,1); }
.wl-note-collapsed[data-open] { max-height: 340px; }

/* actions: one strong, rest quiet */
.wl-act { display: flex; align-items: center; gap: 18px; margin-top: 20px; }
.wl-primary { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: 13.5px; font-weight: 600; color: #fff; border: none; cursor: pointer; border-radius: var(--r-sm); padding: 10px 16px;
  background: linear-gradient(176deg, #ec6a47, var(--co-deep)); box-shadow: 0 1px 1px rgba(150,40,15,0.3), 0 5px 12px -3px rgba(212,74,40,0.5), inset 0 1px 0 rgba(255,255,255,0.35);
  transition: transform 0.14s, box-shadow 0.2s, filter 0.2s; }
.wl-primary svg { width: 15px; height: 15px; }
.wl-primary:hover { transform: translateY(-1px); box-shadow: 0 1px 1px rgba(150,40,15,0.3), 0 9px 20px -4px rgba(212,74,40,0.55), inset 0 1px 0 rgba(255,255,255,0.35); }
.wl-primary:active { transform: translateY(0) scale(0.985); }
.wl-quiet { font: inherit; font-size: 13.5px; font-weight: 550; color: var(--ink-2); background: none; border: none; cursor: pointer; padding: 0; transition: color 0.16s; }
.wl-quiet:hover { color: var(--co-deep); }

/* clients */
.wl-engrave { height: 1px; margin: 28px 0; background: var(--line); box-shadow: 0 1px 0 var(--hi); }
.wl-clients { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.wl-client { display: flex; align-items: center; gap: 13px; position: relative; }
.wl-client-av { width: 46px; height: 46px; border-radius: var(--r-sm); display: grid; place-items: center; font-size: 14px; font-weight: 650; flex-shrink: 0;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), inset 0 0 0 0.5px rgba(36,46,66,0.08), 0 2px 6px rgba(36,46,66,0.1); }
.wl-client-role { font-size: 10.5px; color: var(--ink-3); font-weight: 600; }
.wl-client-name { font-size: 14.5px; font-weight: 600; letter-spacing: -0.01em; margin: 1px 0 3px; color: var(--ink); }
.wl-client-recency { font-size: 11.5px; color: var(--ink-3); display: inline-flex; align-items: center; gap: 6px; }
.wl-client-recency i { width: 6px; height: 6px; border-radius: 50%; }
.wl-rc-ok i { background: var(--t-green); } .wl-rc-waiting i { background: var(--t-amber); } .wl-rc-waiting { color: #a9741f; } .wl-rc-overdue i { background: var(--t-coral); } .wl-rc-overdue { color: var(--co-deep); }
.wl-client-do { position: absolute; right: 0; top: 50%; transform: translateY(-50%) scale(0.85); width: 32px; height: 32px; border-radius: 9px; border: 1px solid var(--line); background: rgba(255,255,255,0.7); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; opacity: 0; transition: opacity 0.18s, transform 0.18s, color 0.18s, border-color 0.18s; }
.wl-client-do svg { width: 15px; height: 15px; }
.wl-client:hover .wl-client-do { opacity: 1; transform: translateY(-50%) scale(1); }
.wl-client-do:hover { color: var(--co-deep); border-color: var(--co-tint); }

/* ── the day (right region of the bench) ──────────────────────────────────── */
.wl-day { padding: 28px 22px 24px; display: flex; flex-direction: column; min-width: 0; background: linear-gradient(180deg, rgba(238,242,246,0.4), rgba(243,245,248,0.18)); }

/* transaction timeline — anchors the story, shows where the sale sits */
.wl-timeline { margin-top: auto; padding-top: 26px; border-top: 1px solid var(--line-soft); }
.wl-timeline-h { font-size: 11px; font-weight: 600; color: var(--ink-3); margin: 0 0 16px; }
.wl-steps { display: flex; }
.wl-step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 9px; position: relative; }
.wl-step::before { content: ""; position: absolute; top: 6px; left: -50%; width: 100%; height: 2px; background: var(--line-strong); }
.wl-step:first-child::before { display: none; }
.wl-step[data-done]::before, .wl-step[data-current]::before { background: linear-gradient(90deg, rgba(230,92,56,0.5), var(--co)); }
.wl-node { width: 13px; height: 13px; border-radius: 50%; background: #fff; box-shadow: inset 0 0 0 2px var(--line-strong); z-index: 1; transition: box-shadow 0.3s, background 0.3s; }
.wl-step[data-done] .wl-node { background: var(--co); box-shadow: inset 0 0 0 2px var(--co), 0 1px 3px rgba(212,74,40,0.4); }
.wl-step[data-current] .wl-node { background: #fff; box-shadow: inset 0 0 0 3.5px var(--co), 0 0 0 4px var(--co-tint); }
.wl-step-l { font-size: 10.5px; color: var(--ink-4); font-weight: 550; letter-spacing: -0.005em; }
.wl-step[data-done] .wl-step-l { color: var(--ink-3); }
.wl-step[data-current] .wl-step-l { color: var(--co-deep); font-weight: 700; }
.wl-day-h { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; }
.wl-day-title { font-family: var(--display); font-size: 19px; font-weight: 560; letter-spacing: -0.02em; margin: 0; }
.wl-day-date { font-size: 11.5px; color: var(--ink-3); font-weight: 550; }
.wl-day-lede { font-size: 12.5px; color: var(--ink-2); line-height: 1.4; margin: 0 0 16px; }
.wl-day-lede b { color: var(--ink); font-weight: 650; }
.wl-progress { display: flex; align-items: center; gap: 11px; margin-bottom: 14px; }
.wl-ticks { display: flex; align-items: flex-end; gap: 3px; height: 16px; }
.wl-tick { width: 4px; border-radius: 2px; height: 42%; background: var(--line-strong); transition: height 0.4s cubic-bezier(0.2,0.85,0.25,1), background 0.4s; }
.wl-tick[data-done] { height: 100%; background: linear-gradient(180deg, #4fb084, var(--t-green)); }
.wl-progress-l { font-size: 11.5px; color: var(--ink-3); font-weight: 600; }
.wl-progress-l b { color: var(--ink); }

.wl-list { display: flex; flex-direction: column; flex: 1; }
.wl-item { position: relative; cursor: pointer; padding: 13px 10px; border-radius: var(--r-md); transition: background 0.25s, box-shadow 0.25s; }
.wl-item + .wl-item::before { content: ""; position: absolute; left: 10px; right: 10px; top: 0; height: 1px; background: var(--line-soft); transition: opacity 0.2s; }
.wl-item:hover { background: rgba(255,255,255,0.55); }
.wl-item:hover::before, .wl-item:hover + .wl-item::before { opacity: 0; }
.wl-item[data-open] { background: linear-gradient(180deg, rgba(234,238,243,0.72), rgba(239,242,246,0.5)); box-shadow: inset 0 1px 3px rgba(36,46,66,0.09), inset 0 0 0 0.5px rgba(36,46,66,0.05); }
.wl-item[data-open]::before, .wl-item[data-open] + .wl-item::before { opacity: 0; }
.wl-item-row { display: grid; grid-template-columns: 20px 1fr auto; gap: 11px; align-items: baseline; }
.wl-tick-btn { width: 17px; height: 17px; border-radius: 6px; border: 1.5px solid var(--ink-4); background: rgba(255,255,255,0.5); cursor: pointer; padding: 0; position: relative; display: grid; place-items: center; transition: border-color 0.2s, background 0.2s, transform 0.2s; align-self: start; margin-top: 1px; }
.wl-tick-btn:hover { border-color: var(--co); transform: scale(1.12); }
.wl-tick-btn svg { width: 11px; height: 11px; color: #fff; opacity: 0; transform: scale(0.3); transition: opacity 0.2s, transform 0.3s cubic-bezier(0.2,1.5,0.4,1); }
.wl-item[data-done] .wl-tick-btn { background: var(--t-green); border-color: var(--t-green); }
.wl-item[data-done] .wl-tick-btn svg { opacity: 1; transform: scale(1); }
.wl-item-title { font-size: 13.5px; font-weight: 550; color: var(--ink); line-height: 1.34; letter-spacing: -0.005em; transition: color 0.3s; }
.wl-item[data-done] .wl-item-title { color: var(--ink-4); }
.wl-item-ctx { font-size: 11px; color: var(--ink-3); margin-top: 3px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; }
.wl-item-ctx i { width: 4px; height: 4px; border-radius: 50%; background: var(--tc, var(--ink-4)); }
.wl-item-ctx[data-here] { color: var(--co-deep); } .wl-item-ctx[data-here] i { background: var(--co); }
.wl-item-when { font-size: 11px; font-weight: 600; color: var(--ink-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
.wl-item-when[data-urgent] { color: var(--co-deep); }
.wl-item[data-done] .wl-item-when { color: var(--ink-4); }
.wl-item-exp { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.4s cubic-bezier(0.2,0.85,0.25,1); }
.wl-item[data-open] .wl-item-exp { grid-template-rows: 1fr; }
.wl-item-exp-in { overflow: hidden; min-height: 0; }
.wl-item-exp p { font-size: 12.5px; color: var(--ink-2); line-height: 1.5; margin: 10px 0 0; padding-left: 31px; }
.wl-item-exp-acts { display: flex; gap: 16px; margin: 13px 0 3px; padding-left: 31px; }
.wl-exp-act { font: inherit; font-size: 12.5px; font-weight: 600; color: var(--ink-2); background: none; border: none; cursor: pointer; padding: 0; transition: color 0.16s; }
.wl-exp-act:first-child { color: var(--co-deep); }
.wl-exp-act:hover { color: var(--ink); }
.wl-exp-act:first-child:hover { color: var(--co); }

/* toast */
.wl-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 50; display: flex; align-items: center; gap: 14px; background: rgba(32,37,45,0.92); backdrop-filter: blur(18px) saturate(1.5); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; font-weight: 500; padding: 11px 16px 11px 18px; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 20px 48px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.14); animation: wl-toastin 0.3s cubic-bezier(0.2,0.85,0.25,1); }
.wl-toast svg { width: 15px; height: 15px; color: #64d396; }
.wl-toast button { font: inherit; font-size: 12.5px; font-weight: 700; color: #ff957a; background: none; border: none; cursor: pointer; padding: 0; }
.wl-toast button:hover { text-decoration: underline; text-underline-offset: 2px; }

/* ── dark theme: "the bench at night" (the dramatic peer) ─────────────────── */
.wl-root[data-theme="dark"] {
  --ink: #f3f4f8; --ink-2: rgba(243,244,248,0.64); --ink-3: rgba(243,244,248,0.42); --ink-4: rgba(243,244,248,0.28);
  --line: rgba(255,255,255,0.1); --line-soft: rgba(255,255,255,0.055); --line-strong: rgba(255,255,255,0.2);
  --hi: rgba(255,255,255,0.08);
  --co: #ff7a52; --co-deep: #ff6b4a; --co-tint: rgba(255,138,101,0.18);
  --t-amber: #e4a94a; --t-blue: #5e9bea; --t-green: #46b586; --t-slate: #8891a0; --t-coral: #ff7a52;
  background:
    radial-gradient(780px 540px at 86% -6%, rgba(56,225,255,0.12) 0%, transparent 60%),
    radial-gradient(840px 640px at 3% 104%, rgba(168,255,96,0.08) 0%, transparent 58%),
    radial-gradient(720px 540px at 72% 56%, rgba(255,107,74,0.1) 0%, transparent 60%),
    linear-gradient(170deg, #0b0f19 0%, #0a0e17 58%, #080b12 100%);
}
.wl-root[data-theme="dark"] *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); background-clip: padding-box; }
.wl-root[data-theme="dark"] *::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); background-clip: padding-box; }
.wl-root[data-theme="dark"] .wl-dock { background: linear-gradient(160deg, rgba(46,50,66,0.62), rgba(32,35,49,0.48)); border-color: rgba(255,255,255,0.12); box-shadow: 0 0 0 0.5px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.4), 0 22px 50px -24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14); }
.wl-root[data-theme="dark"] .wl-mark { background: linear-gradient(150deg, #3b4252, #242a33); box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 3px 8px rgba(0,0,0,0.4); }
.wl-root[data-theme="dark"] .wl-nav-ico:hover { background: rgba(255,255,255,0.08); }
.wl-root[data-theme="dark"] .wl-nav-ico[data-on] { background: rgba(255,255,255,0.1); color: var(--co); box-shadow: inset 0 0 0 0.5px var(--line), 0 2px 6px rgba(0,0,0,0.4); }
.wl-root[data-theme="dark"] .wl-bench { background: linear-gradient(176deg, rgba(34,38,52,0.58), rgba(24,27,40,0.5)); backdrop-filter: blur(28px) saturate(1.7); -webkit-backdrop-filter: blur(28px) saturate(1.7); border-color: rgba(255,255,255,0.1); box-shadow: 0 0 0 0.5px rgba(0,0,0,0.4), 0 2px 5px rgba(0,0,0,0.3), 0 30px 70px -36px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.11); }
.wl-root[data-theme="dark"] .wl-day { background: linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.006)); }
.wl-root[data-theme="dark"] .wl-well { background: linear-gradient(180deg, rgba(10,13,22,0.5), rgba(14,17,27,0.34)); box-shadow: inset 0 1px 3px rgba(0,0,0,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.045); }
.wl-root[data-theme="dark"] .wl-item:hover { background: rgba(255,255,255,0.045); }
.wl-root[data-theme="dark"] .wl-item[data-open] { background: linear-gradient(180deg, rgba(0,0,0,0.26), rgba(0,0,0,0.14)); box-shadow: inset 0 1px 3px rgba(0,0,0,0.42), inset 0 0 0 0.5px rgba(255,255,255,0.04); }
.wl-root[data-theme="dark"] .wl-tick-btn { background: rgba(255,255,255,0.06); }
.wl-root[data-theme="dark"] .wl-note[data-side="solicitor"] .wl-note-av { background: rgba(94,155,234,0.2); color: #a3c8f3; }
.wl-root[data-theme="dark"] .wl-note[data-side="seller"] .wl-note-av { background: rgba(94,150,74,0.2); color: #aad88e; }
.wl-root[data-theme="dark"] .wl-client-av { filter: brightness(0.82) saturate(1.1); box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), inset 0 0 0 0.5px rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.35); }
.wl-root[data-theme="dark"] .wl-step .wl-node { background: #22262e; }
.wl-root[data-theme="dark"] .wl-me { background: linear-gradient(150deg, #3b424d, #2a2f38); color: #c9ced6; border-color: rgba(255,255,255,0.12); }
.wl-root[data-theme="dark"] .wl-thumb { box-shadow: 0 1px 3px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.1); }
.wl-root[data-theme="dark"] .wl-theme-btn { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); color: var(--ink-2); }

.wl-theme-btn { width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.6); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; margin-bottom: 8px; transition: color 0.18s, background 0.18s, transform 0.18s; }
.wl-theme-btn:hover { color: var(--co-deep); transform: scale(1.06); }
.wl-theme-btn svg { width: 16px; height: 16px; }

@keyframes wl-rise { from { opacity: 0; transform: translateY(14px); } }
@keyframes wl-kenburns { from { transform: scale(1.07); } to { transform: scale(1); } }
@keyframes wl-toastin { from { opacity: 0; transform: translate(-50%, 12px); } }
@keyframes wl-fadein { from { opacity: 0; } }
.wl-story, .wl-day { animation: wl-fadein 0.4s ease both; }

@media (max-width: 1120px) {
  .wl-bench { grid-template-columns: 1fr; }
  .wl-seam { display: none; }
  .wl-day { border-top: 1px solid var(--line); box-shadow: 0 -1px 0 var(--hi); }
}
@media (max-width: 720px) {
  .wl-shell { grid-template-columns: 1fr; padding: 14px 12px 22px; gap: 14px; }
  .wl-dock { position: static; height: auto; flex-direction: row; border-radius: 20px; padding: 10px 12px; }
  .wl-dock-group, .wl-book { flex-direction: row; }
  .wl-dock-rule, .wl-dock-cap { display: none; }
  .wl-dock-foot { margin-top: 0; margin-left: auto; padding-top: 0; }
  .wl-thumb[data-on]::before { display: none; }
  .wl-thumb-label { display: none; }
  .wl-story { padding: 22px 20px; } .wl-day { padding: 20px; }
  .wl-addr { font-size: 27px; }
  .wl-clients { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .wl-root *, .wl-root *::before, .wl-root *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
`;
