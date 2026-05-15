"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

type Props = {
  title: string;
  badge?: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
};

export function SectionAccordion({ title, badge, defaultExpanded = true, children }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="agent-glass-strong overflow-hidden">
      <button
        type="button"
        className="agent-acc-hdr w-full"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {title}
          </span>
          {badge}
        </div>
        {expanded
          ? <CaretUp size={14} weight="bold" color="rgba(15,23,42,0.35)" />
          : <CaretDown size={14} weight="bold" color="rgba(15,23,42,0.35)" />
        }
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
