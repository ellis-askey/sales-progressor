"use client";

// /dev/shell-lab — isolated lab for the two shortlisted desktop shells (Floating
// drawers + Compact command bar) around a fixed reference (the scrollable All
// Files screen + the glass bottom dock). Dev-only (blocks in production).
// Presentation-only: no queries, no writes, no production navigation /
// permissions / logic touched. Every action is simulated.
//
// Scroll survives a switch because the content + dock are persistent and only the
// chrome changes (window scroll, fixed chrome). Floating surfaces reuse the real
// LiquidGlass + the dock's fallback and 6px/rAF scroll tuning (see ./shared). The
// nav, badges, New-sale and the full top-bar cluster mirror the real AgentShell.

import { useEffect, useState, type CSSProperties } from "react";
import { notFound } from "next/navigation";
import { Sun, MoonStars } from "@/components/icons/ph";
import { IconModeProvider } from "@/components/icons/shim-core";
import { LabProvider, AllFiles, BottomDock, detectFallback, useReducedMotion, type Theme } from "./shared";
import { FloatingDrawers, CompactCommandBar, type ShellProps } from "./variants";

type VariantKey = "drawers" | "compact";
const OPTIONS: { key: VariantKey; label: string; hint: string }[] = [
  { key: "drawers", label: "Floating drawers", hint: "Nav hides behind the left handle; the top bar is a floating capsule." },
  { key: "compact", label: "Compact command bar", hint: "One floating bar; hover Menu to drop the nav; content gets full width." },
];

