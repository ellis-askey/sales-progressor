"use client";

// App-wide quick-action dock — the glass pill plucked byte-for-byte from the
// /dev/updates-glass prototype (the exact <LiquidGlass> render + the exact
// .lgx-surface / .ug-dock* CSS + vars), now wired to the REAL surfaces:
//   New note  → AddNoteModal   (search a sale → Log an update)
//   New email → ComposeEmailModal
//
// Everything visual is verbatim from that page; the only additions are (1) the
// real wiring, (2) theme sync with the agent app (html[data-theme]), and (3) a
// scroll-aware slide-down hide so it stays out of the way while reading. All CSS
// is scoped under .qdock-root so nothing global changes.
//
// Founder-gated at the mount site (AgentShell). See docs — rendered only for
// ellis@thesalesprogressor.co.uk while this is a trial.

import { useEffect, useRef, useState } from "react";
import { NotePencil, PaperPlaneTilt } from "@phosphor-icons/react";
import { LiquidGlass } from "@/components/quick-dock/LiquidGlass";
import { AddNoteModal } from "@/components/activity/AddNoteModal";
import { ComposeEmailModal } from "@/components/compose/ComposeEmailModal";

// Exact dock tints from /dev/updates-glass (GLASS.dock).
const DOCK_TINT = { dark: "rgba(34,37,50,0.58)", light: "rgba(255,255,255,0.64)" } as const;

// Track the agent app's theme (html[data-theme="dark"]) so the dock's tint +
// vars match light/dark exactly as the prototype switched them.
function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const read = () => setDark(html.getAttribute("data-theme") === "dark");
    read();
    const mo = new MutationObserver(read);
    mo.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export function QuickActionDock() {
  const isDark = useIsDark();
  const [noteOpen, setNoteOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [down, setDown] = useState(false);
  const lastY = useRef(0);

  // Slide the dock away while reading down the page, bring it back on scroll-up
  // or near the top. Works for window scroll and inner scroll containers (file
  // pages) via capture. If nothing scrolls, the dock simply stays — "sticky at
  // all times" is the default.
  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;
    function handle(e: Event) {
      const t = e.target as HTMLElement | Document;
      const y = t && t !== document && (t as HTMLElement).scrollTop != null
        ? (t as HTMLElement).scrollTop
        : window.scrollY;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const dy = y - lastY.current;
        if (y < 60) setDown(false);
        else if (dy > 6) setDown(true);
        else if (dy < -6) setDown(false);
        lastY.current = y;
        ticking = false;
      });
    }
    window.addEventListener("scroll", handle, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", handle, { capture: true } as EventListenerOptions);
  }, []);

  const theme = isDark ? "dark" : "light";
  // Keep it up while a composer is open (the modal covers it) so it doesn't
  // flicker when the sheet animates.
  const hidden = down && !noteOpen && !emailOpen;

  return (
    <div className="qdock-root" data-theme={theme}>
      <LiquidGlass
        radius={22}
        thickness={14}
        displace={46}
        aberration={4}
        tint={DOCK_TINT[theme]}
        className="ug-dock"
        data-down={hidden ? "1" : undefined}
      >
        <button className="ug-dock-btn" onClick={() => setNoteOpen(true)}>
          <NotePencil weight="regular" />
          <span>New note</span>
        </button>
        <span className="ug-dock-sep" />
        <button className="ug-dock-btn" onClick={() => setEmailOpen(true)}>
          <PaperPlaneTilt weight="regular" />
          <span>New email</span>
        </button>
      </LiquidGlass>

      <AddNoteModal open={noteOpen} onClose={() => setNoteOpen(false)} />
      <ComposeEmailModal open={emailOpen} onClose={() => setEmailOpen(false)} />

      <style>{QDOCK_CSS}</style>
    </div>
  );
}

// Verbatim from /dev/updates-glass — the vars (.ug-root), the LiquidGlass base
// (.lgx-surface) and the dock (.ug-dock*) — scoped under .qdock-root so nothing
// global is touched. The only additions are the hide transition + [data-down].
const QDOCK_CSS = `
.qdock-root[data-theme="dark"]{
  --accent:#0a84ff; --ink:#f3f4f8; --line:rgba(255,255,255,0.1); --row-hover:rgba(255,255,255,0.045);
}
.qdock-root[data-theme="light"]{
  --accent:#0a84ff; --ink:#11141b; --line:rgba(12,16,28,0.1); --row-hover:rgba(12,16,28,0.035);
}

/* LiquidGlass base — verbatim .lgx-surface */
.qdock-root .lgx-surface{ position:relative; border:1px solid var(--line);
  -webkit-backdrop-filter:blur(11px) saturate(160%); backdrop-filter:blur(11px) saturate(160%);
  box-shadow:0 8px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.3);
  transition:transform .45s cubic-bezier(.2,.8,.2,1), box-shadow .45s ease, border-radius .4s ease; }
.qdock-root[data-theme="light"] .lgx-surface{ box-shadow:0 8px 26px rgba(20,30,60,0.1), inset 0 1px 0 rgba(255,255,255,0.7); }
.qdock-root .lgx-surface::before{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:0;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent) top/100% 1px no-repeat; opacity:.55; }
.qdock-root .lgx-filter-svg{ position:absolute; width:0; height:0; overflow:hidden; pointer-events:none; }

/* Dock — verbatim .ug-dock* + a slide-down hide */
.qdock-root .ug-dock{ position:fixed; z-index:40; bottom:24px; left:50%; transform:translateX(-50%); display:inline-flex; align-items:center; gap:4px; padding:7px 9px;
  transition:transform .42s cubic-bezier(.3,.9,.3,1), opacity .3s ease; }
.qdock-root .ug-dock[data-down="1"]{ transform:translateX(-50%) translateY(180%); opacity:0; pointer-events:none; }
.qdock-root .ug-dock > *{ position:relative; z-index:1; }
.qdock-root .ug-dock-btn{ display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:15px; background:none; border:none; color:var(--ink); font-size:13.5px; font-weight:550; font-family:inherit; cursor:pointer; transition:background .25s, transform .3s cubic-bezier(.3,1.35,.4,1); }
.qdock-root .ug-dock-btn svg{ width:17px; height:17px; color:var(--accent); }
.qdock-root .ug-dock-btn:hover{ background:var(--row-hover); }
.qdock-root .ug-dock-btn:active{ transform:scale(.96); }
.qdock-root .ug-dock-sep{ width:1px; height:22px; background:var(--line); }
@media (prefers-reduced-motion: reduce){
  .qdock-root .ug-dock, .qdock-root .ug-dock-btn, .qdock-root .lgx-surface{ transition:none; }
}
`;

export default QuickActionDock;
