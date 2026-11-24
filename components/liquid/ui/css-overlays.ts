// Overlay + display + scope CSS for the forward Liquid-Glass system (part 2).
export const GLASS_OVERLAY_CSS = `
.tl-trigger{ display:inline-flex; align-items:center; gap:7px; font:inherit; font-size:13.5px; font-weight:600; color:var(--lg-ink); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:11px; padding:9px 13px; cursor:pointer; transition:border-color .2s,background .2s; } .tl-trigger:hover{ border-color:var(--lg-ink-3); } .tl-trigger svg{ width:14px; height:14px; color:var(--lg-ink-3); } .tl-trigger:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.tl-menu{ min-width:210px; padding:6px; } .tl-menu-item{ display:flex; align-items:center; gap:10px; width:100%; text-align:left; font:inherit; font-size:13.5px; font-weight:500; color:var(--lg-ink); background:none; border:none; padding:9px 11px; border-radius:9px; cursor:pointer; transition:background .15s; } .tl-menu-item svg{ width:15px; height:15px; color:var(--lg-ink-3); } .tl-menu-item span{ flex:1; } .tl-menu-item:hover,.tl-menu-item:focus-visible{ background:var(--lg-hover); outline:none; } .tl-menu-item--danger{ color:var(--lg-danger-ink); } .tl-menu-item--danger svg{ color:var(--lg-danger-ink); }
.tl-pop{ padding:14px; } .tl-pop > *{ position:relative; z-index:1; }
.tl-tip-anchor{ display:inline-flex; outline:none; } .tl-tip{ padding:7px 11px; font-size:12px; font-weight:550; color:var(--lg-ink); white-space:nowrap; }

.tl-scrim{ position:fixed; inset:0; z-index:1650; background:rgba(0,0,0,.44); -webkit-backdrop-filter:blur(5px); backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center; padding:20px; animation:tlfadein .22s; } @keyframes tlfadein{ from{opacity:0} to{opacity:1} }
.tl-scrim--end{ justify-content:flex-end; align-items:stretch; padding:0; } .tl-scrim--bottom{ align-items:flex-end; justify-content:center; padding:0; }
.tl-dialog{ width:min(440px,100%); padding:0; } .tl-dialog > *{ position:relative; z-index:1; }
.tl-dialog-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:18px 20px 12px; } .tl-dialog-head strong{ display:block; font-size:17px; font-weight:700; letter-spacing:-.02em; } .tl-eyebrow{ display:block; font-size:12px; font-weight:600; letter-spacing:-.005em; color:var(--lg-accent-ink); margin-bottom:3px; }
.tl-icon-btn{ width:32px; height:32px; border-radius:9px; display:grid; place-items:center; background:var(--surface-2); border:1px solid var(--lg-line); color:var(--lg-ink-2); cursor:pointer; box-shadow:var(--sh-ctl); } .tl-icon-btn:hover{ color:var(--lg-ink); } .tl-icon-btn svg{ width:14px; height:14px; } .tl-icon-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.tl-dialog-body{ padding:4px 20px 18px; font-size:13.5px; color:var(--lg-ink-2); line-height:1.55; } .tl-dialog-foot{ display:flex; justify-content:flex-end; gap:9px; padding:14px 20px; border-top:1px solid var(--lg-line-2); }
.tl-confirm{ width:min(380px,100%); padding:22px; text-align:center; } .tl-confirm > *{ position:relative; z-index:1; } .tl-confirm-ic{ display:inline-grid; place-items:center; width:46px; height:46px; border-radius:50%; background:var(--lg-accent-soft); color:var(--lg-accent-ink); margin-bottom:12px; } .tl-confirm-ic svg{ width:22px; height:22px; } .tl-confirm-ic--danger{ background:rgba(255,69,58,.16); color:var(--lg-danger-ink); } .tl-confirm strong{ display:block; font-size:16px; font-weight:750; } .tl-confirm p{ font-size:13px; color:var(--lg-ink-2); margin:7px 0 18px; line-height:1.5; } .tl-confirm-foot{ display:flex; justify-content:center; gap:9px; }
.tl-drawer{ width:min(460px,100%); height:100%; border-radius:0; border-left:1px solid var(--lg-line); display:flex; flex-direction:column; } .tl-drawer-body{ flex:1; overflow:auto; padding:18px 20px; font-size:13.5px; color:var(--lg-ink-2); line-height:1.55; display:flex; flex-direction:column; gap:12px; }
.tl-sheet{ width:100%; max-width:640px; border-radius:22px 22px 0 0; padding-bottom:6px; } .tl-sheet-grab{ display:block; width:38px; height:4px; border-radius:999px; background:var(--lg-line); margin:10px auto 2px; } .tl-sheet-head{ padding:6px 20px 10px; } .tl-sheet-head strong{ font-size:16px; font-weight:750; }

.tl-toast-stack{ position:fixed; z-index:1700; right:22px; bottom:22px; display:flex; flex-direction:column; gap:10px; align-items:flex-end; } @media (max-width:560px){ .tl-toast-stack{ left:16px; right:16px; align-items:stretch; } }
.tl-toast{ display:inline-flex; align-items:center; gap:9px; padding:11px 15px; font-size:13px; font-weight:550; color:var(--lg-ink); } .tl-toast-ic{ display:inline-grid; place-items:center; color:#5ce08a; } .tl-toast-ic svg{ width:14px; height:14px; } .tl-toast-ic--info{ color:var(--lg-info,#5cc2ff); } .tl-toast-ic--warn{ color:var(--lg-warn,#f0a95a); }
.tl-note{ display:flex; align-items:flex-start; gap:11px; padding:13px 14px; width:min(360px,calc(100vw - 32px)); } .tl-note-ic{ display:inline-grid; place-items:center; width:30px; height:30px; border-radius:9px; background:rgba(48,209,88,.16); color:#5ce08a; flex-shrink:0; } .tl-note-ic svg{ width:16px; height:16px; } .tl-note-ic--info{ background:rgba(94,155,255,.16); color:var(--lg-info,#5cc2ff); } .tl-note-ic--warn{ background:rgba(255,159,10,.16); color:var(--lg-warn,#f0a95a); }
.tl-note-body{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; } .tl-note-body strong{ font-size:13px; font-weight:650; } .tl-note-body span{ font-size:12px; color:var(--lg-ink-2); line-height:1.45; } .tl-note-act{ align-self:flex-start; margin-top:6px; display:inline-flex; align-items:center; gap:4px; font:inherit; font-size:12px; font-weight:650; color:var(--lg-accent-ink); background:none; border:none; padding:0; cursor:pointer; } .tl-note-act svg{ width:11px; height:11px; }
.tl-note-close{ width:22px; height:22px; border-radius:6px; display:grid; place-items:center; background:none; border:none; color:var(--lg-ink-3); cursor:pointer; flex-shrink:0; } .tl-note-close:hover{ color:var(--lg-ink); } .tl-note-close svg{ width:12px; height:12px; }

/* ── display primitives ─────────────────────────────────────────────────────── */
.glu-empty{ padding:40px 24px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px; } .glu-empty-ic{ width:48px; height:48px; border-radius:13px; display:grid; place-items:center; background:var(--surface); border:1px solid var(--lg-line-2); color:var(--lg-ink-3); box-shadow:inset 0 1px 0 var(--edge-top); } .glu-empty-ic svg{ width:22px; height:22px; } .glu-empty h3{ font-size:15px; font-weight:700; letter-spacing:-.015em; } .glu-empty p{ font-size:13px; color:var(--lg-ink-3); max-width:300px; line-height:1.5; }
.glu-pill{ display:inline-flex; align-items:center; font-size:11px; font-weight:650; letter-spacing:-.003em; padding:2px 9px; border-radius:999px; flex-shrink:0; }
.glu-pill-warn{ color:var(--lg-warn,#f0a95a); background:color-mix(in srgb, var(--lg-warn,#f0a95a) 16%, transparent); }
.glu-pill-info{ color:var(--lg-info,#5cc2ff); background:color-mix(in srgb, var(--lg-info,#5cc2ff) 16%, transparent); }
.glu-pill-coral{ color:var(--lg-accent-ink); background:var(--lg-accent-soft); }
.glu-pill-neutral{ color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); }
.glu-disclosure{ display:flex; align-items:center; gap:7px; width:100%; text-align:left; background:none; border:none; cursor:pointer; font:inherit; font-size:12px; font-weight:650; color:var(--lg-ink-3); padding:7px 2px; } .glu-disclosure:hover{ color:var(--lg-ink); } .glu-caret{ display:inline-block; transition:transform .2s; font-size:15px; line-height:1; } .glu-caret.open{ transform:rotate(90deg); }
.glu-thumb{ border-radius:8px; object-fit:cover; flex-shrink:0; background:var(--lg-fill); } .glu-thumb--ph{ display:grid; place-items:center; color:var(--lg-ink-3); border:1px solid var(--lg-line-2); }
.glu-skel{ display:flex; flex-direction:column; gap:9px; } .glu-skel-line{ height:11px; border-radius:6px; background:linear-gradient(100deg, var(--lg-fill) 30%, var(--lg-hover) 50%, var(--lg-fill) 70%); background-size:200% 100%; animation:gluShim 1.3s ease-in-out infinite; } @keyframes gluShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
.glu-spinner{ display:inline-block; border-radius:50%; border:2px solid var(--lg-line); border-top-color:var(--lg-accent); animation:tlspin .7s linear infinite; }
`;

