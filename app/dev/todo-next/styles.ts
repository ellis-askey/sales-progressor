// Route-local styles for /dev/todo-next. Built on the library's --lg tokens (no new
// glass engine). Tone tokens below are the only additions, for due/overdue states.
export const TODONEXT_CSS = `
.lg-ds[data-theme="dark"]{ --tn-warn:#f0a95a; --tn-danger:#ff6f6f; --tn-ok:#49c58e; --tn-info:#5cc2ff; --tn-sel:rgba(255,107,74,.10); }
.lg-ds[data-theme="light"]{ --tn-warn:#c0781e; --tn-danger:#d64545; --tn-ok:#1f9e63; --tn-info:#1f87d6; --tn-sel:rgba(255,107,74,.08); }

.tn-root{ position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; background:var(--lg-base); color:var(--lg-ink); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif; letter-spacing:-.01em; -webkit-font-smoothing:antialiased; padding-bottom:80px; }
.tn-muted{ color:var(--lg-ink-3); }

/* preview banner */
.tn-banner{ position:relative; z-index:3; display:flex; align-items:center; gap:9px; justify-content:center; padding:8px 16px; font-size:12px; background:color-mix(in srgb, var(--lg-accent) 14%, var(--lg-base)); border-bottom:1px solid color-mix(in srgb, var(--lg-accent) 34%, transparent); color:var(--lg-ink); }
.tn-banner svg{ color:var(--lg-accent-ink); flex-shrink:0; } .tn-banner b{ font-weight:700; }

/* top bar */
.tn-top{ position:relative; z-index:2; max-width:1240px; margin:0 auto; padding:22px 24px 10px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.tn-top-id h1{ font-size:26px; font-weight:800; letter-spacing:-.03em; } .tn-top-id p{ font-size:13px; color:var(--lg-ink-2); margin-top:3px; }
.tn-top-actions{ display:flex; align-items:center; gap:8px; }
.tn-theme{ width:46px; height:28px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; } .tn-theme.on{ background:var(--lg-accent-soft); } .tn-theme-knob{ position:absolute; top:2px; left:2px; width:22px; height:22px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); transition:transform .4s cubic-bezier(.3,1.35,.4,1); } .tn-theme.on .tn-theme-knob{ transform:translateX(18px); }

/* filter bar */
.tn-filterbar{ position:relative; z-index:2; max-width:1240px; margin:0 auto; padding:6px 24px 14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.tn-search{ flex:1; min-width:200px; max-width:340px; } .tn-search .tl-input{ padding:7px 11px; }

/* body grid */
.tn-body{ position:relative; z-index:2; max-width:1240px; margin:0 auto; padding:0 24px; display:grid; grid-template-columns:minmax(340px,440px) 1fr; gap:18px; align-items:start; }
@media (max-width:940px){ .tn-body{ grid-template-columns:1fr; } .tn-detail{ position:static !important; max-height:none !important; } }

/* list */
.tn-list{ display:flex; flex-direction:column; gap:14px; }
.tn-listhead{ display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; letter-spacing:.02em; color:var(--lg-ink-2); text-transform:uppercase; padding:2px 2px 0; } .tn-listhead svg{ color:var(--lg-ink-3); }
.tn-empty{ padding:40px 20px; text-align:center; border:1px solid var(--lg-line-2); border-radius:14px; background:var(--lg-fill); } .tn-empty p{ font-size:13px; color:var(--lg-ink-3); }
.tn-section{ display:flex; flex-direction:column; gap:8px; }
.tn-sec-label{ font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--lg-ink-3); padding:4px 2px 0; }
.tn-sec-label.tn-tone-danger{ color:var(--tn-danger); } .tn-sec-label.tn-tone-warn{ color:var(--tn-warn); }

/* property group (solid, dense) */
.tn-group{ border:1px solid var(--lg-line-2); border-radius:14px; background:var(--lg-fill); overflow:hidden; } .lg-ds[data-theme="light"] .tn-group{ background:#fff; }
.tn-group.dimmed{ opacity:.66; }
.tn-group-head{ padding:8px 12px; border-bottom:1px solid var(--lg-line-2); }
.tn-group-id{ display:flex; align-items:center; gap:9px; text-decoration:none; min-width:0; } .tn-group-addr{ font-size:12.5px; font-weight:650; color:var(--lg-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .tn-group-addr em{ font-style:normal; color:var(--lg-ink-3); font-weight:500; margin-left:6px; } .tn-group-id:hover .tn-group-addr{ color:var(--lg-accent-ink); }
.tn-group-quick{ font-size:12.5px; font-weight:650; color:var(--lg-ink-3); }

/* rows */
.tn-row{ display:flex; align-items:flex-start; gap:11px; padding:11px 13px; border-bottom:1px solid var(--lg-line-2); cursor:pointer; position:relative; transition:background .12s; }
.tn-group .tn-row:last-child{ border-bottom:none; }
.tn-row:hover{ background:var(--lg-hover); } .tn-row.sel{ background:var(--tn-sel); box-shadow:inset 3px 0 0 var(--lg-accent); }
.tn-row.done .tn-row-title{ text-decoration:line-through; color:var(--lg-ink-3); font-weight:400; }
.tn-row--rev{ border:1px solid var(--lg-line-2); border-radius:12px; background:var(--lg-fill); margin-bottom:8px; } .lg-ds[data-theme="light"] .tn-row--rev{ background:#fff; }
.tn-circle{ flex-shrink:0; margin-top:1px; width:20px; height:20px; display:grid; place-items:center; background:none; border:none; padding:0; cursor:pointer; color:var(--lg-ink-3); transition:color .15s,transform .15s; } .tn-circle:hover{ color:var(--tn-ok); transform:scale(1.08); } .tn-circle.on{ color:var(--tn-ok); } .tn-circle-warn:not(.on):hover{ color:var(--tn-warn); }
.tn-row-holdicon{ flex-shrink:0; margin-top:1px; width:20px; height:20px; display:grid; place-items:center; color:var(--tn-warn); }
.tn-row-main{ flex:1; min-width:0; }
.tn-row-titlerow{ display:flex; align-items:center; gap:7px; }
.tn-row-title{ font-size:13px; font-weight:550; color:var(--lg-ink); line-height:1.35; overflow:hidden; text-overflow:ellipsis; }
.tn-row-sub{ font-size:12px; color:var(--lg-ink-2); margin-top:2px; line-height:1.35; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tn-row-addr{ font-size:11px; color:var(--lg-ink-3); margin-top:3px; }
.tn-row-note{ font-size:11.5px; color:var(--lg-ink-2); margin-top:4px; line-height:1.4; } .tn-row-note b{ color:var(--lg-ink-3); font-weight:700; margin-right:4px; }
.tn-row-right{ flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
.tn-row-created{ font-size:11px; color:var(--lg-ink-3); }
.tn-row--rev .tn-thumb{ margin-top:1px; }

/* pick (multi-select) */
.tn-pick{ width:16px; height:16px; border-radius:5px; border:1.5px solid var(--lg-line); background:transparent; cursor:pointer; opacity:0; transition:opacity .12s,border-color .12s,background .12s; display:grid; place-items:center; padding:0; } .tn-row:hover .tn-pick, .tn-pick.on{ opacity:1; } .tn-pick.on{ background:var(--lg-accent); border-color:var(--lg-accent); } .tn-pick span{ width:7px; height:7px; border-radius:2px; background:#fff; opacity:0; } .tn-pick.on span{ opacity:1; }

/* due + pills */
.tn-due{ display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:650; color:var(--lg-ink-3); white-space:nowrap; }
.tn-tone-muted{ color:var(--lg-ink-3); } .tn-tone-warn{ color:var(--tn-warn); } .tn-tone-danger{ color:var(--tn-danger); } .tn-tone-ok{ color:var(--tn-ok); }
.tn-pill{ display:inline-flex; align-items:center; font-size:10px; font-weight:700; letter-spacing:.02em; text-transform:uppercase; padding:2px 7px; border-radius:999px; flex-shrink:0; }
.tn-pill-warn{ color:var(--tn-warn); background:color-mix(in srgb, var(--tn-warn) 16%, transparent); }
.tn-pill-info{ color:var(--tn-info); background:color-mix(in srgb, var(--tn-info) 16%, transparent); }
.tn-pill-coral{ color:var(--lg-accent-ink); background:var(--lg-accent-soft); }
.tn-pill-review{ color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); }

/* thumbnails */
.tn-thumb{ border-radius:8px; object-fit:cover; flex-shrink:0; background:var(--lg-fill); } .tn-thumb--ph{ display:grid; place-items:center; color:var(--lg-ink-3); border:1px solid var(--lg-line-2); }

/* completed disclosure */
.tn-doneblock{ margin-top:4px; }
.tn-disclosure{ display:flex; align-items:center; gap:7px; width:100%; text-align:left; background:none; border:none; cursor:pointer; font:inherit; font-size:12px; font-weight:650; color:var(--lg-ink-3); padding:7px 2px; } .tn-disclosure:hover{ color:var(--lg-ink); }
.tn-caret{ display:inline-block; transition:transform .2s; font-size:15px; line-height:1; } .tn-caret.open{ transform:rotate(90deg); }

/* detail pane */
.tn-detail{ position:sticky; top:16px; max-height:calc(100vh - 32px); overflow:auto; border:1px solid var(--lg-line-2); border-radius:18px; background:var(--lg-fill); } .lg-ds[data-theme="light"] .tn-detail{ background:#fff; }
.tn-detail-empty{ padding:40px 24px; }
.tn-dp{ padding:22px; display:flex; flex-direction:column; gap:14px; }
.tn-dp-top{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.tn-dp-file{ display:flex; align-items:center; gap:10px; text-decoration:none; min-width:0; } .tn-dp-file span{ display:flex; flex-direction:column; font-size:13.5px; font-weight:700; color:var(--lg-ink); } .tn-dp-file em{ font-style:normal; font-size:11px; font-weight:600; color:var(--lg-accent-ink); display:inline-flex; align-items:center; gap:4px; margin-top:1px; }
.tn-dp-quick{ font-size:13px; font-weight:700; color:var(--lg-ink-3); } .tn-dp-toppills{ display:flex; align-items:center; gap:8px; }
.tn-dp-title{ font-size:19px; font-weight:750; letter-spacing:-.02em; line-height:1.25; } .tn-dp-title.done{ text-decoration:line-through; color:var(--lg-ink-3); }
.tn-dp-notes{ font-size:13.5px; color:var(--lg-ink-2); line-height:1.5; } .tn-dp-meta{ font-size:12px; color:var(--lg-ink-3); }
.tn-dp-update{ padding:10px 12px; border-radius:10px; background:var(--lg-hover); border-left:2px solid var(--lg-accent); } .tn-dp-update span{ font-size:10px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:var(--lg-ink-3); } .tn-dp-update p{ font-size:13px; color:var(--lg-ink); margin-top:3px; line-height:1.45; }
.tn-dp-actions{ display:flex; gap:9px; flex-wrap:wrap; }
.tn-dp-sec{ border-top:1px solid var(--lg-line-2); padding-top:14px; display:flex; flex-direction:column; gap:10px; } .tn-dp-sec h3{ font-size:12px; font-weight:700; letter-spacing:.02em; text-transform:uppercase; color:var(--lg-ink-2); }
.tn-dp-hint{ font-size:12px; color:var(--lg-ink-3); line-height:1.45; } .tn-dp-hint b{ color:var(--tn-warn); }
.tn-dp-row{ display:flex; gap:8px; align-items:center; }
.tn-dp-foot{ border-top:1px solid var(--lg-line-2); padding-top:12px; }

/* composer bits */
.tn-cb{ padding:2px 0; } .tn-cb-hint{ display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--lg-ink-3); margin-top:4px; } .tn-cb-hint svg{ color:var(--lg-accent-ink); }
.tn-warnrow{ display:flex; align-items:center; gap:8px; font-size:12px; color:var(--lg-ink-2); background:color-mix(in srgb, var(--tn-warn) 12%, transparent); border:1px solid color-mix(in srgb, var(--tn-warn) 30%, transparent); border-radius:10px; padding:9px 12px; margin-bottom:4px; } .tn-warnrow svg{ color:var(--tn-warn); flex-shrink:0; } .tn-warnrow b{ color:var(--lg-ink); }

/* floating lens selection bar */
.tn-selbar-wrap{ position:fixed; z-index:40; left:50%; bottom:22px; transform:translateX(-50%); }
.tn-selbar{ display:flex; align-items:center; gap:12px; padding:10px 14px; color:#fff; } .lg-ds[data-theme="light"] .tn-selbar{ color:#fff; }
.tn-selbar-n{ font-size:13px; font-weight:700; } .tn-selbar-sep{ width:1px; height:18px; background:rgba(255,255,255,.3); }
.tn-selbar-btn{ display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.2); color:#fff; font:inherit; font-size:12.5px; font-weight:600; padding:6px 11px; border-radius:9px; cursor:pointer; } .tn-selbar-btn:hover{ background:rgba(255,255,255,.22); } .tn-selbar-btn svg{ width:15px; height:15px; }
.tn-selbar-demo{ font-size:10.5px; color:rgba(255,255,255,.7); font-style:italic; }
.tn-selbar-x{ display:grid; place-items:center; width:26px; height:26px; border-radius:7px; background:rgba(255,255,255,.12); border:none; color:#fff; cursor:pointer; } .tn-selbar-x:hover{ background:rgba(255,255,255,.22); }

@media (prefers-reduced-motion: reduce){ .tn-root *{ animation:none !important; transition:none !important; } }
`;
