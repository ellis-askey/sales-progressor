"use client";

// Owner-only plan control on the billing tab. Two modes:
//   - live plan → a quiet "Cancel plan" with an inline two-step confirm. There's
//     deliberately no remove-card button; cancelling is the only off-switch, and it
//     collects any accrued £5 per-sale charges on the card still on file, then
//     cancels the £59 base at period-end (keep the month paid for).
//   - already scheduled to cancel → a "Keep my plan" button that undoes it before
//     period-end, so a mis-click is never a dead-end.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { cancelBusinessPlanAction, reactivateBusinessPlanAction } from "@/app/actions/progression-clients";

export function CancelPlanButton({ scheduledToCancel = false }: { scheduledToCancel?: boolean }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const r = await cancelBusinessPlanAction();
      if (r.ok) {
        toast.success("Your plan will end at the end of this month.");
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function reactivate() {
    startTransition(async () => {
      const r = await reactivateBusinessPlanAction();
      if (r.ok) {
        toast.success("Your plan will carry on as normal.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  // Already cancelling: offer to undo it rather than leaving a dead "Cancel" button.
  if (scheduledToCancel) {
    return (
      <button
        type="button"
        onClick={reactivate}
        disabled={pending}
        className="agent-btn agent-btn-neutral agent-btn-sm"
        style={{ alignSelf: "flex-start", opacity: pending ? 0.6 : 1 }}
      >
        {pending ? "Reactivating…" : "Keep my plan"}
      </button>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-muted)" }}
      >
        Cancel plan
      </button>
    );
  }

  return (
    <div style={{ padding: "13px 15px", borderRadius: 12, border: "1px solid rgba(199,62,62,0.28)", background: "rgba(199,62,62,0.07)", display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>Cancel your plan?</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>
        You'll keep access until the end of your current month. We'll charge for any sales you've added since your last bill, then stop. You won't be charged again after that.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="agent-btn agent-btn-sm"
          style={{ background: "var(--agent-danger, #C73E3E)", color: "#fff", border: "none", opacity: pending ? 0.6 : 1 }}
        >
          {pending ? "Cancelling…" : "Yes, cancel plan"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="agent-btn agent-btn-neutral agent-btn-sm" disabled={pending}>
          Keep plan
        </button>
      </div>
    </div>
  );
}
