"use client";

// Upcoming tab — PREDICTIONS, given a visual treatment distinct from real sends
// (muted, dashed accent, "Predicted" tag) so they never read as queued records.
// Two sections:
//   - Automation exhausted: every configured chase sent, milestone still open.
//     A human-attention signal — shown first, styled as a warning.
//   - Predicted: expected client + solicitor chases over the next 14 days,
//     grouped by day with a per-batch count.

import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import type { UpcomingForecast, PredictedItem, ExhaustedItem } from "@/lib/services/automated-emails-upcoming";

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });

export function UpcomingView({ forecast }: { forecast: UpcomingForecast }) {
  const { predicted, predictedTotal, exhausted } = forecast;

  if (predictedTotal === 0 && exhausted.length === 0) {
    return <EmptyState title="No automated emails currently predicted in the next 14 days" compact />;
  }

  return (
    <div className="space-y-5">
      {exhausted.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", color: "var(--agent-warning, #b45309)" }}>AUTOMATION EXHAUSTED</h3>
            <Pill tone="warning" size="sm">{exhausted.length}</Pill>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--agent-text-muted)" }}>
            Every automated chase has been sent and the step is still open. These need a person.
          </p>
          <div className="space-y-2">
            {exhausted.map((e) => <ExhaustedCard key={`${e.kind}-${e.id}`} item={e} />)}
          </div>
        </div>
      )}

      {predictedTotal > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", color: "var(--agent-text-secondary)" }}>PREDICTED</h3>
            <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{predictedTotal} in the next 14 days</span>
          </div>
          <div className="space-y-4">
            {predicted.map((batch) => (
              <div key={batch.key}>
                <p className="agent-eyebrow" style={{ marginBottom: 6 }}>{batch.label} · {batch.items.length} predicted</p>
                <div className="space-y-1">
                  {batch.items.map((item) => <PredictedRow key={item.id} item={item} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PredictedRow({ item }: { item: PredictedItem }) {
  return (
    <Link
      href={`/agent/transactions/${item.txId}`}
      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 w-full"
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        borderLeft: "2px dashed var(--agent-border-default, rgba(15,23,42,0.2))",
        background: "var(--agent-surface-nested, rgba(15,23,42,0.02))",
      }}
    >
      <span className="hidden sm:block" style={{ fontSize: 11, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums", width: 42, flexShrink: 0 }}>
        {timeFmt.format(item.predictedFor)}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0, background: item.kind === "solicitor" ? "#e0e7ff" : "#ffedd5", color: item.kind === "solicitor" ? "#3730a3" : "#9a3412" }}>
        {item.kind}
      </span>
      <div className="min-w-0 flex-1">
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.address}</span>
        <span style={{ fontSize: 12, color: "var(--agent-text-secondary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.milestoneLabel}</span>
      </div>
      <span className="hidden md:block" style={{ fontSize: 11, color: "var(--agent-text-muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.recipientLabel}</span>
      <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>chase {item.chaseNumber}</span>
        <Pill tone="muted" size="sm" outline>Predicted</Pill>
      </span>
    </Link>
  );
}

function ExhaustedCard({ item }: { item: ExhaustedItem }) {
  return (
    <Link
      href={`/agent/transactions/${item.txId}`}
      className="block"
      style={{ padding: "10px 12px", borderRadius: 8, border: "0.5px solid var(--agent-warning-border, rgba(180,83,9,0.3))", background: "var(--agent-warning-bg, rgba(251,191,36,0.08))" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.address}</span>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0 }}>{item.daysOutstanding}d outstanding</span>
      </div>
      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>
        {item.milestoneLabel} · {item.recipientLabel}
      </p>
      <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
        {item.chasesSent} of {item.cap} automated chases sent{item.lastChaseAt ? ` · last chase ${timeAgo(item.lastChaseAt)}` : ""}
      </p>
    </Link>
  );
}

function timeAgo(d: Date): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
