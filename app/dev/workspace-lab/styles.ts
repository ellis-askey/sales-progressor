// Workspace Lab — material system v2. The fix: glass needs something rich behind
// it. The selected property's photo becomes a living, blurred wallpaper; every
// panel is genuinely translucent and floats on it, so colour bleeds through the
// frost and the blur is visible. No faded pills, no serif. Self-contained, /dev only.

export const LAB_CSS = String.raw`
.wl-root {
  --ink: #221c16;
  --ink-2: #5f564b;
  --ink-3: #8a8073;
  --ink-4: #b4ab9d;
  --on-glass: #2a2219;
  --line: rgba(40,28,14,0.12);
  --line-2: rgba(40,28,14,0.07);
  --co: #ff5f3a;
  --co-deep: #e84a22;
  --co-soft: rgba(255,95,58,0.14);
  --t-coral: #ff5f3a;
  --t-amber: #e0912b;
  --t-blue: #3f84d6;
  --t-green: #2fa06a;
  --t-slate: #8a8f9a;
  --display: "Segoe UI Variable Display", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
  --sans: "Segoe UI Variable Text", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;

  /* real vision glass: low-opacity fill + heavy blur + bright specular edge */
  --glass: linear-gradient(140deg, rgba(255,255,255,0.58), rgba(255,255,255,0.34) 60%, rgba(255,255,255,0.42));
  --glass-blur: blur(34px) saturate(2);
  --glass-edge: 1px solid rgba(255,255,255,0.6);
  --glass-shadow:
    0 2px 8px rgba(26,16,6,0.05),
    0 18px 40px -14px rgba(26,16,6,0.24),
    0 42px 80px -40px rgba(26,16,6,0.4),
    inset 0 1px 0 rgba(255,255,255,0.92),
    inset 0 -1px 0 rgba(255,255,255,0.18),
    inset 0 0 0 0.5px rgba(255,255,255,0.3);

  min-height: 100vh;
  font-family: var(--sans);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  background: #eadfd2;
}
.wl-root *::selection { background: rgba(255,95,58,0.22); }
.wl-root *::-webkit-scrollbar { width: 10px; height: 10px; }
.wl-root *::-webkit-scrollbar-thumb { background: rgba(40,28,14,0.18); border-radius: 99px; border: 3px solid transparent; background-clip: padding-box; }
.wl-root *::-webkit-scrollbar-thumb:hover { background: rgba(40,28,14,0.3); background-clip: padding-box; }
.wl-num { font-variant-numeric: tabular-nums; }

/* ── living wallpaper ─────────────────────────────────────────────────────── */
.wl-bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.wl-bg img { position: absolute; top: -8%; left: -8%; width: 116%; height: 116%; object-fit: cover; filter: blur(46px) saturate(1.7) brightness(1.04); transform: scale(1.12); animation: wl-bgfade 0.9s ease both; }
.wl-bg::after {
  content: ""; position: absolute; inset: 0;
  background:
    radial-gradient(1200px 820px at 16% -4%, rgba(255,255,255,0.46), transparent 58%),
    radial-gradient(900px 760px at 100% 104%, rgba(255,255,255,0.22), transparent 54%),
    linear-gradient(176deg, rgba(248,243,235,0.48), rgba(244,237,228,0.6));
}
.wl-bg::before {
  content: ""; position: absolute; inset: 0; z-index: 1; opacity: 0.045; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.wl-shell { position: relative; z-index: 1; display: grid; grid-template-columns: 76px minmax(0,1fr) 376px; gap: 22px; max-width: 1480px; margin: 0 auto; padding: 22px 24px 28px; min-height: 100vh; align-items: start; }

/* ── navigation rail ──────────────────────────────────────────────────────── */
.wl-rail { position: sticky; top: 22px; height: calc(100vh - 50px); background: var(--glass); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); border: var(--glass-edge); border-radius: 28px; box-shadow: var(--glass-shadow); display: flex; flex-direction: column; align-items: center; padding: 15px 0; gap: 8px; animation: wl-rise 0.6s cubic-bezier(0.2,0.85,0.25,1) both; }
.wl-brand { width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(150deg, var(--co), var(--co-deep)); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 17px; box-shadow: 0 6px 16px -3px rgba(232,74,34,0.65), inset 0 1px 0 rgba(255,255,255,0.45); margin-bottom: 7px; letter-spacing: -0.04em; }
.wl-rail-sep { width: 24px; height: 1px; background: rgba(40,28,14,0.14); margin: 1px 0 5px; }
.wl-book { display: flex; flex-direction: column; gap: 12px; flex: 1; justify-content: center; overflow-y: auto; overflow-x: visible; padding: 2px 0; width: 100%; align-items: center; scrollbar-width: none; }
.wl-book::-webkit-scrollbar { display: none; }
.wl-thumb { position: relative; width: 48px; height: 48px; border-radius: 15px; border: none; padding: 0; cursor: pointer; background-size: cover; background-position: center; box-shadow: 0 3px 8px rgba(30,20,8,0.28), inset 0 0 0 1px rgba(255,255,255,0.22); transition: transform 0.3s cubic-bezier(0.2,0.9,0.25,1), box-shadow 0.3s, border-radius 0.3s; outline: none; }
.wl-thumb::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.28)); opacity: 0.55; transition: opacity 0.3s; }
.wl-thumb:hover { transform: translateX(2px) scale(1.07); box-shadow: 0 9px 20px rgba(30,20,8,0.34); }
.wl-thumb:hover::after { opacity: 0.2; }
.wl-thumb[data-on] { transform: scale(1.14); border-radius: 17px; box-shadow: 0 0 0 2.5px var(--co), 0 10px 22px -4px rgba(232,74,34,0.5), inset 0 0 0 1px rgba(255,255,255,0.3); }
.wl-thumb[data-on]::after { opacity: 0; }
.wl-thumb-dot { position: absolute; top: 5px; right: 5px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.95); box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 2; }
.wl-thumb-label { position: absolute; left: 60px; top: 50%; transform: translateY(-50%) translateX(-4px); white-space: nowrap; background: rgba(28,20,12,0.9); backdrop-filter: blur(10px); color: #fff; font-size: 12px; font-weight: 500; padding: 7px 12px; border-radius: 10px; opacity: 0; pointer-events: none; transition: opacity 0.2s, transform 0.2s; box-shadow: 0 10px 24px rgba(0,0,0,0.3); z-index: 20; }
.wl-thumb-label b { font-weight: 650; } .wl-thumb-label span { color: #bcb4a8; }
.wl-thumb-label::before { content: ""; position: absolute; left: -5px; top: 50%; transform: translateY(-50%) rotate(45deg); width: 10px; height: 10px; background: rgba(28,20,12,0.9); border-radius: 2px; }
.wl-thumb:hover .wl-thumb-label { opacity: 1; transform: translateY(-50%) translateX(0); }
.wl-avatar-me { width: 40px; height: 40px; border-radius: 50%; margin-top: 7px; border: 1.5px solid rgba(255,255,255,0.7); background: linear-gradient(150deg, #f6ddbb, #e8b887); color: #7a4a1e; display: grid; place-items: center; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 3px 8px rgba(30,20,8,0.2), inset 0 1px 0 rgba(255,255,255,0.6); transition: transform 0.2s; }
.wl-avatar-me:hover { transform: scale(1.08); }

/* ── stage ────────────────────────────────────────────────────────────────── */
.wl-stage { display: flex; flex-direction: column; gap: 18px; animation: wl-rise 0.6s cubic-bezier(0.2,0.85,0.25,1) 0.08s both; }
.wl-stage-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 6px 6px 0; }
.wl-addr { font-family: var(--display); font-size: 34px; line-height: 1.04; letter-spacing: -0.03em; font-weight: 700; margin: 0; text-shadow: 0 1px 0 rgba(255,255,255,0.4); }
.wl-addr-sub { font-size: 13.5px; color: var(--ink-2); margin: 8px 0 0; font-weight: 500; }
.wl-meta { display: flex; align-items: baseline; gap: 10px; flex-shrink: 0; }
.wl-price { font-family: var(--display); font-size: 21px; font-weight: 700; letter-spacing: -0.02em; color: var(--ink); }
.wl-ten { font-size: 13px; color: var(--ink-3); font-weight: 550; }
.wl-ten::before { content: ""; display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: var(--ink-4); margin: 0 10px 2px 0; vertical-align: middle; }

.wl-photo { position: relative; border-radius: 24px; overflow: hidden; aspect-ratio: 16 / 9; box-shadow: 0 3px 6px rgba(30,20,8,0.12), 0 30px 64px -22px rgba(30,20,8,0.5), inset 0 0 0 1px rgba(255,255,255,0.14); background: #d8cfc2; }
.wl-photo img { width: 100%; height: 100%; object-fit: cover; display: block; animation: wl-kenburns 18s ease-out both; }
.wl-photo::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(18,12,6,0) 44%, rgba(18,12,6,0.56)); pointer-events: none; }
.wl-photo-top { position: absolute; top: 16px; left: 16px; z-index: 2; display: flex; gap: 8px; }
.wl-stagepill { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #fff; background: rgba(28,20,12,0.32); backdrop-filter: blur(16px) saturate(1.6); border: 1px solid rgba(255,255,255,0.28); border-radius: 999px; padding: 7px 13px 7px 11px; box-shadow: 0 6px 18px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.3); }
.wl-stagepill i { width: 7px; height: 7px; border-radius: 50%; background: var(--tc, var(--co)); box-shadow: 0 0 0 3px rgba(255,255,255,0.22); }
.wl-photo-foot { position: absolute; left: 22px; right: 22px; bottom: 18px; z-index: 2; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.wl-photo-status { color: #fff; font-size: 15px; font-weight: 550; letter-spacing: -0.01em; text-shadow: 0 1px 12px rgba(0,0,0,0.5); max-width: 58%; }
.wl-prog { display: flex; flex-direction: column; align-items: flex-end; gap: 7px; }
.wl-prog-l { color: rgba(255,255,255,0.9); font-size: 11.5px; font-weight: 550; text-shadow: 0 1px 8px rgba(0,0,0,0.5); }
.wl-prog-track { width: 156px; height: 5px; border-radius: 99px; background: rgba(255,255,255,0.3); overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18); }
.wl-prog-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #ffdfb0, #fff); box-shadow: 0 0 12px rgba(255,255,255,0.6); transition: width 0.7s cubic-bezier(0.2,0.85,0.25,1); }

.wl-work { background: var(--glass); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); border: var(--glass-edge); border-radius: 26px; box-shadow: var(--glass-shadow); padding: 24px 26px 22px; }
.wl-eyebrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
.wl-eyebrow-l { display: inline-flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.wl-eyebrow-l .wl-ico { width: 28px; height: 28px; border-radius: 10px; display: grid; place-items: center; background: linear-gradient(150deg, var(--co), var(--co-deep)); color: #fff; box-shadow: 0 4px 10px -2px rgba(232,74,34,0.5); }
.wl-eyebrow-l .wl-ico svg { width: 15px; height: 15px; }
.wl-waiting { font-size: 12.5px; color: var(--ink-3); font-weight: 500; }
.wl-waiting b { color: var(--t-amber); font-weight: 700; }
.wl-enq-title { font-family: var(--display); font-size: 22px; font-weight: 680; letter-spacing: -0.025em; margin: 0 0 8px; line-height: 1.18; }
.wl-enq-sum { font-size: 14.5px; color: var(--ink-2); line-height: 1.5; margin: 0 0 18px; max-width: 62ch; }

.wl-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.wl-btn { position: relative; display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: 14px; font-weight: 600; border-radius: 13px; padding: 12px 18px; cursor: pointer; border: 1px solid transparent; overflow: hidden; transition: transform 0.14s, box-shadow 0.2s, background 0.2s, border-color 0.2s; }
.wl-btn svg { width: 16px; height: 16px; position: relative; z-index: 1; }
.wl-btn span, .wl-btn { -webkit-tap-highlight-color: transparent; }
.wl-btn-primary { color: #fff; background: linear-gradient(170deg, #ff7a4d, var(--co-deep)); box-shadow: 0 8px 20px -5px rgba(232,74,34,0.55), inset 0 1px 0 rgba(255,255,255,0.4); }
.wl-btn-primary::after { content: ""; position: absolute; top: 0; left: -60%; width: 40%; height: 100%; background: linear-gradient(100deg, transparent, rgba(255,255,255,0.4), transparent); transform: skewX(-18deg); transition: left 0.6s ease; }
.wl-btn-primary:hover { transform: translateY(-1.5px); box-shadow: 0 13px 28px -6px rgba(232,74,34,0.62), inset 0 1px 0 rgba(255,255,255,0.4); }
.wl-btn-primary:hover::after { left: 130%; }
.wl-btn-primary:active { transform: translateY(0) scale(0.985); }
.wl-btn-ghost { color: var(--ink); background: rgba(255,255,255,0.4); border-color: rgba(255,255,255,0.6); backdrop-filter: blur(8px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.6); }
.wl-btn-ghost:hover { background: rgba(255,255,255,0.72); transform: translateY(-1px); }
.wl-disclose { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 13px; font-weight: 600; color: var(--ink-2); background: none; border: none; cursor: pointer; padding: 8px 4px; transition: color 0.16s; }
.wl-disclose:hover { color: var(--co-deep); }
.wl-disclose svg { width: 14px; height: 14px; transition: transform 0.32s cubic-bezier(0.2,0.85,0.25,1); }
.wl-disclose[data-open] svg { transform: rotate(180deg); }

.wl-reveal { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.44s cubic-bezier(0.2,0.85,0.25,1); }
.wl-reveal[data-open] { grid-template-rows: 1fr; }
.wl-reveal-in { overflow: hidden; min-height: 0; }
.wl-thread { margin: 18px 0 4px; padding-top: 18px; border-top: 1px solid var(--line-2); display: flex; flex-direction: column; gap: 16px; }
.wl-note { display: grid; grid-template-columns: 32px 1fr; gap: 12px; opacity: 0; transform: translateY(6px); animation: wl-notein 0.4s cubic-bezier(0.2,0.85,0.25,1) forwards; }
.wl-reveal[data-open] .wl-note:nth-child(1) { animation-delay: 0.06s; }
.wl-reveal[data-open] .wl-note:nth-child(2) { animation-delay: 0.13s; }
.wl-reveal[data-open] .wl-note:nth-child(3) { animation-delay: 0.2s; }
.wl-note-av { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; font-size: 11px; font-weight: 700; flex-shrink: 0; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5); }
.wl-note[data-side="solicitor"] .wl-note-av { background: #e4edf8; color: #35608f; }
.wl-note[data-side="you"] .wl-note-av { background: linear-gradient(150deg, var(--co), var(--co-deep)); color: #fff; }
.wl-note[data-side="seller"] .wl-note-av { background: #eaf1e2; color: #577033; }
.wl-note-h { display: flex; align-items: baseline; gap: 8px; margin-bottom: 3px; }
.wl-note-from { font-size: 13px; font-weight: 680; color: var(--ink); }
.wl-note-when { font-size: 11.5px; color: var(--ink-4); }
.wl-note-body { font-size: 13.5px; color: var(--ink-2); line-height: 1.5; }
.wl-subacts { display: flex; gap: 18px; margin-top: 16px; padding-left: 44px; }
.wl-subact { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 13px; font-weight: 600; color: var(--ink-2); background: none; border: none; cursor: pointer; padding: 0; transition: color 0.16s; }
.wl-subact:hover { color: var(--co-deep); } .wl-subact svg { width: 14px; height: 14px; }

.wl-people { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--line-2); }
.wl-person { display: flex; align-items: center; gap: 12px; }
.wl-person:nth-child(2) { padding-left: 24px; border-left: 1px solid var(--line-2); }
.wl-person-av { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; font-size: 14px; font-weight: 700; flex-shrink: 0; box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 3px 8px rgba(30,20,8,0.1); }
.wl-person-role { font-size: 11px; color: var(--ink-3); font-weight: 600; }
.wl-person-name { font-size: 15px; font-weight: 650; letter-spacing: -0.01em; margin: 1px 0 2px; }
.wl-person-last { font-size: 12px; color: var(--ink-3); display: inline-flex; align-items: center; gap: 6px; }
.wl-person-last i { width: 6px; height: 6px; border-radius: 50%; }
.wl-st-ok i { background: var(--t-green); } .wl-st-ok { color: var(--ink-3); }
.wl-st-waiting i { background: var(--t-amber); } .wl-st-waiting { color: #a9741f; }
.wl-st-overdue i { background: var(--t-coral); } .wl-st-overdue { color: var(--co-deep); font-weight: 550; }

/* ── today widget ─────────────────────────────────────────────────────────── */
.wl-today { position: sticky; top: 22px; background: var(--glass); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); border: var(--glass-edge); border-radius: 26px; box-shadow: var(--glass-shadow); padding: 23px 20px 16px; display: flex; flex-direction: column; max-height: calc(100vh - 50px); animation: wl-rise 0.6s cubic-bezier(0.2,0.85,0.25,1) 0.16s both; }
.wl-today-h { padding: 2px 6px 16px; }
.wl-greet { font-family: var(--display); font-size: 22px; font-weight: 700; letter-spacing: -0.025em; margin: 0; display: flex; align-items: center; gap: 9px; }
.wl-live { width: 8px; height: 8px; border-radius: 50%; background: var(--co); box-shadow: 0 0 0 0 rgba(255,95,58,0.55); animation: wl-pulse 2.6s ease-out infinite; flex-shrink: 0; }
.wl-greet-sub { font-size: 13px; color: var(--ink-2); margin: 7px 0 0; line-height: 1.45; }
.wl-greet-sub b { color: var(--ink); font-weight: 650; }
.wl-list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; padding: 2px; margin: 0 -2px; flex: 1; }
.wl-item { position: relative; border-radius: 16px; border: 1px solid transparent; padding: 12px; cursor: pointer; transition: background 0.2s, border-color 0.2s, box-shadow 0.2s; }
.wl-item:hover { background: rgba(255,255,255,0.5); border-color: rgba(255,255,255,0.6); box-shadow: 0 8px 20px -10px rgba(30,20,8,0.3), inset 0 1px 0 rgba(255,255,255,0.6); }
.wl-item[data-open] { background: rgba(255,255,255,0.62); border-color: rgba(255,255,255,0.7); box-shadow: 0 12px 30px -12px rgba(30,20,8,0.34), inset 0 1px 0 rgba(255,255,255,0.7); }
.wl-item[data-done] { opacity: 0.5; }
.wl-item[data-related]::before { content: ""; position: absolute; left: 1px; top: 13px; bottom: 13px; width: 3px; border-radius: 2px; background: linear-gradient(var(--co), var(--co-deep)); box-shadow: 0 0 8px rgba(255,95,58,0.5); transition: opacity 0.3s; }
.wl-item[data-related][data-done]::before { opacity: 0; }
.wl-item-row { display: grid; grid-template-columns: 24px 1fr auto; gap: 11px; align-items: start; }
.wl-check { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--ink-4); background: rgba(255,255,255,0.4); cursor: pointer; padding: 0; margin-top: 1px; position: relative; flex-shrink: 0; transition: border-color 0.2s, background 0.2s, transform 0.2s; display: grid; place-items: center; }
.wl-check:hover { border-color: var(--co); transform: scale(1.1); }
.wl-check svg { width: 13px; height: 13px; color: #fff; opacity: 0; transform: scale(0.4); transition: opacity 0.2s, transform 0.32s cubic-bezier(0.2,1.5,0.4,1); }
.wl-item[data-done] .wl-check { background: var(--t-green); border-color: var(--t-green); box-shadow: 0 3px 10px -2px rgba(47,160,106,0.6); }
.wl-item[data-done] .wl-check svg { opacity: 1; transform: scale(1); }
.wl-item-title { font-size: 13.5px; font-weight: 600; color: var(--ink); line-height: 1.35; letter-spacing: -0.005em; position: relative; width: fit-content; }
.wl-item-title::after { content: ""; position: absolute; left: 0; top: 52%; height: 1.5px; width: 100%; background: var(--ink-3); transform: scaleX(0); transform-origin: left; transition: transform 0.34s cubic-bezier(0.2,0.85,0.25,1); }
.wl-item[data-done] .wl-item-title::after { transform: scaleX(1); }
.wl-item-meta { font-size: 11.5px; color: var(--ink-3); margin-top: 3px; display: flex; align-items: center; gap: 7px; font-weight: 500; }
.wl-item-meta i { width: 5px; height: 5px; border-radius: 50%; background: var(--tc, var(--co)); flex-shrink: 0; }
.wl-item-when { font-size: 11.5px; font-weight: 650; color: var(--ink-3); white-space: nowrap; letter-spacing: 0.01em; }
.wl-item-when[data-urgent] { color: var(--co-deep); }
.wl-item-detail { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.4s cubic-bezier(0.2,0.85,0.25,1); }
.wl-item[data-open] .wl-item-detail { grid-template-rows: 1fr; }
.wl-item-detail-in { overflow: hidden; min-height: 0; }
.wl-item-detail p { font-size: 12.5px; color: var(--ink-2); line-height: 1.5; margin: 10px 0 0; padding-left: 35px; }
.wl-item-acts { display: flex; gap: 8px; margin: 12px 0 2px; padding-left: 35px; }
.wl-mini { font: inherit; font-size: 12px; font-weight: 600; color: var(--ink-2); background: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.7); border-radius: 10px; padding: 7px 12px; cursor: pointer; backdrop-filter: blur(6px); transition: all 0.15s; }
.wl-mini:first-child { color: #fff; background: linear-gradient(165deg, var(--co), var(--co-deep)); border-color: transparent; box-shadow: 0 5px 12px -3px rgba(232,74,34,0.5); }
.wl-mini:hover { transform: translateY(-1px); }

.wl-today-foot { display: flex; align-items: center; gap: 12px; padding: 14px 6px 4px; margin-top: 6px; border-top: 1px solid var(--line-2); }
.wl-foot-track { flex: 1; height: 5px; border-radius: 99px; background: rgba(40,28,14,0.1); overflow: hidden; }
.wl-foot-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--t-green), #57c492); transition: width 0.5s cubic-bezier(0.2,0.85,0.25,1); }
.wl-foot-l { font-size: 12px; color: var(--ink-3); font-weight: 550; white-space: nowrap; }
.wl-foot-l b { color: var(--ink); font-weight: 700; }

.wl-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 50; display: flex; align-items: center; gap: 14px; background: rgba(34,28,20,0.86); backdrop-filter: blur(20px) saturate(1.5); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13.5px; font-weight: 500; padding: 12px 17px 12px 19px; border-radius: 14px; box-shadow: 0 20px 50px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.14); animation: wl-toastin 0.3s cubic-bezier(0.2,0.85,0.25,1); }
.wl-toast svg { width: 15px; height: 15px; color: #67d79a; }
.wl-toast button { font: inherit; font-size: 13px; font-weight: 700; color: #ff9578; background: none; border: none; cursor: pointer; padding: 0; }
.wl-toast button:hover { text-decoration: underline; text-underline-offset: 2px; }

@keyframes wl-rise { from { opacity: 0; transform: translateY(16px); } }
@keyframes wl-bgfade { from { opacity: 0; } }
@keyframes wl-kenburns { from { transform: scale(1.09); } to { transform: scale(1); } }
@keyframes wl-notein { to { opacity: 1; transform: none; } }
@keyframes wl-pulse { 0% { box-shadow: 0 0 0 0 rgba(255,95,58,0.55); } 70%, 100% { box-shadow: 0 0 0 8px rgba(255,95,58,0); } }
@keyframes wl-toastin { from { opacity: 0; transform: translate(-50%, 14px); } }

@media (max-width: 1180px) {
  .wl-shell { grid-template-columns: 70px minmax(0,1fr); }
  .wl-today { grid-column: 2 / 3; position: static; max-height: none; margin-top: 2px; }
}
@media (max-width: 760px) {
  .wl-shell { grid-template-columns: 1fr; padding: 16px 14px 24px; gap: 16px; }
  .wl-rail { position: static; height: auto; flex-direction: row; border-radius: 22px; padding: 12px; gap: 10px; }
  .wl-rail-sep { display: none; }
  .wl-book { flex-direction: row; overflow-x: auto; overflow-y: hidden; justify-content: flex-start; }
  .wl-brand { margin-bottom: 0; }
  .wl-avatar-me { margin-top: 0; }
  .wl-today, .wl-stage { grid-column: auto; }
  .wl-addr { font-size: 27px; }
  .wl-stage-head { flex-direction: column; align-items: flex-start; gap: 10px; }
  .wl-people { grid-template-columns: 1fr; }
  .wl-person:nth-child(2) { padding-left: 0; border-left: none; }
  .wl-thumb-label { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .wl-root *, .wl-root *::before, .wl-root *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
`;
