"use client";

// Shared feed-row primitives for the Automated-emails page (upgrade phase 2):
// ONE row component and ONE category chip, used by the Outbox, History and
// Problems views alike — previously the chip existed twice (one canonical Pill,
// one hand-coloured copy) and the row lived privately inside the list view.

import { Pill } from "@/components/ui/Pill";
import { RoleIcon, asRole, roleLabel } from "@/components/ui/RoleIcon";
import { deliveryStatusMeta } from "./deliveryStatus";
import type { EmailRow } from "@/lib/services/automated-emails-list";

export const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });

export function dayKey(d: Date | null | undefined): string {
  if (!d) return "no-date";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function dayLabel(d: Date | null | undefined): string {
  if (!d) return "No date";
  const k = dayKey(d);
  if (k === dayKey(new Date())) return "Today";
  if (k === dayKey(new Date(Date.now() - 86400000))) return "Yesterday";
  if (k === dayKey(new Date(Date.now() + 86400000))) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
export function timeLabel(d: Date | null | undefined): string {
  if (!d) return "";
  return timeFmt.format(d);
}
export function rowTime(row: EmailRow): Date | null {
  return row.status === "pending" || row.status === "upcoming" ? row.scheduledFor : row.status === "errored" ? (row.errorAt ?? row.sentAt) : row.sentAt;
}

export function groupByDay(rows: EmailRow[]): { key: string; label: string; rows: EmailRow[] }[] {
  const groups = new Map<string, { label: string; rows: EmailRow[] }>();
  for (const r of rows) {
    const d = rowTime(r);
    const k = dayKey(d);
    if (!groups.has(k)) groups.set(k, { label: dayLabel(d), rows: [] });
    groups.get(k)!.rows.push(r);
  }
  return Array.from(groups.entries()).map(([key, g]) => ({ key, label: g.label, rows: g.rows }));
}

// The ONE category chip — canonical Pill tones, proper-cased labels, never the
// raw internal word.
export function CategoryChip({ category }: { category: "chase" | "notification" }) {
  return (
    <Pill glass tone={category === "chase" ? "warning" : "info"} size="sm" style={{ textTransform: "uppercase", letterSpacing: "0.03em", fontSize: 9.5, flexShrink: 0 }}>
      {category === "chase" ? "Chase" : "Notification"}
    </Pill>
  );
}

// One compact, scannable email row. Real rows wear their delivery state;
// predicted rows (status "upcoming") wear a dashed accent + "Predicted" so
// they never read as queued records.
export function CompactRow({ row, onOpen, timeText }: { row: EmailRow; onOpen: (row: EmailRow) => void; timeText?: string }) {
  const meta = deliveryStatusMeta(row.deliveryStatus);
  const role = asRole(row.recipientRole);
  const t = rowTime(row);
  const predicted = row.status === "upcoming";
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="agent-email-feed-row w-full text-left flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
      style={{
        padding: "8px 10px",
        borderRadius: "var(--agent-radius-md, 8px)",
        border: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.07))",
        borderLeft: predicted ? "2px dashed var(--agent-border-default, rgba(15,23,42,0.2))" : undefined,
        background: predicted ? "var(--agent-surface-nested, rgba(15,23,42,0.02))" : "var(--agent-surface-glass, transparent)",
      }}
    >
      <span className="hidden sm:block" style={{ fontSize: 11, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums", width: 42, flexShrink: 0 }}>
        {timeText ?? timeLabel(t)}
      </span>
      <CategoryChip category={row.category} />
      <div className="min-w-0 flex-1">
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.transactionAddress}
        </span>
        <span style={{ fontSize: 12, color: "var(--agent-text-secondary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.subject}
          {row.bundleCount && row.bundleCount > 1 && (
            <span style={{ color: "var(--agent-text-muted)", fontWeight: 600 }}> · +{row.bundleCount - 1} more update{row.bundleCount - 1 === 1 ? "" : "s"}</span>
          )}
        </span>
      </div>
      <span className="hidden md:inline-flex" style={{ alignItems: "center", gap: 4, fontSize: 11, color: "var(--agent-text-muted)", minWidth: 0, maxWidth: 160 }}>
        {role && <RoleIcon role={role} size={11} />}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.recipientName}{role ? ` · ${roleLabel(role)}` : ""}</span>
      </span>
      <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {predicted ? (
          <>
            {row.chaseNumber ? <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>chase {row.chaseNumber}</span> : null}
            <Pill tone="muted" size="sm" outline>Predicted</Pill>
          </>
        ) : (
          <Pill glass tone={meta.tone} size="sm">{meta.label}</Pill>
        )}
      </span>
    </button>
  );
}
