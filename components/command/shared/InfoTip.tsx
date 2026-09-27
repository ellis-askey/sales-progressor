"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * Small hover/focus info tip for the Command Centre. Reveals on hover and on
 * keyboard focus of the trigger. Reusable across every command page.
 *
 * Viewport-safe: on open it measures the popover and shifts it horizontally so
 * it can never run off the edge of the screen (the earlier bug where a tip near
 * the right edge was clipped). `align` is the starting preference; the shift
 * only corrects overflow.
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
  /** Which edge the popover prefers. The shift below overrides this near an edge. */
  align?: "left" | "right";
  children: ReactNode;
}) {
  const tipRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  // Measure with the current shift removed, then nudge back inside the viewport.
  function reposition() {
    const el = tipRef.current;
    if (!el || typeof window === "undefined") return;
    const prev = el.style.transform;
    el.style.transform = "none";
    const rect = el.getBoundingClientRect();
    el.style.transform = prev;
    const pad = 8;
    let dx = 0;
    if (rect.right > window.innerWidth - pad) dx = window.innerWidth - pad - rect.right;
    if (rect.left + dx < pad) dx = pad - rect.left;
    setShift(Math.round(dx));
  }

  return (
    <span
      className="relative inline-flex group align-middle"
      onMouseEnter={reposition}
      onFocusCapture={reposition}
    >
      <button
        type="button"
        aria-label={label ?? "More information"}
        className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full border border-neutral-700 text-neutral-500 text-[9px] font-bold leading-none cursor-help transition-colors hover:border-neutral-500 hover:text-neutral-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
      >
        i
      </button>
      <span
        ref={tipRef}
        role="tooltip"
        style={{ transform: shift ? `translateX(${shift}px)` : undefined }}
        className={`pointer-events-none absolute z-50 bottom-full mb-1.5 w-56 max-w-[calc(100vw-1rem)] rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-[11px] font-normal leading-relaxed text-neutral-300 shadow-xl opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </span>
    </span>
  );
}
