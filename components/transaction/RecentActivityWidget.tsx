"use client";

import { useTabContext } from "./TabContext";
import { relativeDate } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import type { ActivityEntry } from "@/lib/services/comms";

type Props = {
  entries: ActivityEntry[];
};

const TYPE_LABEL: Record<string, string> = {
  internal_note: "Internal",
  outbound: "→ Outbound",
  inbound: "← Inbound",
};

export function RecentActivityWidget({ entries }: Props) {
  const { setActiveTab } = useTabContext();
  const recent = entries.slice(0, 3);

  return (
    <Card padding="none">
      <div className="agent-card-hdr">
        <h3 className="agent-card-title">Recent activity</h3>
        <button onClick={() => setActiveTab("activity")} className="agent-link" style={{ fontSize: 11 }}>
          View all →
        </button>
      </div>

      {recent.length === 0 ? (
        <div style={{ padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic", margin: 0 }}>No activity yet</p>
        </div>
      ) : (
        <div>
          {recent.map((entry) => {
            const typeLabel = entry.kind === "milestone"
              ? (entry.isNotRequired ? "Step skipped" : "Step confirmed")
              : (TYPE_LABEL[entry.type] ?? entry.type);
            const description = entry.kind === "milestone"
              ? entry.milestoneName
              : entry.content;
            const time = entry.kind === "milestone"
              ? (entry.at ? relativeDate(entry.at) : "")
              : relativeDate(entry.at);

            return (
              <div key={entry.id} className="agent-hover-row" style={{ padding: "8px 16px", borderBottom: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-coral-deep)", display: "block" }}>{typeLabel}</span>
                  <p style={{ fontSize: 11, color: "var(--agent-text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{description}</p>
                </div>
                <span style={{ fontSize: 10, color: "var(--agent-text-muted)", flexShrink: 0 }}>{time}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
