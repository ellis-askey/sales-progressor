"use client";

// Compact "automated emails on this file" summary, sits at the top of the
// RemindersSection on both the agent and internal-staff file-detail pages.
// Clicking opens a right-side drawer with the full grouped detail.
//
// Default state is intentionally subtle: one line with a count + a preview
// of the next thing happening. When there's no activity on the file at all,
// shows a muted "no automated emails" line rather than hiding (so the
// section is discoverable when activity does start).

import { useState } from "react";
import { AutomatedEmailsDrawer } from "./AutomatedEmailsDrawer";
import type { AutomatedEmailsPreview, UpcomingChase } from "@/lib/services/automated-emails-preview";

type Props = {
  data: AutomatedEmailsPreview;
};

// Compact day-label for the inline summary.
// Returns: "today", "tomorrow", "Mon", "in 9 days" — depending on distance.
function relativeDayLabel(target: Date, now: Date = new Date()): string {
  const startOfNow = new Date(now);
  startOfNow.setUTCHours(0, 0, 0, 0);
  const startOfTarget = new Date(target);
  startOfTarget.setUTCHours(0, 0, 0, 0);
  const diffDays = Math.round((startOfTarget.getTime() - startOfNow.getTime()) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 0) return "overdue";
  if (diffDays < 7) {
    return target.toLocaleDateString("en-GB", { weekday: "short" });
  }
  return `in ${diffDays} days`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function summaryText(data: AutomatedEmailsPreview): string {
  const todayCount = data.pending.length + data.sentToday.length;
  const nextUpcoming: UpcomingChase | undefined = data.upcoming[0];

  // Build the "next" preview clause
  const nextClause = nextUpcoming
    ? `Next: ${nextUpcoming.milestoneLabel} chase to ${firstName(nextUpcoming.contactName)} ${relativeDayLabel(nextUpcoming.predictedFireDate)} ${formatTime(nextUpcoming.predictedFireDate)}`
    : null;

  if (todayCount > 0 && nextClause) {
    return `${todayCount} today · ${nextClause}`;
  }
  if (todayCount > 0) {
    return `${todayCount} automated email${todayCount === 1 ? "" : "s"} today`;
  }
  if (nextClause) {
    return nextClause;
  }
  return "No automated emails on this file in the next 14 days";
}

export function AutomatedEmailsCard({ data }: Props) {
  const [open, setOpen] = useState(false);
  const text = summaryText(data);
  const hasAny = data.pending.length > 0 || data.sentToday.length > 0 || data.upcoming.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 mb-3 rounded-lg text-left transition-colors hover:bg-black/[0.03]"
        style={{
          background: "var(--agent-surface-elevated, #fff)",
          border: "0.5px solid var(--agent-border-default, rgba(15,23,42,0.10))",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded"
            style={{ background: hasAny ? "rgba(255,107,74,0.10)" : "rgba(15,23,42,0.05)" }}
            aria-hidden
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={hasAny ? "#FF6B4A" : "rgba(15,23,42,0.40)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 5L2 7" />
            </svg>
          </span>
          <p
            className="text-[12px] truncate"
            style={{
              color: hasAny ? "var(--agent-text-primary, #1A1D29)" : "var(--agent-text-muted, rgba(15,23,42,0.50))",
              fontWeight: hasAny ? 500 : 400,
            }}
          >
            {text}
          </p>
        </div>
        <span
          className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded"
          style={{
            color: "var(--agent-text-secondary, rgba(15,23,42,0.65))",
            background: "transparent",
          }}
        >
          Open &rarr;
        </span>
      </button>
      {open && (
        <AutomatedEmailsDrawer data={data} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
