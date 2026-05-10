"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

type Props = {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function CollapsibleSection({ title, summary, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        borderRadius: 16,
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "0.5px solid rgba(255,255,255,0.65)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          borderBottom: open ? "0.5px solid rgba(15,23,42,0.07)" : "none",
          gap: 12,
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(15,23,42,0.45)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            flexShrink: 0,
          }}>
            {title}
          </span>
          {!open && summary && (
            <span style={{
              fontSize: 12,
              color: "rgba(15,23,42,0.40)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {summary}
            </span>
          )}
        </div>
        {open
          ? <CaretUp size={14} weight="bold" color="rgba(15,23,42,0.35)" style={{ flexShrink: 0 }} />
          : <CaretDown size={14} weight="bold" color="rgba(15,23,42,0.35)" style={{ flexShrink: 0 }} />
        }
      </button>

      {open && (
        <div style={{ padding: "16px 18px" }}>
          {children}
        </div>
      )}
    </div>
  );
}
