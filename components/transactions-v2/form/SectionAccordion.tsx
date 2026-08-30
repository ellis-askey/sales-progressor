"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { useCardSurface } from "@/lib/glass/use-card-surface";

type Props = {
  title: string;
  badge?: React.ReactNode;
  defaultExpanded?: boolean;
  // Design Lab tagging — when set, this card appears in the picker.
  glassId?: string;
  glassLabel?: string;
  children: React.ReactNode;
};

export function SectionAccordion({ title, badge, defaultExpanded = true, glassId, glassLabel, children }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { surfaceClass, tag } = useCardSurface(glassId ?? "", glassLabel ?? title, "agent-glass-strong");
  const glass = glassId ? tag : {};

  return (
    <div className={glassId ? surfaceClass : "agent-glass-strong"} {...glass}>
      <button
        type="button"
        className="agent-acc-hdr w-full"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv2-text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {title}
          </span>
          {badge}
        </div>
        <CaretDown
          size={14}
          weight="bold"
          color="var(--nv2-text-ghost)"
          style={{ transition: "transform 200ms", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      <div className={`agent-acc${expanded ? " open" : ""}`}>
        <div className="agent-acc-in">
          <div className="agent-acc-body">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
