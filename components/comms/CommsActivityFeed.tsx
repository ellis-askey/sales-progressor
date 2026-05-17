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
  // openDays: true = open, false = closed.
  // "Today" and "Yesterday" default open; all other labels default closed.
  const [openDays, setOpenDays] = useState<Record<string, boolean>>(
    Object.fromEntries(days.map((d) => [d.label, d.defaultOpen]))
  );

  function toggle(label: string) {
    setOpenDays((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <div className="space-y-4">
      {days.map((d) => {
        const { label, txGroups } = d;
        const open = openDays[label] ?? d.defaultOpen;
        const milestoneCount = txGroups.reduce((n, t) => n + t.milestones.length, 0);
        const countLabel = `${milestoneCount} milestone${milestoneCount !== 1 ? "s" : ""}`;

        return (
          <div key={label} className="agent-glass" style={{ overflow: "hidden" }}>
            <div
              className="agent-acc-hdr"
              role="button"
              tabIndex={0}
              onClick={() => toggle(label)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(label); } }}
            >
              <span className="agent-acc-title">{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="agent-acc-summary">{countLabel}</span>
                {open
                  ? <CaretUp style={{ width: 14, height: 14, color: "var(--agent-text-muted)", flexShrink: 0 }} />
                  : <CaretDown style={{ width: 14, height: 14, color: "var(--agent-text-muted)", flexShrink: 0 }} />
                }
              </div>
            </div>

            <div className={`agent-acc${open ? " open" : ""}`}>
              <div className="agent-acc-in">
                <div className="agent-acc-body">
                  {txGroups.map((tx) => (
                    <div key={tx.transactionId} className="glass-card overflow-hidden">
                      <Link
                        href={`/agent/transactions/${tx.transactionId}`}
                        className="comms-tx-link"
                      >
                        <p className="text-xs font-semibold text-slate-900/70 truncate">{tx.transactionAddress}</p>
                      </Link>
                      <div className="divide-y divide-white/15">
                        {tx.milestones.map((m) => (
                          <div key={m.id} className="flex items-start gap-3 px-4 py-3">
                            <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${m.confirmedByPortal ? "bg-violet-100" : "bg-emerald-100"}`}>
                              <svg className={`w-3 h-3 ${m.confirmedByPortal ? "text-violet-600" : "text-emerald-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
                                {m.confirmedByPortal && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">
                                    Client confirmed
                                  </span>
                                )}
                              </div>
                              {/* A4: actor line rendered only when a real name is available for a non-portal entry */}
                              {!m.confirmedByPortal && m.completedByName && (
                                <p className="text-xs text-slate-900/40 mt-0.5">{m.completedByName}</p>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-900/35 flex-shrink-0 mt-0.5">{relativeDate(m.completedAtIso)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
