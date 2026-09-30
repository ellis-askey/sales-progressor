"use client";

// Calm warning banner shown at the top of the transaction-detail page while
// a file is on hold. Renders nothing when the file isn't on hold — caller
// decides visibility based on PropertyTransaction.status.
//
// Right-side actions (critique — new-buyer flow): "Resume" reactivates the
// file; "Add new buyer" opens the discrete route to add a replacement buyer.
// That route captures the fall-through reason (step 1) then the new buyer
// (step 2). Withdrawing mid-flow flips the file's status, which would normally
// unmount this banner — we keep it mounted while the flow is active so the
// buyer step survives that transition.

import { useState, useTransition } from "react";
import { Warning } from "@phosphor-icons/react";
import { AgentBanner } from "@/components/ui/AgentBanner";
import { WithdrawFileModal } from "./WithdrawFileModal";
import { RelistFileModal } from "./RelistFileModal";
import { changeStatusAction } from "@/app/actions/transactions";
import type { WithdrawalReason } from "@prisma/client";

export function OnHoldBanner({
  show,
  transactionId,
  previousPurchasePrice = null,
  inChain = false,
}: {
  show: boolean;
  transactionId?: string;
  previousPurchasePrice?: number | null;
  inChain?: boolean;
}) {
  const [busy, startTransition] = useTransition();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [buyerOpen, setBuyerOpen] = useState(false);
  const flowActive = reasonOpen || buyerOpen;

  // Stay mounted while the add-buyer flow runs even after the status change
  // (which sets show=false), so the buyer modal isn't torn down mid-flow.
  if (!show && !flowActive) return null;

  const canAct = !!transactionId;

  function resume() {
    if (!transactionId) return;
    startTransition(async () => {
      await changeStatusAction(transactionId, "active");
    });
  }

  function onReasonConfirm(reason: WithdrawalReason, finalReason: string | null) {
    if (!transactionId) return;
    startTransition(async () => {
      // Record the fall-through and withdraw; then hand straight over to the
      // new-buyer step (the file is now withdrawn, so relist's guard passes).
      await changeStatusAction(transactionId, "withdrawn", finalReason, null, reason);
      setReasonOpen(false);
      setBuyerOpen(true);
    });
  }

  const actions = canAct ? (
    <span style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
      <button
        type="button"
        onClick={resume}
        disabled={busy}
        style={{
          font: "inherit", fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 999,
          border: "none", cursor: busy ? "wait" : "pointer", whiteSpace: "nowrap",
          background: "var(--agent-coral-deep, #e8542f)", color: "#fff",
        }}
      >
        Resume
      </button>
      <button
        type="button"
        onClick={() => setReasonOpen(true)}
        disabled={busy}
        style={{
          font: "inherit", fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 999,
          cursor: busy ? "wait" : "pointer", whiteSpace: "nowrap",
          background: "transparent", color: "var(--agent-coral-deep, #e8542f)",
          border: "1px solid color-mix(in srgb, var(--agent-coral, #FF6B4A) 40%, transparent)",
        }}
      >
        Add new buyer
      </button>
    </span>
  ) : undefined;

  return (
    <>
      {show && (
        <AgentBanner
          kind="warning"
          icon={<Warning size={19} weight="fill" />}
          title="This file is on hold."
          body="Everything is paused: no client emails, agent reminders or escalations. Reactivate the file when you're ready to resume."
          rightSlot={actions}
          rightSlotPlacement="inline-responsive"
          className="mb-4"
        />
      )}

      {reasonOpen && (
        <WithdrawFileModal
          inChain={inChain}
          kicker="New buyer"
          title="Add a new buyer"
          subtitle="First, what happened to the current sale?"
          confirmLabel="Next"
          confirmTone="primary"
          onCancel={() => setReasonOpen(false)}
          onConfirm={onReasonConfirm}
        />
      )}

      {buyerOpen && transactionId && (
        <RelistFileModal
          open
          transactionId={transactionId}
          previousPurchasePrice={previousPurchasePrice}
          inChain={inChain}
          onClose={() => setBuyerOpen(false)}
        />
      )}
    </>
  );
}
