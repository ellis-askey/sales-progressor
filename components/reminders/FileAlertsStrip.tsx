"use client";

import { useState } from "react";
import Link from "next/link";
import { Warning } from "@phosphor-icons/react";
import { ALERT_CONFIG } from "@/lib/services/work-queue";
import type { WorkQueueItem, AlertType } from "@/lib/services/work-queue";

// Action copy and focus param per alert type
// Alert types that exist: missing_vendor_solicitor, missing_purchaser_solicitor, overdue_exchange, stale
const ALERT_ACTIONS: Partial<Record<AlertType, { label: string; focus: string }>> = {
  missing_vendor_solicitor:   { label: "Add vendor solicitor →",     focus: "vendor-solicitor"    },
  missing_purchaser_solicitor: { label: "Add purchaser solicitor →", focus: "purchaser-solicitor" },
  overdue_exchange:            { label: "Update exchange date →",     focus: "exchange-date"       },
};

function getPrimaryAlert(alerts: AlertType[]): AlertType | null {
  const priority: AlertType[] = [
    "missing_purchaser_solicitor",
    "missing_vendor_solicitor",
    "overdue_exchange",
    "stale",
  ];
  return priority.find((a) => alerts.includes(a)) ?? null;
}

export function FileAlertsStrip({ items }: { items: WorkQueueItem[] }) {
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

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
            const hasBothSolicitorsMissing =
              item.alerts.includes("missing_vendor_solicitor") &&
              item.alerts.includes("missing_purchaser_solicitor");
            let actionLabel: string | null = null;
            let deepLink: string;
            if (hasBothSolicitorsMissing) {
              actionLabel = "Add solicitors →";
              deepLink = `/agent/transactions/${item.id}`;
            } else {
              const primaryAlert = getPrimaryAlert(item.alerts);
              const action = primaryAlert ? ALERT_ACTIONS[primaryAlert] : null;
              actionLabel = action?.label ?? null;
              deepLink = action?.focus
                ? `/agent/transactions/${item.id}?focus=${action.focus}`
                : `/agent/transactions/${item.id}`;
            }

            return (
              <div key={item.id} className="px-4 py-2.5 hover:bg-white/20 transition-colors">
                {/* Address — full-width row, no competition with badges */}
                <Link
                  href={`/agent/transactions/${item.id}`}
                  style={{ textDecoration: "none" }}
                  className="block mb-1.5"
                >
                  <p className="text-xs font-medium text-slate-900/80 leading-snug">{item.propertyAddress}</p>
                  {item.agentUser && (
                    <p className="text-xs text-slate-900/40 mt-0.5">{item.agentUser.name}</p>
                  )}
                </Link>

                {/* Badges + action — second row, badges left, action right */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1.5 flex-wrap">
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
                  </div>
                  {actionLabel && (
                    <Link
                      href={deepLink}
                      style={{ textDecoration: "none" }}
                      className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg bg-white/50 border border-white/60 text-slate-900/60 hover:bg-white/70 hover:text-slate-900/80 transition-colors whitespace-nowrap"
                    >
                      {actionLabel}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
