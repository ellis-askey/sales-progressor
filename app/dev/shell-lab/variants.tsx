"use client";

// The two shortlisted shells for /dev/shell-lab: Floating drawers + Compact
// command bar. Chrome only — the content + bottom dock are persistent in
// page.tsx so scroll survives a switch. Both carry the real top-bar cluster and
// faithful nav; only the use of space differs.

import { useEffect, useRef } from "react";
import { List, X } from "@/components/icons/ph";
import { LabGlass, Brand, NewSale, NavList, SearchPill, TopRight } from "./shared";

export type ShellProps = {
  navOpen: boolean; setNavOpen: (v: boolean) => void;
  menuOpen: boolean; setMenuOpen: (v: boolean) => void;
};

// ── 1 · Floating drawers ─────────────────────────────────────────────────────
export function FloatingDrawers({ navOpen, setNavOpen }: ShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  // Escape + outside-click close, focus into the drawer on open, focus returns
  // to the handle on close.
  useEffect(() => {
    if (!navOpen) return;
    const prev = (document.activeElement as HTMLElement | null);
    panelRef.current?.querySelector<HTMLElement>("a,button,input,[tabindex]")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setNavOpen(false); } };
    const onDown = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node) && !handleRef.current?.contains(e.target as Node)) setNavOpen(false); };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("mousedown", onDown, true); (prev ?? handleRef.current)?.focus?.(); };
  }, [navOpen, setNavOpen]);

  return (
    <>
      <div className="lab-capsule-wrap">
        <LabGlass radius={19} className="lab-capsule"><SearchPill /><span className="lab-cap-sep" /><TopRight compact /></LabGlass>
      </div>
      <button ref={handleRef} className="lab-edge-handle" type="button" aria-expanded={navOpen} aria-label="Open navigation" onClick={() => setNavOpen(true)}><List weight="bold" /></button>
      {navOpen && <div className="lab-scrim" aria-hidden onClick={() => setNavOpen(false)} />}
      <div ref={panelRef} className={`lab-drawer${navOpen ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Navigation" aria-hidden={!navOpen}>
        <LabGlass radius={24} className="lab-drawer-glass">
          <div className="lab-drawer-head"><Brand /><button className="lab-icon-btn" type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)}><X weight="bold" /></button></div>
          <div className="lab-side-body"><NewSale /><NavList /></div>
        </LabGlass>
      </div>
    </>
  );
}

// ── 2 · Compact command bar (nav opens on hover) ─────────────────────────────
export function CompactCommandBar({ menuOpen, setMenuOpen }: ShellProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const open = () => { window.clearTimeout(closeTimer.current); setMenuOpen(true); };
  const scheduleClose = () => { closeTimer.current = window.setTimeout(() => setMenuOpen(false), 140); };

  // Escape (returns focus to the trigger) + click-away. Hover-open never steals
  // focus; a click/keyboard open moves focus into the menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setMenuOpen(false); btnRef.current?.focus(); } };
    const onDown = (e: MouseEvent) => { if (regionRef.current && !regionRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("mousedown", onDown, true); };
  }, [menuOpen, setMenuOpen]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <div className="lab-cmd-wrap">
      <LabGlass radius={19} className="lab-cmd">
        <div ref={regionRef} className="lab-cmd-menu-region" onMouseEnter={open} onMouseLeave={scheduleClose}>
          <button ref={btnRef} className="lab-cmd-menu" type="button" aria-expanded={menuOpen} aria-haspopup="menu"
            onClick={() => { if (menuOpen) { setMenuOpen(false); } else { open(); requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("a,button")?.focus()); } }}>
            <List weight="bold" /><span>Menu</span>
          </button>
          <div ref={panelRef} className={`lab-cmd-menu-panel${menuOpen ? " open" : ""}`} role="menu" aria-label="Navigation" aria-hidden={!menuOpen}>
            <LabGlass radius={20} className="lab-cmd-menu-glass"><div className="lab-side-body"><NewSale /><NavList /></div></LabGlass>
          </div>
        </div>
        <span className="lab-cap-sep" />
        <SearchPill />
        <span className="lab-cmd-spacer" />
        <TopRight compact />
      </LabGlass>
    </div>
  );
}
