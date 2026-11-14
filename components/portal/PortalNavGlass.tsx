"use client";

// PortalNavGlass — the glass material for the portal's navigation (the floating
// greeting + menu pills on top, and the magnify dock on the bottom). It is the
// production home of the design signed off in /dev/portal-preview.
//
// PRIMARY target is the frosted fallback — that is what phones actually render,
// and it is tuned to look premium on its own (warm portal tint, layered shadow,
// inset specular highlight, a faint grain so it reads as physical glass). On
// DESKTOP Chromium only we layer the real refraction engine on top as a bonus;
// every phone (incl. Android Chrome) stays on the lightweight frost so a consumer
// device never janks on backdrop-filter: url().
//
// The refraction engine is components/quick-dock/LiquidGlass — the production-safe
// in-house copy already shipping in the agent quick-dock (NOT components/liquid,
// which is forward-only). All CSS is scoped under .pnav-* and injected once by
// PortalShell via PORTAL_NAV_CSS.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { LiquidGlass } from "@/components/quick-dock/LiquidGlass";

// Tuned values from the signed-off preview.
const REFRACT = { blur: 16, displace: 70, aberration: 1 } as const;

function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.getAttribute("data-portal-theme") === "dark");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-portal-theme"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

// Refraction only on DESKTOP Chromium. iOS / Safari / Firefox can't present
// url()-backdrop refraction at all; mobile Chromium can but we keep phones on the
// cheap frost so a budget device stays smooth.
function useRefraction(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const iOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari = /^((?!chrome|android|crios|fxios|edg|opr).)*safari/i.test(ua);
    const firefox = /firefox|fxios/i.test(ua);
    const chromium = !(iOS || safari || firefox);
    const desktop = window.matchMedia("(min-width: 900px) and (pointer: fine)").matches;
    setOk(chromium && desktop);
  }, []);
  return ok;
}

