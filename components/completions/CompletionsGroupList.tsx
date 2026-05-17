"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import {
  CompletionFileRowView,
  GROUP_STYLES,
  type CompletionFileRow,
} from "@/components/completions/CompletionFileRowView";

export type { CompletionFileRow };

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }

export type CompletionGroup = {
  key: "overdue" | "this_week" | "next_week" | "later" | "no_date";
  label: string;
  files: CompletionFileRow[];
  groupValue: number;
  groupFeeTotal: number;
  missingFeeCount: number;
};

export function CompletionsGroupList({ groups }: { groups: CompletionGroup[] }) {
  /* OLD: const [collapsed, setCollapsed] = useState(Object.fromEntries(groups.map(g => [g.key, true]))) */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  function toggle(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      {groups.map(({ key, label, files, groupValue, groupFeeTotal, missingFeeCount }) => {
        const s = GROUP_STYLES[key];
        const isOpen = !!openGroups[key];

        return (
          /* OLD: <div key={key} id={`section-${key}`}> — plain div, no agent-glass */
          <div key={key} id={`section-${key}`} className="agent-glass" style={{ overflow: "hidden" }}>

            {/* Group header — agent-acc-hdr
                Urgency colours (dot, label) applied to CHILD elements only — not to agent-acc-hdr
                itself — to avoid conflict with the canonical class's hover/focus styles.
                agent-acc-title NOT used: it forces color:var(--agent-text-primary) which
                suppresses urgency text-red-600 / text-amber-600 classes. */}
            {/* OLD: <button className="w-full flex items-center gap-2.5 mb-2 text-left"> */}
            <div
              className="agent-acc-hdr"
              role="button"
              tabIndex={0}
              onClick={() => toggle(key)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(key); } }}
            >
              {/* Left: dot + urgency label */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                <span className={`text-xs font-bold uppercase tracking-[0.07em] truncate ${s.label}`}>
                  {label} ({files.length})
                </span>
              </div>
              {/* Right: fee or value total + caret */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {groupFeeTotal > 0 ? (
                  /* OLD: <p className="text-xs font-semibold tabular-nums" style={{ color: "rgba(15,23,42,0.6)" }}>{fmt(groupFeeTotal / 100)} fees</p> */
                  <span className="agent-acc-summary">{fmt(groupFeeTotal / 100)} fees</span>
                ) : groupValue > 0 ? (
                  /* OLD: <p className="text-xs text-slate-900/40 font-medium tabular-nums">{fmt(groupValue / 100)}</p> */
                  <span className="agent-acc-summary">{fmt(groupValue / 100)}</span>
                ) : null}
                {isOpen
                  ? <CaretUp className="w-3.5 h-3.5 flex-shrink-0 text-slate-900/40" />
                  : <CaretDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-900/40" />
                }
              </div>
            </div>

            {/* Body — agent-acc animation (200ms open / 150ms close via agent-system.css) */}
            {/* OLD: {!isCollapsed && <div className="space-y-2">{files...}</div>} — no animation */}
            <div className={`agent-acc${isOpen ? " open" : ""}`}>
              <div className="agent-acc-in">
                <div className="agent-acc-body">
                  {/* Missing-fee note — OLD: rendered outside accordion, between header and file list */}
                  {groupFeeTotal > 0 && missingFeeCount > 0 && (
                    <p className="text-xs text-slate-900/30 ml-[22px] -mt-2 mb-0">
                      ({missingFeeCount} file{missingFeeCount !== 1 ? "s" : ""} with no fee set)
                    </p>
                  )}
                  <div className="space-y-2">
                    {files.map((f) => (
                      <Link
                        key={f.id}
                        href={`/agent/transactions/${f.id}`}
                        className={`glass-card block px-5 py-4 border ${s.border} hover:shadow-md transition-shadow`}
                        style={{ textDecoration: "none" }}
                      >
                        <CompletionFileRowView file={f} groupKey={key} />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}
