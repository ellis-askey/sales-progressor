"use client";

// The escalated "get enquiries raised" reminder, in the work queue. Automated
// nudging has stopped at the two-week ceiling, so this is the team's to chase
// personally. Styled to match ReminderCard's escalated state exactly (glass card,
// 4px red stripe, red status bar, Confirm / Snooze actions). Two actions:
//   • Confirm  → markEnquiriesRaisedAction (confirms PM14, closes the chase)
//   • Snooze   → snoozeEnquiryRaiseAction (promised "raised by" date, +3 working days)

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock, Scales } from "@phosphor-icons/react";
import { formatDate, toUKDateStr } from "@/lib/utils";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { markEnquiriesRaisedAction, snoozeEnquiryRaiseAction } from "@/app/actions/enquiries";
import type { EnquiryEscalationReminder } from "@/lib/services/enquiry-escalations";

export function EnquiryEscalationCard({
  reminder,
  showAddressLink = false,
}: {
  reminder: EnquiryEscalationReminder;
  showAddressLink?: boolean;
}) {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const [pending, startTransition] = useTransition();

  const todayStr = toUKDateStr(new Date());
  const escStr = toUKDateStr(reminder.escalatedAt);
  const daysOverdue = Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(escStr).getTime()) / 86400000));
  const headerLeft = daysOverdue > 0 ? `Escalated · ${daysOverdue}d overdue` : "Escalated · due today";
  const summary = `${reminder.nudgeCount} nudge${reminder.nudgeCount === 1 ? "" : "s"} sent · since ${formatDate(reminder.openedAt)}`;

  function markRaised() {
    if (isExiting) return;
    setIsExiting(true);
    startTransition(async () => {
      const res = await markEnquiriesRaisedAction({ transactionId: reminder.transactionId });
      if (res.ok) router.refresh();
      else setIsExiting(false);
    });
  }
  function snooze() {
    if (isExiting) return;
    setIsExiting(true);
    startTransition(async () => {
      await snoozeEnquiryRaiseAction({ transactionId: reminder.transactionId, workingDays: 3 });
      router.refresh();
    });
  }

  return (
    <div
      style={{
        maxHeight: isExiting ? 0 : 600,
        opacity: isExiting ? 0 : 1,
        overflow: isExiting ? "hidden" : "visible",
        transition: "max-height 280ms ease, opacity 220ms ease",
        marginBottom: isExiting ? -8 : 0,
      }}
    >
      <div className="glass-card" style={{ borderRadius: 20, borderLeft: "4px solid #dc2626" }}>
        {/* Status bar */}
        <div
          className="px-4 py-1.5 text-xs font-medium flex items-center justify-between bg-red-50/60 text-red-700"
          style={{ borderRadius: "20px 20px 0 0" }}
        >
          <span>{headerLeft}</span>
          <span className="opacity-60 truncate ml-3">{summary}</span>
        </div>

        {/* Body */}
        <div className="px-5 py-3">
          {showAddressLink && (
            <Link
              href={`/agent/transactions/${reminder.transactionId}`}
              className="text-xs text-slate-900/50 hover:text-slate-900/80 transition-colors block mb-2"
            >
              {reminder.propertyAddress} <LinkArrow />
            </Link>
          )}
          <div className="space-y-1">
            {reminder.solicitorName && (
              <p className="text-xs text-slate-900/40">{reminder.solicitorName} (buyer&rsquo;s solicitor)</p>
            )}
            <p className="text-sm font-semibold leading-snug text-red-700">
              Chase the buyer&rsquo;s solicitor to get enquiries raised
            </p>
            <p className="text-xs text-slate-900/50">
              Automated nudges are done and enquiries still aren&rsquo;t raised, two weeks on. Time to call the buyer&rsquo;s solicitor and push for them.
            </p>
            <span
              className="inline-flex items-center gap-1.5"
              style={{
                padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: "rgba(var(--agent-info-rgb,61,122,184),0.14)",
                border: "0.5px solid rgba(var(--agent-info-rgb,61,122,184),0.34)",
                color: "var(--agent-info)", marginTop: 2,
              }}
            >
              <Scales size={11} weight="fill" /> Buyer&rsquo;s solicitor
            </span>
          </div>

          {/* Action row */}
          <div className="flex items-center justify-end gap-1.5 mt-3">
            <button
              type="button"
              onClick={markRaised}
              disabled={pending || isExiting}
              title="Mark enquiries raised"
              className="reminder-action-btn reminder-confirm-btn"
            >
              <CheckCircle weight="fill" className="reminder-action-icon" />
              <span className="reminder-btn-label">Mark raised</span>
            </button>
            <button
              type="button"
              onClick={snooze}
              disabled={pending || isExiting}
              title="Remind me in 3 working days"
              className="reminder-action-btn reminder-snooze-btn"
            >
              <Clock weight="regular" className="reminder-action-icon" />
              <span className="reminder-btn-label">Snooze</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
