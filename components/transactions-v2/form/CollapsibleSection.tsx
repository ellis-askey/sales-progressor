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
    <div className="agent-glass-strong overflow-hidden">
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
        {open
          ? <CaretUp size={14} weight="bold" color="var(--nv2-text-ghost)" style={{ flexShrink: 0 }} />
          : <CaretDown size={14} weight="bold" color="var(--nv2-text-ghost)" style={{ flexShrink: 0 }} />
        }
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
