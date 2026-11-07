// Focus Next — "The Briefing". A bespoke, self-contained editorial surface for the
// /dev prototype. No liquid-glass dependency: this is its own visual world so the
// whole screen reads as one considered composition. Warm dark ground, a two-voice
// type system (serif = the written brief: headlines, addresses, key numbers;
// sans = the operational layer: status, threads, actions), TSP coral as the one
// accent. Prototype-only; isolated to this route.

export const FOCUS_CSS = String.raw`
.fb-root {
  --bg: #16110c;
  --panel: #1e1710;
  --panel-2: #241c14;
  --ink: #f2e9db;
  --ink-2: #c3b49b;
  --ink-3: #93856e;
  --ink-4: #6f6353;
  --line: rgba(242,233,219,0.10);
  --line-2: rgba(242,233,219,0.055);
  --co: #ff8458;          /* coral, for interactive + brand */
  --co-solid: #ef5f34;    /* coral button fill */
  --t-danger: #f3765a;
  --t-warn: #e4a74e;
  --t-info: #83b2ea;
  --t-ok: #87b78f;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  min-height: 100vh;
  background:
    radial-gradient(1200px 620px at 78% -8%, rgba(239,95,52,0.09), transparent 60%),
    radial-gradient(900px 600px at 6% 0%, rgba(120,92,60,0.10), transparent 55%),
    linear-gradient(180deg, #19130d, #130e09 60%);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.fb-root *::selection { background: rgba(255,132,88,0.26); color: #fff; }
.fb-root *::-webkit-scrollbar { width: 11px; height: 11px; }
.fb-root *::-webkit-scrollbar-thumb { background: rgba(242,233,219,0.14); border-radius: 99px; border: 3px solid transparent; background-clip: padding-box; }
.fb-root *::-webkit-scrollbar-thumb:hover { background: rgba(242,233,219,0.22); background-clip: padding-box; }
.fb-num { font-variant-numeric: tabular-nums; }

.fb-shell { max-width: 1240px; margin: 0 auto; padding: 46px 34px 140px; }

/* ── masthead ─────────────────────────────────────────────────────────────── */
.fb-mast { padding-bottom: 30px; border-bottom: 1px solid var(--line); }
.fb-brandrow { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
.fb-brand { font-size: 13px; font-weight: 700; letter-spacing: 0.02em; color: var(--ink); }
.fb-brand span { color: var(--co); }
.fb-chip { font-size: 10.5px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-3); border: 1px solid var(--line); border-radius: 999px; padding: 3px 9px; font-weight: 600; }
.fb-mast-main { display: flex; justify-content: space-between; align-items: flex-end; gap: 40px; }
.fb-thesis { font-family: var(--serif); font-size: 34px; line-height: 1.14; letter-spacing: -0.018em; font-weight: 600; margin: 0; max-width: 15ch; }
.fb-thesis b { color: var(--co); font-weight: 600; }
.fb-thesis .fb-quiet { color: var(--ink-3); }
.fb-mast-tools { display: flex; flex-direction: column; align-items: flex-end; gap: 14px; flex-shrink: 0; }
.fb-scope { display: inline-flex; background: var(--panel); border: 1px solid var(--line); border-radius: 11px; padding: 3px; gap: 2px; }
.fb-scope button { font: inherit; font-size: 12.5px; font-weight: 550; color: var(--ink-3); background: none; border: none; border-radius: 8px; padding: 6px 13px; cursor: pointer; transition: color 0.16s, background 0.16s; }
.fb-scope button:hover { color: var(--ink); }
.fb-scope button[data-on] { color: var(--ink); background: var(--panel-2); box-shadow: inset 0 0 0 1px var(--line), 0 1px 2px rgba(0,0,0,0.3); }
.fb-search { display: flex; align-items: center; gap: 9px; border: 1px solid var(--line); background: rgba(0,0,0,0.18); border-radius: 11px; padding: 8px 13px; color: var(--ink-3); transition: border-color 0.16s; width: 232px; }
.fb-search:focus-within { border-color: rgba(255,132,88,0.5); }
.fb-search svg { width: 15px; height: 15px; flex-shrink: 0; }
.fb-search input { background: none; border: none; outline: none; color: var(--ink); font: inherit; font-size: 13.5px; width: 100%; }
.fb-search input::placeholder { color: var(--ink-4); }
.fb-search .fb-clear { background: none; border: none; color: var(--ink-4); cursor: pointer; padding: 0; display: none; }
.fb-search .fb-clear svg { width: 14px; height: 14px; }
.fb-search[data-filled] .fb-clear { display: inline-flex; }
.fb-search .fb-clear:hover { color: var(--ink); }

/* ── two-zone body ────────────────────────────────────────────────────────── */
.fb-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 54px; align-items: start; margin-top: 8px; }
.fb-rail { position: sticky; top: 24px; }

/* ── the feed ─────────────────────────────────────────────────────────────── */
.fb-feed { min-width: 0; }
.fb-story { padding: 30px 0 32px; border-bottom: 1px solid var(--line-2); position: relative; scroll-margin-top: 20px; }
.fb-story::before { content: ""; position: absolute; left: -22px; top: 36px; width: 3px; height: 0; background: var(--co); border-radius: 2px; transition: height 0.26s cubic-bezier(0.2,0.8,0.2,1); }
.fb-story[data-hi]::before { height: 26px; }
.fb-kicker { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; margin: 0 0 11px; }
.fb-kicker svg { width: 13px; height: 13px; }
.fb-k-danger { color: var(--t-danger); } .fb-k-warn { color: var(--t-warn); } .fb-k-info { color: var(--t-info); } .fb-k-ok { color: var(--t-ok); } .fb-k-neutral { color: var(--ink-3); }
.fb-addr { font-family: var(--serif); font-size: 25px; line-height: 1.12; letter-spacing: -0.02em; font-weight: 600; margin: 0 0 3px; cursor: pointer; width: fit-content; }
.fb-addr:hover { color: var(--co); }
.fb-addr .fb-town { color: var(--ink-3); font-weight: 500; }
.fb-dateline { font-size: 12.5px; color: var(--ink-4); margin: 0 0 22px; }
.fb-dateline b { color: var(--ink-3); font-weight: 600; }

.fb-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 26px 48px; }
.fb-sides[data-single] { grid-template-columns: minmax(0, 520px); }
.fb-side { min-width: 0; }
.fb-side-h { display: flex; align-items: baseline; gap: 10px; margin-bottom: 3px; }
.fb-role { font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-4); font-weight: 700; flex-shrink: 0; }
.fb-name { font-size: 15.5px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); }
.fb-st { font-size: 13px; margin: 0 0 14px; display: inline-flex; align-items: center; gap: 6px; }
.fb-st svg { width: 13px; height: 13px; }
.fb-s-danger { color: var(--t-danger); } .fb-s-warn { color: var(--t-warn); } .fb-s-info { color: var(--t-info); } .fb-s-ok { color: var(--t-ok); } .fb-s-neutral { color: var(--ink-3); }

.fb-thread { display: flex; flex-direction: column; gap: 11px; margin-bottom: 15px; }
.fb-ex { display: grid; grid-template-columns: 15px minmax(0,1fr) auto; gap: 10px; align-items: start; }
.fb-ex-i { width: 14px; height: 14px; color: var(--ink-4); margin-top: 2px; }
.fb-ex[data-bad] .fb-ex-i { color: var(--t-danger); }
.fb-ex-t { font-size: 13.5px; color: var(--ink); line-height: 1.38; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.fb-ex-m { font-size: 11.5px; color: var(--ink-4); margin-top: 2px; }
.fb-ex-m[data-bad] { color: var(--t-danger); }
.fb-ex-auto { font-style: italic; }
.fb-ex-w { font-size: 11.5px; color: var(--ink-4); white-space: nowrap; margin-top: 1px; }
.fb-ex-none { font-size: 13px; color: var(--ink-4); font-style: italic; }
.fb-more { font: inherit; font-size: 12px; color: var(--ink-3); background: none; border: none; padding: 0; cursor: pointer; align-self: flex-start; }
.fb-more:hover { color: var(--co); }

.fb-acts { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.fb-act { display: inline-flex; align-items: center; gap: 8px; background: none; border: none; color: var(--ink); font: inherit; font-size: 13.5px; font-weight: 550; cursor: pointer; padding: 0; transition: color 0.16s; }
.fb-act svg { width: 15px; height: 15px; color: var(--co); transition: color 0.16s; }
.fb-act .fb-arr { width: 12px; opacity: 0; transform: translateX(-4px); transition: all 0.2s; }
.fb-act-primary:hover { color: var(--co); } .fb-act-primary:hover .fb-arr { opacity: 1; transform: none; }
.fb-act-muted { color: var(--ink-3); font-size: 13px; } .fb-act-muted svg { color: var(--ink-4); } .fb-act-muted:hover { color: var(--ink); }
.fb-done-line { display: inline-flex; align-items: center; gap: 9px; font-size: 13px; color: var(--t-ok); font-weight: 500; }
.fb-done-line svg { width: 14px; height: 14px; }
.fb-done-line.is-parked { color: var(--ink-3); }
.fb-reopen { font: inherit; font-size: 12.5px; color: var(--ink-4); background: none; border: none; cursor: pointer; padding: 0; margin-left: 2px; text-decoration: underline; text-underline-offset: 2px; }
.fb-reopen:hover { color: var(--ink); }

/* ── calm register ────────────────────────────────────────────────────────── */
.fb-rule { display: flex; align-items: center; gap: 16px; margin: 44px 0 6px; }
.fb-rule::before, .fb-rule::after { content: ""; flex: 1; height: 1px; background: var(--line-2); }
.fb-rule span { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-4); font-weight: 700; }
.fb-calm { display: flex; justify-content: space-between; align-items: baseline; gap: 18px; padding: 13px 0; border-bottom: 1px solid var(--line-2); cursor: pointer; }
.fb-calm:hover .fb-calm-addr { color: var(--co); }
.fb-calm-addr { font-size: 14.5px; font-weight: 600; letter-spacing: -0.01em; transition: color 0.16s; }
.fb-calm-addr em { color: var(--ink-3); font-style: normal; font-weight: 500; }
.fb-calm-meta { font-size: 12px; color: var(--ink-4); white-space: nowrap; }

/* ── empty states ─────────────────────────────────────────────────────────── */
.fb-caught { text-align: center; padding: 72px 20px; }
.fb-caught svg { width: 36px; height: 36px; color: var(--t-ok); }
.fb-caught h3 { font-family: var(--serif); font-size: 25px; font-weight: 600; letter-spacing: -0.015em; margin: 16px 0 8px; }
.fb-caught p { font-size: 14px; color: var(--ink-3); max-width: 340px; margin: 0 auto; line-height: 1.5; }
.fb-empty { padding: 64px 20px; text-align: center; color: var(--ink-4); font-size: 14px; }

/* ── coverage rail ────────────────────────────────────────────────────────── */
.fb-cov { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 20px 20px 18px; }
.fb-cov-top { display: flex; align-items: baseline; gap: 12px; }
.fb-cov-num { font-family: var(--serif); font-size: 34px; font-weight: 600; letter-spacing: -0.01em; line-height: 1; }
.fb-cov-num em { font-style: normal; color: var(--ink-3); font-size: 21px; }
.fb-cov-cap { font-size: 11.5px; color: var(--ink-3); line-height: 1.3; }
.fb-cov-bar { height: 5px; border-radius: 99px; background: rgba(0,0,0,0.3); margin: 15px 0 12px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--line-2); }
.fb-cov-bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--co-solid), var(--co)); transition: width 0.5s cubic-bezier(0.2,0.8,0.2,1); }
.fb-cov-sub { font-size: 12px; color: var(--ink-3); }
.fb-cov-sub b { color: var(--ink); font-weight: 600; }

.fb-ledger { margin-top: 20px; }
.fb-ledger-h { font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-4); font-weight: 700; margin: 0 0 10px; display: flex; justify-content: space-between; align-items: center; }
.fb-ledger-h .fb-num { color: var(--ink-3); }
.fb-still { max-height: 46vh; overflow-y: auto; margin: 0 -6px; padding: 0 6px; }
.fb-still-s { padding: 11px 0; border-bottom: 1px solid var(--line-2); }
.fb-still-addr { font-size: 13px; font-weight: 600; letter-spacing: -0.005em; cursor: pointer; margin-bottom: 7px; width: fit-content; }
.fb-still-addr:hover { color: var(--co); }
.fb-still-addr em { color: var(--ink-4); font-style: normal; font-weight: 500; }
.fb-still-side { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 3px 0; }
.fb-still-l { font-size: 12px; color: var(--ink-2); min-width: 0; display: flex; align-items: center; gap: 7px; }
.fb-still-l em { font-style: normal; color: var(--ink-4); }
.fb-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.fb-dot-danger { background: var(--t-danger); } .fb-dot-warn { background: var(--t-warn); } .fb-dot-info { background: var(--t-info); } .fb-dot-ok { background: var(--t-ok); } .fb-dot-neutral { background: var(--ink-4); }
.fb-done-btn { font: inherit; font-size: 11.5px; font-weight: 600; color: var(--ink-3); background: none; border: 1px solid var(--line); border-radius: 7px; padding: 3px 9px; cursor: pointer; flex-shrink: 0; transition: all 0.15s; }
.fb-done-btn:hover { color: var(--ink); border-color: rgba(255,132,88,0.5); background: rgba(255,132,88,0.08); }
.fb-disc { margin-top: 14px; }
.fb-disc summary { font-size: 12px; color: var(--ink-4); cursor: pointer; list-style: none; display: flex; align-items: center; gap: 7px; padding: 5px 0; user-select: none; }
.fb-disc summary::-webkit-details-marker { display: none; }
.fb-disc summary:hover { color: var(--ink-2); }
.fb-disc summary svg { width: 12px; height: 12px; transition: transform 0.18s; }
.fb-disc[open] summary svg { transform: rotate(90deg); }
.fb-disc-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 12px; color: var(--ink-3); padding: 5px 0 5px 19px; }
.fb-disc-row em { font-style: normal; color: var(--ink-4); }
.fb-ledger-clear { font-size: 12px; color: var(--ink-4); font-style: italic; padding: 6px 0; }

/* ── modal ────────────────────────────────────────────────────────────────── */
.fb-scrim { position: fixed; inset: 0; z-index: 60; background: rgba(10,7,4,0.62); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 24px; animation: fb-fade 0.18s ease; }
@keyframes fb-fade { from { opacity: 0; } }
.fb-modal { width: min(500px, 100%); background: var(--panel-2); border: 1px solid var(--line); border-radius: 18px; box-shadow: 0 32px 80px rgba(0,0,0,0.6); overflow: hidden; animation: fb-pop 0.22s cubic-bezier(0.2,0.8,0.2,1); }
@keyframes fb-pop { from { opacity: 0; transform: translateY(10px) scale(0.985); } }
.fb-modal-h { padding: 20px 22px 0; }
.fb-modal-eyebrow { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--co); font-weight: 700; }
.fb-modal-h h3 { font-family: var(--serif); font-size: 21px; font-weight: 600; letter-spacing: -0.015em; margin: 6px 0 0; }
.fb-modal-b { padding: 18px 22px 4px; display: flex; flex-direction: column; gap: 14px; }
.fb-field label { display: block; font-size: 11.5px; font-weight: 650; color: var(--ink-3); margin-bottom: 6px; letter-spacing: 0.01em; }
.fb-field .fb-hint { font-weight: 400; color: var(--ink-4); font-style: italic; }
.fb-input, .fb-textarea { width: 100%; background: rgba(0,0,0,0.22); border: 1px solid var(--line); border-radius: 11px; color: var(--ink); font: inherit; font-size: 14px; padding: 10px 13px; outline: none; transition: border-color 0.16s; }
.fb-input:focus, .fb-textarea:focus { border-color: rgba(255,132,88,0.55); }
.fb-textarea { resize: vertical; line-height: 1.5; min-height: 96px; }
.fb-to { font-size: 13px; color: var(--ink-3); } .fb-to b { color: var(--ink); font-weight: 600; }
.fb-modal-f { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px 20px; margin-top: 8px; }
.fb-btn { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 13.5px; font-weight: 600; border-radius: 11px; padding: 9px 16px; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
.fb-btn svg { width: 15px; height: 15px; }
.fb-btn-ghost { background: none; color: var(--ink-3); border-color: var(--line); }
.fb-btn-ghost:hover { color: var(--ink); border-color: var(--ink-4); }
.fb-btn-primary { background: var(--co-solid); color: #fff; box-shadow: 0 6px 18px rgba(239,95,52,0.32); }
.fb-btn-primary:hover { filter: brightness(1.07); }
.fb-btn-primary:active { transform: scale(0.98); }

/* ── toast ────────────────────────────────────────────────────────────────── */
.fb-toast { position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%); z-index: 70; display: flex; align-items: center; gap: 16px; background: var(--panel-2); border: 1px solid var(--line); color: var(--ink); font-size: 13.5px; padding: 11px 16px 11px 18px; border-radius: 13px; box-shadow: 0 18px 44px rgba(0,0,0,0.5); animation: fb-toast-in 0.26s cubic-bezier(0.2,0.8,0.2,1); }
@keyframes fb-toast-in { from { opacity: 0; transform: translate(-50%, 14px); } }
.fb-toast svg { width: 15px; height: 15px; color: var(--t-ok); }
.fb-toast-undo { font: inherit; font-size: 13px; font-weight: 650; color: var(--co); background: none; border: none; cursor: pointer; padding: 0; }
.fb-toast-undo:hover { text-decoration: underline; text-underline-offset: 2px; }

.fb-kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 4px; font-size: 11px; font-weight: 600; color: var(--ink-3); background: var(--panel); border: 1px solid var(--line); border-radius: 5px; }

/* ── responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 1040px) {
  .fb-grid { grid-template-columns: 1fr; gap: 40px; }
  .fb-rail { position: static; }
  .fb-still { max-height: none; }
}
@media (max-width: 680px) {
  .fb-shell { padding: 30px 18px 110px; }
  .fb-mast-main { flex-direction: column; align-items: flex-start; gap: 22px; }
  .fb-mast-tools { align-items: stretch; width: 100%; }
  .fb-search { width: 100%; }
  .fb-thesis { font-size: 27px; }
  .fb-sides { grid-template-columns: 1fr; gap: 22px; }
  .fb-sides[data-single] { grid-template-columns: 1fr; }
  .fb-story::before { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .fb-root *, .fb-root *::before { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
`;
