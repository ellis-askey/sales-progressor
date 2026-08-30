"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { useCardSurface } from "@/lib/glass/use-card-surface";

type Props = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  // Design Lab tagging — when set, this card appears in the picker.
  glassId?: string;
  glassLabel?: string;
  children: React.ReactNode;
};

export function CollapsibleSection({ title, summary, defaultOpen = false, glassId, glassLabel, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const { surfaceClass, tag } = useCardSurface(glassId ?? "", glassLabel ?? title, "agent-glass-strong");
  const glass = glassId ? tag : {};

  return (
    <div className={`${glassId ? surfaceClass : "agent-glass-strong"} overflow-hidden`} {...glass}>
      <button
        type="button"
        className="agent-acc-hdr w-full"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv2-text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>
            {title}
          </span>
          {!open && summary && (
            <span style={{ fontSize: 12, color: "var(--nv2-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {summary}
            </span>
          )}
        </div>
        {/* 2026-08-11 drawer-consistency pass: rotating CaretDown
            (canonical) instead of swapping between up/down icons, so the
            chevron animates with the section like every other drawer. */}
        <CaretDown
          size={14}
          weight="bold"
          aria-hidden
          color="var(--nv2-text-ghost)"
          style={{
            flexShrink: 0,
            transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      <div className={`agent-acc${open ? " open" : ""}`}>
        <div className="agent-acc-in">
          <div className="agent-acc-body">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
