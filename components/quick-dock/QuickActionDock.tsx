"use client";

// App-wide quick-action dock — the glass pill plucked byte-for-byte from the
// /dev/updates-glass prototype (the exact <LiquidGlass> render + the exact
// .lgx-surface / .ug-dock* CSS + vars), now wired to the REAL surfaces:
//   New note  → AddNoteModal   (search a sale, or straight onto the open file)
//   New email → ComposeEmailModal
//
// The SVG-backdrop refraction only renders on Chromium. Safari / Firefox / iOS
// can't present it, so there we keep the EXACT same container and swap the
// material for the same frosted glass the enquiries dropdown menu uses
// (blur(30px) saturate(200%)). Also: theme sync with the app (html[data-theme]),
// a scroll-aware slide-down hide, and labels that never wrap (the dock widens to
// fit, truncating only when the viewport is genuinely too narrow). All CSS is
// scoped under .qdock-root so nothing global changes.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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

// True on engines that can't present the SVG-backdrop refraction (WebKit/iOS +
// Firefox) — there we fall back to a plain frosted pill. Chromium keeps the real
// LiquidGlass. Defaults false (SSR) and resolves on mount.
function useGlassFallback(): boolean {
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const iOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari = /^((?!chrome|android|crios|fxios|edg|opr).)*safari/i.test(ua);
    const firefox = /firefox|fxios/i.test(ua);
    setFallback(iOS || safari || firefox);
  }, []);
  return fallback;
}

