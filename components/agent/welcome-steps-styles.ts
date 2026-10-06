// Shared styles for the stepped welcome modals (SelfManagedWelcomeModal +
// ProgressorWelcomeModal). Self-contained (explicit colours, light + dark) because
// the modal portals to <body> outside the agent token scope. The `agent-modal-in`
// and `welcome-zoom-out` keyframes it references are defined globally (agent-system
// / globals.css), loaded under /agent. Keep both welcomes importing this so they
// stay visually identical.

export const WELCOME_STEPS_CSS = `
.pw-card {
  position: relative; overflow-y: auto; overflow-x: hidden;
  width: min(864px, calc(100vw - 72px));
  border-radius: 16px;
}
.pw-card[data-pw-theme="light"] {
  --surface:#ffffff; --coral:#FF6B4A; --coral-tint:rgba(255,138,101,0.12);
  --cta-from:#FF7E57; --cta-to:#F0511A; --cta-shadow:rgba(240,81,26,0.30); --cta-shadow-hi:rgba(240,81,26,0.42);
  --heading:#0F1B2D; --body:#54617d; --muted:#9aa3b2;
  --row-border:rgba(45,24,16,0.10); --row-bg:rgba(45,24,16,0.015); --switch-off:rgba(45,24,16,0.18);
  --card-border:rgba(45,24,16,0.10); --card-shadow:0 24px 64px rgba(45,24,16,0.16),0 4px 16px rgba(45,24,16,0.07);
}
.pw-card[data-pw-theme="dark"] {
  --surface:#1e293b; --coral:#FF6B4A; --coral-tint:rgba(255,107,74,0.16);
  --cta-from:#FF7E57; --cta-to:#F0511A; --cta-shadow:rgba(240,81,26,0.40); --cta-shadow-hi:rgba(240,81,26,0.55);
  --heading:#EFF6FF; --body:#94A3B8; --muted:#64748B;
  --row-border:rgba(255,255,255,0.10); --row-bg:rgba(255,255,255,0.03); --switch-off:rgba(255,255,255,0.20);
  --card-border:rgba(255,255,255,0.10); --card-shadow:0 28px 70px rgba(0,0,0,0.55),0 6px 20px rgba(0,0,0,0.40);
}
.pw-card { background: var(--surface); border: 0.5px solid var(--card-border); box-shadow: var(--card-shadow); }
/* No visible scrollbar — content is sized to fit; the overflow is only a safety net. */
.pw-card { scrollbar-width: none; -ms-overflow-style: none; }
.pw-card::-webkit-scrollbar { width: 0; height: 0; display: none; }

/* Entrance/exit (modal). Overridden to a slide for the drawer below. */
.pw-card { animation: agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both; }
.pw-card.pw-closing { animation: welcome-zoom-out 420ms cubic-bezier(0.4,0,1,1) both; }
.pw-overlay { display:flex; align-items:center; justify-content:center; padding:0; }

.pw-close { position:absolute; top:14px; right:14px; z-index:4; width:26px; height:26px; border-radius:50%;
  display:inline-flex; align-items:center; justify-content:center; background:transparent; border:0; cursor:pointer;
  color:var(--muted); transition:background 140ms ease,color 140ms ease,transform 140ms ease; }
.pw-close:hover { background:var(--row-bg); color:var(--body); }
.pw-close:active { transform:scale(0.88); }

.pw-col { position:relative; z-index:1; max-width:none; padding:40px 54px 34px; display:flex; flex-direction:column; }

.pw-dots { display:flex; gap:6px; align-items:center; margin-bottom:16px; }
.pw-dot { height:6px; width:6px; border-radius:999px; background:var(--row-border); transition:all 220ms ease; }
.pw-dot.on { width:20px; background:var(--coral); }

.pw-eyebrow { font-size:11.5px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--coral); }
.pw-title { margin:11px 0 0; font-size:25px; line-height:1.12; font-weight:800; letter-spacing:-0.5px; color:var(--heading); }
.pw-lede { margin:11px 0 0; font-size:14.5px; line-height:1.55; color:var(--body); text-wrap:balance; }

.pw-points { list-style:none; margin:22px 0 0; padding:0; display:flex; flex-direction:column; gap:3px; }
.pw-points li { display:flex; gap:13px; align-items:flex-start; padding:11px 0; }
.pw-chip { flex-shrink:0; width:30px; display:inline-flex; align-items:flex-start; justify-content:center; color:var(--coral); }
.pw-pt-t { display:block; font-size:14.5px; font-weight:700; color:var(--heading); letter-spacing:-0.2px; }
.pw-pt-d { display:block; margin-top:2px; font-size:13px; line-height:1.5; color:var(--body); }

/* Filled coral badges + divided rows. Opt in with .pw-points.pw-badges. */
.pw-points.pw-badges { gap:0; }
.pw-points.pw-badges li { padding:14px 0; gap:15px; border-top:0.5px solid var(--row-border); }
.pw-points.pw-badges li:first-child { border-top:0; padding-top:4px; }
.pw-points.pw-badges .pw-chip { width:42px; height:42px; border-radius:50%;
  background:linear-gradient(180deg,var(--cta-from),var(--cta-to)); color:#fff;
  align-items:center; justify-content:center; box-shadow:0 5px 14px var(--cta-shadow); }
.pw-points.pw-badges .pw-chip svg { width:20px; height:20px; }

.pw-toggles { margin:20px 0 0; display:flex; flex-direction:column; border-radius:14px; overflow:hidden; border:1px solid var(--row-border); }
.pw-trow { display:flex; gap:12px; align-items:flex-start; padding:15px; background:var(--surface); border-top:1px solid var(--row-border); }
.pw-trow:first-child { border-top:0; }
.pw-tx { flex:1; min-width:0; }
.pw-tr-t { display:block; font-size:13.8px; font-weight:700; color:var(--heading); letter-spacing:-0.2px; }
.pw-tr-d { display:block; margin-top:3px; font-size:12.5px; line-height:1.45; color:var(--body); }

.pw-switch { position:relative; height:22px; width:38px; border-radius:999px; border:0; padding:0; flex-shrink:0;
  background:var(--switch-off); cursor:pointer; transition:background 140ms ease; margin-top:2px; }
.pw-switch[aria-checked="true"] { background:var(--coral); }
.pw-knob { position:absolute; top:2px; left:2px; height:18px; width:18px; border-radius:999px; background:#fff;
  box-shadow:0 1px 3px rgba(0,0,0,0.22); transition:transform 150ms cubic-bezier(0.34,1.3,0.64,1); }
.pw-switch[aria-checked="true"] .pw-knob { transform:translateX(16px); }

.pw-footnote { margin:14px 2px 0; font-size:12px; line-height:1.5; color:var(--muted); }

/* Step content cross-fade: fades out before the step swaps, fades back in while the
   card morphs. Driven by the .is-out class on step change. */
.pw-stepbody { transition: opacity 240ms ease; }
.pw-stepbody.is-out { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .pw-stepbody { transition: none; } }

.pw-ready-logo { display:block; width:54px; height:54px; border-radius:50%; margin:2px 0 0; }

/* Footer action row: secondary on the left, primary on the right (desktop). */
.pw-foot { margin-top:26px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
.pw-cta { width:auto; display:flex; align-items:center; justify-content:center; gap:10px; border:0; border-radius:14px;
  cursor:pointer; padding:14px 26px; font:inherit; font-size:15px; font-weight:700; color:#fff;
  background:linear-gradient(180deg,var(--cta-from) 0%,var(--cta-to) 100%); box-shadow:0 6px 16px var(--cta-shadow);
  transition:transform 140ms ease,box-shadow 160ms ease,filter 160ms ease; }
.pw-cta:hover { transform:translateY(-1px); box-shadow:0 10px 24px var(--cta-shadow-hi); filter:saturate(1.05) brightness(1.02); }
.pw-cta:active { transform:translateY(0); }
.pw-ghost { width:auto; border:0; background:transparent; cursor:pointer; font:inherit; font-size:13.5px; font-weight:600;
  color:var(--muted); padding:8px 10px; border-radius:10px; transition:color 140ms ease; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
.pw-ghost:hover { color:var(--coral); }
/* Coral-outline secondary — white fill, coral outline + text, warms to a faint coral on hover. */
.pw-secondary { width:auto; display:inline-flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;
  font:inherit; font-size:15px; font-weight:700; color:var(--cta-to); background:var(--surface);
  border:0.5px solid rgba(255,107,74,0.5); border-radius:14px; padding:14px 24px;
  transition:background 140ms ease, border-color 140ms ease, transform 90ms ease; }
.pw-secondary:hover { background:rgba(255,107,74,0.08); border-color:rgba(255,107,74,0.75); }
.pw-secondary:active { transform:scale(0.98); }
.pw-linkrow { display:flex; align-items:center; justify-content:flex-start; margin-top:18px; }
.pw-back { border:0; background:transparent; cursor:pointer; font:inherit; font-size:13.5px; font-weight:600; color:var(--muted);
  padding:6px 2px; display:inline-flex; align-items:center; gap:6px; transition:color 140ms ease; }
.pw-back:hover { color:var(--body); }

@media (max-width: 767px) {
  .pw-card { width:100%; max-width:440px; }
  .pw-col { max-width:100%; padding:32px 28px 26px; }
  /* Stack the footer; the primary button sits on top with its text + arrow centred. */
  .pw-foot { flex-direction:column-reverse; align-items:stretch; }
  .pw-foot .pw-cta, .pw-foot .pw-ghost, .pw-foot .pw-back, .pw-foot .pw-secondary { width:100%; justify-content:center; }
}
@media (max-width: 460px) {
  .pw-col { padding:30px 22px 24px; }
  .pw-title { font-size:23px; }
}

/* Below 1200px: become a full-width bottom drawer that slides up. Scoped to
   .pw-overlay so only the welcome uses it. */
@media (max-width: 1199px) {
  .pw-overlay { align-items:flex-end; }
  .pw-overlay .pw-card {
    width:100%; max-width:none; border-radius:22px 22px 0 0;
    animation: pw-drawer-up 360ms cubic-bezier(0.22,1,0.36,1) both;
  }
  .pw-overlay .pw-card.pw-closing { animation: pw-drawer-down 300ms cubic-bezier(0.4,0,1,1) both; }
}
@keyframes pw-drawer-up { from { transform:translateY(100%); } to { transform:translateY(0); } }
@keyframes pw-drawer-down { from { transform:translateY(0); } to { transform:translateY(100%); } }

/* Short viewports: the wide chases step lays its options out in two columns so
   they stay on-screen without scrolling. The odd last option spans the full row. */
@media (min-width: 768px) and (max-height: 760px) {
  .pw-toggles { display:grid; grid-template-columns:1fr 1fr; }
  .pw-trow { border-top:1px solid var(--row-border); border-left:1px solid var(--row-border); }
  .pw-trow:nth-child(-n+2) { border-top:0; }
  .pw-trow:nth-child(odd) { border-left:0; }
  .pw-trow:last-child:nth-child(odd) { grid-column:1 / -1; }
}
`;
