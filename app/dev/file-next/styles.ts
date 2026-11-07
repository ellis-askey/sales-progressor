// File Next — the bench + glass material applied to the dense file page.
// Light = pearl calm; dark = the real Liquid Glass material (blue-black base,
// tiered translucent panels, cyan/lime/coral iridescence). Layered materials,
// engraved separators, editorial type, one earned accent. Self-contained, /dev.

export const FILE_CSS = String.raw`
.fn-root {
  --ink: #232831; --ink-2: #596170; --ink-3: #8891a0; --ink-4: #aeb6c2;
  --line: rgba(36,46,66,0.10); --line-soft: rgba(36,46,66,0.06); --line-strong: rgba(36,46,66,0.16);
  --hi: rgba(255,255,255,0.9);
  --co: #e65c38; --co-deep: #d44a28; --co-tint: rgba(230,92,56,0.1);
  --t-amber: #c98a2e; --t-blue: #4a7fc4; --t-green: #3b9b6d; --t-slate: #8891a0; --t-coral: #e65c38;
  --display: "Segoe UI Variable Display", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
  --sans: "Segoe UI Variable Text", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  --r-sm: 10px; --r-md: 14px; --r-lg: 20px; --r-xl: 28px;
  --glass-blur: blur(30px) saturate(1.6);
  min-height: 100vh; font-family: var(--sans); color: var(--ink);
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  background:
    radial-gradient(900px 620px at 88% -6%, #fdeee2 0%, transparent 44%),
    radial-gradient(1100px 820px at 2% 102%, #e4ebf3 0%, transparent 52%),
    radial-gradient(700px 500px at 60% 36%, rgba(255,255,255,0.5) 0%, transparent 60%),
    linear-gradient(168deg, #f4f6f8 0%, #edf0f3 60%, #e9ecf0 100%);
  background-attachment: fixed;
}
.fn-root *::selection { background: rgba(230,92,56,0.18); }
.fn-root *::-webkit-scrollbar { width: 9px; height: 9px; }
.fn-root *::-webkit-scrollbar-thumb { background: rgba(36,46,66,0.16); border-radius: 99px; border: 3px solid transparent; background-clip: padding-box; }
.fn-root *::-webkit-scrollbar-thumb:hover { background: rgba(36,46,66,0.28); background-clip: padding-box; }
.fn-num { font-variant-numeric: tabular-nums; }

/* dark = the real Liquid Glass material */
.fn-root[data-theme="dark"] {
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
.fn-root[data-theme="dark"] *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); background-clip: padding-box; }

.fn-shell { position: relative; z-index: 1; display: grid; grid-template-columns: 72px minmax(0,1fr); gap: 20px; max-width: 1460px; margin: 0 auto; padding: 22px 24px 30px; min-height: 100vh; align-items: start; }

/* dock */
.fn-dock { position: sticky; top: 22px; height: calc(100vh - 52px); display: flex; flex-direction: column; align-items: center; padding: 14px 0 12px;
  background: linear-gradient(160deg, rgba(255,255,255,0.62), rgba(255,255,255,0.4)); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid rgba(255,255,255,0.7); border-radius: 26px; box-shadow: 0 0 0 0.5px rgba(36,46,66,0.05), 0 1px 2px rgba(36,46,66,0.06), 0 22px 50px -24px rgba(36,46,66,0.32), inset 0 1px 0 rgba(255,255,255,0.9); animation: fn-rise 0.55s cubic-bezier(0.2,0.85,0.25,1) both; }
.fn-root[data-theme="dark"] .fn-dock { background: linear-gradient(160deg, rgba(46,50,66,0.62), rgba(32,35,49,0.48)); border-color: rgba(255,255,255,0.12); box-shadow: 0 0 0 0.5px rgba(0,0,0,0.4), 0 22px 50px -24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14); }
.fn-mark { width: 34px; height: 34px; border-radius: 11px; background: linear-gradient(150deg, #2b313c, #1b2028); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 15px; letter-spacing: -0.04em; box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 8px rgba(20,25,35,0.3); }
.fn-root[data-theme="dark"] .fn-mark { background: linear-gradient(150deg, #3b4252, #242a33); }
.fn-dock-rule { width: 24px; height: 1px; margin: 13px 0; background: var(--line); box-shadow: 0 1px 0 var(--hi); }
.fn-back { width: 40px; height: 40px; border-radius: 12px; border: none; background: transparent; color: var(--ink-3); display: grid; place-items: center; cursor: pointer; transition: color 0.18s, background 0.18s; }
.fn-back svg { width: 19px; height: 19px; } .fn-back:hover { color: var(--ink); background: rgba(255,255,255,0.55); }
.fn-root[data-theme="dark"] .fn-back:hover { background: rgba(255,255,255,0.07); }
.fn-dock-sp { flex: 1; }
.fn-theme-btn { width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.6); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; margin-bottom: 8px; transition: color 0.18s, transform 0.18s; }
.fn-root[data-theme="dark"] .fn-theme-btn { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); }
.fn-theme-btn:hover { color: var(--co-deep); transform: scale(1.06); } .fn-theme-btn svg { width: 16px; height: 16px; }
.fn-me { width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.8); background: linear-gradient(150deg, #cdd6e2, #aab6c6); color: #3a434f; display: grid; place-items: center; font-weight: 650; font-size: 12px; cursor: pointer; box-shadow: 0 2px 6px rgba(36,46,66,0.2); }
.fn-root[data-theme="dark"] .fn-me { background: linear-gradient(150deg, #3b424d, #2a2f38); color: #c9ced6; border-color: rgba(255,255,255,0.12); }

/* the bench */
.fn-bench { background: linear-gradient(176deg, rgba(255,255,255,0.78), rgba(252,253,255,0.62)); backdrop-filter: blur(16px) saturate(1.15); -webkit-backdrop-filter: blur(16px) saturate(1.15);
  border: 1px solid rgba(255,255,255,0.85); border-radius: var(--r-xl); overflow: hidden;
  box-shadow: 0 0 0 0.5px rgba(36,46,66,0.055), 0 1px 2px rgba(36,46,66,0.05), 0 30px 70px -36px rgba(36,46,66,0.28), inset 0 1px 0 rgba(255,255,255,0.95); animation: fn-rise 0.55s cubic-bezier(0.2,0.85,0.25,1) 0.06s both; }
.fn-root[data-theme="dark"] .fn-bench { background: linear-gradient(176deg, rgba(34,38,52,0.58), rgba(24,27,40,0.5)); backdrop-filter: blur(28px) saturate(1.7); -webkit-backdrop-filter: blur(28px) saturate(1.7); border-color: rgba(255,255,255,0.1); box-shadow: 0 0 0 0.5px rgba(0,0,0,0.4), 0 30px 70px -36px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.11); }

/* hero */
.fn-hero { padding: 26px 30px 0; }
.fn-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.fn-crumb { font-size: 11.5px; font-weight: 600; color: var(--ink-3); margin: 0 0 7px; }
.fn-addr { font-family: var(--display); font-size: 30px; line-height: 1.03; letter-spacing: -0.025em; font-weight: 380; margin: 0; }
.fn-sub { font-size: 13px; color: var(--ink-3); margin: 8px 0 0; display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.fn-sub b { color: var(--ink-2); font-weight: 600; }
.fn-sub-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--ink-4); }
.fn-price { text-align: right; flex-shrink: 0; }
.fn-price b { font-family: var(--display); font-size: 19px; font-weight: 600; letter-spacing: -0.01em; display: block; }
.fn-price span { font-size: 11.5px; color: var(--ink-3); font-weight: 550; }

.fn-plate { position: relative; margin-top: 18px; border-radius: var(--r-md); overflow: hidden; height: 150px; box-shadow: 0 1px 2px rgba(20,25,35,0.14), 0 10px 26px -14px rgba(20,25,35,0.4), inset 0 0 0 1px rgba(255,255,255,0.22), inset 0 0 0 0.5px rgba(20,25,35,0.14); }
.fn-plate img { width: 100%; height: 100%; object-fit: cover; object-position: center 42%; display: block; }
.fn-plate::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(14,10,8,0.45) 0%, transparent 44%); }
.fn-plate-cap { position: absolute; left: 15px; bottom: 13px; z-index: 2; display: inline-flex; align-items: center; gap: 8px; color: #fff; font-size: 12px; font-weight: 600; }
.fn-plate-cap i { width: 7px; height: 7px; border-radius: 50%; background: var(--tc, var(--co)); box-shadow: 0 0 0 2.5px rgba(255,255,255,0.22); }
.fn-plate-eta { position: absolute; right: 15px; bottom: 13px; z-index: 2; color: rgba(255,255,255,0.85); font-size: 11.5px; font-weight: 550; }

/* milestone strip */
.fn-strip { display: flex; align-items: flex-start; margin: 22px 2px 4px; }
.fn-step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; position: relative; }
.fn-step::before { content: ""; position: absolute; top: 6px; left: -50%; width: 100%; height: 2px; background: var(--line-strong); }
.fn-step:first-child::before { display: none; }
.fn-step[data-done]::before, .fn-step[data-current]::before { background: linear-gradient(90deg, rgba(230,92,56,0.5), var(--co)); }
.fn-node { width: 13px; height: 13px; border-radius: 50%; background: var(--bench-node, #fff); box-shadow: inset 0 0 0 2px var(--line-strong); z-index: 1; }
.fn-root[data-theme="dark"] .fn-node { background: #22262e; }
.fn-step[data-done] .fn-node { background: var(--co); box-shadow: inset 0 0 0 2px var(--co), 0 1px 3px rgba(212,74,40,0.4); }
.fn-step[data-current] .fn-node { background: var(--bench-node, #fff); box-shadow: inset 0 0 0 3.5px var(--co), 0 0 0 4px var(--co-tint); }
.fn-root[data-theme="dark"] .fn-step[data-current] .fn-node { background: #0a0e17; }
.fn-step-l { font-size: 10.5px; font-weight: 550; color: var(--ink-4); }
.fn-step[data-done] .fn-step-l { color: var(--ink-3); }
.fn-step[data-current] .fn-step-l { color: var(--co-deep); font-weight: 700; }
.fn-step-w { font-size: 9.5px; color: var(--ink-4); margin-top: -3px; }

/* tabs */
.fn-tabs { display: flex; gap: 2px; margin: 20px 22px 0; padding: 4px; border-radius: var(--r-md); background: rgba(36,46,66,0.04); width: fit-content; }
.fn-root[data-theme="dark"] .fn-tabs { background: rgba(0,0,0,0.22); }
.fn-tab { font: inherit; font-size: 13px; font-weight: 600; color: var(--ink-3); background: none; border: none; border-radius: 9px; padding: 7px 15px; cursor: pointer; transition: color 0.16s, background 0.16s; display: inline-flex; align-items: center; gap: 7px; }
.fn-tab:hover { color: var(--ink); }
.fn-tab[data-on] { color: var(--ink); background: var(--hi); box-shadow: 0 1px 3px rgba(36,46,66,0.14), inset 0 0 0 0.5px var(--line); }
.fn-root[data-theme="dark"] .fn-tab[data-on] { background: rgba(255,255,255,0.1); box-shadow: inset 0 0 0 0.5px var(--line); }
.fn-tab-count { font-size: 10.5px; font-weight: 700; color: var(--ink-3); background: rgba(36,46,66,0.08); border-radius: 99px; padding: 1px 6px; }
.fn-tab[data-on] .fn-tab-count { color: var(--co-deep); background: var(--co-tint); }

/* body: main | seam | sidebar */
.fn-body { display: grid; grid-template-columns: minmax(0,1fr) 1px 320px; }
.fn-seam { background: linear-gradient(180deg, transparent, var(--line) 10%, var(--line) 90%, transparent); box-shadow: 1px 0 0 var(--hi); }
.fn-main { padding: 24px 30px 30px; min-width: 0; animation: fn-fade 0.35s ease both; }
.fn-side { padding: 24px 22px 28px; min-width: 0; background: linear-gradient(180deg, rgba(238,242,246,0.4), rgba(243,245,248,0.15)); }
.fn-root[data-theme="dark"] .fn-side { background: linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.006)); }

/* overview: summary + next action */
.fn-summary { font-size: 15px; color: var(--ink-2); line-height: 1.55; margin: 0 0 18px; max-width: 60ch; }
.fn-summary b { color: var(--ink); font-weight: 650; }
.fn-next { display: flex; align-items: center; gap: 16px; padding: 15px 16px; border-radius: var(--r-md); background: var(--co-tint); border: 1px solid rgba(230,92,56,0.2); margin-bottom: 26px; }
.fn-root[data-theme="dark"] .fn-next { border-color: rgba(255,122,82,0.26); }
.fn-next-txt { flex: 1; min-width: 0; } .fn-next-txt b { font-size: 13.5px; font-weight: 650; display: block; } .fn-next-txt span { font-size: 12px; color: var(--ink-2); }
.fn-primary { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: 13.5px; font-weight: 600; color: #fff; border: none; cursor: pointer; border-radius: var(--r-sm); padding: 10px 16px; flex-shrink: 0;
  background: linear-gradient(176deg, #ec6a47, var(--co-deep)); box-shadow: 0 1px 1px rgba(150,40,15,0.3), 0 5px 12px -3px rgba(212,74,40,0.5), inset 0 1px 0 rgba(255,255,255,0.35); transition: transform 0.14s, box-shadow 0.2s; }
.fn-primary svg { width: 15px; height: 15px; } .fn-primary:hover { transform: translateY(-1px); } .fn-primary:active { transform: scale(0.985); }

.fn-sec-h { display: flex; align-items: baseline; justify-content: space-between; margin: 0 0 12px; }
.fn-sec-h h3 { font-family: var(--display); font-size: 15px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
.fn-sec-h span { font-size: 11.5px; color: var(--ink-3); font-weight: 550; }

/* enquiry rows */
.fn-enq { border-radius: var(--r-md); overflow: hidden; }
.fn-enq-row { padding: 14px 15px; cursor: pointer; border-radius: var(--r-md); transition: background 0.2s; position: relative; }
.fn-enq-row + .fn-enq-row { margin-top: 2px; }
.fn-enq-row:hover { background: rgba(255,255,255,0.5); }
.fn-root[data-theme="dark"] .fn-enq-row:hover { background: rgba(255,255,255,0.04); }
.fn-enq-row[data-open] { background: linear-gradient(180deg, rgba(234,238,243,0.7), rgba(239,242,246,0.45)); box-shadow: inset 0 1px 3px rgba(36,46,66,0.08), inset 0 0 0 0.5px rgba(36,46,66,0.05); }
.fn-root[data-theme="dark"] .fn-enq-row[data-open] { background: linear-gradient(180deg, rgba(10,13,22,0.5), rgba(14,17,27,0.3)); box-shadow: inset 0 1px 3px rgba(0,0,0,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.045); }
.fn-enq-head { display: grid; grid-template-columns: auto 1fr auto; gap: 11px; align-items: center; }
.fn-enq-state { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.fn-enq-state[data-s="raised"] { background: var(--t-amber); box-shadow: 0 0 0 3px color-mix(in srgb, var(--t-amber) 20%, transparent); }
.fn-enq-state[data-s="replied"] { background: var(--t-blue); }
.fn-enq-state[data-s="resolved"] { background: var(--t-green); }
.fn-enq-title { font-size: 13.5px; font-weight: 600; color: var(--ink); letter-spacing: -0.005em; }
.fn-enq-meta { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }
.fn-enq-tag { font-size: 11px; font-weight: 650; white-space: nowrap; }
.fn-enq-tag[data-s="raised"] { color: var(--co-deep); } .fn-enq-tag[data-s="replied"] { color: var(--t-blue); } .fn-enq-tag[data-s="resolved"] { color: var(--ink-4); }
.fn-enq-exp { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.4s cubic-bezier(0.2,0.85,0.25,1); }
.fn-enq-row[data-open] .fn-enq-exp { grid-template-rows: 1fr; }
.fn-enq-exp-in { overflow: hidden; min-height: 0; }
.fn-note { display: grid; grid-template-columns: 26px 1fr; gap: 10px; padding: 9px 0; }
.fn-note + .fn-note { border-top: 1px solid var(--line-soft); }
.fn-note:first-child { margin-top: 12px; }
.fn-note-av { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
.fn-note[data-side="solicitor"] .fn-note-av { background: #dde7f4; color: #35608f; }
.fn-root[data-theme="dark"] .fn-note[data-side="solicitor"] .fn-note-av { background: rgba(94,155,234,0.2); color: #a3c8f3; }
.fn-note[data-side="you"] .fn-note-av { background: linear-gradient(150deg, var(--co), var(--co-deep)); color: #fff; }
.fn-note[data-side="seller"] .fn-note-av { background: #e3edda; color: #51702f; }
.fn-root[data-theme="dark"] .fn-note[data-side="seller"] .fn-note-av { background: rgba(94,150,74,0.2); color: #aad88e; }
.fn-note-h { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 2px; }
.fn-note-from { font-size: 12.5px; font-weight: 650; } .fn-note-when { font-size: 11px; color: var(--ink-4); }
.fn-note-body { font-size: 12.5px; color: var(--ink-2); line-height: 1.5; }
.fn-note-acts { display: flex; gap: 16px; margin-top: 12px; padding-left: 36px; }
.fn-note-act { font: inherit; font-size: 12px; font-weight: 600; color: var(--ink-2); background: none; border: none; cursor: pointer; padding: 0; } .fn-note-act:first-child { color: var(--co-deep); } .fn-note-act:hover { color: var(--co); }

/* mortgage inline */
.fn-mortgage { margin-top: 26px; padding: 15px 17px; border-radius: var(--r-md); background: rgba(255,255,255,0.45); border: 1px solid var(--line); display: flex; align-items: center; gap: 14px; }
.fn-root[data-theme="dark"] .fn-mortgage { background: rgba(255,255,255,0.03); }
.fn-mortgage-ic { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; background: color-mix(in srgb, var(--t-green) 15%, transparent); color: var(--t-green); flex-shrink: 0; }
.fn-mortgage-ic svg { width: 19px; height: 19px; }
.fn-mortgage b { font-size: 13.5px; font-weight: 650; } .fn-mortgage-sub { font-size: 12px; color: var(--ink-3); margin-top: 1px; }
.fn-mortgage-amt { margin-left: auto; text-align: right; } .fn-mortgage-amt b { font-family: var(--display); font-size: 15px; } .fn-mortgage-amt span { font-size: 11px; color: var(--t-green); font-weight: 600; }

/* activity feed */
.fn-feed { display: flex; flex-direction: column; }
.fn-fitem { display: grid; grid-template-columns: 34px 1fr auto; gap: 13px; padding: 14px 4px; position: relative; }
.fn-fitem + .fn-fitem::before { content: ""; position: absolute; left: 20px; right: 4px; top: 0; height: 1px; background: var(--line-soft); }
.fn-fico { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: rgba(36,46,66,0.05); color: var(--ink-3); }
.fn-root[data-theme="dark"] .fn-fico { background: rgba(255,255,255,0.06); }
.fn-fico svg { width: 17px; height: 17px; } .fn-fico[data-k="reply"], .fn-fico[data-k="call"] { color: var(--t-blue); } .fn-fico[data-k="doc"] { color: var(--t-green); } .fn-fico[data-k="alert"] { color: var(--t-amber); }
.fn-ftext { font-size: 13.5px; color: var(--ink); line-height: 1.4; } .fn-fsub { font-size: 12px; color: var(--ink-3); margin-top: 3px; line-height: 1.45; }
.fn-fmeta { text-align: right; font-size: 11px; color: var(--ink-4); white-space: nowrap; } .fn-fmeta b { display: block; color: var(--ink-3); font-weight: 600; margin-bottom: 1px; }

/* chain */
.fn-chain-lede { font-size: 13.5px; color: var(--ink-2); margin: 0 0 18px; } .fn-chain-lede b { color: var(--ink); font-weight: 650; }
.fn-link { display: grid; grid-template-columns: 22px 1fr auto; gap: 14px; align-items: center; padding: 16px 0; position: relative; }
.fn-link + .fn-link::before { content: ""; position: absolute; left: 10px; top: -16px; height: 16px; width: 2px; background: var(--line-strong); }
.fn-link-node { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--bench-node, #fff); box-shadow: inset 0 0 0 2px var(--line-strong); }
.fn-root[data-theme="dark"] .fn-link-node { background: #22262e; }
.fn-link[data-s="current"] .fn-link-node { box-shadow: inset 0 0 0 3px var(--co), 0 0 0 4px var(--co-tint); }
.fn-link[data-s="ok"] .fn-link-node { background: var(--t-green); box-shadow: none; }
.fn-link-addr { font-size: 14px; font-weight: 600; } .fn-link[data-s="current"] .fn-link-addr { color: var(--co-deep); }
.fn-link-role { font-size: 11.5px; color: var(--ink-3); margin-top: 1px; }
.fn-link-stage { font-size: 11.5px; font-weight: 600; color: var(--ink-2); }

/* documents */
.fn-doc { display: grid; grid-template-columns: 36px 1fr auto; gap: 12px; align-items: center; padding: 12px 4px; border-radius: var(--r-sm); cursor: pointer; transition: background 0.18s; }
.fn-doc:hover { background: rgba(255,255,255,0.5); } .fn-root[data-theme="dark"] .fn-doc:hover { background: rgba(255,255,255,0.04); }
.fn-doc + .fn-doc { border-top: 1px solid var(--line-soft); }
.fn-doc-ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: rgba(36,46,66,0.05); color: var(--ink-3); } .fn-root[data-theme="dark"] .fn-doc-ic { background: rgba(255,255,255,0.06); } .fn-doc-ic svg { width: 17px; height: 17px; }
.fn-doc-name { font-size: 13px; font-weight: 600; } .fn-doc-kind { font-size: 11.5px; color: var(--ink-3); margin-top: 1px; }
.fn-doc-when { font-size: 11px; color: var(--ink-4); }

/* sidebar blocks */
.fn-block + .fn-block { margin-top: 24px; padding-top: 22px; border-top: 1px solid var(--line-soft); }
.fn-block-h { font-size: 11px; font-weight: 700; letter-spacing: 0.02em; color: var(--ink-3); margin: 0 0 14px; }
.fn-party { display: flex; align-items: center; gap: 11px; padding: 7px 0; position: relative; }
.fn-party-av { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; font-size: 12.5px; font-weight: 700; flex-shrink: 0; box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), inset 0 0 0 0.5px rgba(36,46,66,0.08); }
.fn-root[data-theme="dark"] .fn-party-av { filter: brightness(0.82) saturate(1.1); box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), inset 0 0 0 0.5px rgba(255,255,255,0.08); }
.fn-party-role { font-size: 10.5px; color: var(--ink-3); font-weight: 600; }
.fn-party-name { font-size: 13px; font-weight: 600; letter-spacing: -0.005em; margin: 1px 0 1px; }
.fn-party-firm { font-size: 11px; color: var(--ink-4); }
.fn-party-rec { font-size: 11px; color: var(--ink-3); display: inline-flex; align-items: center; gap: 5px; margin-top: 1px; } .fn-party-rec i { width: 5px; height: 5px; border-radius: 50%; }
.fn-rc-ok i { background: var(--t-green); } .fn-rc-waiting i { background: var(--t-amber); } .fn-rc-waiting { color: #a9741f; } .fn-rc-overdue i { background: var(--t-coral); } .fn-rc-overdue { color: var(--co-deep); }
.fn-root[data-theme="dark"] .fn-rc-waiting { color: var(--t-amber); }
.fn-party-do { position: absolute; right: 0; top: 50%; transform: translateY(-50%) scale(0.85); width: 30px; height: 30px; border-radius: 9px; border: 1px solid var(--line); background: rgba(255,255,255,0.65); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; opacity: 0; transition: opacity 0.18s, transform 0.18s; }
.fn-root[data-theme="dark"] .fn-party-do { background: rgba(255,255,255,0.06); }
.fn-party-do svg { width: 14px; height: 14px; } .fn-party:hover .fn-party-do { opacity: 1; transform: translateY(-50%) scale(1); } .fn-party-do:hover { color: var(--co-deep); border-color: var(--co-tint); }

.fn-date { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 9px 0; }
.fn-date + .fn-date { border-top: 1px solid var(--line-soft); }
.fn-date-l { font-size: 12.5px; color: var(--ink-2); } .fn-date-v { font-size: 13px; font-weight: 600; } .fn-date[data-emph] .fn-date-v { color: var(--co-deep); }
.fn-date[data-emph] .fn-date-l { color: var(--ink); font-weight: 550; }

.fn-chainmini-pos { font-size: 12px; color: var(--ink-2); margin: 0 0 12px; line-height: 1.4; } .fn-chainmini-pos b { color: var(--ink); font-weight: 650; }
.fn-chainmini { display: flex; flex-direction: column; gap: 9px; }
.fn-cm { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.fn-cm i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--line-strong); }
.fn-cm[data-s="ok"] i { background: var(--t-green); } .fn-cm[data-s="current"] i { box-shadow: inset 0 0 0 2px var(--co); background: transparent; } .fn-cm[data-s="waiting"] i { background: var(--t-amber); }
.fn-cm b { font-weight: 600; color: var(--ink); } .fn-cm[data-s="current"] b { color: var(--co-deep); } .fn-cm span { color: var(--ink-4); margin-left: auto; }

/* toast */
.fn-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 50; display: flex; align-items: center; gap: 14px; background: rgba(32,37,45,0.92); backdrop-filter: blur(18px) saturate(1.5); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; font-weight: 500; padding: 11px 16px 11px 18px; border-radius: 12px; box-shadow: 0 20px 48px rgba(0,0,0,0.32); animation: fn-toastin 0.3s cubic-bezier(0.2,0.85,0.25,1); }
.fn-toast svg { width: 15px; height: 15px; color: #64d396; }

@keyframes fn-rise { from { opacity: 0; transform: translateY(14px); } }
@keyframes fn-fade { from { opacity: 0; } }
@keyframes fn-toastin { from { opacity: 0; transform: translate(-50%, 12px); } }

@media (max-width: 1080px) {
  .fn-body { grid-template-columns: 1fr; }
  .fn-seam { display: none; }
  .fn-side { border-top: 1px solid var(--line); box-shadow: 0 -1px 0 var(--hi); }
}
@media (max-width: 720px) {
  .fn-shell { grid-template-columns: 1fr; padding: 14px 12px 22px; }
  .fn-dock { position: static; height: auto; flex-direction: row; border-radius: 20px; padding: 10px 12px; }
  .fn-dock-rule { display: none; } .fn-dock-sp { flex: 1; }
  .fn-hero, .fn-main, .fn-side { padding-left: 18px; padding-right: 18px; }
  .fn-addr { font-size: 25px; } .fn-hero-top { flex-direction: column; gap: 10px; }
  .fn-tabs { margin-left: 18px; }
}
@media (prefers-reduced-motion: reduce) { .fn-root *, .fn-root *::before, .fn-root *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; } }
`;
