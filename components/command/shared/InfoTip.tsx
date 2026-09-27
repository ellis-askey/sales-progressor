"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * Small hover/focus info tip for the Command Centre. Reveals on hover and on
 * keyboard focus of the trigger. Reusable across every command page.
 *
 * The popover is rendered with position: fixed and positioned from the trigger's
 * on-screen box, so it escapes BOTH the screen edge and any ancestor with
 * overflow clipping (e.g. the chase-control table's overflow-x-auto, which used
 * to cut the tip off inside its own container). It prefers to sit above the
 * trigger and flips below if there isn't room; it clamps horizontally so it can
 * never run off the side.
 *
 * Voice: keep tip copy plain and free of em-dashes (Law 21).
 */
export default function InfoTip({
  label,
  align = "left",
  children,
}: {
  /** Accessible name for the trigger button. Describe what the tip explains. */
  label?: string;
  /** Which edge the popover prefers to align to the trigger. Clamped to stay on screen. */
  align?: "left" | "right";
  children: ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  // Measure the trigger + tip (both already in the DOM) and place the tip above
  // the trigger, clamped inside the viewport, flipping below if there's no room.
  function place() {
    const btn = btnRef.current;
    const tip = tipRef.current;
    if (!btn || !tip || typeof window === "undefined") return;
    const b = btn.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const pad = 8;
    let left = align === "right" ? b.right - t.width : b.left;
    left = Math.min(Math.max(pad, left), window.innerWidth - t.width - pad);
    let top = b.top - t.height - 6;
    if (top < pad) top = b.bottom + 6; // flip below when there's no room above
    setPos({ top: Math.round(top), left: Math.round(left) });
  }

  const show = () => { place(); setOpen(true); };
  const hide = () => setOpen(false);

  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={btnRef}
        type="button"
        aria-label={label ?? "More information"}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full border border-neutral-700 text-neutral-500 text-[9px] font-bold leading-none cursor-help transition-colors hover:border-neutral-500 hover:text-neutral-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
      >
        i
      </button>
      <span
        ref={tipRef}
        role="tooltip"
        style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 100, opacity: open ? 1 : 0 }}
        className="pointer-events-none w-56 max-w-[calc(100vw-1rem)] rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-[11px] font-normal leading-relaxed text-neutral-300 shadow-xl transition-opacity duration-150"
      >
        {children}
      </span>
    </span>
  );
}
