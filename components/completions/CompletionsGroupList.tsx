"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }
function fmtDate(d: string | null) {
  if (!d) return "No date set";
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}
function timeSinceExchange(iso: string | null): string {
  if (!iso) return "Exchange date not recorded";
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Exchanged today";
  if (days === 1) return "Exchanged yesterday";
  return `Exchanged ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${days} days ago`;
}

const GROUP_STYLES = {
  overdue:   { dot: "bg-red-500",   label: "text-red-600",      border: "border-red-200/40"   },
  this_week: { dot: "bg-amber-500", label: "text-amber-600",    border: "border-amber-200/40" },
  next_week: { dot: "bg-blue-500",  label: "text-blue-600",     border: "border-blue-200/40"  },
  later:     { dot: "bg-slate-400", label: "text-slate-900/60", border: "border-white/20"      },
  no_date:   { dot: "bg-slate-300", label: "text-slate-900/40", border: "border-white/15"      },
} as const;

const SET_DATE_STYLE: React.CSSProperties = {
  fontSize: 12, color: "rgba(15,23,42,0.45)",
  border: "1px solid rgba(15,23,42,0.15)", borderRadius: 6,
  padding: "3px 8px", whiteSpace: "nowrap", display: "inline-block",
};

export type CompletionFileRow = {
  id: string;
  propertyAddress: string;
  purchasePrice: number | null;
  agentFeeAmount: number | null;
  purchasers: string[];
  assignedUserName: string | null;
  exchangedAtIso: string | null;
  completionDateIso: string | null;
  vendorSolicitorName: string | null;
  purchaserSolicitorName: string | null;
  daysRel: number | null;
  daysLabel: string;
  daysColor: string;
};

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
        const isNoDate = key === "no_date";

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
                {files.map((f) => {
                  const hasNeitherSol = !f.vendorSolicitorName && !f.purchaserSolicitorName;

                  const DateBlock = () => isNoDate ? (
                    <span style={SET_DATE_STYLE}>Set date →</span>
                  ) : (
                    <div className="text-right">
                      <p className={`text-sm font-bold mb-0.5 ${s.label}`}>{fmtDate(f.completionDateIso)}</p>
                      {f.daysLabel && <p className="text-xs" style={{ color: f.daysColor }}>{f.daysLabel}</p>}
                    </div>
                  );

                  return (
                    <Link
                      key={f.id}
                      href={`/agent/transactions/${f.id}`}
                      className={`glass-card block px-5 py-4 border ${s.border} hover:shadow-md transition-shadow`}
                      style={{ textDecoration: "none" }}
                    >
                      {/* Desktop layout */}
                      <div className="hidden md:flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-bold text-slate-900/90 mb-1 truncate">{f.propertyAddress}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-1">
                            {f.purchasePrice && <span className="text-sm text-slate-900/50">{fmt(f.purchasePrice / 100)}</span>}
                            {f.agentFeeAmount && <span className="text-sm font-medium" style={{ color: "rgba(15,23,42,0.7)" }}>Fee: {fmt(f.agentFeeAmount / 100)}</span>}
                            {f.purchasers.length > 0 && <span className="text-sm text-slate-900/50">Purchaser: {f.purchasers.join(", ")}</span>}
                            {f.assignedUserName && <span className="text-sm text-slate-900/50">Progressor: {f.assignedUserName}</span>}
                          </div>
                          <p className="text-xs text-slate-900/40 mb-0.5">{timeSinceExchange(f.exchangedAtIso)}</p>
                          {hasNeitherSol ? (
                            <p className="text-xs" style={{ color: "#b45309" }}>No solicitors set</p>
                          ) : (
                            <p className="text-xs text-slate-900/40 truncate">
                              Vendor sol: {f.vendorSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}
                              {" · "}
                              Purchaser sol: {f.purchaserSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 self-start">
                          <DateBlock />
                        </div>
                      </div>

                      {/* Mobile layout */}
                      <div className="flex md:hidden flex-col gap-1">
                        <p className="text-[15px] font-bold text-slate-900/90 leading-snug">{f.propertyAddress}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {f.purchasePrice && <span className="text-sm text-slate-900/50">{fmt(f.purchasePrice / 100)}</span>}
                          {f.agentFeeAmount && <span className="text-sm font-medium" style={{ color: "rgba(15,23,42,0.7)" }}>Fee: {fmt(f.agentFeeAmount / 100)}</span>}
                          {f.purchasers.length > 0 && <span className="text-sm text-slate-900/50">Purchaser: {f.purchasers.join(", ")}</span>}
                          {f.assignedUserName && <span className="text-sm text-slate-900/50">Progressor: {f.assignedUserName}</span>}
                        </div>
                        <p className="text-xs text-slate-900/40">{timeSinceExchange(f.exchangedAtIso)}</p>
                        {hasNeitherSol ? (
                          <p className="text-xs" style={{ color: "#b45309" }}>No solicitors set</p>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <p className="text-xs text-slate-900/40">Vendor sol: {f.vendorSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}</p>
                            <p className="text-xs text-slate-900/40">Purchaser sol: {f.purchaserSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}</p>
                          </div>
                        )}
                        <div className="flex justify-end mt-1">
                          <DateBlock />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
