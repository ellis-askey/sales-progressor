// Route-local styles for /dev/hub-next. Uses the --lg tokens + the material tokens
// from components/liquid/ui (GLASS_CSS). Light + dark first-class. No shared edits.
export const HUB_CSS = `
.lg-ds[data-theme="dark"]{ --h-danger:#ff6f6f; --h-warn:#f0a95a; --h-info:#5cc2ff; --h-ok:#49c58e; }
.lg-ds[data-theme="light"]{ --h-danger:#d64545; --h-warn:#c0781e; --h-info:#1f87d6; --h-ok:#1f9e63; }

.hub-root{ position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; background:var(--lg-base); color:var(--lg-ink); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif; letter-spacing:-.011em; -webkit-font-smoothing:antialiased; }
.hub-aurora{ position:fixed; inset:0; z-index:0; pointer-events:none; background:radial-gradient(42% 40% at 8% 2%, rgba(255,107,74,.16), transparent 62%), radial-gradient(40% 38% at 94% 6%, rgba(56,160,248,.13), transparent 66%), radial-gradient(48% 46% at 78% 98%, rgba(150,110,255,.12), transparent 66%), radial-gradient(40% 40% at 28% 100%, rgba(50,200,150,.08), transparent 64%); }
.lg-ds[data-theme="light"] .hub-aurora{ background:radial-gradient(44% 42% at 8% 0%, rgba(255,150,110,.26), transparent 64%), radial-gradient(42% 40% at 95% 4%, rgba(90,170,255,.22), transparent 68%), radial-gradient(50% 48% at 80% 100%, rgba(165,120,255,.2), transparent 66%), radial-gradient(40% 40% at 26% 100%, rgba(70,200,150,.14), transparent 64%); }
.hub-wrap{ position:relative; z-index:1; max-width:1040px; margin:0 auto; padding:40px 28px 140px; }

/* hero */
.hub-hero{ display:flex; align-items:flex-start; justify-content:space-between; gap:24px; }
.hub-greet{ font-size:13px; font-weight:560; color:var(--lg-ink-2); margin-bottom:8px; }
.hub-hero h1{ font-size:clamp(26px,3.4vw,34px); font-weight:680; letter-spacing:-.035em; line-height:1.14; max-width:620px; } .hub-dim{ color:var(--lg-ink-3); font-weight:600; }
.hub-hero-r{ display:flex; align-items:center; gap:14px; flex-shrink:0; }
.hub-asof{ display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--lg-ink-3); } .hub-asof svg{ width:14px; height:14px; }
.hub-theme{ width:50px; height:30px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; box-shadow:inset 0 1px 2px rgba(0,0,0,.08); } .hub-theme.on{ background:var(--lg-accent-soft); } .hub-theme-knob{ position:absolute; top:2px; left:2px; width:24px; height:24px; border-radius:50%; background:var(--surface-2); box-shadow:var(--sh-ctl), inset 0 1px 0 var(--edge-top); display:grid; place-items:center; transition:transform .4s cubic-bezier(.3,1.35,.4,1); } .hub-theme-knob svg{ width:13px; height:13px; color:var(--lg-ink-2); } .hub-theme.on .hub-theme-knob{ transform:translateX(20px); }

/* pulse */
.hub-pulse{ display:flex; align-items:stretch; gap:0; margin-top:24px; padding:18px 8px; }
.hub-stat{ flex:1; display:flex; flex-direction:column; gap:3px; padding:0 20px; border-left:1px solid var(--lg-line-2); } .hub-stat:first-child{ border-left:none; }
.hub-stat-n{ font-size:26px; font-weight:680; letter-spacing:-.03em; color:var(--lg-ink); } .hub-stat-n.accent{ color:var(--lg-accent-ink); } .hub-stat-l{ font-size:12px; color:var(--lg-ink-3); }

/* stage band */
.hub-stages{ display:flex; gap:9px; margin-top:16px; flex-wrap:wrap; }
.hub-stage{ display:flex; align-items:center; gap:9px; padding:9px 14px; border-radius:12px; background:var(--surface); border:1px solid var(--lg-line); box-shadow:var(--sh-ctl), inset 0 1px 0 var(--edge-top); cursor:pointer; transition:border-color .14s, transform .08s; } .hub-stage:hover{ border-color:var(--lg-ink-3); } .hub-stage:active{ transform:translateY(.5px); } .hub-stage.on{ border-color:var(--lg-accent); box-shadow:0 0 0 1px var(--lg-accent), inset 0 1px 0 var(--edge-top); }
.hub-stage-n{ font-size:16px; font-weight:680; letter-spacing:-.02em; } .hub-stage-l{ font-size:12.5px; color:var(--lg-ink-2); font-weight:550; }

/* main */
.hub-main{ margin-top:30px; }
.hub-mainhead{ display:flex; align-items:center; gap:12px; margin-bottom:14px; }
.hub-clear{ display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 11px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-fill); font:inherit; font-size:12px; font-weight:560; color:var(--lg-ink-2); cursor:pointer; } .hub-clear svg{ width:10px; height:10px; }

.hub-rows{ display:flex; flex-direction:column; border-radius:16px; overflow:hidden; background:var(--surface); border:1px solid var(--lg-line); box-shadow:var(--sh-ctl), inset 0 1px 0 var(--edge-top); }
.hub-row{ display:flex; align-items:center; gap:13px; padding:13px 15px; cursor:pointer; position:relative; transition:background .13s; } .hub-row + .hub-row{ border-top:1px solid var(--lg-line-2); }
.hub-row:hover{ background:var(--lg-hover); } .hub-row.sel{ background:color-mix(in srgb, var(--lg-accent) 9%, transparent); } .hub-row.sel::before{ content:""; position:absolute; left:0; top:8px; bottom:8px; width:3px; border-radius:3px; background:var(--lg-accent); }
.hub-thumb{ width:44px; height:44px; border-radius:11px; flex-shrink:0; box-shadow:inset 0 0 0 1px rgba(255,255,255,.14); }
.hub-row-main{ flex:1; min-width:0; } .hub-row-top{ display:flex; align-items:baseline; gap:9px; } .hub-row-line{ font-size:14px; font-weight:600; letter-spacing:-.01em; } .hub-row-loc{ font-size:11.5px; color:var(--lg-ink-3); }
.hub-row-reason{ font-size:12.5px; margin-top:3px; font-weight:560; } .hub-row-status{ font-size:12.5px; color:var(--lg-ink-2); margin-top:3px; display:flex; align-items:center; gap:7px; } .hub-dot{ width:7px; height:7px; border-radius:50%; flex-shrink:0; background:currentColor; }
.hub-row-right{ flex-shrink:0; display:flex; align-items:center; gap:6px; } .hub-due{ font-size:11.5px; font-weight:600; white-space:nowrap; }
.hub-rowmenu{ display:grid; place-items:center; width:28px; height:28px; border-radius:7px; color:var(--lg-ink-3); } .hub-rowmenu:hover{ background:var(--lg-hover); color:var(--lg-ink); } .hub-rowmenu svg{ width:17px; height:17px; }
.hub-open{ width:28px; height:28px; border-radius:7px; display:grid; place-items:center; background:none; border:none; color:var(--lg-ink-3); cursor:pointer; opacity:0; transition:opacity .13s; } .hub-row:hover .hub-open{ opacity:1; } .hub-open:hover{ background:var(--lg-hover); color:var(--lg-ink); } .hub-open svg{ width:14px; height:14px; }

.hub-t-danger{ color:var(--h-danger); } .hub-t-warn{ color:var(--h-warn); } .hub-t-info{ color:var(--h-info); } .hub-t-ok{ color:var(--h-ok); } .hub-t-muted{ color:var(--lg-ink-3); }

/* lower panels */
.hub-lower{ display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:28px; } @media (max-width:800px){ .hub-lower{ grid-template-columns:1fr; } }
.hub-panel{ padding:20px; } .hub-panel h3{ font-size:15px; font-weight:650; letter-spacing:-.015em; } .hub-panel-sub{ font-size:12.5px; color:var(--lg-ink-3); margin:3px 0 16px; }
.hub-feed{ display:flex; flex-direction:column; gap:14px; }
.hub-event{ display:flex; align-items:flex-start; gap:11px; } .hub-event p{ font-size:13px; color:var(--lg-ink); line-height:1.4; } .hub-event span{ font-size:11.5px; color:var(--lg-ink-3); }
.hub-ava{ width:28px; height:28px; border-radius:50%; flex-shrink:0; display:grid; place-items:center; font-size:11.5px; font-weight:700; color:#fff; } .hub-ava-staff{ background:var(--lg-accent); } .hub-ava-sol{ background:#6b7280; } .hub-ava-buyer{ background:#2b8a5a; } .hub-ava-seller{ background:#2f6fb0; }

/* forecast */
.hub-forecast{ display:flex; align-items:flex-end; gap:12px; height:140px; }
.hub-fc-col{ flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; height:100%; }
.hub-fc-bar-wrap{ flex:1; width:100%; display:flex; align-items:flex-end; justify-content:center; }
.hub-fc-bar{ width:100%; max-width:36px; border-radius:7px 7px 3px 3px; background:linear-gradient(180deg, var(--lg-accent-ink), var(--lg-accent)); position:relative; min-height:8px; display:flex; justify-content:center; box-shadow:0 2px 8px rgba(224,78,44,.24); } .hub-fc-bar em{ position:absolute; top:-18px; font-size:11px; font-weight:650; font-style:normal; color:var(--lg-ink-2); } .hub-fc-col:first-child .hub-fc-bar{ background:linear-gradient(180deg,#ff8a65,#ff6b4a); }
.hub-fc-lab{ font-size:11px; color:var(--lg-ink-3); }
.hub-fc-sum{ margin-top:18px; padding-top:14px; border-top:1px solid var(--lg-line-2); font-size:12.5px; color:var(--lg-ink-3); } .hub-fc-sum strong{ color:var(--lg-ink); font-weight:650; }

/* floating lens action bar */
.hub-actionwrap{ position:fixed; z-index:50; left:50%; bottom:26px; transform:translateX(-50%); animation:hubrise .32s cubic-bezier(.22,1,.36,1); } @keyframes hubrise{ from{ opacity:0; transform:translate(-50%,10px);} to{ opacity:1; transform:translateX(-50%);} }
.hub-actionbar{ display:flex; align-items:center; gap:10px; padding:10px 12px; color:#fff; }
.hub-ab-name{ font-size:13px; font-weight:650; padding-left:4px; } .hub-ab-sep{ width:1px; height:18px; background:rgba(255,255,255,.28); }
.hub-ab-btn{ display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 12px; border-radius:9px; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.2); color:#fff; font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .14s; } .hub-ab-btn:hover{ background:rgba(255,255,255,.24); } .hub-ab-btn svg{ width:14px; height:14px; }
.hub-ab-x{ width:30px; height:30px; border-radius:8px; display:grid; place-items:center; background:rgba(255,255,255,.12); border:none; color:#fff; cursor:pointer; } .hub-ab-x:hover{ background:rgba(255,255,255,.24); } .hub-ab-x svg{ width:12px; height:12px; }

/* detail drawer */
.hub-detail{ display:flex; flex-direction:column; gap:18px; }
.hub-detail-hero{ height:120px; border-radius:14px; position:relative; overflow:hidden; display:flex; align-items:flex-end; } .hub-detail-heroi{ padding:14px 16px; background:linear-gradient(180deg, transparent, rgba(0,0,0,.45)); width:100%; } .hub-detail-heroi strong{ display:block; color:#fff; font-size:18px; font-weight:700; } .hub-detail-heroi span{ color:rgba(255,255,255,.85); font-size:12.5px; }
.hub-detail-meta{ display:flex; gap:0; } .hub-detail-meta > div{ flex:1; display:flex; flex-direction:column; gap:2px; padding:0 14px; border-left:1px solid var(--lg-line-2); } .hub-detail-meta > div:first-child{ padding-left:0; border-left:none; } .hub-meta-l{ font-size:11px; color:var(--lg-ink-3); } .hub-meta-v{ font-size:14px; font-weight:600; }
.hub-detail-sec h4{ font-size:12px; font-weight:650; color:var(--lg-ink-2); margin-bottom:10px; }
.hub-prog{ height:7px; border-radius:999px; background:var(--lg-fill); overflow:hidden; margin-bottom:14px; } .hub-prog-bar{ display:block; height:100%; border-radius:999px; background:linear-gradient(90deg, var(--lg-accent-ink), var(--lg-accent)); }
.hub-ms{ display:flex; flex-direction:column; gap:10px; } .hub-ms li{ display:flex; align-items:center; gap:9px; font-size:13px; color:var(--lg-ink-3); } .hub-ms li svg{ width:16px; height:16px; color:var(--lg-ink-3); } .hub-ms li.done{ color:var(--lg-ink-2); } .hub-ms li.done svg{ color:var(--h-ok); } .hub-ms li.current{ color:var(--lg-ink); font-weight:600; } .hub-ms li.current svg{ color:var(--lg-accent); } .hub-ms-dot{ width:16px; height:16px; display:inline-grid; place-items:center; } .hub-ms-dot::after{ content:""; width:7px; height:7px; border-radius:50%; border:1.5px solid var(--lg-line); }
.hub-people{ display:flex; flex-direction:column; gap:11px; } .hub-person{ display:flex; align-items:center; gap:10px; } .hub-person b{ display:block; font-size:13px; font-weight:600; } .hub-person span{ font-size:11.5px; color:var(--lg-ink-3); }
.hub-detail-actions{ display:flex; gap:9px; }

/* compose */
.hub-compose{ display:flex; flex-direction:column; gap:5px; } .hub-compose label{ font-size:11px; font-weight:650; color:var(--lg-ink-3); margin-top:8px; } .hub-cfield{ padding:9px 12px; border-radius:10px; background:var(--lg-field); border:1px solid var(--lg-line); font-size:13px; } .hub-cbody{ padding:11px 12px; border-radius:10px; background:var(--lg-field); border:1px solid var(--lg-line); font-size:13px; line-height:1.5; min-height:90px; color:var(--lg-ink-2); } .hub-cnote{ font-size:11.5px; color:var(--lg-ink-3); margin-top:10px; }

@media (max-width:620px){ .hub-pulse{ flex-wrap:wrap; gap:14px 0; } .hub-stat{ flex:1 0 50%; border-left:none; } .hub-wrap{ padding:24px 16px 120px; } }
@media (prefers-reduced-motion: reduce){ .hub-root *{ animation:none !important; } }
`;