export function QuickActionDock({ isFounder = false }: { isFounder?: boolean }) {
  const isDark = useIsDark();
  const fallback = useGlassFallback();
  const pathname = usePathname();
  // When you're on a file (/agent/transactions/<id>), the dock's New note / New
  // email open straight onto THAT sale — no re-searching for the file you're
  // already looking at. Off a file, they start from a sale search as normal.
  const fileMatch = pathname?.match(/^\/agent\/transactions\/([^/]+)/);
  const fileId = fileMatch && fileMatch[1] !== "migrate" && fileMatch[1] !== "new" ? fileMatch[1] : null;
  const [noteOpen, setNoteOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  // Founder floating windows (one email, one note). Each remembers whether it's
  // minimised and the sale it was opened onto — FROZEN at open so navigating the
  // app never re-targets the draft or wipes it. null = not open. These live on
  // the dock, which sits in the persistent layout, so an open window survives
  // page-to-page navigation.
  const [emailWin, setEmailWin] = useState<{ min: boolean; fileId: string | null } | null>(null);
  const [noteWin, setNoteWin] = useState<{ min: boolean; fileId: string | null } | null>(null);
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

  // Founder: opening brings an existing window to front (un-minimises it);
  // otherwise it opens onto the sale we're on right now, frozen for the life of
  // the window. Non-founder: the classic modal, unchanged.
  function openNote() {
    if (isFounder) setNoteWin((w) => (w ? { ...w, min: false } : { min: false, fileId }));
    else setNoteOpen(true);
  }
  function openEmail() {
    if (isFounder) setEmailWin((w) => (w ? { ...w, min: false } : { min: false, fileId }));
    else setEmailOpen(true);
  }
  // Stacking order for the minimised chips (bottom-right); email nearest the corner.
  const minimisedOrder: ("email" | "note")[] = [];
  if (emailWin?.min) minimisedOrder.push("email");
  if (noteWin?.min) minimisedOrder.push("note");

  // Same buttons in both the refraction and fallback shells.
  const dockInner = (
    <>
      <button className="ug-dock-btn" onClick={openNote}>
        <NotePencil weight="regular" />
        <span>New note</span>
      </button>
      <span className="ug-dock-sep" />
      <button className="ug-dock-btn" onClick={openEmail}>
        <PaperPlaneTilt weight="regular" />
        <span>New email</span>
      </button>
    </>
  );

  return (
    <div className="qdock-root" data-theme={theme}>
      {fallback ? (
        // Same container (.ug-dock), enquiries-menu frosted material (.qdock-fallback).
        <div className="ug-dock qdock-fallback" data-down={hidden ? "1" : undefined}>
          {dockInner}
        </div>
      ) : (
        <LiquidGlass
          radius={22}
          thickness={14}
          displace={46}
          aberration={4}
          tint={DOCK_TINT[theme]}
          className="ug-dock"
          data-down={hidden ? "1" : undefined}
        >
          {dockInner}
        </LiquidGlass>
      )}

      {isFounder ? (
        <>
          {emailWin && (
            <ComposeEmailModal
              frame="floating"
              open
              initialTransactionId={emailWin.fileId}
              minimized={emailWin.min}
              stackIndex={minimisedOrder.indexOf("email")}
              onMinimize={() => setEmailWin((w) => (w ? { ...w, min: true } : w))}
              onRestore={() => setEmailWin((w) => (w ? { ...w, min: false } : w))}
              onClose={() => setEmailWin(null)}
            />
          )}
          {noteWin && (
            <AddNoteModal
              frame="floating"
              open
              initialTransactionId={noteWin.fileId}
              minimized={noteWin.min}
              stackIndex={minimisedOrder.indexOf("note")}
              onMinimize={() => setNoteWin((w) => (w ? { ...w, min: true } : w))}
              onRestore={() => setNoteWin((w) => (w ? { ...w, min: false } : w))}
              onClose={() => setNoteWin(null)}
            />
          )}
        </>
      ) : (
        <>
          <AddNoteModal open={noteOpen} onClose={() => setNoteOpen(false)} initialTransactionId={fileId} />
          <ComposeEmailModal open={emailOpen} onClose={() => setEmailOpen(false)} initialTransactionId={fileId} />
        </>
      )}

      <style>{QDOCK_CSS}</style>
    </div>
  );
}

// Verbatim from /dev/updates-glass — the vars (.ug-root), the LiquidGlass base
// (.lgx-surface) and the dock (.ug-dock*) — scoped under .qdock-root so nothing
// global is touched. Additions: the hide transition + [data-down], the no-wrap /
// widen-to-fit labels, and the .qdock-fallback material for non-Chromium.
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

/* Dock — verbatim .ug-dock* + a slide-down hide. width:max-content so it widens
   to fit the labels (no wrap); max-width clamps it to the viewport so it only
   truncates when genuinely too narrow (~<300px). */
.qdock-root .ug-dock{ position:fixed; z-index:40; bottom:24px; left:50%; transform:translateX(-50%); display:inline-flex; align-items:center; gap:4px; padding:7px 9px;
  width:max-content; max-width:calc(100vw - 20px);
  transition:transform .42s cubic-bezier(.3,.9,.3,1), opacity .3s ease; }
.qdock-root .ug-dock[data-down="1"]{ transform:translateX(-50%) translateY(180%); opacity:0; pointer-events:none; }
.qdock-root .ug-dock > *{ position:relative; z-index:1; }
.qdock-root .ug-dock-btn{ display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:15px; background:none; border:none; color:var(--ink); font-size:13.5px; font-weight:550; font-family:inherit; cursor:pointer; white-space:nowrap; min-width:0; transition:background .25s, transform .3s cubic-bezier(.3,1.35,.4,1); }
.qdock-root .ug-dock-btn span{ overflow:hidden; text-overflow:ellipsis; }
.qdock-root .ug-dock-btn svg{ width:17px; height:17px; flex-shrink:0; color:var(--accent); }
.qdock-root .ug-dock-btn:hover{ background:var(--row-hover); }
.qdock-root .ug-dock-btn:active{ transform:scale(.96); }
.qdock-root .ug-dock-sep{ width:1px; height:22px; flex-shrink:0; background:var(--line); }

/* Non-Chromium fallback — identical container, the enquiries dropdown's frosted
   glass (surfaceStyle in components/ui/Popover.tsx): blur(30) saturate(200),
   30% tint, 1px --agent-border-default, 0 12px 30px rgba(20,12,6,0.16). Keeps
   the dock's own 22px radius, not the menu's 10px. */
.qdock-root .ug-dock.qdock-fallback{
  background:rgba(255,255,255,0.30);
  -webkit-backdrop-filter:blur(30px) saturate(200%); backdrop-filter:blur(30px) saturate(200%);
  border:1px solid var(--agent-border-default); border-radius:22px;
  box-shadow:0 12px 30px rgba(20,12,6,0.16); }
.qdock-root[data-theme="dark"] .ug-dock.qdock-fallback{ background:rgba(20,26,36,0.30); }

@media (prefers-reduced-motion: reduce){
  .qdock-root .ug-dock, .qdock-root .ug-dock-btn, .qdock-root .lgx-surface{ transition:none; }
}
`;

export default QuickActionDock;
