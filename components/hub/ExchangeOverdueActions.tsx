"use client";

// The "Deal with it ▾" dropdown on a Hub "Exchange date passed" row, so the agent
// can resolve it in place instead of hunting on the file. Uses the shared
// RowActionMenu (floating, on-screen). Three ways out:
//   - Set a new date → the file's revise flow (has the "spoken to both parties"
//     safety gate), so we don't rebuild that here.
//   - Recalibrate     → re-run the estimate from today (one tap).
//   - Snooze          → hush it for a few days without a fake date (one tap).

import { useState, useTransition } from "react";
import { CalendarPlus, ArrowsClockwise, Clock } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { recalibrateExchangeDateAction, snoozeExchangeReminderAction } from "@/app/actions/transactions";
import { RowActionMenu } from "@/components/hub/RowActionMenu";

export function ExchangeOverdueActions({ transactionId, onDone }: {
  transactionId: string;
  // Called after a successful in-place resolution (recalibrate / snooze), so
  // the hosting card can remove the row without waiting for a reload.
  onDone?: () => void;
}) {
  const { toast } = useAgentToast();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean }>, okMsg: string, okDesc: string, failMsg: string) => {
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) throw new Error("rejected");
        toast.success(okMsg, { description: okDesc });
        onDone?.();
      } catch {
        toast.error(failMsg);
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <RowActionMenu
      label={busy ? "Working…" : "Deal with it"}
      disabled={busy}
      items={[
        {
          key: "set-date",
          icon: <CalendarPlus size={16} weight="bold" />,
          title: "Set a new date",
          sub: "Once you've spoken to both parties.",
          href: `/agent/transactions/${transactionId}`,
        },
        {
          key: "recalibrate",
          icon: <ArrowsClockwise size={16} weight="bold" />,
          title: "Recalibrate estimate",
          sub: "Re-estimate from today based on what's left.",
          onClick: () => run(() => recalibrateExchangeDateAction(transactionId), "Estimate recalibrated", "New expected date set from today.", "Couldn't recalibrate"),
        },
        {
          key: "snooze",
          icon: <Clock size={16} weight="bold" />,
          title: "Snooze a few days",
          sub: "Hush it while you're chasing. No date set.",
          onClick: () => run(() => snoozeExchangeReminderAction(transactionId), "Snoozed", "We'll bring it back in a few days.", "Couldn't snooze"),
        },
      ]}
    />
  );
}
