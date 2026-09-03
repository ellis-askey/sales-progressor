"use client";

// Files tab — one row per active file, the coverage donut expanded into a
// working list. Where the feed is per-email, this is per-file: its automation
// status, what's queued on it, and whether anything's failing. Attention-first
// ordering comes from the service. Each row opens the file.

import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import type { FileAutomationRow, FileCoverageStatus } from "@/lib/services/automated-emails-coverage";

const STATUS_META: Record<FileCoverageStatus, { label: string; tone: "success" | "warning" | "muted" }> = {
  covered: { label: "Covered", tone: "success" },
  needInfo: { label: "Needs info", tone: "warning" },
  paused: { label: "Paused", tone: "muted" },
};

const PAUSE_LABEL: Record<"global" | "agency" | "file", string> = {
  global: "Paused everywhere",
  agency: "Paused for the agency",
  file: "Paused on this file",
};

function nextLabel(at: Date | null): string {
  if (!at) return "Nothing queued";
  const t = at.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(at);
  if (day === today) return `Next today ${t}`;
  return `Next ${at.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}`;
}

export function FilesView({ rows }: { rows: FileAutomationRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No active files to monitor" description="Files appear here while a sale is in progress." compact />;
  }

  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const meta = STATUS_META[r.status];
        return (
          <Link
            key={r.txId}
            href={`/agent/transactions/${r.txId}`}
            className="agent-email-feed-row w-full text-left flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
            style={{ padding: "10px 12px", borderRadius: 8, border: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.07))", background: "var(--agent-surface-glass, transparent)" }}
          >
            <div className="min-w-0 flex-1">
              <span style={{ fontSize: 13, fontWeight: 650, color: "var(--agent-text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.address}
              </span>
              <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>
                {r.pendingCount > 0 ? `${r.pendingCount} queued · ${nextLabel(r.nextSendAt)}` : "Nothing queued"}
              </span>
            </div>

            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {r.issuesCount > 0 && (
                <Pill glass tone="danger" size="sm">{r.issuesCount} {r.issuesCount === 1 ? "issue" : "issues"}</Pill>
              )}
              <Pill glass tone={meta.tone} size="sm">
                {r.status === "paused" && r.pauseReason ? PAUSE_LABEL[r.pauseReason] : meta.label}
              </Pill>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
