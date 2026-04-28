"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export type MilestoneRow = {
  id: string;
  completedAtIso: string;
  confirmedByPortal: boolean;
  side: string;
  milestoneName: string;
  completedByName: string | null;
};

export type TxGroup = {
  transactionId: string;
  transactionAddress: string;
  milestones: MilestoneRow[];
};

export type DayBucket = {
  label: string;
  txGroups: TxGroup[];
  defaultOpen: boolean;
};

export function CommsActivityFeed({ days }: { days: DayBucket[] }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    Object.fromEntries(days.map((d) => [d.label, !d.defaultOpen]))
  );

  function toggle(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <div className="space-y-6">
      {days.map(({ label, txGroups }) => {
        const isCollapsed = collapsed[label] ?? false;
        const milestoneCount = txGroups.reduce((n, t) => n + t.milestones.length, 0);

        return (
          <div key={label}>
            <button
              onClick={() => toggle(label)}
              className="w-full flex items-center gap-2 mb-3 text-left"
            >
              <p className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide flex-1">{label}</p>
              <span className="text-xs font-medium text-slate-900/40 bg-slate-100/60 px-2 py-0.5 rounded-full">
                {milestoneCount}
              </span>
              {isCollapsed
                ? <CaretDown className="w-3.5 h-3.5 text-slate-900/30 flex-shrink-0" />
                : <CaretUp className="w-3.5 h-3.5 text-slate-900/30 flex-shrink-0" />
              }
            </button>

            {!isCollapsed && (
              <div className="space-y-3">
                {txGroups.map((tx) => (
                  <div key={tx.transactionId} className="glass-card overflow-hidden">
                    <Link
                      href={`/agent/transactions/${tx.transactionId}`}
                      className="block px-4 py-2.5 border-b border-white/20 hover:bg-white/20 transition-colors"
                      style={{ textDecoration: "none" }}
                    >
                      <p className="text-xs font-semibold text-slate-900/70 truncate">{tx.transactionAddress}</p>
                    </Link>
                    <div className="divide-y divide-white/15">
                      {tx.milestones.map((m) => {
                        const isPortal = m.confirmedByPortal;
                        const clientName = isPortal ? "Client" : null;
                        return (
                          <div key={m.id} className="flex items-start gap-3 px-4 py-3">
                            <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isPortal ? "bg-violet-100" : "bg-emerald-100"}`}>
                              <svg className={`w-3 h-3 ${isPortal ? "text-violet-600" : "text-emerald-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-slate-900/80">{m.milestoneName}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                  m.side === "vendor" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-700"
                                }`}>
                                  {m.side === "vendor" ? "Vendor" : "Purchaser"}
                                </span>
                                {isPortal && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">
                                    Client confirmed
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-900/40 mt-0.5">
                                {isPortal ? clientName : (m.completedByName ?? "unknown")}
                              </p>
                            </div>
                            <span className="text-[11px] text-slate-900/35 flex-shrink-0 mt-0.5">{relativeDate(m.completedAtIso)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
