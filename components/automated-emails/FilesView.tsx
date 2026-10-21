"use client";

// Files view (Insights) — one row per active file, the coverage donut expanded
// into a working list. Where the feed is per-email, this is per-file: its
// automation status, what's queued on it, and whether anything's failing.
// Attention-first ordering comes from the service. The address opens the file;
// file-level automation can be paused/resumed right here (upgrade phase 3) —
// the same switch the file page has, so no trip to the file just to pause it.
// Agency-wide and platform-wide pauses can't be lifted from here and say so.

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { pauseClientEmails, resumeClientEmails } from "@/app/actions/automation";
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
      {rows.map((r) => <FileRow key={r.txId} row={r} />)}
    </div>
  );
}

function FileRow({ row: r }: { row: FileAutomationRow }) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [acting, startActing] = useTransition();
  // Optimistic local flip so the row answers immediately; the refresh confirms.
  const [localPaused, setLocalPaused] = useState<boolean | null>(null);

  const filePaused = localPaused ?? (r.status === "paused" && r.pauseReason === "file");
  const lockedPause = r.status === "paused" && (r.pauseReason === "global" || r.pauseReason === "agency");
  const meta = filePaused ? STATUS_META.paused : lockedPause ? STATUS_META.paused : STATUS_META[r.status === "paused" ? "covered" : r.status];

  function toggle() {
    startActing(async () => {
      const res = filePaused ? await resumeClientEmails(r.txId) : await pauseClientEmails(r.txId);
      if (res.ok) {
        setLocalPaused(!filePaused);
        toast.success(filePaused ? "Automation resumed on this file" : "Automation paused on this file");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div
      className="agent-email-feed-row w-full flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
      style={{ padding: "10px 12px", borderRadius: "var(--agent-radius-md, 8px)", border: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.07))", background: "var(--agent-surface-glass, transparent)" }}
    >
      <div className="min-w-0 flex-1">
        <Link
          href={`/agent/transactions/${r.txId}`}
          className="agent-link"
          style={{ fontSize: 13, fontWeight: 650, color: "var(--agent-text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {r.address}
        </Link>
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>
          {r.pendingCount > 0 ? `${r.pendingCount} queued · ${nextLabel(r.nextSendAt)}` : "Nothing queued"}
        </span>
      </div>

      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {r.issuesCount > 0 && (
          <Pill glass tone="danger" size="sm">{r.issuesCount} {r.issuesCount === 1 ? "problem" : "problems"}</Pill>
        )}
        <Pill glass tone={filePaused || lockedPause ? "muted" : meta.tone} size="sm">
          {filePaused ? PAUSE_LABEL.file : lockedPause && r.pauseReason ? PAUSE_LABEL[r.pauseReason] : meta.label}
        </Pill>
        {!lockedPause && (
          <button
            type="button"
            onClick={toggle}
            disabled={acting}
            className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
            title={filePaused ? "Resume automated emails on this file" : "Pause automated emails on this file"}
          >
            {acting ? "…" : filePaused ? "Resume" : "Pause"}
          </button>
        )}
      </span>
    </div>
  );
}
