"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveCompletionDateAction } from "@/app/actions/transactions";
import { CaretDown } from "@phosphor-icons/react";
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
  const [openDatePickerId, setOpenDatePickerId] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

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
                <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: s.dotColor }} />
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
                <CaretDown style={{ width: 14, height: 14, color: "var(--agent-text-muted)", flexShrink: 0, transition: "transform 200ms", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
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
                      <div key={f.id}>
                        <Link
                          href={`/agent/transactions/${f.id}`}
                          className={`glass-card agent-hover-row block px-5 py-4 border ${s.border}`}
                          style={{ textDecoration: "none" }}
                        >
                          <CompletionFileRowView
                            file={f}
                            groupKey={key}
                            onSetDate={() => { setOpenDatePickerId(f.id); setDateValue(""); }}
                          />
                        </Link>
                        {openDatePickerId === f.id && (
                          <div
                            className="agent-reveal-in"
                            style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
                          >
                            <input
                              type="date"
                              className="glass-input px-2 py-1.5 text-sm"
                              min={today}
                              value={dateValue}
                              onChange={(e) => setDateValue(e.target.value)}
                              autoFocus
                            />
                            <button
                              className="agent-btn agent-btn-sm agent-btn-primary"
                              disabled={!dateValue || isPending}
                              onClick={() => {
                                startTransition(async () => {
                                  await saveCompletionDateAction(f.id, dateValue);
                                  setOpenDatePickerId(null);
                                  router.refresh();
                                });
                              }}
                            >
                              {isPending ? "Saving…" : "Set date"}
                            </button>
                            <button
                              className="agent-link agent-link-muted"
                              style={{ fontSize: 11 }}
                              onClick={() => setOpenDatePickerId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
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
