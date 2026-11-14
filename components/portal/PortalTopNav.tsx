"use client";

// Portal top navigation — T8 "expandable corner": a floating greeting pill on the
// left, and a menu button on the right that fans the drawer's four sections as
// matching glass pills. Tapping a section opens the real PortalMenuDrawer to that
// tab (via onOpenMenu → scrollToSection). Replaces the old full-width greeting
// bar; all the greeting / drawer logic still lives in PortalShell.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { List, X } from "@phosphor-icons/react/dist/ssr";
import { PortalNavGlass } from "./PortalNavGlass";

// The drawer's four tabs, in fan order (keys match PortalMenuDrawer's tab keys /
// scrollToSection values).
const SECTIONS: { key: string; label: string }[] = [
  { key: "documents", label: "Documents" },
  { key: "information", label: "Information" },
  { key: "settings", label: "Settings" },
  { key: "customisation", label: "Customisation" },
];

export function PortalTopNav({ greeting, onOpenMenu }: { greeting: ReactNode; onOpenMenu: (section: string) => void }) {
  const [open, setOpen] = useState(false);
  const cornerRef = useRef<HTMLDivElement>(null);

  // Close the fan on outside tap / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (cornerRef.current && !cornerRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointerdown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="pnav-top">
      <PortalNavGlass radius={999} className="pnav-greet">
        <span className="pnav-greet-txt">{greeting}</span>
      </PortalNavGlass>

      <div className="pnav-corner" ref={cornerRef}>
        <PortalNavGlass radius={999} className="pnav-menu">
          <button type="button" className="pnav-menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <X size={18} weight="bold" /> : <List size={18} weight="regular" />}
          </button>
        </PortalNavGlass>

        <div className="pnav-fan" data-open={open ? "1" : undefined} role="menu" aria-hidden={!open}>
          {SECTIONS.map((sec) => (
            <div key={sec.key} className="pnav-fan-item">
              <PortalNavGlass radius={999} className="pnav-fan-pill">
                <button type="button" role="menuitem" tabIndex={open ? 0 : -1} className="pnav-fan-pill-btn" onClick={() => { onOpenMenu(sec.key); setOpen(false); }}>{sec.label}</button>
              </PortalNavGlass>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
