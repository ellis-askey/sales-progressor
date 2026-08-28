import type { ReactNode } from "react";

/**
 * Small hover/focus info tip for the Command Centre. Pure CSS (no client JS):
 * the tip shows on hover and on keyboard focus of the trigger. Reusable across
 * every command page — the first shared tooltip primitive in the Command Centre.
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
  /** Which edge the popover aligns to. Use "right" near the right screen edge. */
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex group align-middle">
      <button
        type="button"
        aria-label={label ?? "More information"}
        className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full border border-neutral-700 text-neutral-500 text-[9px] font-bold leading-none cursor-help transition-colors hover:border-neutral-500 hover:text-neutral-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
      >
        i
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 bottom-full mb-1.5 w-56 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-[11px] font-normal leading-relaxed text-neutral-300 shadow-xl opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </span>
    </span>
  );
}