export function PortalNavGlass({ radius = 22, className = "", style, children }: { radius?: number; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const real = useRefraction();
  const dark = useIsDark();
  if (real) {
    const tint = dark ? "rgba(26,32,41,0.73)" : "rgba(255,247,243,0.73)";
    return (
      <LiquidGlass radius={radius} blur={REFRACT.blur} displace={REFRACT.displace} aberration={REFRACT.aberration} tint={tint} className={`pnav-glass pnav-glass--real ${className}`} style={style}>
        {children}
      </LiquidGlass>
    );
  }
  return (
    <div className={`pnav-glass pnav-frost ${className}`} style={{ borderRadius: radius, ...style }}>
      <span aria-hidden className="pnav-grain" />
      {children}
    </div>
  );
}

// Injected once by PortalShell. Scoped under .pnav-* so nothing else is touched.
export const PORTAL_NAV_CSS = `
/* ── Glass material ───────────────────────────────────────────────────────── */
.pnav-glass{ position:relative; }
.pnav-glass > *{ position:relative; z-index:1; }
.pnav-frost{ overflow:hidden;
  background:rgba(255,247,243,0.54);
  -webkit-backdrop-filter:blur(4px) saturate(165%); backdrop-filter:blur(4px) saturate(165%);
  border:1px solid rgba(255,255,255,0.65);
  box-shadow:0 17px 32px rgba(255,138,101,0.15), 0 2px 10px rgba(15,23,42,0.1), inset 0 1px 0 rgba(255,255,255,0.58); }
[data-portal-theme="dark"] .pnav-frost{ background:rgba(26,32,41,0.56); border-color:rgba(255,255,255,0.12);
  box-shadow:0 18px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1); }
.pnav-grain{ position:absolute; inset:0; z-index:0; border-radius:inherit; pointer-events:none; opacity:0.42; mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
  background-size:120px 120px; }
[data-portal-theme="dark"] .pnav-grain{ mix-blend-mode:soft-light; }
/* Real-refraction base (LiquidGlass adds .lgx-surface). */
.portal-scope .lgx-surface{ position:relative; border:1px solid rgba(255,255,255,0.6);
  box-shadow:0 17px 32px rgba(255,138,101,0.15), 0 2px 10px rgba(15,23,42,0.1);
  -webkit-backdrop-filter:blur(2px) saturate(165%); backdrop-filter:blur(2px) saturate(165%); }
[data-portal-theme="dark"] .portal-scope .lgx-surface{ border-color:rgba(255,255,255,0.12); box-shadow:0 18px 36px rgba(0,0,0,0.45); }
.portal-scope .lgx-surface::before{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent) top/100% 1px no-repeat; opacity:.7; }
.portal-scope .lgx-filter-svg{ position:absolute; width:0; height:0; overflow:hidden; pointer-events:none; }

/* ── Top: greeting + expandable corner ───────────────────────────────────── */
.pnav-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; color:var(--portal-textPrimary,#1A1D29); }
.pnav-greet{ display:inline-flex; align-items:center; padding:10px 17px; max-width:62vw; }
.pnav-greet-txt{ font-size:15.5px; font-weight:620; color:var(--portal-textPrimary,#1A1D29); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pnav-corner{ position:relative; display:flex; flex-direction:column; align-items:flex-end; flex-shrink:0; }
.pnav-menu{ width:42px; height:42px; display:inline-flex; align-items:center; justify-content:center; }
.pnav-menu-btn{ width:100%; height:100%; border:none; background:none; color:var(--portal-textPrimary,#1A1D29); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; -webkit-tap-highlight-color:transparent; }
.pnav-menu-btn:active{ transform:scale(0.94); }
.pnav-fan{ position:absolute; top:52px; right:0; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
.pnav-fan-item{ opacity:0; transform:translateY(-8px) scale(0.94); pointer-events:none;
  transition:opacity .26s cubic-bezier(.2,.8,.2,1), transform .34s cubic-bezier(.2,.8,.2,1); }
.pnav-fan[data-open="1"] .pnav-fan-item{ opacity:1; transform:none; pointer-events:auto; }
.pnav-fan[data-open="1"] .pnav-fan-item:nth-child(1){ transition-delay:.02s; }
.pnav-fan[data-open="1"] .pnav-fan-item:nth-child(2){ transition-delay:.06s; }
.pnav-fan[data-open="1"] .pnav-fan-item:nth-child(3){ transition-delay:.10s; }
.pnav-fan[data-open="1"] .pnav-fan-item:nth-child(4){ transition-delay:.14s; }
.pnav-fan-pill{ display:inline-flex; }
.pnav-fan-pill-btn{ display:inline-flex; align-items:center; padding:10px 17px; border:none; background:none; color:var(--portal-textPrimary,#1A1D29); font:inherit; font-size:14px; font-weight:620; white-space:nowrap; border-radius:999px; cursor:pointer; transition:color .15s ease; -webkit-tap-highlight-color:transparent; }
.pnav-fan-pill-btn:hover{ color:var(--portal-primary,#FF6B4A); }
.pnav-fan-pill-btn:active{ transform:scale(0.97); }

/* ── Bottom: magnify dock ────────────────────────────────────────────────── */
.pnav-bottom-wrap{ display:flex; justify-content:center; padding:0 16px calc(16px + env(safe-area-inset-bottom,0px)); pointer-events:none; }
.pnav-bottom-wrap > *{ pointer-events:auto; }
.pnav-dock{ display:inline-flex; align-items:center; gap:4px; padding:7px; }
.pnav-tab{ position:relative; display:inline-flex; align-items:center; gap:7px; height:46px; padding:0 14px; border-radius:16px;
  color:var(--portal-textMuted,#8B91A3); text-decoration:none; -webkit-tap-highlight-color:transparent;
  transition:color .2s ease, transform .3s cubic-bezier(.3,1.1,.4,1); }
.pnav-tab[data-on]{ color:var(--portal-primary,#FF6B4A); }
.pnav-tab-ico{ position:relative; display:inline-flex; transition:transform .32s cubic-bezier(.3,1.1,.4,1), filter .25s ease; }
.pnav-tab[data-on] .pnav-tab-ico{ transform:translateY(-3px) scale(1.15); filter:drop-shadow(0 5px 9px color-mix(in srgb, var(--portal-primary,#FF6B4A) 45%, transparent)); }
.pnav-tab-lbl{ font-size:13px; font-weight:650; max-width:0; opacity:0; overflow:hidden; white-space:nowrap;
  transition:max-width .34s cubic-bezier(.2,.8,.2,1), opacity .26s ease; }
.pnav-tab[data-on] .pnav-tab-lbl{ max-width:96px; opacity:1; }
.pnav-badge{ position:absolute; top:-2px; right:6px; min-width:16px; height:16px; padding:0 4px; border-radius:9px; background:var(--portal-primary,#FF6B4A); color:#fff;
  font-size:10px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; border:2px solid var(--portal-cardBg,#fff); pointer-events:none; }

@media (prefers-reduced-motion: reduce){
  .pnav-fan-item, .pnav-tab, .pnav-tab-ico, .pnav-tab-lbl, .pnav-fan-pill-btn{ transition:none; }
}
[data-portal-motion="reduced"] .pnav-fan-item,
[data-portal-motion="reduced"] .pnav-tab,
[data-portal-motion="reduced"] .pnav-tab-ico,
[data-portal-motion="reduced"] .pnav-tab-lbl{ transition:none; }
`;
