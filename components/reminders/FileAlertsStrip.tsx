"use client";

import { useState } from "react";
import Link from "next/link";
import { Warning } from "@phosphor-icons/react";
import { ALERT_CONFIG } from "@/lib/services/work-queue";
import type { WorkQueueItem } from "@/lib/services/work-queue";

export function FileAlertsStrip({ items }: { items: WorkQueueItem[] }) {
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const now = new Date();
  const overdueCount = items.filter((i) => i.alerts.includes("overdue_exchange")).length;
  const missingCount = items.filter(
    (i) => i.alerts.includes("missing_vendor_solicitor") || i.alerts.includes("missing_purchaser_solicitor")
  ).length;
  const staleCount = items.filter((i) => i.alerts.includes("stale")).length;

  return (
    <div className="glass-card overflow-hidden" style={{ clipPath: "inset(0 round 20px)" }}>
      {/* Header — always visible */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 ${!collapsed ? "border-b border-white/30" : ""}`}
        style={{ background: "rgba(251, 191, 36, 0.08)" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Warning weight="fill" style={{ width: 13, height: 13, color: "var(--agent-warning)", flexShrink: 0 }} />
          <span className="text-xs font-semibold text-slate-900/60">
            {items.length} file alert{items.length !== 1 ? "s" : ""}
          </span>
          {overdueCount > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">
              {overdueCount} overdue exchange
            </span>
          )}
          {missingCount > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
              {missingCount} missing solicitor
            </span>
          )}
          {staleCount > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100">
              {staleCount} stale
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed((p) => !p)}
          className="text-xs text-slate-900/40 hover:text-slate-900/60 transition-colors shrink-0 ml-2"
        >
          {collapsed ? "Show ↓" : "Hide ↑"}
        </button>
      </div>

      {/* Expanded body */}
      {!collapsed && (
        <div className="divide-y divide-white/30">
          {items.map((item) => {
            const exchangeDate = item.expectedExchangeDate ? new Date(item.expectedExchangeDate) : null;
            const exchangeOverdue = exchangeDate && exchangeDate < now;
            const daysOverdue = exchangeOverdue
              ? Math.floor((now.getTime() - exchangeDate!.getTime()) / 86400000)
              : null;

            return (
              <Link key={item.id} href={`/agent/transactions/${item.id}`} style={{ textDecoration: "none" }}>
                <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/20 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900/80 truncate">{item.propertyAddress}</p>
                    {item.agentUser && (
                      <p className="text-xs text-slate-900/40">{item.agentUser.name}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {item.alerts.map((alert) => {
                      const cfg = ALERT_CONFIG[alert];
                      return (
                        <span
                          key={alert}
                          style={{
                            padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
                          }}
                        >
                          {cfg.label}
                        </span>
                      );
                    })}
                    {exchangeOverdue && daysOverdue !== null && (
                      <span style={{
                        padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 500,
                        color: "var(--agent-danger)", background: "var(--agent-danger-bg)", border: "1px solid var(--agent-danger-border)",
                      }}>
                        {daysOverdue}d overdue
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
