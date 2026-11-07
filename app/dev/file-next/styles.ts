// File Next — the bench + glass STYLING applied over the real file-page density.
// Nothing removed: app nav, top bar, full hero, 7-step strip, contacts, sale
// health, chain, fees all present, re-skinned in the new language. Light = pearl
// calm; dark = the real Liquid Glass material. Self-contained, /dev only.

export const FILE_CSS = String.raw`
.fn-root {
  --ink: #232831; --ink-2: #596170; --ink-3: #8891a0; --ink-4: #aeb6c2;
  --line: rgba(36,46,66,0.10); --line-soft: rgba(36,46,66,0.06); --line-strong: rgba(36,46,66,0.16);
  --hi: rgba(255,255,255,0.9);
  --co: #e65c38; --co-deep: #d44a28; --co-tint: rgba(230,92,56,0.1);
  --t-amber: #c98a2e; --t-blue: #4a7fc4; --t-green: #3b9b6d; --t-slate: #8891a0; --t-coral: #e65c38;
  --panel: rgba(255,255,255,0.62);
  --display: "Segoe UI Variable Display", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
  --sans: "Segoe UI Variable Text", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  --r-sm: 10px; --r-md: 14px; --r-lg: 20px; --r-xl: 26px;
  --glass-blur: blur(30px) saturate(1.6);
  min-height: 100vh; font-family: var(--sans); color: var(--ink);
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  background:
    radial-gradient(900px 620px at 88% -6%, #fdeee2 0%, transparent 44%),
    radial-gradient(1100px 820px at 2% 102%, #e4ebf3 0%, transparent 52%),
    linear-gradient(168deg, #f4f6f8 0%, #edf0f3 60%, #e9ecf0 100%);
  background-attachment: fixed;
}
.fn-root[data-theme="dark"] {
  --ink: #f3f4f8; --ink-2: rgba(243,244,248,0.64); --ink-3: rgba(243,244,248,0.42); --ink-4: rgba(243,244,248,0.28);
  --line: rgba(255,255,255,0.1); --line-soft: rgba(255,255,255,0.055); --line-strong: rgba(255,255,255,0.2);
  --hi: rgba(255,255,255,0.08);
  --co: #ff7a52; --co-deep: #ff6b4a; --co-tint: rgba(255,138,101,0.18);
  --t-amber: #e4a94a; --t-blue: #5e9bea; --t-green: #46b586; --t-slate: #8891a0; --t-coral: #ff7a52;
  --panel: rgba(255,255,255,0.04);
  background:
    radial-gradient(780px 540px at 86% -6%, rgba(56,225,255,0.12) 0%, transparent 60%),
    radial-gradient(840px 640px at 3% 104%, rgba(168,255,96,0.08) 0%, transparent 58%),
    radial-gradient(720px 540px at 72% 56%, rgba(255,107,74,0.1) 0%, transparent 60%),
    linear-gradient(170deg, #0b0f19 0%, #0a0e17 58%, #080b12 100%);
}
.fn-root *::selection { background: rgba(230,92,56,0.18); }
.fn-root *::-webkit-scrollbar { width: 9px; height: 9px; }
.fn-root *::-webkit-scrollbar-thumb { background: rgba(36,46,66,0.16); border-radius: 99px; border: 3px solid transparent; background-clip: padding-box; }
.fn-root[data-theme="dark"] *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); background-clip: padding-box; }
.fn-num { font-variant-numeric: tabular-nums; }

.fn-app { display: grid; grid-template-columns: 216px minmax(0,1fr); min-height: 100vh; max-width: 1560px; margin: 0 auto; }

/* ── app nav ──────────────────────────────────────────────────────────────── */
.fn-nav { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; padding: 18px 14px; gap: 3px; overflow-y: auto; }
.fn-brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 16px; }
.fn-brand-mark { width: 30px; height: 30px; border-radius: 9px; background: linear-gradient(150deg, var(--co), var(--co-deep)); display: grid; place-items: center; color: #fff; box-shadow: 0 4px 10px -2px rgba(212,74,40,0.5); } .fn-brand-mark svg { width: 17px; height: 17px; }
.fn-brand b { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }
.fn-navnew { display: flex; align-items: center; gap: 10px; font: inherit; font-size: 13.5px; font-weight: 650; color: #fff; background: linear-gradient(170deg, #ec6a47, var(--co-deep)); border: none; border-radius: var(--r-sm); padding: 10px 14px; cursor: pointer; box-shadow: 0 5px 12px -3px rgba(212,74,40,0.5), inset 0 1px 0 rgba(255,255,255,0.3); margin-bottom: 8px; transition: transform 0.14s; } .fn-navnew:hover { transform: translateY(-1px); } .fn-navnew svg { width: 16px; height: 16px; }
.fn-navitem { display: flex; align-items: center; gap: 11px; font: inherit; font-size: 13.5px; font-weight: 550; color: var(--ink-2); background: none; border: none; border-radius: var(--r-sm); padding: 9px 12px; cursor: pointer; transition: color 0.16s, background 0.16s; width: 100%; text-align: left; }
.fn-navitem svg { width: 18px; height: 18px; color: var(--ink-3); flex-shrink: 0; }
.fn-navitem:hover { background: var(--panel); color: var(--ink); }
.fn-navitem[data-on] { background: var(--co-tint); color: var(--co-deep); font-weight: 650; } .fn-navitem[data-on] svg { color: var(--co-deep); }
.fn-navitem-count { margin-left: auto; font-size: 11px; font-weight: 700; color: #fff; background: var(--co); border-radius: 99px; padding: 1px 7px; }
.fn-navitem[data-on] .fn-navitem-count { background: var(--co-deep); }

/* ── top bar + content ────────────────────────────────────────────────────── */
.fn-content { min-width: 0; padding: 0 22px 30px 8px; }
.fn-topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 14px; padding: 16px 2px; }
.fn-search { flex: 1; max-width: 460px; display: flex; align-items: center; gap: 10px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 9px 14px; color: var(--ink-3); backdrop-filter: blur(10px); }
.fn-search svg { width: 16px; height: 16px; } .fn-search input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: var(--ink); font: inherit; font-size: 13.5px; } .fn-search input::placeholder { color: var(--ink-4); }
.fn-search kbd { font-size: 10.5px; font-weight: 600; color: var(--ink-3); background: rgba(36,46,66,0.06); border-radius: 5px; padding: 2px 6px; }
.fn-topsp { flex: 1; }
.fn-asof { font-size: 12px; color: var(--ink-3); }
.fn-iconbtn { width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; transition: color 0.16s, transform 0.16s; } .fn-iconbtn:hover { color: var(--co-deep); transform: scale(1.05); } .fn-iconbtn svg { width: 17px; height: 17px; }
.fn-user { display: flex; align-items: center; gap: 9px; background: var(--panel); border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px 4px 4px; cursor: pointer; }
.fn-user-av { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(150deg, #cdd6e2, #aab6c6); color: #3a434f; display: grid; place-items: center; font-size: 11px; font-weight: 700; } .fn-root[data-theme="dark"] .fn-user-av { background: linear-gradient(150deg, #3b424d, #2a2f38); color: #c9ced6; }
.fn-user span { font-size: 13px; font-weight: 600; } .fn-user svg { width: 13px; height: 13px; color: var(--ink-3); }

/* ── bench ────────────────────────────────────────────────────────────────── */
.fn-bench { background: linear-gradient(176deg, rgba(255,255,255,0.78), rgba(252,253,255,0.62)); backdrop-filter: blur(16px) saturate(1.15); -webkit-backdrop-filter: blur(16px) saturate(1.15);
  border: 1px solid rgba(255,255,255,0.85); border-radius: var(--r-xl); overflow: hidden;
  box-shadow: 0 0 0 0.5px rgba(36,46,66,0.055), 0 1px 2px rgba(36,46,66,0.05), 0 30px 70px -36px rgba(36,46,66,0.28), inset 0 1px 0 rgba(255,255,255,0.95); animation: fn-rise 0.5s cubic-bezier(0.2,0.85,0.25,1) both; }
.fn-root[data-theme="dark"] .fn-bench { background: linear-gradient(176deg, rgba(34,38,52,0.58), rgba(24,27,40,0.5)); backdrop-filter: blur(28px) saturate(1.7); -webkit-backdrop-filter: blur(28px) saturate(1.7); border-color: rgba(255,255,255,0.1); box-shadow: 0 0 0 0.5px rgba(0,0,0,0.4), 0 30px 70px -36px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.11); }

/* hero */
.fn-hero { padding: 24px 28px 0; }
.fn-hero-grid { display: grid; grid-template-columns: 272px 1fr; gap: 24px; }
.fn-photo { position: relative; border-radius: var(--r-md); overflow: hidden; height: 186px; box-shadow: 0 1px 2px rgba(20,25,35,0.14), 0 10px 26px -14px rgba(20,25,35,0.4), inset 0 0 0 0.5px rgba(20,25,35,0.14); }
.fn-photo img { width: 100%; height: 100%; object-fit: cover; }
.fn-photo-back { position: absolute; top: 12px; left: 12px; z-index: 2; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #fff; background: rgba(28,20,12,0.4); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); border-radius: 999px; padding: 6px 12px 6px 10px; cursor: pointer; } .fn-photo-back svg { width: 14px; height: 14px; }
.fn-hero-info { min-width: 0; }
.fn-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.fn-status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 650; color: var(--t-green); background: color-mix(in srgb, var(--t-green) 14%, transparent); border-radius: 999px; padding: 5px 12px; } .fn-status i { width: 7px; height: 7px; border-radius: 50%; background: var(--t-green); }
.fn-pct { text-align: right; } .fn-pct b { font-family: var(--display); font-size: 14px; font-weight: 650; } .fn-pct-bar { width: 150px; height: 6px; border-radius: 99px; background: rgba(36,46,66,0.1); margin-top: 5px; overflow: hidden; } .fn-root[data-theme="dark"] .fn-pct-bar { background: rgba(255,255,255,0.1); } .fn-pct-bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--co-deep), var(--co)); }
.fn-addr { font-family: var(--display); font-size: 30px; line-height: 1.02; letter-spacing: -0.025em; font-weight: 380; margin: 10px 0 2px; }
.fn-addr-sub { font-size: 13px; color: var(--ink-3); font-weight: 500; }
.fn-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 18px 0 14px; }
.fn-meta-item { display: flex; align-items: center; gap: 10px; }
.fn-meta-ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--panel); border: 1px solid var(--line); color: var(--ink-3); flex-shrink: 0; } .fn-meta-ic svg { width: 16px; height: 16px; }
.fn-meta-l { font-size: 10.5px; color: var(--ink-3); font-weight: 550; } .fn-meta-v { font-size: 13.5px; font-weight: 650; letter-spacing: -0.005em; margin-top: 1px; }
.fn-hero-foot { display: flex; align-items: center; gap: 14px; padding: 14px 0 20px; border-top: 1px solid var(--line-soft); }
.fn-managing { display: flex; align-items: center; gap: 9px; } .fn-managing-av { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(150deg, #f6ddbb, #e8b887); color: #7a4a1e; display: grid; place-items: center; font-size: 11px; font-weight: 700; } .fn-managing b { font-size: 12.5px; font-weight: 650; display: block; } .fn-managing span { font-size: 11px; color: var(--ink-3); }
.fn-onfile { font-size: 11.5px; color: var(--ink-3); } .fn-onfile b { color: var(--ink-2); font-weight: 600; }
.fn-managedby { margin-left: auto; font-size: 11.5px; font-weight: 650; color: #fff; background: linear-gradient(150deg, var(--co), var(--co-deep)); border-radius: 999px; padding: 6px 13px; }

/* 7-step strip */
.fn-strip { display: flex; align-items: flex-start; margin: 20px 2px 2px; }
.fn-step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 7px; position: relative; }
.fn-step::before { content: ""; position: absolute; top: 15px; left: -50%; width: 100%; height: 2px; background: var(--line-strong); }
.fn-step:first-child::before { display: none; }
.fn-step[data-done]::before { background: var(--t-green); }
.fn-step[data-current]::before { background: linear-gradient(90deg, var(--t-green), var(--co)); }
.fn-stepnode { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 700; z-index: 1; background: var(--panel); border: 1.5px solid var(--line-strong); color: var(--ink-3); }
.fn-step[data-done] .fn-stepnode { background: var(--t-green); border-color: var(--t-green); color: #fff; }
.fn-step[data-current] .fn-stepnode { background: var(--co); border-color: var(--co); color: #fff; box-shadow: 0 0 0 4px var(--co-tint); }
.fn-stepnode svg { width: 15px; height: 15px; }
.fn-step-l { font-size: 11px; font-weight: 600; color: var(--ink-2); } .fn-step[data-current] .fn-step-l { color: var(--co-deep); }
.fn-step-w { font-size: 10px; color: var(--ink-4); }
.fn-step[data-current] .fn-step-w { color: var(--co-deep); font-weight: 600; }

/* banner */
.fn-banner { display: flex; align-items: flex-start; gap: 12px; margin: 20px 28px 0; padding: 13px 16px; border-radius: var(--r-md); background: color-mix(in srgb, var(--t-amber) 12%, transparent); border: 1px solid color-mix(in srgb, var(--t-amber) 26%, transparent); }
.fn-banner svg { width: 18px; height: 18px; color: var(--t-amber); flex-shrink: 0; margin-top: 1px; }
.fn-banner b { font-size: 13.5px; font-weight: 650; display: block; } .fn-banner span { font-size: 12.5px; color: var(--ink-2); }

/* tabs */
.fn-tabs { display: flex; gap: 2px; margin: 20px 28px 0; padding: 4px; border-radius: var(--r-md); background: rgba(36,46,66,0.04); width: fit-content; }
.fn-root[data-theme="dark"] .fn-tabs { background: rgba(0,0,0,0.22); }
.fn-tab { font: inherit; font-size: 13px; font-weight: 600; color: var(--ink-3); background: none; border: none; border-radius: 9px; padding: 7px 15px; cursor: pointer; transition: color 0.16s, background 0.16s; display: inline-flex; align-items: center; gap: 7px; }
.fn-tab:hover { color: var(--ink); } .fn-tab[data-on] { color: var(--ink); background: var(--hi); box-shadow: 0 1px 3px rgba(36,46,66,0.14), inset 0 0 0 0.5px var(--line); }
.fn-root[data-theme="dark"] .fn-tab[data-on] { background: rgba(255,255,255,0.1); }
.fn-tab-count { font-size: 10.5px; font-weight: 700; color: var(--ink-3); background: rgba(36,46,66,0.08); border-radius: 99px; padding: 1px 6px; } .fn-tab[data-on] .fn-tab-count { color: var(--co-deep); background: var(--co-tint); }

/* body */
.fn-body { display: grid; grid-template-columns: minmax(0,1fr) 1px 304px; }
.fn-seam { background: linear-gradient(180deg, transparent, var(--line) 8%, var(--line) 92%, transparent); box-shadow: 1px 0 0 var(--hi); }
.fn-main { padding: 22px 28px 28px; min-width: 0; animation: fn-fade 0.35s ease both; }
.fn-side { padding: 22px 20px 26px; min-width: 0; background: linear-gradient(180deg, rgba(238,242,246,0.4), rgba(243,245,248,0.15)); }
.fn-root[data-theme="dark"] .fn-side { background: linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.006)); }
.fn-sec-h { display: flex; align-items: baseline; justify-content: space-between; margin: 0 0 12px; }
.fn-sec-h h3 { font-family: var(--display); font-size: 15px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
.fn-sec-h span { font-size: 11.5px; color: var(--ink-3); font-weight: 550; } .fn-sec-h .fn-link-act { color: var(--co-deep); cursor: pointer; font-weight: 600; }
.fn-sp24 { height: 26px; }

/* next action */
.fn-next { display: flex; align-items: center; gap: 16px; padding: 15px 16px; border-radius: var(--r-md); background: var(--co-tint); border: 1px solid rgba(230,92,56,0.2); margin-bottom: 24px; }
.fn-root[data-theme="dark"] .fn-next { border-color: rgba(255,122,82,0.26); }
.fn-next-txt { flex: 1; min-width: 0; } .fn-next-txt b { font-size: 13.5px; font-weight: 650; display: block; } .fn-next-txt span { font-size: 12px; color: var(--ink-2); }
.fn-primary { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: 13.5px; font-weight: 600; color: #fff; border: none; cursor: pointer; border-radius: var(--r-sm); padding: 10px 16px; flex-shrink: 0; background: linear-gradient(176deg, #ec6a47, var(--co-deep)); box-shadow: 0 1px 1px rgba(150,40,15,0.3), 0 5px 12px -3px rgba(212,74,40,0.5), inset 0 1px 0 rgba(255,255,255,0.35); transition: transform 0.14s; } .fn-primary svg { width: 15px; height: 15px; } .fn-primary:hover { transform: translateY(-1px); }

/* contacts */
.fn-ctoggle { display: inline-flex; gap: 2px; padding: 3px; border-radius: var(--r-sm); background: rgba(36,46,66,0.05); margin-bottom: 14px; } .fn-root[data-theme="dark"] .fn-ctoggle { background: rgba(0,0,0,0.22); }
.fn-ctoggle button { font: inherit; font-size: 12.5px; font-weight: 600; color: var(--ink-3); background: none; border: none; border-radius: 7px; padding: 6px 14px; cursor: pointer; } .fn-ctoggle button[data-on] { color: var(--co-deep); background: var(--hi); box-shadow: 0 1px 2px rgba(36,46,66,0.12); } .fn-root[data-theme="dark"] .fn-ctoggle button[data-on] { background: rgba(255,255,255,0.1); }
.fn-contact { display: flex; align-items: center; gap: 12px; padding: 12px 4px; } .fn-contact + .fn-contact { border-top: 1px solid var(--line-soft); }
.fn-contact-av { width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; font-size: 13px; font-weight: 700; flex-shrink: 0; box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), inset 0 0 0 0.5px rgba(36,46,66,0.08); position: relative; } .fn-root[data-theme="dark"] .fn-contact-av { filter: brightness(0.82) saturate(1.1); }
.fn-contact-av i { position: absolute; bottom: -1px; right: -1px; width: 11px; height: 11px; border-radius: 50%; border: 2px solid var(--bench-edge, #fbfcff); }
.fn-rc-ok i { background: var(--t-green); } .fn-rc-waiting i { background: var(--t-amber); } .fn-rc-overdue i { background: var(--t-coral); }
.fn-contact-role { font-size: 10.5px; color: var(--ink-3); font-weight: 600; } .fn-contact-name { font-size: 14px; font-weight: 620; letter-spacing: -0.01em; margin: 1px 0; } .fn-contact-phone { font-size: 11.5px; color: var(--ink-3); } .fn-num { font-variant-numeric: tabular-nums; }
.fn-contact-acts { margin-left: auto; display: flex; gap: 6px; }
.fn-cact { width: 32px; height: 32px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; transition: color 0.15s, border-color 0.15s, transform 0.15s; } .fn-cact:hover { color: var(--co-deep); border-color: var(--co-tint); transform: translateY(-1px); } .fn-cact svg { width: 15px; height: 15px; }

/* enquiries (reused) */
.fn-enq-row { padding: 14px 15px; cursor: pointer; border-radius: var(--r-md); transition: background 0.2s; }
.fn-enq-row + .fn-enq-row { margin-top: 2px; }
.fn-enq-row:hover { background: var(--panel); }
.fn-enq-row[data-open] { background: linear-gradient(180deg, rgba(234,238,243,0.7), rgba(239,242,246,0.45)); box-shadow: inset 0 1px 3px rgba(36,46,66,0.08), inset 0 0 0 0.5px rgba(36,46,66,0.05); }
.fn-root[data-theme="dark"] .fn-enq-row[data-open] { background: linear-gradient(180deg, rgba(10,13,22,0.5), rgba(14,17,27,0.3)); box-shadow: inset 0 1px 3px rgba(0,0,0,0.45); }
.fn-enq-head { display: grid; grid-template-columns: auto 1fr auto; gap: 11px; align-items: center; }
.fn-enq-state { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; } .fn-enq-state[data-s="raised"] { background: var(--t-amber); box-shadow: 0 0 0 3px color-mix(in srgb, var(--t-amber) 20%, transparent); } .fn-enq-state[data-s="replied"] { background: var(--t-blue); } .fn-enq-state[data-s="resolved"] { background: var(--t-green); }
.fn-enq-title { font-size: 13.5px; font-weight: 600; letter-spacing: -0.005em; } .fn-enq-meta { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }
.fn-enq-tag { font-size: 11px; font-weight: 650; white-space: nowrap; } .fn-enq-tag[data-s="raised"] { color: var(--co-deep); } .fn-enq-tag[data-s="replied"] { color: var(--t-blue); } .fn-enq-tag[data-s="resolved"] { color: var(--ink-4); }
.fn-enq-exp { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.4s cubic-bezier(0.2,0.85,0.25,1); } .fn-enq-row[data-open] .fn-enq-exp { grid-template-rows: 1fr; } .fn-enq-exp-in { overflow: hidden; min-height: 0; }
.fn-note { display: grid; grid-template-columns: 26px 1fr; gap: 10px; padding: 9px 0; } .fn-note + .fn-note { border-top: 1px solid var(--line-soft); } .fn-note:first-child { margin-top: 12px; }
.fn-note-av { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
.fn-note[data-side="solicitor"] .fn-note-av { background: #dde7f4; color: #35608f; } .fn-root[data-theme="dark"] .fn-note[data-side="solicitor"] .fn-note-av { background: rgba(94,155,234,0.2); color: #a3c8f3; }
.fn-note[data-side="you"] .fn-note-av { background: linear-gradient(150deg, var(--co), var(--co-deep)); color: #fff; }
.fn-note[data-side="seller"] .fn-note-av { background: #e3edda; color: #51702f; } .fn-root[data-theme="dark"] .fn-note[data-side="seller"] .fn-note-av { background: rgba(94,150,74,0.2); color: #aad88e; }
.fn-note-h { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 2px; } .fn-note-from { font-size: 12.5px; font-weight: 650; } .fn-note-when { font-size: 11px; color: var(--ink-4); } .fn-note-body { font-size: 12.5px; color: var(--ink-2); line-height: 1.5; }
.fn-note-acts { display: flex; gap: 16px; margin-top: 12px; padding-left: 36px; } .fn-note-act { font: inherit; font-size: 12px; font-weight: 600; color: var(--ink-2); background: none; border: none; cursor: pointer; padding: 0; } .fn-note-act:first-child { color: var(--co-deep); }

/* chain cards */
.fn-chaincards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.fn-cc { position: relative; border-radius: var(--r-md); overflow: hidden; height: 150px; cursor: pointer; box-shadow: inset 0 0 0 0.5px rgba(36,46,66,0.14); transition: transform 0.2s, box-shadow 0.2s; }
.fn-cc:hover { transform: translateY(-2px); box-shadow: 0 12px 26px -12px rgba(36,46,66,0.4); }
.fn-cc img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.fn-cc::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(14,16,24,0.15), rgba(14,16,24,0.78)); }
.fn-cc[data-s="current"] { box-shadow: 0 0 0 2px var(--co), 0 12px 26px -10px rgba(212,74,40,0.4); }
.fn-cc:not([data-s="current"]) img { filter: grayscale(0.4) brightness(0.9); }
.fn-cc-in { position: absolute; inset: 0; z-index: 2; padding: 13px; display: flex; flex-direction: column; justify-content: flex-end; color: #fff; }
.fn-cc-tag { position: absolute; top: 12px; left: 12px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: rgba(255,255,255,0.85); }
.fn-cc[data-s="current"] .fn-cc-tag { color: #fff; background: var(--co); padding: 3px 8px; border-radius: 99px; }
.fn-cc-pct { position: absolute; top: 11px; right: 12px; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fn-cc-addr { font-size: 14px; font-weight: 680; letter-spacing: -0.01em; } .fn-cc-sub { font-size: 11.5px; color: rgba(255,255,255,0.82); margin-top: 2px; }

/* activity */
.fn-feed { display: flex; flex-direction: column; }
.fn-fitem { display: grid; grid-template-columns: 34px 1fr auto; gap: 13px; padding: 14px 4px; position: relative; }
.fn-fitem + .fn-fitem::before { content: ""; position: absolute; left: 20px; right: 4px; top: 0; height: 1px; background: var(--line-soft); }
.fn-fico { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--panel); color: var(--ink-3); } .fn-fico svg { width: 17px; height: 17px; } .fn-fico[data-k="reply"], .fn-fico[data-k="call"] { color: var(--t-blue); } .fn-fico[data-k="doc"] { color: var(--t-green); } .fn-fico[data-k="alert"] { color: var(--t-amber); }
.fn-ftext { font-size: 13.5px; line-height: 1.4; } .fn-fsub { font-size: 12px; color: var(--ink-3); margin-top: 3px; line-height: 1.45; }
.fn-fmeta { text-align: right; font-size: 11px; color: var(--ink-4); white-space: nowrap; } .fn-fmeta b { display: block; color: var(--ink-3); font-weight: 600; margin-bottom: 1px; }

/* property data */
.fn-pdata { border-radius: var(--r-md); overflow: hidden; border: 1px solid var(--line); }
.fn-prow { display: flex; justify-content: space-between; align-items: center; padding: 13px 16px; font-size: 13.5px; } .fn-prow + .fn-prow { border-top: 1px solid var(--line-soft); } .fn-prow span { color: var(--ink-2); } .fn-prow b { font-weight: 650; }
.fn-psource { font-size: 11px; color: var(--ink-4); padding: 12px 16px; border-top: 1px solid var(--line-soft); }

/* sidebar blocks */
.fn-block + .fn-block { margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--line-soft); }
.fn-block-h { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--ink-2); margin: 0 0 14px; } .fn-block-h svg { width: 16px; height: 16px; color: var(--ink-3); }
.fn-health-status { font-size: 15px; font-weight: 700; color: var(--co-deep); margin-left: auto; }
.fn-metric { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; font-size: 12.5px; } .fn-metric span { color: var(--ink-2); } .fn-metric b { font-weight: 650; }
.fn-scorebar { display: flex; height: 7px; border-radius: 99px; overflow: hidden; margin: 14px 0 12px; } .fn-scorebar i { display: block; height: 100%; } .fn-scorebar .s-coral { background: var(--co); } .fn-scorebar .s-amber { background: var(--t-amber); }
.fn-scoreitem { display: grid; grid-template-columns: 8px 1fr auto; gap: 10px; align-items: start; padding: 8px 0; } .fn-scoreitem i { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; } .fn-scoreitem i.s-coral { background: var(--co); } .fn-scoreitem i.s-amber { background: var(--t-amber); }
.fn-scoreitem b { font-size: 12.5px; font-weight: 600; } .fn-scoreitem span { font-size: 11px; color: var(--ink-3); display: block; margin-top: 1px; line-height: 1.4; } .fn-scoreitem em { font-style: normal; font-size: 12.5px; font-weight: 700; color: var(--co-deep); }
.fn-date { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 8px 0; } .fn-date + .fn-date { border-top: 1px solid var(--line-soft); } .fn-date-l { font-size: 12.5px; color: var(--ink-2); } .fn-date-v { font-size: 13px; font-weight: 600; } .fn-date[data-emph] .fn-date-v { color: var(--co-deep); }
.fn-note-sm { font-size: 11px; color: var(--ink-4); font-style: italic; margin-top: 10px; line-height: 1.4; }
.fn-agent { display: flex; align-items: center; gap: 11px; margin-bottom: 12px; } .fn-agent-av { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(150deg, hsl(200 40% 92%), hsl(200 38% 85%)); color: hsl(200 44% 34%); display: grid; place-items: center; font-size: 13px; font-weight: 700; } .fn-root[data-theme="dark"] .fn-agent-av { filter: brightness(0.82); }
.fn-agent b { font-size: 13.5px; font-weight: 650; display: block; } .fn-agent span { font-size: 11.5px; color: var(--ink-3); } .fn-agent-email { font-size: 11.5px; color: var(--ink-3); margin-bottom: 12px; word-break: break-all; }
.fn-msgbtn { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 9px; cursor: pointer; transition: border-color 0.16s; } .fn-msgbtn:hover { border-color: var(--ink-4); } .fn-msgbtn svg { width: 15px; height: 15px; }

/* toast */
.fn-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 60; display: flex; align-items: center; gap: 14px; background: rgba(32,37,45,0.92); backdrop-filter: blur(18px) saturate(1.5); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; font-weight: 500; padding: 11px 16px 11px 18px; border-radius: 12px; box-shadow: 0 20px 48px rgba(0,0,0,0.32); animation: fn-toastin 0.3s cubic-bezier(0.2,0.85,0.25,1); } .fn-toast svg { width: 15px; height: 15px; color: #64d396; }

@keyframes fn-rise { from { opacity: 0; transform: translateY(14px); } }
@keyframes fn-fade { from { opacity: 0; } }
@keyframes fn-toastin { from { opacity: 0; transform: translate(-50%, 12px); } }

@media (max-width: 1240px) { .fn-body { grid-template-columns: 1fr; } .fn-seam { display: none; } .fn-side { border-top: 1px solid var(--line); } .fn-meta { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 960px) {
  .fn-app { grid-template-columns: 1fr; } .fn-nav { position: static; height: auto; flex-direction: row; flex-wrap: wrap; } .fn-brand { width: 100%; padding-bottom: 8px; } .fn-navnew { margin-bottom: 0; }
  .fn-content { padding: 0 14px 24px; } .fn-hero-grid { grid-template-columns: 1fr; } .fn-chaincards { grid-template-columns: 1fr; } .fn-addr { font-size: 25px; }
}
@media (prefers-reduced-motion: reduce) { .fn-root *, .fn-root *::before, .fn-root *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; } }
`;
