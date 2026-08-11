"use client";

// Client view for the automated emails page. Renders:
//   - KPI strip (3 counts)
//   - Director-only "All agency / Mine only" segment pill (when shown)
//   - File-filter pill when fileId is in the URL
//   - Tab segment-pill row (URL-driven via <Link>)
//   - List of email rows, grouped by day for sent/upcoming tabs
//   - Each persisted row (pending / sent / errored) opens the
//     EmailPreviewModal on click; predicted upcoming rows have no
//     payload so they're click-disabled.
//
// All navigation is via <Link> + URL query params so deep-links survive
// reload and the back button works as expected.

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EmailRow, EmailListTab } from "@/lib/services/automated-emails-list";
import { EmailPreviewModal } from "@/components/email/EmailPreviewModal";
import { GlassCard } from "@/components/glass/GlassCard";
import { RoleIcon, asRole, roleLabel } from "@/components/ui/RoleIcon";

type Props = {
  rows: EmailRow[];
  counts: { pending: number; sentLast7d: number; sentLast30d: number; errored: number };
  tab: EmailListTab;
  mineOnly: boolean;
  fileId?: string;
  fileLabel: string | null;
  showMineToggle: boolean;
};

const TABS: { value: EmailListTab; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent (30d)" },
  { value: "errored", label: "Errored" },
  { value: "upcoming", label: "Upcoming" },
];

// Per-tab count for the "Label · N" suffix. Returns null when no global
// count is known (Upcoming requires a per-tx prediction fan-out; we don't
// compute that just for the label).
function countForTab(
  t: EmailListTab,
  counts: Props["counts"],
  rows: EmailRow[],
  activeTab: EmailListTab,
): number | null {
  if (t === "pending") return counts.pending;
  if (t === "sent") return counts.sentLast30d;
  if (t === "errored") return counts.errored;
  // upcoming — show count only when we're already on that tab (rows are
  // already loaded; no extra cost). Skip otherwise.
  return t === activeTab ? rows.length : null;
}

// Build a URL preserving the relevant params (mine, fileId) but swapping tab.
function tabHref(tab: EmailListTab, mineOnly: boolean, fileId?: string): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (mineOnly) params.set("mine", "1");
  if (fileId) params.set("fileId", fileId);
  return `/agent/automated-emails?${params.toString()}`;
}

function toggleMineHref(currentTab: EmailListTab, nextMine: boolean, fileId?: string): string {
  const params = new URLSearchParams();
  params.set("tab", currentTab);
  if (nextMine) params.set("mine", "1");
  if (fileId) params.set("fileId", fileId);
  return `/agent/automated-emails?${params.toString()}`;
}

function clearFileFilterHref(currentTab: EmailListTab, mineOnly: boolean): string {
  const params = new URLSearchParams();
  params.set("tab", currentTab);
  if (mineOnly) params.set("mine", "1");
  return `/agent/automated-emails?${params.toString()}`;
}

// London-zoned day key like "2026-05-26".
function dayKey(d: Date | null | undefined): string {
  if (!d) return "no-date";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function dayLabel(d: Date | null | undefined): string {
  if (!d) return "No date";
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const tomorrow = dayKey(new Date(Date.now() + 86400000));
  const k = dayKey(d);
  if (k === today) return "Today";
  if (k === yesterday) return "Yesterday";
  if (k === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function timeLabel(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function CategoryChip({ category }: { category: "chase" | "notification" }) {
  const style =
    category === "chase"
      ? { background: "#ffedd5", color: "#9a3412" }
      : { background: "#dbeafe", color: "#1e40af" };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: 4,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        flexShrink: 0,
        ...style,
      }}
    >
      {category}
    </span>
  );
}

function statusMeta(row: EmailRow): string {
  switch (row.status) {
    case "pending":
      return `Will send ${dayLabel(row.scheduledFor)} ${timeLabel(row.scheduledFor)}`;
    case "sent":
      return `Sent ${dayLabel(row.sentAt)} ${timeLabel(row.sentAt)}`;
    case "errored":
      return `Failed ${dayLabel(row.errorAt)} ${timeLabel(row.errorAt)}`;
    case "upcoming":
      return `Predicted ${dayLabel(row.scheduledFor)} ${timeLabel(row.scheduledFor)}${row.chaseNumber ? ` · chase ${row.chaseNumber} of 2` : ""}`;
  }
}

function EmailRowCard({ row, onPreview }: { row: EmailRow; onPreview: (emailId: string) => void }) {
  const searchParams = useSearchParams();
  // Preserve current tab/mine state when linking back from a file
  const backTab = searchParams.get("tab") ?? "pending";
  const backMine = searchParams.get("mine") === "1";
  const backHref =
    `/agent/automated-emails?tab=${backTab}${backMine ? "&mine=1" : ""}`;
  // Upcoming rows are predictions with synthetic IDs (no queue row yet), and
  // solicitor rows (source "message") live in OutboundMessage, which the
  // queue-only preview modal can't load — for both, the row's property link
  // is the way in (a dedicated detail drawer lands in PR 3). Only real queue
  // rows open the modal.
  const isPreviewable = row.status !== "upcoming" && row.source !== "message";
  return (
    // Design Lab: `auto-emails-row`. Default v05 per Ellis's pick, 2026-08-09.
    <GlassCard
      glassId="auto-emails-row"
      label="Auto emails · Email card"
      defaultVariant="v05"
      style={{
        borderRadius: 10,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <CategoryChip category={row.category} />
        <Link
          href={`/agent/transactions/${row.transactionId}?back=${encodeURIComponent(backHref)}`}
          className="agent-link"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--agent-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          {row.transactionAddress}
        </Link>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 500,
          color: "var(--agent-text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.subject}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 11,
          color: "var(--agent-text-muted)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
          To {row.recipientName}
          {(() => {
            const r = asRole(row.recipientRole);
            if (!r) return null;
            return (
              <>
                <span>·</span>
                <RoleIcon role={r} size={11} />
                <span>{roleLabel(r)}</span>
              </>
            );
          })()}
        </span>
        <span style={{ flexShrink: 0, fontWeight: 500 }}>{statusMeta(row)}</span>
      </div>
      {row.status === "errored" && row.errorMessage && (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 11,
            color: "var(--agent-danger)",
            fontStyle: "italic",
          }}
        >
          {row.errorMessage}
        </p>
      )}
      {isPreviewable && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button
            type="button"
            onClick={() => onPreview(row.id)}
            className="agent-link"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            {row.status === "pending" ? "View / Edit →" : "View →"}
          </button>
        </div>
      )}
    </GlassCard>
  );
}

