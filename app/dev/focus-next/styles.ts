// Focus Next — prototype stylesheet (injected once alongside GLASS_CSS). All
// classes are `fx-` prefixed and scoped under `.lg-ds`. Uses only --lg tokens.
export const FOCUS_CSS = `
.lg-ds.fx-root { min-height: 100vh; position: relative; background: var(--lg-base); overflow: hidden; }
.fx-root ::selection { background: var(--lg-accent-soft); color: var(--lg-ink); }
.fx-root :focus-visible { outline: 2px solid var(--lg-accent); outline-offset: 2px; border-radius: 6px; }
.fx-root *::-webkit-scrollbar { width: 10px; height: 10px; }
.fx-root *::-webkit-scrollbar-thumb { background: var(--lg-line); border-radius: 99px; border: 3px solid transparent; background-clip: padding-box; }
.fx-root *::-webkit-scrollbar-thumb:hover { background: var(--lg-ink-3); background-clip: padding-box; }
.fx-num { font-variant-numeric: tabular-nums; }

/* Ambient — two very soft glows, never busy. */
.fx-scene { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.fx-scene::before, .fx-scene::after { content: ""; position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.5; }
.fx-scene::before { width: 48vw; height: 48vw; left: -10vw; top: -14vw; background: radial-gradient(circle, rgba(255,107,74,0.16), transparent 68%); }
.fx-scene::after { width: 42vw; height: 42vw; right: -12vw; bottom: -12vw; background: radial-gradient(circle, rgba(94,155,255,0.12), transparent 68%); }
.lg-ds[data-theme="light"] .fx-scene::before { opacity: 0.6; }
.lg-ds[data-theme="light"] .fx-scene::after { opacity: 0.5; }

/* Shell: top bar, then two independently-scrolling panes. */
.fx-shell { position: relative; z-index: 1; height: 100vh; max-width: 1400px; margin: 0 auto; display: grid; grid-template-rows: auto 1fr; padding: 18px 22px 0; gap: 14px; }
.fx-body { display: grid; grid-template-columns: minmax(348px, 432px) 1fr; gap: 16px; min-height: 0; padding-bottom: 18px; }
.fx-pane { min-height: 0; overflow: auto; overscroll-behavior: contain; }

/* ── Top bar ─────────────────────────────────────────────────────────────── */
.fx-top { display: flex; align-items: center; gap: 18px; }
.fx-top-id { display: flex; flex-direction: column; gap: 1px; }
.fx-title { font-size: 16px; font-weight: 650; letter-spacing: -0.02em; margin: 0; }
.fx-title b { color: var(--lg-accent-ink); font-weight: 650; }
.fx-sub { font-size: 12px; color: var(--lg-ink-3); }
.fx-top-sp { flex: 1; }
.fx-asof { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--lg-ink-3); }
.fx-asof svg { width: 13px; height: 13px; }
.fx-theme { width: 46px; height: 28px; border-radius: 99px; border: 1px solid var(--lg-line); background: var(--lg-fill); position: relative; cursor: pointer; transition: background var(--lg-fast); flex-shrink: 0; }
.fx-theme-knob { position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: var(--lg-ink); color: var(--lg-base); display: grid; place-items: center; transition: transform var(--lg-mid) var(--lg-spring); }
.fx-theme-knob svg { width: 12px; height: 12px; }
.fx-theme.on .fx-theme-knob { transform: translateX(18px); }

/* Coverage ribbon — the only glass in the chrome; quiet, elevated. */
.fx-cov { display: inline-flex; align-items: center; gap: 13px; padding: 9px 15px 9px 12px; }
.fx-cov-ring { --p: 0; width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  background: conic-gradient(var(--lg-ok) calc(var(--p) * 1%), var(--lg-line) 0); display: grid; place-items: center;
  transition: background var(--lg-slow) var(--lg-ease); }
.fx-cov-ring::after { content: ""; width: 26px; height: 26px; border-radius: 50%; background: var(--lg-glass-raised); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); grid-area: 1/1; }
.fx-cov-ring span { grid-area: 1/1; z-index: 1; font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fx-cov-txt { display: flex; flex-direction: column; gap: 1px; line-height: 1.25; }
.fx-cov-txt b { font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.fx-cov-txt small { font-size: 11px; color: var(--lg-ink-3); }

/* ── Controls row ────────────────────────────────────────────────────────── */
.fx-controls { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.fx-controls .tl-input { flex: 1; min-width: 0; }
.fx-count { margin-left: auto; font-size: 11.5px; color: var(--lg-ink-3); font-variant-numeric: tabular-nums; white-space: nowrap; }

/* ── List ────────────────────────────────────────────────────────────────── */
.fx-list { display: flex; flex-direction: column; gap: 6px; }
.fx-group-h { font-size: 11px; font-weight: 650; letter-spacing: 0.02em; color: var(--lg-ink-3); text-transform: uppercase; margin: 14px 4px 4px; display: flex; align-items: center; gap: 8px; }
.fx-group-h:first-child { margin-top: 2px; }
.fx-group-h .fx-group-n { font-variant-numeric: tabular-nums; color: var(--lg-ink-3); font-weight: 600; }
.fx-group-h hr { flex: 1; border: 0; border-top: 1px solid var(--lg-line-2); }

.fx-row { display: grid; grid-template-columns: 4px 40px 1fr auto; align-items: center; gap: 12px; width: 100%; text-align: left;
  padding: 11px 13px 11px 9px; border-radius: var(--lg-r-md); background: transparent; border: 1px solid transparent; cursor: pointer;
  transition: background var(--lg-fast), border-color var(--lg-fast); color: inherit; }
.fx-row:hover { background: var(--lg-hover); }
.fx-row[data-sel="true"] { background: var(--lg-fill); border-color: var(--lg-line); }
.fx-row[data-sel="true"] .fx-row-rail { opacity: 1; }
.fx-row-rail { width: 4px; align-self: stretch; border-radius: 99px; background: var(--lg-line); opacity: 0; transition: opacity var(--lg-fast), background var(--lg-fast); }
.fx-row-rail[data-tone="danger"] { background: var(--lg-danger); opacity: 1; }
.fx-row-rail[data-tone="warn"] { background: var(--lg-warn); opacity: 1; }
.fx-row-rail[data-tone="info"] { background: var(--lg-info); opacity: 0.8; }
.fx-row-rail[data-tone="ok"] { background: var(--lg-ok); opacity: 0.55; }
.fx-row-main { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.fx-row-addr { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fx-row-addr small { color: var(--lg-ink-3); font-weight: 500; }
.fx-row-why { font-size: 12px; color: var(--lg-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
.fx-row-why[data-tone="danger"] { color: var(--lg-danger-ink); }
.fx-row-why[data-tone="warn"] { color: #e0902a; }
.lg-ds[data-theme="dark"] .fx-row-why[data-tone="warn"] { color: #ffb84d; }
.fx-row-why[data-tone="info"] { color: var(--lg-info); }
.fx-row-why[data-tone="ok"] { color: var(--lg-ink-3); }
.fx-row-why svg { width: 13px; height: 13px; flex-shrink: 0; }
.fx-row-sides { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; flex-shrink: 0; }

/* tiny per-side marker in the list (two to a row) */
.fx-mini { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-variant-numeric: tabular-nums; color: var(--lg-ink-3); }
.fx-mini-k { width: 15px; height: 15px; border-radius: 5px; display: grid; place-items: center; font-size: 9px; font-weight: 800; letter-spacing: 0.02em; flex-shrink: 0; }
.fx-mini-k[data-k="vendor"] { background: rgba(94,155,255,0.16); color: #7db0ff; }
.fx-mini-k[data-k="purchaser"] { background: rgba(48,209,88,0.16); color: #5ce08a; }
.lg-ds[data-theme="light"] .fx-mini-k[data-k="vendor"] { background: rgba(37,99,235,0.12); color: #2563eb; }
.lg-ds[data-theme="light"] .fx-mini-k[data-k="purchaser"] { background: rgba(14,120,70,0.1); color: #0e7846; }
.fx-mini-dot { width: 6px; height: 6px; border-radius: 50%; }
.fx-dot-ok { background: var(--lg-ok); } .fx-dot-warn { background: var(--lg-warn); } .fx-dot-danger { background: var(--lg-danger); } .fx-dot-info { background: var(--lg-info); } .fx-dot-neutral { background: var(--lg-ink-3); } .fx-dot-covered { background: var(--lg-ok); opacity: 0.4; }
.fx-mini-covered { color: var(--lg-ink-3); }
.fx-mini-check { color: var(--lg-ok); width: 11px; height: 11px; }

/* ── Detail pane ─────────────────────────────────────────────────────────── */
.fx-detail { padding: 20px 22px; display: flex; flex-direction: column; gap: 18px; }
.fx-dh { display: flex; align-items: flex-start; gap: 14px; }
.fx-dh-main { min-width: 0; flex: 1; }
.fx-dh-addr { font-size: 19px; font-weight: 650; letter-spacing: -0.02em; margin: 0 0 2px; }
.fx-dh-meta { font-size: 12.5px; color: var(--lg-ink-3); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fx-dh-meta .fx-dh-price { color: var(--lg-ink-2); font-weight: 600; font-variant-numeric: tabular-nums; }
.fx-dh-meta i { width: 3px; height: 3px; border-radius: 50%; background: var(--lg-ink-3); display: inline-block; }
.fx-openfile { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--lg-accent-ink); background: none; border: none; cursor: pointer; padding: 6px 2px; flex-shrink: 0; }
.fx-openfile svg { width: 13px; height: 13px; transition: transform var(--lg-fast); }
.fx-openfile:hover svg { transform: translate(2px, -2px); }

/* Concern callouts */
.fx-concerns { display: flex; flex-direction: column; gap: 8px; }
.fx-concern { display: flex; align-items: flex-start; gap: 11px; padding: 12px 14px; border-radius: var(--lg-r-sm); background: var(--lg-fill); }
.fx-concern[data-tone="danger"] { background: rgba(255,69,58,0.09); }
.fx-concern[data-tone="warn"] { background: rgba(255,159,10,0.09); }
.fx-concern-ic { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; }
.fx-concern-ic svg { width: 16px; height: 16px; }
.fx-concern[data-tone="danger"] .fx-concern-ic { background: rgba(255,69,58,0.16); color: var(--lg-danger-ink); }
.fx-concern[data-tone="warn"] .fx-concern-ic { background: rgba(255,159,10,0.16); color: #ffb84d; }
.fx-concern[data-tone="info"] .fx-concern-ic { background: rgba(94,155,255,0.16); color: var(--lg-info); }
.fx-concern-b strong { display: block; font-size: 13px; font-weight: 600; margin-bottom: 1px; }
.fx-concern-b span { font-size: 12px; color: var(--lg-ink-2); }
.fx-concern-act { margin-left: auto; align-self: center; }

/* Two sides */
.fx-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.fx-sides[data-single="true"] { grid-template-columns: 1fr; }
.fx-side { padding: 15px 16px; border-radius: var(--lg-r-md); background: var(--lg-fill); border: 1px solid var(--lg-line-2); display: flex; flex-direction: column; gap: 13px; }
.fx-side[data-dim="true"] { opacity: 0.62; }
.fx-side-h { display: flex; align-items: center; gap: 9px; }
.fx-side-k { font-size: 9.5px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; padding: 3px 7px; border-radius: 6px; }
.fx-side-k[data-k="vendor"] { background: rgba(94,155,255,0.16); color: #7db0ff; }
.fx-side-k[data-k="purchaser"] { background: rgba(48,209,88,0.16); color: #5ce08a; }
.lg-ds[data-theme="light"] .fx-side-k[data-k="vendor"] { background: rgba(37,99,235,0.12); color: #2563eb; }
.lg-ds[data-theme="light"] .fx-side-k[data-k="purchaser"] { background: rgba(14,120,70,0.1); color: #0e7846; }
.fx-side-name { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.fx-side-status { font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
.fx-side-status svg { width: 13px; height: 13px; }
.fx-ss-ok { color: var(--lg-ok); } .fx-ss-warn { color: #e0902a; } .fx-ss-danger { color: var(--lg-danger-ink); } .fx-ss-info { color: var(--lg-info); } .fx-ss-neutral { color: var(--lg-ink-3); }
.lg-ds[data-theme="dark"] .fx-ss-warn { color: #ffb84d; }
.lg-ds[data-theme="dark"] .fx-ss-ok { color: #5ce08a; }

/* channel history */
.fx-hist { display: flex; flex-direction: column; gap: 2px; }
.fx-hline { display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 9px; padding: 6px 4px; border-radius: 8px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; color: inherit; transition: background var(--lg-fast); }
.fx-hline:hover { background: var(--lg-hover); }
.fx-hline-ic { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; position: relative; background: var(--lg-fill); }
.fx-hline-ic svg { width: 13px; height: 13px; }
.fx-hline-ic[data-ch="email"] { color: #6f9bff; } .fx-hline-ic[data-ch="whatsapp"] { color: #1fc96a; } .fx-hline-ic[data-ch="call"] { color: var(--lg-accent-ink); }
.fx-hline-pip { position: absolute; right: -2px; bottom: -2px; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--lg-base); }
.fx-hline-b { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.fx-hline-t { font-size: 12.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fx-hline-s { font-size: 11px; color: var(--lg-ink-3); display: flex; align-items: center; gap: 6px; }
.fx-hline-auto { font-size: 9.5px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: var(--lg-ink-3); background: var(--lg-fill); padding: 1px 5px; border-radius: 4px; }
.fx-hline-when { font-size: 11px; color: var(--lg-ink-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.fx-hist-more { font-size: 11.5px; font-weight: 600; color: var(--lg-ink-2); background: none; border: none; cursor: pointer; padding: 5px 4px; align-self: flex-start; }
.fx-hist-more:hover { color: var(--lg-accent-ink); }
.fx-hist-empty { font-size: 12px; color: var(--lg-ink-3); padding: 4px; }

/* side action bar */
.fx-sacts { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-top: auto; padding-top: 11px; border-top: 1px solid var(--lg-line-2); }
.fx-act { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 7px 11px; border-radius: 9px; border: 1px solid var(--lg-line); background: var(--lg-fill); color: var(--lg-ink); cursor: pointer; transition: background var(--lg-fast), border-color var(--lg-fast), transform var(--lg-fast); }
.fx-act svg { width: 14px; height: 14px; }
.fx-act:hover { border-color: var(--lg-ink-3); background: var(--lg-hover); }
.fx-act:active { transform: scale(0.97); }
.fx-act--primary { background: var(--lg-accent); border-color: var(--lg-accent); color: #fff; box-shadow: 0 3px 11px rgba(255,107,74,0.3); }
.fx-act--primary:hover { filter: brightness(1.06); background: var(--lg-accent); border-color: var(--lg-accent); }
.fx-act--muted { color: var(--lg-ink-2); background: none; border-color: transparent; }
.fx-act--muted:hover { background: var(--lg-hover); }

/* covered banner */
.fx-covered { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 600; color: var(--lg-ok); }
.fx-covered svg { width: 14px; height: 14px; }
.fx-covered button { font: inherit; font-size: 11.5px; color: var(--lg-ink-3); background: none; border: none; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.fx-covered button:hover { color: var(--lg-ink); }

/* empty / caught up */
.fx-caught { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 48px 20px; text-align: center; color: var(--lg-ink-3); }
.fx-caught-ic { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: rgba(48,209,88,0.14); color: var(--lg-ok); }
.fx-caught-ic svg { width: 24px; height: 24px; }
.fx-caught h3 { font-size: 15px; font-weight: 600; color: var(--lg-ink); margin: 0; }
.fx-caught p { font-size: 12.5px; margin: 0; max-width: 260px; }

.fx-detail-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--lg-ink-3); text-align: center; padding: 40px; }
.fx-detail-empty svg { width: 30px; height: 30px; opacity: 0.6; }
.fx-detail-empty p { font-size: 12.5px; margin: 0; }
.fx-kbd { font-size: 10.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--lg-fill); border: 1px solid var(--lg-line); border-radius: 5px; padding: 1px 5px; color: var(--lg-ink-2); }

/* skeleton */
.fx-skelrow { display: grid; grid-template-columns: 40px 1fr; gap: 12px; align-items: center; padding: 11px 13px; }
.fx-skelbar { height: 10px; border-radius: 6px; background: linear-gradient(90deg, rgba(128,128,140,0.1) 25%, rgba(128,128,140,0.2) 37%, rgba(128,128,140,0.1) 63%); background-size: 400% 100%; animation: fxshim 1.4s ease infinite; }
@keyframes fxshim { from { background-position: 100% 0; } to { background-position: 0 0; } }

/* mock composer body */
.fx-form { display: flex; flex-direction: column; gap: 12px; }
.fx-form-to { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--lg-ink-2); padding: 8px 2px; border-bottom: 1px solid var(--lg-line-2); }
.fx-form-to b { color: var(--lg-ink); font-weight: 600; }

/* responsive: single column, detail becomes a drawer handled in JS */
@media (max-width: 1080px) {
  .fx-body { grid-template-columns: 1fr; }
  .fx-detail-inline { display: none; }
  .fx-sides { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .fx-shell { padding: 12px 12px 0; }
  .fx-top { flex-wrap: wrap; gap: 10px; }
  .fx-cov { order: 3; }
}
@media (prefers-reduced-motion: reduce) {
  .fx-cov-ring, .fx-theme-knob, .fx-skelbar { transition: none; animation: none; }
}
`;