// The opt-in theme scope: remaps the agent app's --agent-* custom properties to
// Liquid-Glass values WITHIN a .lg-glass-scope subtree only. Lets well-tokenised
// production components inherit the new palette with ZERO code change. Does NOT
// reach portalled content (portals escape the subtree) — that is why portalled
// overlays use the canonical Liquid-Glass overlays instead.
export const GLASS_SCOPE_CSS = `
.lg-glass-scope{
  --agent-coral:#FF8A65; --agent-coral-deep:#FF6B4A;
  --agent-text-primary:var(--lg-ink); --agent-text-secondary:var(--lg-ink-2); --agent-text-muted:var(--lg-ink-3); --agent-text-disabled:var(--lg-ink-3);
  --agent-surface-elevated:var(--lg-fill); --agent-surface-subtle:var(--lg-hover);
  --agent-border-default:var(--lg-line); --agent-border-subtle:var(--lg-line-2);
  --agent-hover:var(--lg-hover); --agent-field:var(--lg-field);
  --agent-danger:var(--lg-danger-ink); --agent-warning:var(--lg-warn,#f0a95a); --agent-success:#45c08a; --agent-info:var(--lg-info,#5cc2ff);
  --agent-radius-xl:18px;
}
`;

// Modal reconciliation: makes the REAL Compose Email + Add Note (LogUpdateModal)
// portalled modals inherit the Liquid-Glass look — ONLY when their portal root
// carries .lg-glass-scope (opt-in; threaded via scopeClassName). The coral header
// and primary buttons are kept (on-brand). All other usages (no scope class) are
// byte-identical. High-specificity (.cem-backdrop.lg-glass-scope) guarantees the
// token remap beats the modal's own [data-theme] agent-theme vars.
export const GLASS_MODAL_CSS = `
/* The portal roots escape .lg-ds, so they SELF-PROVIDE the --lg tokens (dark
   default; .lg-glass-light switches to light to follow the host workspace),
   and remap --agent-* so the tokenised parts recolour. --gl-surface is the solid
   modal base (the translucent --lg-fill would have nothing behind it here). */
.cem-backdrop.lg-glass-scope, .lum-ov.lg-glass-scope{
  --lg-ink:#f3f4f8; --lg-ink-2:rgba(243,244,248,.64); --lg-ink-3:rgba(243,244,248,.4);
  --lg-line:rgba(255,255,255,.12); --lg-line-2:rgba(255,255,255,.07);
  --lg-fill:rgba(255,255,255,.07); --lg-field:rgba(255,255,255,.05); --lg-hover:rgba(255,255,255,.09);
  --lg-accent:#ff6b4a; --lg-accent-ink:#ff8a65; --lg-accent-soft:rgba(255,138,101,.18);
  --lg-danger-ink:#ff6961; --lg-info:#5e9bff; --gl-surface:#141a26; --gl-surface-2:#1b2231;
  --agent-surface-elevated:var(--gl-surface-2); --agent-surface-subtle:var(--lg-hover); --agent-bg-paper:var(--lg-hover);
  --agent-text-primary:var(--lg-ink); --agent-text-secondary:var(--lg-ink-2); --agent-text-muted:var(--lg-ink-3); --agent-text-disabled:var(--lg-ink-3);
  --agent-border-default:var(--lg-line); --agent-border-subtle:var(--lg-line-2); --agent-border-strong:var(--lg-line);
  --agent-hover-shade:var(--lg-hover); --agent-danger:var(--lg-danger-ink); --agent-success:#45c08a; --agent-info:var(--lg-info);
  --agent-coral:#FF8A65; --agent-coral-deep:#FF6B4A; --agent-coral-light:#FFB18F; --agent-coral-darker:#E55B3D;
}
.cem-backdrop.lg-glass-light, .lum-ov.lg-glass-light{
  --lg-ink:#11141b; --lg-ink-2:rgba(17,20,27,.62); --lg-ink-3:rgba(17,20,27,.44);
  --lg-line:rgba(12,16,28,.1); --lg-line-2:rgba(12,16,28,.06);
  --lg-fill:rgba(12,16,28,.05); --lg-field:rgba(12,16,28,.04); --lg-hover:rgba(12,16,28,.045);
  --lg-danger-ink:#d7352b; --gl-surface:#ffffff; --gl-surface-2:#f6f8fc;
}
/* Compose Email — override the hard-coded white/warm fills (coral header kept) */
.cem-backdrop.lg-glass-scope{ background:rgba(0,0,0,.52); }
.lg-glass-scope .cem-modal{ background:var(--gl-surface); border-color:var(--lg-line); box-shadow:0 24px 70px rgba(0,0,0,.5); }
.lg-glass-scope .cem-pill, .lg-glass-scope .cem-menu, .lg-glass-scope .cem-schedmenu, .lg-glass-scope .cem-sigmenu, .lg-glass-scope .cem-clearx, .lg-glass-scope .cem-cancel-sched, .lg-glass-scope .cem-subject, .lg-glass-scope .cem-editor-wrap, .lg-glass-scope .cem-chipbox, .lg-glass-scope .cem-sale-search, .lg-glass-scope .cem-sale-selected{ background:var(--lg-field); }
.lg-glass-scope .cem-pthumb{ background:var(--lg-fill); }
.lg-glass-scope .cem-mi:hover, .lg-glass-scope .cem-si:hover, .lg-glass-scope .cem-si-sig:hover{ background:var(--lg-hover); box-shadow:none; }
.lg-glass-scope .cem-skel{ background:linear-gradient(100deg, rgba(255,255,255,.04) 30%, rgba(255,255,255,.09) 50%, rgba(255,255,255,.04) 70%); background-size:200% 100%; }
/* Add Note + LogUpdateModal — override translucent-white / warm fills */
.lg-glass-scope .lum-bg{ background:rgba(0,0,0,.52); }
.lg-glass-scope .lum-sheet{ background:var(--gl-surface); border-color:var(--lg-line); box-shadow:0 24px 70px -18px rgba(0,0,0,.6), 0 8px 24px rgba(0,0,0,.3); }
.lg-glass-scope .lum-ic, .lg-glass-scope .lum-prophead, .lg-glass-scope .lum-btn, .lg-glass-scope .lum-tile, .lg-glass-scope .lum-seg, .lg-glass-scope .lum-pill, .lg-glass-scope .lum-ta, .lg-glass-scope .lum-sidechip, .lg-glass-scope .lum-wst, .lg-glass-scope .anb-search, .lg-glass-scope .lum-menu{ background:var(--lg-field); }
.lg-glass-scope .lum-ic:hover, .lg-glass-scope .lum-prophead:hover, .lg-glass-scope .lum-btn:hover, .lg-glass-scope .lum-tile:hover{ background:var(--lg-hover); }
.lg-glass-scope .lum-seg button[aria-pressed="true"]{ background:var(--lg-fill); color:var(--lg-ink); box-shadow:0 1px 3px rgba(0,0,0,.3); }
.lg-glass-scope .lum-ta:focus{ background:var(--lg-field); }
.lg-glass-scope .lum-menu{ box-shadow:0 8px 24px rgba(0,0,0,.4); }
.lg-glass-scope .lum-chk{ border-color:var(--lg-fill); }
`;
