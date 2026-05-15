"use client";

import Link from "next/link";
import { Clock, ArrowRight } from "@phosphor-icons/react/dist/ssr";

export type AttentionItem = {
  id: string;
  urgency: "escalated" | "overdue" | "due_today";
  reminderName: string;
  transaction: { id: string; propertyAddress: string };
};

const URGENCY_STYLE = {
  escalated: {
    border: "var(--agent-danger)",
    bg:     "rgba(var(--agent-danger-rgb),0.05)",
    color:  "var(--agent-danger)",
    label:  "Escalated",
  },
  overdue: {
    border: "var(--agent-warning)",
    bg:     "rgba(var(--agent-warning-rgb),0.05)",
    color:  "var(--agent-warning)",
    label:  "Overdue",
  },
  due_today: {
    border: "var(--agent-coral)",
    bg:     "var(--agent-coral-bg-tint)",
    color:  "var(--agent-coral-deep)",
    label:  "Due today",
  },
} as const;

export function AttentionListView({ items }: { items: AttentionItem[] }) {
  return (
    <div
      className="agent-glass-strong"
      style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}
    >
      {/* Section header */}
      <div className="agent-card-hdr" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Clock size={15} color="var(--agent-text-muted)" />
          <div>
            <p className="agent-card-title-emphasis">Needs your attention</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
              Reminders due today or overdue.
            </p>
          </div>
        </div>
        {items.length > 0 && (
          <Link href="/agent/work-queue" className="agent-link" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            All reminders
            <ArrowRight size={12} />
          </Link>
        )}
      </div>

      {/* Rows */}
      {items.length === 0 ? (
        <div style={{
          padding: "24px 20px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--agent-success)", flexShrink: 0,
          }} />
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
            No reminders due. All clear.
          </p>
        </div>
      ) : (
        items.slice(0, 3).map((item, i) => {
          const s = URGENCY_STYLE[item.urgency];
          return (
            <Link
              key={item.id}
              href={`/agent/transactions/${item.transaction.id}?tab=reminders`}
              style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                padding: "13px 20px 13px 17px",
                borderLeft: `3px solid ${s.border}`,
                background: s.bg,
                borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                textDecoration: "none", gap: 12,
              }}
              className="agent-hover-row"
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{
                  margin: 0, fontSize: 12, fontWeight: 500,
                  color: "var(--agent-text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {item.transaction.propertyAddress}
                </p>
                <p style={{
                  margin: "2px 0 0", fontSize: 11,
                  color: "var(--agent-text-secondary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {item.reminderName}
                </p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: s.color, flexShrink: 0,
              }}>
                {s.label}
              </span>
            </Link>
          );
        })
      )}
    </div>
  );
}
