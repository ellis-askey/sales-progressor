"use client";

// The "Deal with it ▾" dropdown on a Hub "Exchange date passed" row, so the agent
// can resolve it in place instead of hunting on the file. Uses the shared
// RowActionMenu (floating, on-screen). Three ways out:
//   - Set a new date → the revise modal, right here (the shared
//     ReviseExchangeDateModal, with its "spoken to both parties" safety gate).
//   - Recalibrate     → re-run the estimate from today (one tap).
//   - Snooze          → hush it for a few days without a fake date (one tap).

import { useState, useTransition } from "react";
import { CalendarPlus, ArrowsClockwise, Clock } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { recalibrateExchangeDateAction, snoozeExchangeReminderAction } from "@/app/actions/transactions";
import { RowActionMenu } from "@/components/hub/RowActionMenu";
import { ReviseExchangeDateModal } from "@/components/transaction/ReviseExchangeDateModal";

export function ExchangeOverdueActions({ transactionId, address, onDone }: {
  transactionId: string;
  address: string;
  // Called after a successful in-place resolution (new date / recalibrate /
  // snooze), so the hosting card can remove the row without waiting for a reload.
  onDone?: () => void;
}) {
  const { toast } = useAgentToast();
  const [busy, setBusy] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [, startTransition] = useTransition();

  // okDesc can be a plain string or, when the action returns detail worth showing
  // (e.g. the recalibrated date), a function of the result.
  const run = <T extends { ok: boolean }>(
    action: () => Promise<T>,
    okMsg: string,
    okDesc: string | ((res: T) => string),
    failMsg: string,
  ) => {
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) throw new Error("rejected");
        toast.success(okMsg, { description: typeof okDesc === "function" ? okDesc(res) : okDesc });
        onDone?.();
      } catch {
        toast.error(failMsg);
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <>
    <RowActionMenu
      label={busy ? "Working…" : "Deal with it"}
      disabled={busy}
      items={[
        {
          key: "set-date",
          icon: <CalendarPlus size={16} weight="bold" />,
          title: "Set a new date",
          sub: "Once you've spoken to both parties.",
          onClick: () => setReviseOpen(true),
        },
        {
          key: "recalibrate",
          icon: <ArrowsClockwise size={16} weight="bold" />,
          title: "Recalibrate estimate",
          sub: "Re-estimate from today based on what's left.",
          onClick: () => run(
            () => recalibrateExchangeDateAction(transactionId),
            "Estimate recalibrated",
            (res) => (res.newDate ? `New expected exchange: ${res.newDate}` : "New expected date set from today."),
            "Couldn't recalibrate",
          ),
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
    {reviseOpen && (
      <ReviseExchangeDateModal
        transactionId={transactionId}
        address={address}
        onClose={() => setReviseOpen(false)}
        onSaved={() => {
          setReviseOpen(false);
          toast.success("New date set", { description: "The expected exchange date has been revised." });
          onDone?.();
        }}
      />
    )}
    </>
  );
}
