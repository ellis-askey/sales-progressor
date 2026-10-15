"use client";

// InfoTip — a small (i) after a title that reveals a short explainer. Opens on
// hover (pointer) and on tap/click (touch), with a grace period so you can move
// from the icon into the popover. The popover is portalled to <body> and
// fixed-positioned from the trigger, so it never clips inside a card, flips
// above when the trigger sits low in the viewport, and clamps its width to the
// screen on tablet/mobile. Click again (or outside / Escape / scroll) to close.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "@phosphor-icons/react";

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    .infotip-btn { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; width: 16px; height: 16px; margin-left: 5px; padding: 0; border: none; border-radius: 50%; background: none; color: #9ca3af; cursor: pointer; flex-shrink: 0; transition: color .14s ease, background .14s ease; }
    .infotip-btn:hover, .infotip-btn[aria-expanded="true"] { color: var(--agent-coral-deep, #E2452A); background: rgba(255,107,74,0.12); }
    .infotip-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(255,107,74,0.4); }
    .infotip-pop { background: #fff; border: 1px solid rgba(0,0,0,0.10); border-radius: 11px; box-shadow: 0 12px 32px rgba(15,26,46,0.18), 0 2px 8px rgba(15,26,46,0.08); padding: 12px 14px; font-size: 12.5px; line-height: 1.55; color: #374151; animation: infotip-fade .12s ease; }
    .infotip-pop p { margin: 0; }
    @keyframes infotip-fade { from { opacity: 0; } to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .infotip-pop { animation: none; } }
  `;
  document.head.appendChild(el);
}

type Pos = { left: number; top: number; width: number; placeAbove: boolean };

export function InfoTip({ label, children }: { label?: string; children: ReactNode }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const closeT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => { injectStyles(); }, []);

  function place() {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(320, window.innerWidth - margin * 2);
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    // Flip above when the trigger sits in the lower part of the viewport.
    const placeAbove = r.bottom > window.innerHeight * 0.62;
    const top = placeAbove ? r.top - 8 : r.bottom + 8;
    setPos({ left, top, width, placeAbove });
  }

  function openNow() { if (closeT.current) clearTimeout(closeT.current); setOpen(true); }
  function closeSoon() {
    if (pinned) return;
    if (closeT.current) clearTimeout(closeT.current);
    closeT.current = setTimeout(() => setOpen(false), 120);
  }

  useEffect(() => {
    if (!open) { setPos(null); return; }
    place();
    const hardClose = () => { setOpen(false); setPinned(false); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      const pop = document.getElementById("infotip-open-pop");
      if (pop?.contains(t)) return;
      hardClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hardClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hardClose, true);
    window.addEventListener("resize", hardClose);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hardClose, true);
      window.removeEventListener("resize", hardClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="infotip-btn"
        aria-label={label ? `About ${label}` : "More information"}
        aria-expanded={open}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        onFocus={openNow}
        onBlur={closeSoon}
        onClick={(e) => {
          e.stopPropagation();
          if (pinned) { setPinned(false); setOpen(false); }
          else { setPinned(true); setOpen(true); }
        }}
      >
        <Info size={13} weight="bold" />
      </button>

      {open && pos && createPortal(
        <div
          id="infotip-open-pop"
          role="tooltip"
          style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, transform: pos.placeAbove ? "translateY(-100%)" : undefined, zIndex: 2000 }}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
        >
          <div className="infotip-pop">
            {typeof children === "string" ? <p>{children}</p> : children}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
