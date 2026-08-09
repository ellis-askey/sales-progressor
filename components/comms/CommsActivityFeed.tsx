"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import { RoleIcon, ROLE_PILL_BG, roleColour } from "@/components/ui/RoleIcon";
import { GlassCard } from "@/components/glass/GlassCard";

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
          // Design Lab: `updates-day`. Default v03 (2026-08-09 page pass).
          <GlassCard key={label} glassId="updates-day" label="Updates · Day bucket" defaultVariant="v03" style={{ overflow: "hidden" }}>
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
                <CaretDown style={{ width: 14, height: 14, color: "var(--agent-text-muted)", flexShrink: 0, transition: "transform 200ms", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
              </div>
            </div>

            <div className={`agent-acc${open ? " open" : ""}`}>
              <div className="agent-acc-in">
                <div className="agent-acc-body">
                  {txGroups.map((tx) => (
                    // Design Lab: `updates-tx-card`. Default v03.
                    <GlassCard key={tx.transactionId} glassId="updates-tx-card" label="Updates · File card" defaultVariant="v03" className="overflow-hidden">
                      <Link
                        href={`/agent/transactions/${tx.transactionId}`}
                        className="comms-tx-link"
                      >
                        <p className="text-xs font-semibold text-slate-900/70 truncate">{tx.transactionAddress}</p>
                      </Link>
                      <div>
                        {tx.milestones.map((m, mi) => (
                          <div key={m.id} className="flex items-start gap-3 px-4 py-3" style={{ borderTop: mi > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}>
                            <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: m.confirmedByPortal ? "rgba(var(--agent-info-rgb), 0.12)" : "rgba(var(--agent-success-rgb), 0.12)" }}>
                              <svg className="w-3 h-3" style={{ color: m.confirmedByPortal ? "var(--agent-info)" : "var(--agent-success)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[13px] font-medium text-slate-900/80">{m.milestoneName}</span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  background: ROLE_PILL_BG[m.side === "vendor" ? "vendor" : "purchaser"],
                                  color: roleColour(m.side === "vendor" ? "vendor" : "purchaser"),
                                }}>
                                  <RoleIcon role={m.side === "vendor" ? "vendor" : "purchaser"} size={10} />
                                  {m.side === "vendor" ? "Vendor" : "Purchaser"}
                                </span>
                                {m.confirmedByPortal && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(var(--agent-info-rgb), 0.08)", color: "var(--agent-info)", border: "0.5px solid rgba(var(--agent-info-rgb), 0.2)" }}>
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
                    </GlassCard>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
