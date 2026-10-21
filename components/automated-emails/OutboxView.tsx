"use client";

// Outbox — the landing view of the Automated-emails page (upgrade phase 2).
// One chronological schedule answering "what are we sending on my behalf?":
// what went TODAY (with its delivery state), what's still to go today, then
// the next 14 days — queued sends and predicted chases merged day by day.
// Every row opens the detail drawer, INCLUDING predictions: a predicted row
// composes the real email with the same engine the send uses, so the preview
// is true to what will land. The "automation exhausted" strip closes the view:
// files where every automated chase has been sent and the step is still open.

import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { CompactRow, dayKey, dayLabel, rowTime } from "./EmailFeedRow";
import type { EmailRow } from "@/lib/services/automated-emails-list";
import type { UpcomingForecast, ExhaustedItem } from "@/lib/services/automated-emails-upcoming";

// Predictions → feed rows, carrying the preview identity the drawer needs.
function predictedToRows(forecast: UpcomingForecast | null): EmailRow[] {
  if (!forecast) return [];
  const out: EmailRow[] = [];
  for (const batch of forecast.predicted) {
    for (const item of batch.items) {
      const predictedTarget =
        item.kind === "client" && item.contactId
          ? ({ kind: "client", contactId: item.contactId, milestoneCode: item.milestoneCode } as const)
          : item.kind === "solicitor" && item.side
            ? ({ kind: "solicitor", side: item.side, milestoneCode: item.milestoneCode } as const)
            : undefined;
      out.push({
        id: item.id,
        source: "queue",
        emailType: item.kind === "solicitor" ? "SOLICITOR_CHASE" : "CLIENT_CHASE",
        category: "chase",
        transactionId: item.txId,
        transactionAddress: item.address,
        recipientName: item.recipientLabel,
        recipientRole: "",
        subject: `${item.milestoneLabel} chase`,
        status: "upcoming",
        deliveryStatus: "pending",
        scheduledFor: item.predictedFor,
        sentAt: null,
        errorAt: null,
        errorMessage: null,
        chaseNumber: item.chaseNumber,
        predictedTarget,
      });
    }
  }
  return out;
}

export function OutboxView({
  sentToday,
  pending,
  forecast,
  filtersActive,
  onOpen,
}: {
  sentToday: EmailRow[];
  pending: EmailRow[];
  forecast: UpcomingForecast | null;
  filtersActive: boolean;
  onOpen: (row: EmailRow) => void;
}) {
  // Predictions can't honour the row filters (they're synthetic, composed at
  // view time) — rather than quietly showing unfiltered rows beside filtered
  // ones, they step back and say so.
  const predictedRows = filtersActive ? [] : predictedToRows(forecast);

  const todayK = dayKey(new Date());
  const all = [...sentToday, ...pending, ...predictedRows];

  // Group by London day. An overdue-but-unsent queue row belongs to TODAY (it
  // goes out on the next run), never to the day it originally missed.
  const groups = new Map<string, { label: string; rows: EmailRow[] }>();
  for (const row of all) {
    const t = rowTime(row);
    let k = dayKey(t);
    let label = dayLabel(t);
    if (row.status !== "sent" && k < todayK) { k = todayK; label = "Today"; }
    if (!groups.has(k)) groups.set(k, { label, rows: [] });
    groups.get(k)!.rows.push(row);
  }
  const ordered = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, g]) => ({
      key,
      label: g.label,
      rows: g.rows.sort((a, b) => {
        // Within a day: what already went (in send order), then what's still to come.
        const aSent = a.status === "sent" ? 0 : 1;
        const bSent = b.status === "sent" ? 0 : 1;
        if (aSent !== bSent) return aSent - bSent;
        return (rowTime(a)?.getTime() ?? 0) - (rowTime(b)?.getTime() ?? 0);
      }),
    }));

  const exhausted = filtersActive ? [] : (forecast?.exhausted ?? []);

  if (ordered.length === 0 && exhausted.length === 0) {
    return (
      <EmptyState
        title={filtersActive ? "No matching emails" : "Nothing sent today and nothing scheduled"}
        description={filtersActive ? "Try clearing the search or filters. Predictions are hidden while filters are on." : "When an automated email sends or gets queued, it appears here."}
        compact
      />
    );
  }

  return (
    <div className="space-y-4">
      {filtersActive && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>
          Predicted chases are hidden while search or filters are on. They come back when you clear them.
        </p>
      )}
      {!filtersActive && forecast?.truncated && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>
          Predictions cover the first 300 files, so the schedule ahead is a floor, not a total.
        </p>
      )}

      {ordered.map((g) => {
        const sent = g.rows.filter((r) => r.status === "sent").length;
        const toGo = g.rows.length - sent;
        const summary =
          g.key === todayK
            ? [sent > 0 ? `${sent} sent` : null, toGo > 0 ? `${toGo} to go` : null].filter(Boolean).join(" · ") || `${g.rows.length} emails`
            : `${g.rows.length} ${g.rows.length === 1 ? "email" : "emails"}`;
        return (
          <div key={g.key}>
            <p className="agent-eyebrow" style={{ marginBottom: 6 }}>{g.label} · {summary}</p>
            <div className="space-y-1">
              {g.rows.map((r) => <CompactRow key={`${r.source}-${r.id}`} row={r} onOpen={onOpen} />)}
            </div>
          </div>
        );
      })}

      {exhausted.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 8px" }}>
            <h3 className="agent-eyebrow" style={{ margin: 0, color: "var(--agent-warning)" }}>Automation exhausted</h3>
            <Pill glass tone="warning" size="sm">{exhausted.length}</Pill>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--agent-text-muted)" }}>
            Every automated chase has been sent and the step is still open. These need a person.
          </p>
          <div className="space-y-2">
            {exhausted.map((e) => <ExhaustedCard key={`${e.kind}-${e.id}`} item={e} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ExhaustedCard({ item }: { item: ExhaustedItem }) {
  return (
    <Link
      href={`/agent/transactions/${item.txId}`}
      className="block"
      style={{ padding: "10px 12px", borderRadius: "var(--agent-radius-md, 8px)", border: "0.5px solid var(--agent-warning-border, rgba(180,83,9,0.3))", background: "var(--agent-warning-bg, rgba(251,191,36,0.08))" }}
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
