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
  const [collapsed, setCollapsed] = useState(true);

  if (items.length === 0) return null;

  const overdueCount = items.filter((i) => i.alerts.includes("overdue_exchange")).length;
  const missingCount = items.filter(
    (i) => i.alerts.includes("missing_vendor_solicitor") || i.alerts.includes("missing_purchaser_solicitor")
  ).length;
  const staleCount = items.filter((i) => i.alerts.includes("stale")).length;

  return (
    <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      {/* Header — agent-card-hdr-warning (canonical, ANIMATION_STANDARDS §S5) */}
      <div className="agent-card-hdr-warning">
        <div className="flex items-center gap-2 flex-wrap">
          <Warning weight="fill" style={{ width: 13, height: 13, color: "var(--agent-warning)", flexShrink: 0 }} />
          <span className="agent-card-title">
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
              {/* OLD: "{N} stale" — Rule 2: "stale" is dev shorthand. The per-row label
                   in ALERT_CONFIG already reads "No progress in 14+ days"; this summary
                   badge now matches that spirit in active voice. */}
              {staleCount} not progressing
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed((p) => !p)}
          className="agent-link agent-link-muted"
          style={{ fontSize: 12 }}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      {/* Expanded body — agent-acc / agent-acc-in for animated height transition */}
      <div className={`agent-acc${!collapsed ? " open" : ""}`}>
        <div className="agent-acc-in">
          {items.map((item, i) => {
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
              <div
                key={item.id}
                className="agent-hover-row"
                style={{
                  padding: "10px 16px",
                  borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                }}
              >
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
                      className="agent-link agent-link-muted"
                      style={{ fontSize: 11, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      {actionLabel}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
