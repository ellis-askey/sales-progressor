// Workspace Lab — bespoke material system for the /dev design experiment.
// A warm, airy "desk" of frosted-glass objects over soft daylight. Light-only by
// deliberate brief ("light, airy, sophisticated"). All classes `wl-` prefixed and
// self-contained; no shared tokens, no liquid-glass kit.

export const LAB_CSS = String.raw`
.wl-root {
  --ink: #2a2520;
  --ink-2: #6b6256;
  --ink-3: #9a9184;
  --ink-4: #beb5a7;
  --line: rgba(54,40,24,0.10);
  --line-2: rgba(54,40,24,0.055);
  --co: #ff6a45;
  --co-deep: #ec5631;
  --co-soft: rgba(255,106,69,0.12);
  --t-coral: #ff6a45;
  --t-amber: #dd9630;
  --t-blue: #4d86c9;
  --t-green: #3a9e6b;
  --t-slate: #8b909a;
  --serif: "Hoefler Text", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
  --glass: linear-gradient(180deg, rgba(255,254,252,0.76), rgba(255,253,249,0.62));
  --glass-br: 1px solid rgba(255,255,255,0.7);
  --elev: 0 1px 1px rgba(60,44,28,0.035), 0 10px 26px -10px rgba(60,44,28,0.10), 0 34px 60px -28px rgba(60,44,28,0.16), inset 0 1px 0 rgba(255,255,255,0.75);
  min-height: 100vh;
  font-family: var(--sans);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  background:
    radial-gradient(1100px 760px at 10% -8%, #fff6ec 0%, transparent 56%),
    radial-gradient(1000px 900px at 102% 108%, #e9edf1 0%, transparent 52%),
    radial-gradient(700px 560px at 78% -2%, rgba(255,106,69,0.06) 0%, transparent 60%),
    linear-gradient(158deg, #f5f0e9, #ece6dd 70%);
  background-attachment: fixed;
}
.wl-root::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.04; mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.wl-root *::selection { background: rgba(255,106,69,0.2); }
.wl-root *::-webkit-scrollbar { width: 10px; height: 10px; }
.wl-root *::-webkit-scrollbar-thumb { background: rgba(54,40,24,0.16); border-radius: 99px; border: 3px solid transparent; background-clip: padding-box; }
.wl-root *::-webkit-scrollbar-thumb:hover { background: rgba(54,40,24,0.26); background-clip: padding-box; }
.wl-num { font-variant-numeric: tabular-nums; }

.wl-shell { position: relative; z-index: 1; display: grid; grid-template-columns: 74px minmax(0,1fr) 372px; gap: 22px; max-width: 1480px; margin: 0 auto; padding: 22px 24px 28px; min-height: 100vh; align-items: start; }

/* ── navigation rail ──────────────────────────────────────────────────────── */
.wl-rail { position: sticky; top: 22px; height: calc(100vh - 50px); background: var(--glass); backdrop-filter: blur(22px) saturate(1.4); -webkit-backdrop-filter: blur(22px) saturate(1.4); border: var(--glass-br); border-radius: 26px; box-shadow: var(--elev); display: flex; flex-direction: column; align-items: center; padding: 16px 0; gap: 8px; animation: wl-rise 0.6s cubic-bezier(0.2,0.85,0.25,1) both; }
.wl-brand { width: 34px; height: 34px; border-radius: 11px; background: linear-gradient(150deg, var(--co), var(--co-deep)); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 16px; box-shadow: 0 5px 14px -3px rgba(236,86,49,0.6), inset 0 1px 0 rgba(255,255,255,0.4); margin-bottom: 8px; letter-spacing: -0.03em; }
.wl-rail-sep { width: 26px; height: 1px; background: var(--line); margin: 2px 0 6px; }
.wl-book { display: flex; flex-direction: column; gap: 11px; flex: 1; justify-content: center; overflow-y: auto; overflow-x: visible; padding: 2px 0; width: 100%; align-items: center; scrollbar-width: none; }
.wl-book::-webkit-scrollbar { display: none; }
.wl-thumb { position: relative; width: 46px; height: 46px; border-radius: 14px; border: none; padding: 0; cursor: pointer; background-size: cover; background-position: center; box-shadow: 0 2px 6px rgba(50,36,20,0.18), inset 0 0 0 1px rgba(255,255,255,0.14); transition: transform 0.28s cubic-bezier(0.2,0.85,0.25,1), box-shadow 0.28s, border-radius 0.28s; outline: none; }
.wl-thumb::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.22)); opacity: 0; transition: opacity 0.28s; }
.wl-thumb:hover { transform: translateX(2px) scale(1.06); box-shadow: 0 7px 16px rgba(50,36,20,0.26); }
.wl-thumb[data-on] { transform: scale(1.12); border-radius: 16px; box-shadow: 0 0 0 2.5px var(--co), 0 8px 18px rgba(236,86,49,0.3), inset 0 0 0 1px rgba(255,255,255,0.2); }
.wl-thumb[data-on]::after { opacity: 1; }
.wl-thumb-dot { position: absolute; top: 5px; right: 5px; width: 9px; height: 9px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.9); box-shadow: 0 1px 2px rgba(0,0,0,0.25); z-index: 2; }
.wl-thumb-label { position: absolute; left: 58px; top: 50%; transform: translateY(-50%) translateX(-4px); white-space: nowrap; background: #2a2520; color: #fff; font-size: 12px; font-weight: 500; padding: 6px 11px; border-radius: 9px; opacity: 0; pointer-events: none; transition: opacity 0.2s, transform 0.2s; box-shadow: 0 8px 20px rgba(0,0,0,0.22); z-index: 20; }
.wl-thumb-label b { font-weight: 600; } .wl-thumb-label span { color: #b9b1a6; }
.wl-thumb-label::before { content: ""; position: absolute; left: -5px; top: 50%; transform: translateY(-50%) rotate(45deg); width: 9px; height: 9px; background: #2a2520; border-radius: 2px; }
.wl-thumb:hover .wl-thumb-label { opacity: 1; transform: translateY(-50%) translateX(0); }
.wl-avatar-me { width: 38px; height: 38px; border-radius: 50%; margin-top: 8px; border: 1px solid var(--line); background: linear-gradient(150deg, #f3d9b8, #e7b98a); color: #7a4e22; display: grid; place-items: center; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255,255,255,0.6); transition: transform 0.2s; }
.wl-avatar-me:hover { transform: scale(1.07); }

/* ── stage: property workspace ────────────────────────────────────────────── */
.wl-stage { display: flex; flex-direction: column; gap: 20px; animation: wl-rise 0.6s cubic-bezier(0.2,0.85,0.25,1) 0.08s both; }
.wl-stage-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 4px 4px 0; }
.wl-addr { font-family: var(--serif); font-size: 31px; line-height: 1.08; letter-spacing: -0.015em; font-weight: 600; margin: 0; }
.wl-addr-sub { font-size: 13.5px; color: var(--ink-3); margin: 7px 0 0; font-weight: 450; }
.wl-meta { display: flex; gap: 8px; flex-shrink: 0; }
.wl-meta-chip { font-size: 12px; font-weight: 550; color: var(--ink-2); background: rgba(255,255,255,0.5); border: 1px solid var(--line); border-radius: 9px; padding: 6px 11px; backdrop-filter: blur(8px); }
.wl-meta-chip b { color: var(--ink); font-weight: 650; }

.wl-photo { position: relative; border-radius: 22px; overflow: hidden; aspect-ratio: 16 / 9; box-shadow: 0 2px 4px rgba(50,36,20,0.08), 0 22px 50px -18px rgba(50,36,20,0.4); background: #ded6ca; }
.wl-photo img { width: 100%; height: 100%; object-fit: cover; display: block; animation: wl-kenburns 16s ease-out both; }
.wl-photo::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,14,8,0) 46%, rgba(20,14,8,0.5)); pointer-events: none; }
.wl-photo-top { position: absolute; top: 16px; left: 16px; z-index: 2; display: flex; gap: 8px; }
.wl-stagepill { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: #fff; background: rgba(28,20,12,0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.22); border-radius: 999px; padding: 6px 12px 6px 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.2); }
.wl-stagepill i { width: 7px; height: 7px; border-radius: 50%; background: var(--tc, var(--co)); box-shadow: 0 0 0 3px rgba(255,255,255,0.18); }
.wl-photo-foot { position: absolute; left: 20px; right: 20px; bottom: 16px; z-index: 2; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.wl-photo-status { color: #fff; font-size: 14.5px; font-weight: 500; letter-spacing: -0.01em; text-shadow: 0 1px 10px rgba(0,0,0,0.4); max-width: 60%; }
.wl-prog { display: flex; flex-direction: column; align-items: flex-end; gap: 7px; }
.wl-prog-l { color: rgba(255,255,255,0.86); font-size: 11.5px; font-weight: 500; text-shadow: 0 1px 6px rgba(0,0,0,0.4); }
.wl-prog-track { width: 150px; height: 5px; border-radius: 99px; background: rgba(255,255,255,0.28); overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15); }
.wl-prog-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #ffd9a8, #fff); transition: width 0.7s cubic-bezier(0.2,0.85,0.25,1); }

/* work panel: enquiry + people */
.wl-work { background: var(--glass); backdrop-filter: blur(22px) saturate(1.4); -webkit-backdrop-filter: blur(22px) saturate(1.4); border: var(--glass-br); border-radius: 24px; box-shadow: var(--elev); padding: 22px 24px 20px; }
.wl-eyebrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.wl-eyebrow-l { display: inline-flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 600; color: var(--ink-2); }
.wl-eyebrow-l .wl-ico { width: 26px; height: 26px; border-radius: 9px; display: grid; place-items: center; background: var(--co-soft); color: var(--co-deep); }
.wl-eyebrow-l .wl-ico svg { width: 15px; height: 15px; }
.wl-waiting { font-size: 12.5px; color: var(--ink-3); font-weight: 500; }
.wl-waiting b { color: var(--t-amber); font-weight: 650; }
.wl-enq-title { font-size: 20px; font-weight: 640; letter-spacing: -0.02em; margin: 0 0 7px; line-height: 1.25; }
.wl-enq-sum { font-size: 14.5px; color: var(--ink-2); line-height: 1.5; margin: 0 0 16px; max-width: 62ch; }

.wl-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.wl-btn { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: 14px; font-weight: 600; border-radius: 12px; padding: 11px 17px; cursor: pointer; border: 1px solid transparent; transition: transform 0.14s, box-shadow 0.18s, background 0.18s, border-color 0.18s; }
.wl-btn svg { width: 16px; height: 16px; }
.wl-btn-primary { color: #fff; background: linear-gradient(170deg, var(--co), var(--co-deep)); box-shadow: 0 6px 18px -4px rgba(236,86,49,0.5), inset 0 1px 0 rgba(255,255,255,0.3); }
.wl-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 10px 24px -5px rgba(236,86,49,0.58), inset 0 1px 0 rgba(255,255,255,0.3); }
.wl-btn-primary:active { transform: translateY(0) scale(0.985); }
.wl-btn-ghost { color: var(--ink); background: rgba(255,255,255,0.55); border-color: var(--line); }
.wl-btn-ghost:hover { background: rgba(255,255,255,0.85); border-color: rgba(54,40,24,0.16); }
.wl-disclose { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 13px; font-weight: 550; color: var(--ink-3); background: none; border: none; cursor: pointer; padding: 8px 4px; transition: color 0.16s; }
.wl-disclose:hover { color: var(--ink); }
.wl-disclose svg { width: 14px; height: 14px; transition: transform 0.3s cubic-bezier(0.2,0.85,0.25,1); }
.wl-disclose[data-open] svg { transform: rotate(180deg); }

/* progressive disclosure: the thread */
.wl-reveal { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.42s cubic-bezier(0.2,0.85,0.25,1); }
.wl-reveal[data-open] { grid-template-rows: 1fr; }
.wl-reveal-in { overflow: hidden; min-height: 0; }
.wl-thread { margin: 18px 0 4px; padding-top: 18px; border-top: 1px solid var(--line-2); display: flex; flex-direction: column; gap: 16px; }
.wl-note { display: grid; grid-template-columns: 30px 1fr; gap: 12px; opacity: 0; transform: translateY(6px); animation: wl-notein 0.4s cubic-bezier(0.2,0.85,0.25,1) forwards; }
.wl-reveal[data-open] .wl-note:nth-child(1) { animation-delay: 0.06s; }
.wl-reveal[data-open] .wl-note:nth-child(2) { animation-delay: 0.13s; }
.wl-reveal[data-open] .wl-note:nth-child(3) { animation-delay: 0.2s; }
.wl-note-av { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.wl-note[data-side="solicitor"] .wl-note-av { background: #e8eef6; color: #39618f; }
.wl-note[data-side="you"] .wl-note-av { background: var(--co-soft); color: var(--co-deep); }
.wl-note[data-side="seller"] .wl-note-av { background: #eef1e8; color: #5a7036; }
.wl-note-h { display: flex; align-items: baseline; gap: 8px; margin-bottom: 3px; }
.wl-note-from { font-size: 13px; font-weight: 640; color: var(--ink); }
.wl-note-when { font-size: 11.5px; color: var(--ink-4); }
.wl-note-body { font-size: 13.5px; color: var(--ink-2); line-height: 1.5; }
.wl-subacts { display: flex; gap: 16px; margin-top: 16px; padding-left: 42px; }
.wl-subact { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 13px; font-weight: 550; color: var(--ink-2); background: none; border: none; cursor: pointer; padding: 0; transition: color 0.16s; }
.wl-subact:hover { color: var(--co-deep); } .wl-subact svg { width: 14px; height: 14px; }

/* people strip */
.wl-people { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--line-2); }
.wl-person { display: flex; align-items: center; gap: 12px; }
.wl-person:nth-child(2) { padding-left: 22px; border-left: 1px solid var(--line-2); }
.wl-person-av { width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; font-size: 14px; font-weight: 700; flex-shrink: 0; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5); }
.wl-person-role { font-size: 10.5px; color: var(--ink-3); font-weight: 600; letter-spacing: 0.02em; }
.wl-person-name { font-size: 14.5px; font-weight: 620; letter-spacing: -0.01em; margin: 1px 0 2px; }
.wl-person-last { font-size: 12px; color: var(--ink-3); display: inline-flex; align-items: center; gap: 6px; }
.wl-person-last i { width: 6px; height: 6px; border-radius: 50%; }
.wl-st-ok i { background: var(--t-green); } .wl-st-ok { color: var(--ink-3); }
.wl-st-waiting i { background: var(--t-amber); } .wl-st-waiting { color: #a9741f; }
.wl-st-overdue i { background: var(--t-coral); } .wl-st-overdue { color: var(--co-deep); }

/* ── today widget ─────────────────────────────────────────────────────────── */
.wl-today { position: sticky; top: 22px; background: var(--glass); backdrop-filter: blur(22px) saturate(1.4); -webkit-backdrop-filter: blur(22px) saturate(1.4); border: var(--glass-br); border-radius: 24px; box-shadow: var(--elev); padding: 22px 20px 16px; display: flex; flex-direction: column; max-height: calc(100vh - 50px); animation: wl-rise 0.6s cubic-bezier(0.2,0.85,0.25,1) 0.16s both; }
.wl-today-h { padding: 2px 4px 16px; }
.wl-greet { font-family: var(--serif); font-size: 21px; font-weight: 600; letter-spacing: -0.01em; margin: 0; display: flex; align-items: center; gap: 9px; }
.wl-live { width: 7px; height: 7px; border-radius: 50%; background: var(--co); box-shadow: 0 0 0 0 rgba(255,106,69,0.5); animation: wl-pulse 2.6s ease-out infinite; }
.wl-greet-sub { font-size: 13px; color: var(--ink-3); margin: 6px 0 0; line-height: 1.45; }
.wl-greet-sub b { color: var(--ink-2); font-weight: 600; }
.wl-list { display: flex; flex-direction: column; gap: 7px; overflow-y: auto; padding: 2px; margin: 0 -2px; flex: 1; }
.wl-item { position: relative; border-radius: 15px; border: 1px solid transparent; padding: 12px 12px 12px 12px; cursor: pointer; transition: background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s; }
.wl-item:hover { background: rgba(255,255,255,0.6); border-color: var(--line-2); box-shadow: 0 6px 16px -8px rgba(60,44,28,0.2); }
.wl-item[data-open] { background: rgba(255,255,255,0.72); border-color: var(--line); box-shadow: 0 10px 26px -12px rgba(60,44,28,0.26); }
.wl-item[data-done] { opacity: 0.55; }
.wl-item[data-related]::before { content: ""; position: absolute; left: 1px; top: 13px; bottom: 13px; width: 3px; border-radius: 2px; background: var(--co); opacity: 0.55; transition: opacity 0.3s; }
.wl-item[data-related][data-done]::before { opacity: 0; }
.wl-item-row { display: grid; grid-template-columns: 24px 1fr auto; gap: 11px; align-items: start; }
.wl-check { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--ink-4); background: transparent; cursor: pointer; padding: 0; margin-top: 1px; position: relative; flex-shrink: 0; transition: border-color 0.2s, background 0.2s, transform 0.2s; display: grid; place-items: center; }
.wl-check:hover { border-color: var(--co); transform: scale(1.08); }
.wl-check svg { width: 13px; height: 13px; color: #fff; opacity: 0; transform: scale(0.4); transition: opacity 0.2s, transform 0.3s cubic-bezier(0.2,1.4,0.4,1); }
.wl-item[data-done] .wl-check { background: var(--t-green); border-color: var(--t-green); }
.wl-item[data-done] .wl-check svg { opacity: 1; transform: scale(1); }
.wl-item-title { font-size: 13.5px; font-weight: 580; color: var(--ink); line-height: 1.35; letter-spacing: -0.005em; position: relative; width: fit-content; }
.wl-item-title::after { content: ""; position: absolute; left: 0; top: 52%; height: 1.5px; width: 100%; background: var(--ink-3); transform: scaleX(0); transform-origin: left; transition: transform 0.32s cubic-bezier(0.2,0.85,0.25,1); }
.wl-item[data-done] .wl-item-title::after { transform: scaleX(1); }
.wl-item-meta { font-size: 11.5px; color: var(--ink-3); margin-top: 3px; display: flex; align-items: center; gap: 7px; }
.wl-item-meta i { width: 5px; height: 5px; border-radius: 50%; background: var(--tc, var(--co)); flex-shrink: 0; }
.wl-item-when { font-size: 11px; font-weight: 600; color: var(--ink-3); background: rgba(54,40,24,0.05); border-radius: 7px; padding: 3px 8px; white-space: nowrap; }
.wl-item-when[data-urgent] { color: var(--co-deep); background: var(--co-soft); }
.wl-item-detail { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.38s cubic-bezier(0.2,0.85,0.25,1); }
.wl-item[data-open] .wl-item-detail { grid-template-rows: 1fr; }
.wl-item-detail-in { overflow: hidden; min-height: 0; }
.wl-item-detail p { font-size: 12.5px; color: var(--ink-2); line-height: 1.5; margin: 10px 0 0; padding-left: 35px; }
.wl-item-acts { display: flex; gap: 8px; margin: 12px 0 2px; padding-left: 35px; }
.wl-mini { font: inherit; font-size: 12px; font-weight: 600; color: var(--ink-2); background: rgba(255,255,255,0.7); border: 1px solid var(--line); border-radius: 9px; padding: 6px 11px; cursor: pointer; transition: all 0.15s; }
.wl-mini:first-child { color: var(--co-deep); border-color: rgba(236,86,49,0.28); background: var(--co-soft); }
.wl-mini:hover { transform: translateY(-1px); box-shadow: 0 5px 12px -5px rgba(60,44,28,0.3); }

.wl-today-foot { display: flex; align-items: center; gap: 12px; padding: 14px 6px 4px; margin-top: 6px; border-top: 1px solid var(--line-2); }
.wl-foot-track { flex: 1; height: 5px; border-radius: 99px; background: rgba(54,40,24,0.08); overflow: hidden; }
.wl-foot-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--t-green), #58c08a); transition: width 0.5s cubic-bezier(0.2,0.85,0.25,1); }
.wl-foot-l { font-size: 12px; color: var(--ink-3); font-weight: 550; white-space: nowrap; }
.wl-foot-l b { color: var(--ink); font-weight: 650; }

/* undo toast */
.wl-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 50; display: flex; align-items: center; gap: 14px; background: rgba(42,37,32,0.92); backdrop-filter: blur(14px); color: #fff; font-size: 13.5px; font-weight: 500; padding: 11px 16px 11px 18px; border-radius: 13px; box-shadow: 0 18px 44px rgba(0,0,0,0.3); animation: wl-toastin 0.3s cubic-bezier(0.2,0.85,0.25,1); }
.wl-toast svg { width: 15px; height: 15px; color: #6fd79b; }
.wl-toast button { font: inherit; font-size: 13px; font-weight: 650; color: #ff9f84; background: none; border: none; cursor: pointer; padding: 0; }
.wl-toast button:hover { text-decoration: underline; text-underline-offset: 2px; }

.wl-devtag { position: fixed; top: 14px; right: 16px; z-index: 40; font-size: 10.5px; letter-spacing: 0.04em; font-weight: 600; color: var(--ink-3); background: rgba(255,255,255,0.6); border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; backdrop-filter: blur(8px); }

@keyframes wl-rise { from { opacity: 0; transform: translateY(16px); } }
@keyframes wl-kenburns { from { transform: scale(1.08); } to { transform: scale(1); } }
@keyframes wl-notein { to { opacity: 1; transform: none; } }
@keyframes wl-pulse { 0% { box-shadow: 0 0 0 0 rgba(255,106,69,0.5); } 70%, 100% { box-shadow: 0 0 0 7px rgba(255,106,69,0); } }
@keyframes wl-toastin { from { opacity: 0; transform: translate(-50%, 14px); } }

/* ── responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 1180px) {
  .wl-shell { grid-template-columns: 68px minmax(0,1fr); }
  .wl-today { grid-column: 2 / 3; position: static; max-height: none; margin-top: 2px; }
}
@media (max-width: 760px) {
  .wl-shell { grid-template-columns: 1fr; padding: 16px 14px 24px; gap: 16px; }
  .wl-rail { position: static; height: auto; flex-direction: row; border-radius: 20px; padding: 12px; gap: 10px; }
  .wl-rail-sep { display: none; }
  .wl-book { flex-direction: row; overflow-x: auto; overflow-y: hidden; }
  .wl-brand { margin-bottom: 0; }
  .wl-avatar-me { margin-top: 0; }
  .wl-today, .wl-stage { grid-column: auto; }
  .wl-addr { font-size: 25px; }
  .wl-stage-head { flex-direction: column; align-items: flex-start; gap: 12px; }
  .wl-people { grid-template-columns: 1fr; }
  .wl-thumb-label { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .wl-root *, .wl-root *::before, .wl-root *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
`;
