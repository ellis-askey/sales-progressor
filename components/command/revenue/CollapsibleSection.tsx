"use client";

import { useState, type ReactNode } from "react";

// A Command Centre section whose header collapses/expands its body with a smooth
// height animation, so long tables can be folded away as the Revenue page grows.
// The title is the clickable toggle; an optional tip sits beside it (outside the
// toggle) so opening the info tip never collapses the section.
export function CollapsibleSection({
  title,
  tip,
  defaultOpen = true,
  children,
}: {
  title: string;
  tip?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-left uppercase tracking-wider hover:text-neutral-300 transition-colors"
        >
          <span className={`text-neutral-600 text-[13px] leading-none transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
            ›
          </span>
          {title}
        </button>
        {tip}
      </h2>
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">{children}</div>
      </div>
    </section>
  );
}
