"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, Warning } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { ALERT_CONFIG } from "@/lib/services/work-queue";
import type { WorkQueueItem, AlertType } from "@/lib/services/work-queue";
import { GlassCard } from "@/components/glass/GlassCard";

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
    // Design Lab: `reminders-alerts-strip`. Default v27 per Ellis's pick, 2026-08-09.
    <GlassCard glassId="reminders-alerts-strip" label="Reminders · File alerts strip" defaultVariant="v27" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      {/* Header — agent-card-hdr-warning (canonical, ANIMATION_STANDARDS §S5).
          Whole bar is the disclosure trigger (2026-08-11 drawer-consistency
          pass; was a small Show/Hide link on the right). */}
      <div
        className="agent-card-hdr-warning"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((p) => !p)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsed((p) => !p); } }}
        style={{ cursor: "pointer" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Warning weight="fill" style={{ width: 13, height: 13, color: "var(--agent-warning)", flexShrink: 0 }} />
          <span className="agent-card-title">
            {items.length} file alert{items.length !== 1 ? "s" : ""}
          </span>
          {overdueCount > 0 && (
            <Pill glass tone="danger" size="md">{overdueCount} overdue exchange</Pill>
          )}
          {missingCount > 0 && (
            <Pill glass tone="warning" size="md">{missingCount} missing solicitor</Pill>
          )}
          {staleCount > 0 && (
            // "not progressing" (not the dev shorthand "stale"); matches the
            // per-row "No progress in 14+ days" label in active voice.
            <Pill glass tone="info" size="md">{staleCount} not progressing</Pill>
          )}
        </div>
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden
          style={{
            flexShrink: 0,
            color: "var(--agent-text-muted)",
            transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
          }}
        />
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
    </GlassCard>
  );
}
