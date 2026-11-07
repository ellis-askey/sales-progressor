// Focus Next — prototype stylesheet (v2, Mail/Reminders-inspired reading pane).
// One window surface, hairlines + type + space instead of nested cards. All
// classes `fx-` prefixed, scoped under `.lg-ds`, tokens only.
export const FOCUS_CSS = `
.lg-ds.fx-root { min-height: 100vh; position: relative; background: var(--lg-base); display: grid; place-items: center; padding: 26px; overflow: hidden; }
.fx-root ::selection { background: var(--lg-accent-soft); color: var(--lg-ink); }
.fx-root :focus-visible { outline: 2px solid var(--lg-accent); outline-offset: 1px; border-radius: 7px; }
.fx-root *::-webkit-scrollbar { width: 11px; height: 11px; }
.fx-root *::-webkit-scrollbar-thumb { background: var(--lg-line); border-radius: 99px; border: 3px solid transparent; background-clip: padding-box; }
.fx-root *:hover::-webkit-scrollbar-thumb { background: var(--lg-ink-3); background-clip: padding-box; }
.fx-num { font-variant-numeric: tabular-nums; }

.fx-scene { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.fx-scene::before, .fx-scene::after { content: ""; position: absolute; border-radius: 50%; filter: blur(100px); }
.fx-scene::before { width: 52vw; height: 52vw; left: -12vw; top: -16vw; background: radial-gradient(circle, rgba(255,107,74,0.18), transparent 66%); opacity: 0.55; }
.fx-scene::after { width: 46vw; height: 46vw; right: -14vw; bottom: -16vw; background: radial-gradient(circle, rgba(120,150,255,0.13), transparent 66%); opacity: 0.5; }

/* The window: one vibrancy surface, everything lives inside it. */
.fx-window { position: relative; z-index: 1; width: min(1340px, 100%); height: min(880px, calc(100vh - 52px)); border-radius: 20px;
  background: var(--lg-glass-raised); -webkit-backdrop-filter: blur(30px) saturate(150%); backdrop-filter: blur(30px) saturate(150%);
  border: 1px solid var(--lg-line); box-shadow: 0 30px 80px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.14);
  display: grid; grid-template-rows: auto 1fr; overflow: hidden; }
.lg-ds[data-theme="light"] .fx-window { box-shadow: 0 30px 80px rgba(30,40,80,0.16), inset 0 1px 0 rgba(255,255,255,0.8); }

/* ── Toolbar ─────────────────────────────────────────────────────────────── */
.fx-tb { display: flex; align-items: center; gap: 18px; padding: 0 16px 0 20px; height: 60px; border-bottom: 1px solid var(--lg-line-2); }
.fx-tb-id { display: flex; flex-direction: column; gap: 4px; min-width: 150px; }
.fx-tb-title { display: flex; align-items: baseline; gap: 9px; }
.fx-tb-title b { font-size: 15px; font-weight: 680; letter-spacing: -0.02em; }
.fx-tb-title span { font-size: 12px; color: var(--lg-ink-3); font-variant-numeric: tabular-nums; }
.fx-tb-cov { position: relative; height: 3px; width: 100%; border-radius: 99px; background: var(--lg-line); overflow: hidden; }
.fx-tb-cov i { display: block; height: 100%; border-radius: 99px; background: var(--lg-accent); transition: width var(--lg-slow) var(--lg-ease); }
.fx-tb-sp { flex: 1; }
.fx-tb-search { width: 210px; transition: width var(--lg-mid) var(--lg-ease); }
.fx-tb-search:focus-within { width: 250px; }
.fx-theme { width: 32px; height: 32px; border-radius: 9px; border: 1px solid transparent; background: none; color: var(--lg-ink-3); display: grid; place-items: center; cursor: pointer; transition: background var(--lg-fast), color var(--lg-fast); }
.fx-theme:hover { background: var(--lg-hover); color: var(--lg-ink); }
.fx-theme svg { width: 16px; height: 16px; }

/* ── Main split ──────────────────────────────────────────────────────────── */
.fx-main { display: grid; grid-template-columns: minmax(300px, 356px) 1fr; min-height: 0; }
.fx-listcol { border-right: 1px solid var(--lg-line-2); min-height: 0; overflow: auto; overscroll-behavior: contain; padding-bottom: 10px; }
.fx-detailcol { min-height: 0; overflow: auto; overscroll-behavior: contain; }

/* list sub-toolbar: lens + side scope */
.fx-lhead { position: sticky; top: 0; z-index: 2; background: color-mix(in srgb, var(--lg-glass-raised) 86%, transparent); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); padding: 11px 14px 9px; display: flex; flex-direction: column; gap: 9px; border-bottom: 1px solid var(--lg-line-2); }
.fx-scope { display: inline-flex; gap: 2px; align-self: flex-start; }
.fx-scope button { font: inherit; font-size: 11.5px; font-weight: 550; color: var(--lg-ink-3); background: none; border: none; padding: 3px 9px; border-radius: 7px; cursor: pointer; transition: background var(--lg-fast), color var(--lg-fast); }
.fx-scope button:hover { color: var(--lg-ink-2); }
.fx-scope button[data-on="true"] { color: var(--lg-ink); background: var(--lg-fill); }

/* section header */
.fx-sec { display: flex; align-items: baseline; justify-content: space-between; padding: 15px 18px 6px; }
.fx-sec:first-of-type { padding-top: 11px; }
.fx-sec b { font-size: 12px; font-weight: 640; letter-spacing: -0.01em; color: var(--lg-ink-2); }
.fx-sec span { font-size: 11.5px; color: var(--lg-ink-3); font-variant-numeric: tabular-nums; }

/* ── Source-list row ─────────────────────────────────────────────────────── */
.fx-row { display: grid; grid-template-columns: 9px 1fr auto; align-items: start; gap: 11px; width: 100%; text-align: left;
  padding: 10px 18px 11px; background: none; border: none; cursor: pointer; color: inherit; position: relative;
  transition: background var(--lg-fast); }
.fx-row::after { content: ""; position: absolute; left: 38px; right: 14px; bottom: 0; height: 1px; background: var(--lg-line-2); }
.fx-row:last-child::after { display: none; }
.fx-row:hover { background: var(--lg-hover); }
.fx-row[data-sel="true"] { background: var(--lg-accent-soft); }
.fx-row[data-sel="true"]::after, .fx-row[data-sel="true"] + .fx-row::after { opacity: 0; }
.fx-row-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; }
.fx-row-dot[data-u="danger"] { background: var(--lg-accent); }
.fx-row-dot[data-u="warn"] { background: transparent; box-shadow: inset 0 0 0 1.5px var(--lg-warn); }
.fx-row-dot[data-u="info"] { background: transparent; box-shadow: inset 0 0 0 1.5px var(--lg-info); }
.fx-row-dot[data-u="none"] { background: transparent; }
.fx-row-m { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.fx-row-addr { font-size: 14px; font-weight: 600; letter-spacing: -0.012em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fx-row-addr span { color: var(--lg-ink-3); font-weight: 450; }
.fx-row-sum { font-size: 12.5px; line-height: 1.4; color: var(--lg-ink-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.fx-row-sum em { font-style: normal; color: var(--lg-ink); font-weight: 550; }
.fx-row-when { font-size: 11.5px; color: var(--lg-ink-3); font-variant-numeric: tabular-nums; margin-top: 1px; white-space: nowrap; }

/* ── Detail (reading pane) ───────────────────────────────────────────────── */
.fx-detail { padding: 24px 30px 30px; max-width: 1000px; }
.fx-dhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.fx-daddr { font-size: 23px; font-weight: 640; letter-spacing: -0.025em; margin: 0 0 4px; line-height: 1.12; }
.fx-dmeta { font-size: 12.5px; color: var(--lg-ink-3); display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.fx-dmeta b { color: var(--lg-ink-2); font-weight: 600; font-variant-numeric: tabular-nums; }
.fx-dmeta i { width: 2.5px; height: 2.5px; border-radius: 50%; background: var(--lg-ink-3); }
.fx-openfile { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 550; color: var(--lg-ink-2); background: none; border: none; cursor: pointer; padding: 5px 2px; white-space: nowrap; flex-shrink: 0; transition: color var(--lg-fast); }
.fx-openfile:hover { color: var(--lg-ink); }
.fx-openfile svg { width: 13px; height: 13px; transition: transform var(--lg-fast); }
.fx-openfile:hover svg { transform: translate(1.5px, -1.5px); }

/* concern — one quiet inline line, left hairline accent */
.fx-concern { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding: 9px 0 9px 14px; border-left: 2px solid var(--lg-accent); }
.fx-concern[data-t="warn"] { border-left-color: var(--lg-warn); }
.fx-concern svg { width: 15px; height: 15px; flex-shrink: 0; color: var(--lg-accent-ink); }
.fx-concern[data-t="warn"] svg { color: var(--lg-warn); }
.fx-concern b { font-size: 13px; font-weight: 600; }
.fx-concern span { font-size: 12.5px; color: var(--lg-ink-2); }
.fx-concern .fx-concern-open { margin-left: auto; font-size: 12px; font-weight: 550; color: var(--lg-ink-3); background: none; border: none; cursor: pointer; padding: 4px 6px; }
.fx-concern .fx-concern-open:hover { color: var(--lg-ink); }

/* all-clear — one calm line for a healthy sale, where concerns would sit */
.fx-allclear { display: flex; align-items: center; gap: 9px; margin-top: 16px; font-size: 12.5px; color: var(--lg-ink-3); }
.fx-allclear svg { width: 15px; height: 15px; color: var(--lg-ink-2); }

/* two columns, divided by a hairline — not cards */
.fx-cols { display: grid; grid-template-columns: 1fr 1fr; margin-top: 22px; }
.fx-cols[data-single="true"] { grid-template-columns: 1fr; max-width: 520px; }
.fx-col { padding: 0 26px; min-width: 0; }
.fx-col:first-child { padding-left: 0; }
.fx-col:last-child { padding-right: 0; border-left: 1px solid var(--lg-line-2); }
.fx-cols[data-single="true"] .fx-col { border-left: none; padding: 0; }

.fx-ch { display: flex; align-items: center; gap: 11px; margin-bottom: 3px; }
.fx-circle { width: 22px; height: 22px; border-radius: 50%; border: 1.6px solid var(--lg-ink-3); background: none; cursor: pointer; display: grid; place-items: center; flex-shrink: 0; color: #fff; transition: border-color var(--lg-fast), background var(--lg-fast), transform var(--lg-fast) var(--lg-spring); }
.fx-circle svg { width: 13px; height: 13px; opacity: 0; transform: scale(0.5); transition: opacity var(--lg-fast), transform var(--lg-mid) var(--lg-spring); }
.fx-circle:hover { border-color: var(--lg-accent); transform: scale(1.08); }
.fx-circle[data-s="done"] { background: var(--lg-accent); border-color: var(--lg-accent); }
.fx-circle[data-s="done"] svg { opacity: 1; transform: scale(1); }
.fx-circle[data-s="parked"] { border-color: var(--lg-ink-3); border-style: dashed; color: var(--lg-ink-3); }
.fx-circle[data-s="parked"] svg { opacity: 0.8; transform: scale(1); color: var(--lg-ink-3); }
.fx-ch-id { min-width: 0; }
.fx-ch-role { font-size: 10.5px; font-weight: 600; color: var(--lg-ink-3); letter-spacing: 0.01em; }
.fx-ch-name { font-size: 15px; font-weight: 600; letter-spacing: -0.015em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fx-status { font-size: 12px; font-weight: 500; color: var(--lg-ink-3); margin: 0 0 15px 33px; display: flex; align-items: center; gap: 6px; }
.fx-status[data-t="warn"] { color: var(--lg-warn); }
.lg-ds[data-theme="light"] .fx-status[data-t="warn"] { color: #c87a1e; }
.fx-status[data-t="danger"] { color: var(--lg-accent-ink); }
.fx-status[data-t="ok"] { color: var(--lg-ink-2); }
.fx-status svg { width: 13px; height: 13px; }

/* conversation thread */
.fx-thread { display: flex; flex-direction: column; margin-left: 33px; }
.fx-te { display: grid; grid-template-columns: 20px 1fr auto; gap: 11px; padding: 9px 0; position: relative; }
.fx-te::after { content: ""; position: absolute; left: 31px; right: 0; bottom: 0; height: 1px; background: var(--lg-line-2); }
.fx-te:last-of-type::after { display: none; }
.fx-te-g { width: 20px; display: grid; place-items: center; margin-top: 1px; color: var(--lg-ink-3); }
.fx-te-g svg { width: 15px; height: 15px; }
.fx-te[data-recent="true"] .fx-te-g { color: var(--lg-ink); }
.fx-te-b { min-width: 0; }
.fx-te-t { font-size: 13px; font-weight: 450; color: var(--lg-ink-2); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.fx-te[data-recent="true"] .fx-te-t { color: var(--lg-ink); font-weight: 500; }
.fx-te-s { font-size: 11px; color: var(--lg-ink-3); margin-top: 2px; display: flex; align-items: center; gap: 6px; }
.fx-te-s[data-bad="true"] { color: var(--lg-danger-ink); }
.fx-te-auto { font-size: 10.5px; font-style: italic; color: var(--lg-ink-3); }
.fx-te-w { font-size: 11px; color: var(--lg-ink-3); font-variant-numeric: tabular-nums; margin-top: 1px; white-space: nowrap; }
.fx-te-empty { font-size: 12.5px; color: var(--lg-ink-3); padding: 10px 0 4px; }
.fx-more { font: inherit; font-size: 11.5px; font-weight: 550; color: var(--lg-ink-3); background: none; border: none; cursor: pointer; padding: 9px 0 2px; align-self: flex-start; transition: color var(--lg-fast); }
.fx-more:hover { color: var(--lg-accent-ink); }

/* per-side actions: one primary, rest quiet */
.fx-acts { display: flex; align-items: center; gap: 4px; margin: 16px 0 0 33px; }
.fx-prim { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 12.5px; font-weight: 600; color: #fff; background: var(--lg-accent); border: none; border-radius: 9px; padding: 8px 14px; cursor: pointer; box-shadow: 0 4px 13px rgba(255,107,74,0.32); transition: filter var(--lg-fast), transform var(--lg-fast) var(--lg-spring); }
.fx-prim:hover { filter: brightness(1.07); }
.fx-prim:active { transform: scale(0.97); }
.fx-prim svg { width: 14px; height: 14px; }
.fx-sec-act { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 12.5px; font-weight: 550; color: var(--lg-ink-2); background: none; border: none; border-radius: 8px; padding: 8px 10px; cursor: pointer; transition: background var(--lg-fast), color var(--lg-fast); }
.fx-sec-act:hover { background: var(--lg-hover); color: var(--lg-ink); }
.fx-sec-act svg { width: 14px; height: 14px; }
/* kebab reuses the kit DropdownMenu trigger, restyled + caret hidden */
.fx-kebabwrap .tl-trigger { padding: 0; width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; background: none; border: none; color: var(--lg-ink-3); gap: 0; transition: background var(--lg-fast), color var(--lg-fast); }
.fx-kebabwrap .tl-trigger:hover { background: var(--lg-hover); color: var(--lg-ink); }
.fx-kebabwrap .tl-trigger > svg:last-child { display: none; }
.fx-kebabwrap .tl-trigger > svg:first-child { width: 17px; height: 17px; }

/* done state (coverage met) — a quiet line, not a banner */
.fx-done-line { display: flex; align-items: center; gap: 8px; margin: 16px 0 0 33px; font-size: 12.5px; font-weight: 500; color: var(--lg-ink-2); }
.fx-done-line svg { width: 15px; height: 15px; color: var(--lg-accent-ink); }
.fx-done-line button { font: inherit; font-size: 12px; color: var(--lg-ink-3); background: none; border: none; cursor: pointer; padding: 2px 4px; }
.fx-done-line button:hover { color: var(--lg-ink); }

/* empty / caught up */
.fx-caught { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 11px; padding: 70px 24px; text-align: center; }
.fx-caught svg { width: 28px; height: 28px; color: var(--lg-accent-ink); opacity: 0.85; }
.fx-caught h3 { font-size: 15px; font-weight: 600; margin: 0; }
.fx-caught p { font-size: 12.5px; color: var(--lg-ink-3); margin: 0; max-width: 240px; line-height: 1.45; }
.fx-nodetail { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--lg-ink-3); text-align: center; padding: 40px; }
.fx-nodetail svg { width: 26px; height: 26px; opacity: 0.5; }
.fx-nodetail p { font-size: 12.5px; margin: 0; }
.fx-kbd { font: 10.5px ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--lg-fill); border: 1px solid var(--lg-line); border-radius: 5px; padding: 1.5px 6px; color: var(--lg-ink-2); }

/* detail enter transition */
.fx-detail { animation: fxdetail var(--lg-mid) var(--lg-ease); }
@keyframes fxdetail { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

/* skeleton */
.fx-skel { padding: 11px 18px; display: grid; grid-template-columns: 1fr; gap: 8px; }
.fx-skelbar { height: 11px; border-radius: 6px; background: linear-gradient(90deg, rgba(128,128,140,0.09) 25%, rgba(128,128,140,0.19) 37%, rgba(128,128,140,0.09) 63%); background-size: 400% 100%; animation: fxshim 1.4s ease infinite; }
@keyframes fxshim { from { background-position: 100% 0; } to { background-position: 0 0; } }

/* mock composer */
.fx-form { display: flex; flex-direction: column; gap: 13px; }
.fx-form-to { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--lg-ink-2); padding: 7px 2px; border-bottom: 1px solid var(--lg-line-2); }
.fx-form-to b { color: var(--lg-ink); font-weight: 600; }

/* responsive */
@media (max-width: 1000px) {
  .fx-root { padding: 0; }
  .fx-window { width: 100%; height: 100vh; border-radius: 0; border: none; }
  .fx-main { grid-template-columns: 1fr; }
  .fx-listcol { border-right: none; }
  .fx-detail-inline { display: none; }
  .fx-cols { grid-template-columns: 1fr; gap: 0; }
  .fx-col { padding: 0; }
  .fx-col:last-child { border-left: none; border-top: 1px solid var(--lg-line-2); padding-top: 20px; margin-top: 20px; }
}
@media (max-width: 560px) {
  .fx-tb-id { min-width: 0; }
  .fx-tb-title span { white-space: nowrap; }
  .fx-tb-cap { display: none; }
  .fx-tb-search { width: 148px; }
  .fx-tb-search:focus-within { width: 164px; }
  .fx-detail { padding: 18px 16px 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .fx-detail, .fx-skelbar, .fx-tb-cov i, .fx-circle, .fx-circle svg { animation: none; transition: none; }
}
`;