export default function ShellLab() {
  if (process.env.NODE_ENV === "production") notFound();

  const [variant, setVariant] = useState<VariantKey>("drawers");
  const [theme, setTheme] = useState<Theme>("light");
  const [force, setForce] = useState<"auto" | "glass" | "frost">("auto");
  const reduce = useReducedMotion();

  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [autoFallback, setAutoFallback] = useState(false);
  useEffect(() => { setAutoFallback(detectFallback()); }, []);
  const fallback = force === "auto" ? autoFallback : force === "frost";

  function choose(k: VariantKey) { setNavOpen(false); setMenuOpen(false); setVariant(k); }

  const shellProps: ShellProps = { navOpen, setNavOpen, menuOpen, setMenuOpen };

  // Content offset = what the active shell occupies (the win is in the width).
  const padLeft = variant === "drawers" ? 34 : 0;
  const padTop = 94;

  const Shell = variant === "drawers" ? FloatingDrawers : CompactCommandBar;

  return (
    <LabProvider value={{ theme, setTheme, fallback, reduce }}>
      <IconModeProvider mode="solar">
        <div className="shell-lab" data-theme={theme} data-variant={variant} data-reduce={reduce ? "1" : undefined}
          style={{ "--pad-left": `${padLeft}px`, "--pad-top": `${padTop}px` } as CSSProperties}>
          <Shell {...shellProps} />
          <main className="lab-main"><AllFiles /></main>
          <BottomDock />

          <aside className="lab-console" aria-label="Shell lab controls">
            <div className="lab-console-head">Shell lab</div>
            <div className="lab-opts" role="radiogroup" aria-label="Shell option">
              {OPTIONS.map((o) => (
                <button key={o.key} type="button" role="radio" aria-checked={variant === o.key}
                  className={`lab-opt${variant === o.key ? " on" : ""}`} onClick={() => choose(o.key)}>{o.label}</button>
              ))}
            </div>
            <p className="lab-opt-hint">{OPTIONS.find((o) => o.key === variant)!.hint}</p>
            <div className="lab-console-tools">
              <button type="button" className="lab-ttl" aria-pressed={theme === "dark"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <MoonStars weight="duotone" /> : <Sun weight="duotone" />}<span>{theme === "dark" ? "Dark" : "Light"}</span>
              </button>
              <div className="lab-force" role="group" aria-label="Glass material">
                <span>Glass</span>
                {(["auto", "glass", "frost"] as const).map((f) => (
                  <button key={f} type="button" aria-pressed={force === f} className={force === f ? "on" : ""} onClick={() => setForce(f)}>
                    {f === "auto" ? "Auto" : f === "glass" ? "Real" : "Fallback"}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <style>{LAB_CSS}</style>
        </div>
      </IconModeProvider>
    </LabProvider>
  );
}

const LAB_CSS = `
.shell-lab{ min-height:100vh; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
.shell-lab[data-theme="light"]{
  --bg1:#f6f4fb; --bg2:#eaf0fb; --surface:#ffffff; --surface-2:#f4f6fa; --ink:#15181f; --muted:#69707e; --faint:#9aa1ad;
  --line:rgba(16,20,32,0.085); --line-2:rgba(16,20,32,0.05); --accent:#ff6b4a; --accent-deep:#ec4e2c; --accent-rgb:255,107,74;
  --accent-ink:#ffffff; --accent-soft:rgba(255,107,74,0.1); --accent-glow:rgba(255,92,61,0.34);
  --ok:#2e9f6b; --warn:#d2851c; --hot:#e0564a; --shadow:0 12px 34px rgba(24,30,54,0.12); --shadow-2:0 1px 2px rgba(43,38,32,0.08);
}
.shell-lab[data-theme="dark"]{
  --bg1:#0c0e14; --bg2:#141a28; --surface:#191d28; --surface-2:#222736; --ink:#f1f3f8; --muted:#9aa3b4; --faint:#69728a;
  --line:rgba(255,255,255,0.095); --line-2:rgba(255,255,255,0.05); --accent:#ff7d5e; --accent-deep:#ef5f3e; --accent-rgb:255,125,94;
  --accent-ink:#1a1016; --accent-soft:rgba(255,125,94,0.15); --accent-glow:rgba(255,110,78,0.42);
  --ok:#4bbd86; --warn:#e2a548; --hot:#f0776b; --shadow:0 18px 44px rgba(0,0,0,0.5); --shadow-2:0 1px 3px rgba(0,0,0,0.34);
}
.shell-lab{ background:radial-gradient(1200px 760px at 80% -10%, var(--bg2), var(--bg1)) fixed; color:var(--ink); }
.shell-lab *{ box-sizing:border-box; }
.shell-lab button{ font-family:inherit; cursor:pointer; color:inherit; }
.shell-lab a{ color:inherit; }
.shell-lab :focus-visible{ outline:2px solid var(--accent); outline-offset:2px; border-radius:9px; }

/* LiquidGlass base — the filter <svg> MUST collapse to 0×0, or it balloons the glass. */
.shell-lab .lgx-surface{ position:relative; }
.shell-lab .lgx-surface > *{ position:relative; z-index:1; }
.shell-lab .lgx-filter-svg{ position:absolute; width:0; height:0; overflow:hidden; pointer-events:none; }

.lab-main{ padding-left:var(--pad-left); padding-top:var(--pad-top); transition:padding .42s cubic-bezier(.2,.8,.2,1); min-height:100vh; }
.shell-lab[data-reduce] .lab-main{ transition:none; }

/* ── All Files content ─────────────────────────────────────────── */
.lab-content{ max-width:1520px; margin:0 auto; padding:28px 34px 220px; transition:max-width .42s ease; }
.lab-c-head{ margin-bottom:20px; }
.lab-c-head h1{ font-size:27px; font-weight:680; letter-spacing:-.021em; margin:0 0 4px; }
.lab-c-head p{ font-size:13.5px; color:var(--muted); margin:0; }
.lab-list{ background:var(--surface); border:1px solid var(--line); border-radius:17px; box-shadow:var(--shadow-2); overflow:hidden; }
.lab-row{ display:grid; grid-template-columns:minmax(230px,2fr) minmax(150px,1.3fr) 132px 130px minmax(170px,1.6fr) 84px; align-items:center; gap:14px; padding:12px 20px; border-top:1px solid var(--line-2); font-size:13px; }
.lab-row:first-child{ border-top:none; }
.lab-row:not(.lab-row-head){ transition:background .16s; }
.lab-row:not(.lab-row-head):hover, .lab-row:not(.lab-row-head):focus-visible{ background:var(--surface-2); }
.lab-row-head{ background:color-mix(in srgb,var(--surface-2) 70%,transparent); font-size:10.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--faint); padding:9px 20px; }
.lab-prop{ display:flex; align-items:center; gap:12px; min-width:0; }
.lab-tile{ position:relative; width:40px; height:40px; border-radius:10px; flex-shrink:0; display:grid; place-items:center; box-shadow:inset 0 0 0 1px rgba(0,0,0,0.07); overflow:hidden; }
.lab-tile::before{ content:""; position:absolute; inset:0; background:linear-gradient(152deg, rgba(255,255,255,0.4), transparent 62%); }
.lab-tile svg{ position:relative; width:21px; height:21px; color:rgba(28,22,16,0.36); }
.lab-prop-txt{ display:flex; flex-direction:column; min-width:0; gap:1px; }
.lab-prop-txt b{ font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.lab-prop-txt small, .lab-parties small{ color:var(--muted); font-size:11.5px; }
.lab-parties{ display:flex; flex-direction:column; min-width:0; gap:1px; }
.lab-parties b{ font-weight:550; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.lab-chip{ font-size:11.5px; font-weight:600; padding:4px 11px; border-radius:999px; white-space:nowrap; }
.lab-chip-ok{ background:color-mix(in srgb,var(--ok) 15%,transparent); color:var(--ok); }
.lab-chip-warn{ background:color-mix(in srgb,var(--warn) 18%,transparent); color:var(--warn); }
.lab-chip-hot{ background:color-mix(in srgb,var(--hot) 16%,transparent); color:var(--hot); }
.lab-prog{ display:flex; align-items:center; gap:9px; }
.lab-prog-bar{ flex:1; height:6px; border-radius:999px; background:var(--line); overflow:hidden; }
.lab-prog-bar i{ display:block; height:100%; border-radius:999px; background:linear-gradient(90deg,var(--accent),var(--accent-deep)); }
.lab-prog em{ font-size:11px; color:var(--muted); font-style:normal; min-width:30px; }
.lab-next{ color:var(--muted); font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.lab-r-wait{ text-align:right; }
.lab-wait{ font-size:12px; font-weight:650; padding:3px 8px; border-radius:7px; background:var(--surface-2); color:var(--muted); }
.lab-wait-warn{ color:var(--warn); } .lab-wait-hot{ color:var(--hot); background:color-mix(in srgb,var(--hot) 12%,transparent); }
.lab-tail{ text-align:center; color:var(--faint); font-size:12px; padding:26px 0 0; }
@media (max-width:1180px){ .lab-row{ grid-template-columns:minmax(200px,2fr) 122px 120px minmax(150px,1.4fr) 76px; } .lab-parties{ display:none; } }
@media (max-width:980px){ .lab-row{ grid-template-columns:minmax(180px,2fr) 118px minmax(140px,1.4fr) 72px; } .lab-prog{ display:none; } }

/* ── Frost fallback (dock's material) ──────────────────────────── */
.lab-frost{ position:relative; background:rgba(255,255,255,0.5); -webkit-backdrop-filter:blur(30px) saturate(190%); backdrop-filter:blur(30px) saturate(190%); border:1px solid var(--line); box-shadow:var(--shadow); }
.shell-lab[data-theme="dark"] .lab-frost{ background:rgba(25,29,40,0.6); }

/* ── Bottom dock (reference) ───────────────────────────────────── */
.lab-dock-wrap{ position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:60; transition:transform .42s cubic-bezier(.3,.9,.3,1), opacity .3s ease; }
.lab-dock-wrap[data-down="1"]{ transform:translateX(-50%) translateY(190%); opacity:0; pointer-events:none; }
.shell-lab[data-reduce] .lab-dock-wrap{ transition:opacity .2s; }
.shell-lab[data-reduce] .lab-dock-wrap[data-down="1"]{ transform:translateX(-50%); }
.lab-dock{ display:inline-flex; align-items:center; gap:4px; padding:7px 9px; }
.lab-dock-btn{ display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:15px; background:none; border:none; font-size:13.5px; font-weight:560; white-space:nowrap; transition:background .2s, transform .25s cubic-bezier(.3,1.35,.4,1); }
.lab-dock-btn svg{ width:17px; height:17px; color:var(--accent); }
.lab-dock-btn:hover{ background:var(--line-2); } .lab-dock-btn:active{ transform:scale(.96); }
.lab-dock-sep{ width:1px; height:22px; background:var(--line); }

/* ── Tooltip ───────────────────────────────────────────────────── */
.lab-tt{ position:relative; display:inline-flex; }
.lab-tt-bubble{ position:absolute; z-index:70; pointer-events:none; opacity:0; transform:translateX(-4px); transition:opacity .14s, transform .14s; background:var(--ink); color:var(--surface); font-size:12px; font-weight:560; padding:5px 9px; border-radius:7px; white-space:nowrap; box-shadow:var(--shadow-2); }
.lab-tt-right .lab-tt-bubble{ left:calc(100% + 10px); top:50%; margin-top:-13px; }
.lab-tt:hover .lab-tt-bubble, .lab-tt:focus-within .lab-tt-bubble{ opacity:1; transform:translateX(0); }

/* ── Sidebar chrome: brand · New sale (vibrant) · nav (faithful) ── */
.lab-brand{ display:flex; align-items:center; gap:10px; padding:4px 4px 14px; }
.lab-brand-mark{ width:32px; height:32px; border-radius:9px; background:linear-gradient(135deg,var(--accent),#ff9a7a); flex-shrink:0; box-shadow:0 4px 12px var(--accent-soft); }
.lab-brand-txt{ display:flex; flex-direction:column; min-width:0; }
.lab-brand-txt b{ font-size:13.5px; font-weight:640; white-space:nowrap; } .lab-brand-txt small{ font-size:11.5px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.lab-side-body{ flex:1; min-height:0; display:flex; flex-direction:column; overflow-y:auto; overflow-x:hidden; }
.lab-newsale{ display:flex; align-items:center; gap:10px; padding:9px 14px 9px 9px; margin-bottom:10px; border-radius:12px; text-decoration:none; font-size:13.5px; font-weight:620; color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent-deep)); box-shadow:0 6px 18px var(--accent-glow); transition:transform .22s cubic-bezier(.3,1.2,.4,1), box-shadow .22s, filter .22s; }
.lab-newsale:hover{ transform:translateY(-1px); filter:brightness(1.04); box-shadow:0 9px 24px var(--accent-glow); }
.lab-newsale:active{ transform:translateY(0) scale(.99); }
.lab-newsale-badge{ width:26px; height:26px; border-radius:8px; flex-shrink:0; display:grid; place-items:center; background:rgba(255,255,255,0.22); box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18); }
.lab-newsale.collapsed{ justify-content:center; padding:9px; }
.lab-nav{ display:flex; flex-direction:column; gap:2px; }
.lab-rail-item{ position:relative; z-index:1; display:flex; align-items:center; gap:11px; padding:10px 12px; border-radius:10px; font-size:13px; color:var(--muted); text-decoration:none; overflow:hidden; transition:color .16s; }
.lab-rail-item svg{ width:18px; height:18px; flex-shrink:0; }
.lab-rail-item:hover{ color:var(--accent); }
.lab-rail-item.on{ color:var(--accent); font-weight:600; }
.lab-rail-label{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lab-rail-pill{ position:absolute; left:0; top:0; width:100%; height:100%; z-index:-1; border-radius:10px; pointer-events:none;
  background:radial-gradient(circle at left, rgba(var(--accent-rgb),0.2) 0%, rgba(var(--accent-rgb),0.07) 46%, transparent 100%); }
.lab-rail-chevron{ display:inline-flex; flex-shrink:0; color:var(--accent); opacity:0; transform:translateX(10px); transition:opacity .16s, transform .24s cubic-bezier(.22,1,.36,1); }
.lab-rail-item:hover .lab-rail-chevron, .lab-rail-item:focus-visible .lab-rail-chevron{ opacity:1; transform:translateX(0); }
.lab-rail-badge{ display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; flex-shrink:0; min-width:19px; height:19px; padding:0 6px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:-.01em; line-height:1; font-variant-numeric:tabular-nums; color:var(--accent); background:transparent; border:1.25px solid var(--accent); }
.lab-rail-dot{ position:absolute; top:9px; right:13px; width:6px; height:6px; border-radius:50%; background:var(--accent); }
.lab-nav-div{ height:1px; background:var(--line-2); margin:7px 2px; }
.lab-recents{ display:flex; flex-direction:column; gap:1px; }
.lab-recents p{ margin:4px 0 4px 4px; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); }
.lab-recent{ display:flex; align-items:center; gap:10px; padding:7px 12px; border-radius:9px; color:var(--muted); text-decoration:none; font-size:12px; }
.lab-recent svg{ width:15px; height:15px; opacity:.55; flex-shrink:0; } .lab-recent span{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lab-recent:hover{ background:var(--surface-2); color:var(--ink); }

/* ── Top-bar control cluster — ghost (borderless) controls ─────── */
.lab-tb-right{ display:flex; align-items:center; gap:4px; }
.lab-search{ display:flex; align-items:center; gap:8px; width:min(380px,40vw); height:38px; padding:0 12px; background:var(--surface-2); border:1px solid var(--line); border-radius:11px; color:var(--muted); transition:border-color .16s; }
.lab-search:focus-within{ border-color:color-mix(in srgb,var(--accent) 55%,var(--line)); }
.lab-search svg{ width:16px; height:16px; } .lab-search input{ flex:1; min-width:0; border:none; background:none; color:var(--ink); font-size:13.5px; outline:none; } .lab-search kbd{ font-family:inherit; font-size:11px; color:var(--faint); border:1px solid var(--line); border-radius:5px; padding:1px 5px; }
.lab-viewtoggle{ display:inline-flex; background:var(--surface-2); border-radius:10px; padding:2px; gap:2px; }
.lab-viewtoggle button{ border:none; background:none; color:var(--muted); font-size:12.5px; font-weight:560; padding:6px 12px; border-radius:8px; transition:background .16s,color .16s; }
.lab-viewtoggle button.on{ background:var(--surface); color:var(--ink); box-shadow:var(--shadow-2); }
.lab-asof{ display:inline-flex; align-items:center; gap:5px; border:none; background:none; color:var(--muted); font-size:11.5px; padding:6px 9px; border-radius:8px; white-space:nowrap; transition:background .16s,color .16s; }
.lab-asof:hover{ background:var(--surface-2); color:var(--ink); } .lab-asof svg{ width:13px; height:13px; } .lab-asof.compact{ padding:7px; }
.lab-asof .spin{ display:inline-flex; animation:labSpin .7s linear infinite; }
.lab-icon-btn{ position:relative; width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border:none; background:none; border-radius:10px; transition:background .16s; }
.lab-icon-btn:hover{ background:var(--surface-2); } .lab-icon-btn svg{ width:19px; height:19px; }
.lab-bell-dot{ position:absolute; top:7px; right:8px; width:7px; height:7px; border-radius:50%; background:var(--accent); box-shadow:0 0 0 2.5px var(--surface); }
.lab-acct{ display:inline-flex; align-items:center; gap:8px; height:38px; padding:0 9px 0 5px; border:none; background:none; border-radius:11px; transition:background .16s; }
.lab-acct:hover{ background:var(--surface-2); } .lab-acct svg{ width:13px; height:13px; color:var(--muted); }
.lab-avatar{ width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,var(--accent),#ff9a7a); color:#fff; font-size:11px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 2px 6px var(--accent-soft); }
.lab-acct-name{ font-size:13px; font-weight:560; white-space:nowrap; }

/* Compact cluster: icon-ified in the floating surfaces, with its own bg so it
   reads as a self-contained set. */
.lab-capsule .lab-icon-btn:hover, .lab-cmd .lab-icon-btn:hover, .lab-capsule .lab-asof:hover, .lab-cmd .lab-asof:hover, .lab-capsule .lab-acct:hover, .lab-cmd .lab-acct:hover{ background:var(--line-2); }

/* ── Shared: the glass bar (capsule / command) + handle ────────── */
.lab-capsule-wrap, .lab-cmd-wrap{ position:fixed; top:16px; z-index:45; }
.lab-capsule-wrap{ left:50%; transform:translateX(-50%); max-width:calc(100vw - 48px); }
.lab-capsule{ display:inline-flex; align-items:center; gap:10px; padding:8px 11px; }
.lab-cap-sep{ width:1px; height:22px; background:var(--line); flex-shrink:0; }
.lab-search ~ .lab-tb-right, .lab-capsule .lab-tb-right, .lab-cmd .lab-tb-right{ gap:3px; }

.lab-edge-handle{ position:fixed; top:50%; left:0; transform:translateY(-50%); z-index:44; width:24px; height:96px; display:flex; align-items:center; justify-content:center; border:1px solid var(--line); border-left:none; border-radius:0 15px 15px 0; background:var(--surface); color:var(--muted); box-shadow:var(--shadow-2); transition:width .2s,color .2s,box-shadow .2s; }
.lab-edge-handle:hover, .lab-edge-handle:focus-visible{ width:30px; color:var(--accent); box-shadow:var(--shadow); } .lab-edge-handle svg{ width:16px; height:16px; }
.lab-scrim{ position:fixed; inset:0; z-index:48; background:rgba(10,14,24,0.3); -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px); animation:labFade .2s ease; }
.lab-drawer{ position:fixed; top:14px; bottom:14px; left:14px; width:272px; z-index:49; transform:translateX(calc(-100% - 22px)); transition:transform .42s cubic-bezier(.2,.86,.26,1); pointer-events:none; }
.lab-drawer.open{ transform:translateX(0); pointer-events:auto; }
.shell-lab[data-reduce] .lab-drawer{ transition:transform .2s linear; }
.lab-drawer-glass{ height:100%; display:flex; flex-direction:column; padding:16px; overflow:hidden; }
.lab-drawer-glass .lab-side-body{ padding-top:14px; }
.lab-drawer-head{ display:flex; align-items:center; justify-content:space-between; }

/* ── Compact command bar + hover menu ──────────────────────────── */
.lab-cmd-wrap{ left:50%; transform:translateX(-50%); width:min(920px,calc(100vw - 48px)); }
.lab-cmd{ display:flex; align-items:center; gap:10px; padding:8px 11px; }
.lab-cmd-menu-region{ position:relative; display:inline-flex; }
.lab-cmd-menu{ display:inline-flex; align-items:center; gap:8px; height:38px; padding:0 14px; border:none; background:var(--surface-2); border-radius:11px; font-size:13.5px; font-weight:580; flex-shrink:0; transition:background .16s,color .16s; }
.lab-cmd-menu svg{ width:17px; height:17px; }
.lab-cmd-menu:hover{ background:var(--line-2); }
.lab-cmd-menu[aria-expanded="true"]{ background:var(--accent-soft); color:var(--accent); }
.lab-cmd .lab-search{ flex:1; width:auto; }
.lab-cmd-spacer{ flex:0 0 2px; }
.lab-cmd-menu-panel{ position:absolute; top:calc(100% + 13px); left:0; width:272px; opacity:0; transform:translateY(-8px) scale(.98); transform-origin:top left; pointer-events:none; transition:opacity .15s ease, transform .2s cubic-bezier(.2,.9,.3,1); }
.lab-cmd-menu-panel.open{ opacity:1; transform:translateY(0) scale(1); pointer-events:auto; }
.shell-lab[data-reduce] .lab-cmd-menu-panel{ transition:opacity .12s; transform:none; }
.lab-cmd-menu-glass{ display:flex; flex-direction:column; padding:14px; max-height:74vh; overflow:hidden; }

/* ── Lab console (dev-only switcher + toggles) ─────────────────── */
.lab-console{ position:fixed; right:18px; bottom:18px; z-index:80; width:214px; background:var(--surface); border:1px solid var(--line); border-radius:17px; box-shadow:var(--shadow); padding:13px; }
.lab-console-head{ font-size:10.5px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; color:var(--faint); padding:1px 4px 10px; }
.lab-opts{ display:flex; flex-direction:column; gap:3px; }
.lab-opt{ text-align:left; border:1px solid transparent; background:none; color:var(--muted); font-size:13px; font-weight:560; padding:9px 11px; border-radius:10px; transition:background .14s,color .14s; }
.lab-opt:hover{ background:var(--surface-2); color:var(--ink); }
.lab-opt.on{ background:var(--accent-soft); color:var(--accent); font-weight:640; }
.lab-opt-hint{ font-size:11.5px; line-height:1.45; color:var(--muted); margin:10px 4px 12px; }
.lab-console-tools{ display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--line-2); padding-top:11px; }
.lab-ttl{ display:inline-flex; align-items:center; gap:8px; justify-content:center; height:34px; border:1px solid var(--line); background:var(--surface-2); border-radius:9px; font-size:12.5px; font-weight:560; }
.lab-ttl svg{ width:16px; height:16px; color:var(--accent); }
.lab-force{ display:flex; align-items:center; gap:4px; }
.lab-force > span{ font-size:11px; color:var(--faint); font-weight:650; margin-right:2px; }
.lab-force button{ flex:1; border:1px solid var(--line); background:var(--surface-2); color:var(--muted); font-size:11px; font-weight:600; padding:6px 0; border-radius:7px; }
.lab-force button.on{ background:var(--accent); color:var(--accent-ink); border-color:transparent; }

@keyframes labFade{ from{ opacity:0 } to{ opacity:1 } }
@keyframes labSpin{ to{ transform:rotate(360deg) } }
@media (prefers-reduced-motion: reduce){ .shell-lab *{ animation-duration:.01ms !important; } }
`;
