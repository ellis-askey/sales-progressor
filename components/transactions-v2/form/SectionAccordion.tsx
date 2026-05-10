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
    <div
      style={{
        borderRadius: 16,
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "0.5px solid rgba(255,255,255,0.65)",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          borderBottom: expanded ? "0.5px solid rgba(15,23,42,0.07)" : "none",
          transition: "border-bottom 150ms",
        }}
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

      {/* Body */}
      {expanded && (
        <div style={{ padding: "16px 18px" }}>
          {children}
        </div>
      )}
    </div>
  );
}
