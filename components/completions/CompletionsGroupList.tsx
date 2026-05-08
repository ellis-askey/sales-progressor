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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((g) => [g.key, true]))
  );

  function toggle(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      {groups.map(({ key, label, files, groupValue, groupFeeTotal, missingFeeCount }) => {
        const s = GROUP_STYLES[key];
        const isCollapsed = collapsed[key] ?? true;

        return (
          <div key={key} id={`section-${key}`}>
            {/* Group header */}
            <button
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-2.5 mb-2 text-left"
            >
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
              <p className={`text-xs font-bold uppercase tracking-[0.07em] ${s.label} flex-1`}>
                {label} ({files.length})
              </p>
              {groupFeeTotal > 0 ? (
                <p className="text-xs font-semibold tabular-nums" style={{ color: "rgba(15,23,42,0.6)" }}>
                  {fmt(groupFeeTotal / 100)} fees
                </p>
              ) : groupValue > 0 ? (
                <p className="text-xs text-slate-900/40 font-medium tabular-nums">{fmt(groupValue / 100)}</p>
              ) : null}
              {isCollapsed
                ? <CaretDown className={`w-3.5 h-3.5 flex-shrink-0 ${s.label}`} />
                : <CaretUp className={`w-3.5 h-3.5 flex-shrink-0 ${s.label}`} />
              }
            </button>
            {groupFeeTotal > 0 && missingFeeCount > 0 && !isCollapsed && (
              <p className="text-xs text-slate-900/30 -mt-1 mb-2 ml-[22px]">
                ({missingFeeCount} file{missingFeeCount !== 1 ? "s" : ""} with no fee set)
              </p>
            )}

            {!isCollapsed && (
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
            )}
          </div>
        );
      })}
    </div>
  );
}