function emptyCopy(tab: EmailListTab, mineOnly: boolean, showMineToggle: boolean): string {
  if (tab === "pending") {
    if (mineOnly) {
      return "No automated emails queued on your files. Switch to All agency to see the wider view.";
    }
    return "No automated emails queued. The next batch will appear here when scheduled.";
  }
  if (tab === "sent") {
    if (mineOnly) {
      return "No automated emails have been sent on your files in the last 30 days.";
    }
    return "No automated emails sent in the last 30 days yet.";
  }
  if (tab === "errored") {
    return "No failed automated emails. Everything's delivering cleanly.";
  }
  // upcoming
  if (mineOnly) {
    return "Nothing predicted in the next 14 days on your files.";
  }
  if (showMineToggle && !mineOnly) {
    return "Nothing predicted in the next 14 days across the agency.";
  }
  return "Nothing predicted in the next 14 days.";
}

function groupByDay(rows: EmailRow[], dateField: "scheduledFor" | "sentAt"): { key: string; label: string; rows: EmailRow[] }[] {
  const groups = new Map<string, { label: string; rows: EmailRow[] }>();
  for (const r of rows) {
    const d = r[dateField] ?? r.scheduledFor;
    const key = dayKey(d);
    const label = dayLabel(d);
    const g = groups.get(key) ?? { label, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  return Array.from(groups.entries()).map(([key, g]) => ({ key, label: g.label, rows: g.rows }));
}

export function AutomatedEmailsListView({
  rows,
  counts,
  tab,
  mineOnly,
  fileId,
  fileLabel,
  showMineToggle,
}: Props) {
  const [previewEmailId, setPreviewEmailId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {/* Director toggle + file filter pill */}
      {(showMineToggle || fileId) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {showMineToggle && (
            <div style={{ display: "flex", gap: 4 }}>
              <Link
                href={toggleMineHref(tab, false, fileId)}
                className={`agent-segment-pill agent-segment-pill-sm${!mineOnly ? " on" : ""}`}
              >
                All agency
              </Link>
              <Link
                href={toggleMineHref(tab, true, fileId)}
                className={`agent-segment-pill agent-segment-pill-sm${mineOnly ? " on" : ""}`}
              >
                Mine only
              </Link>
            </div>
          )}
          {fileId && fileLabel && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--agent-text-secondary)",
                background: "var(--agent-surface-glass)",
                border: "0.5px solid rgba(15,23,42,0.10)",
                borderRadius: 8,
                padding: "4px 10px",
              }}
            >
              <span>Filtered to: {fileLabel}</span>
              <Link
                href={clearFileFilterHref(tab, mineOnly)}
                className="agent-link agent-link-muted"
                style={{ fontSize: 11 }}
              >
                Clear
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        {TABS.map((t) => {
          const n = countForTab(t.value, counts, rows, tab);
          return (
            <Link
              key={t.value}
              href={tabHref(t.value, mineOnly, fileId)}
              className={`agent-segment-pill agent-segment-pill-sm${tab === t.value ? " on" : ""}`}
            >
              {t.label}
              {n != null ? ` · ${n}` : ""}
            </Link>
          );
        })}
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div
          style={{
            background: "var(--agent-surface-elevated)",
            border: "1px solid var(--agent-border-default)",
            borderRadius: 10,
            padding: "24px 16px",
            textAlign: "center",
            color: "var(--agent-text-muted)",
            fontSize: 13,
            fontStyle: "italic",
          }}
        >
          {emptyCopy(tab, mineOnly, showMineToggle)}
        </div>
      ) : tab === "sent" || tab === "upcoming" ? (
        <div className="space-y-4">
          {groupByDay(rows, tab === "sent" ? "sentAt" : "scheduledFor").map((g) => (
            <div key={g.key}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--agent-text-muted)",
                  marginBottom: 8,
                }}
              >
                {g.label}
              </p>
              <div className="space-y-2">
                {g.rows.map((r) => (
                  <EmailRowCard key={r.id} row={r} onPreview={setPreviewEmailId} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <EmailRowCard key={r.id} row={r} onPreview={setPreviewEmailId} />
          ))}
        </div>
      )}

      {previewEmailId && (
        <EmailPreviewModal
          emailId={previewEmailId}
          onClose={() => setPreviewEmailId(null)}
        />
      )}
    </div>
  );
}

// Clickable KPI card — whole card is a Link that jumps to the matching tab.
// Uses the .agent-kpi-card class for hover lift + chevron reveal (defined
// in agent-system.css alongside the segment-pill recipe).
