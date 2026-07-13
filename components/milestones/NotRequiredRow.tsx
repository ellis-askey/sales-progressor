"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import type { MilestoneDefinition, MilestoneCompletion, PurchaseType } from "@prisma/client";
import { reverseMilestoneAction } from "@/app/actions/milestones";
import { MortgageModal } from "@/components/milestones/MortgageModal";

type EnrichedDef = Omit<MilestoneDefinition, "weight"> & {
  weight: number;
  completion: MilestoneCompletion | null;
  isComplete: boolean;
  isNotRequired: boolean;
  isAvailable: boolean;
};

type Props = {
  def: EnrichedDef;
  transactionId: string;
};

export function NotRequiredRow({ def, transactionId }: Props) {
  const [loading, setLoading] = useState(false);
  const [showMortgageModal, setShowMortgageModal] = useState(false);

  const isPM9 = def.code === "PM9";

  async function doReinstate(newPurchaseType?: PurchaseType) {
    setLoading(true);
    setShowMortgageModal(false);
    try {
      await reverseMilestoneAction({
        transactionId,
        milestoneDefinitionId: def.id,
        ...(newPurchaseType ? { newPurchaseType } : {}),
      });
      // revalidatePath in reverseMilestoneAction triggers automatic page re-render
    } catch {
      // silent — optimistic pattern; page re-renders on success
    } finally {
      setLoading(false);
    }
  }

  function handleReinstate() {
    if (isPM9) {
      setShowMortgageModal(true);
    } else {
      doReinstate();
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 border-b last:border-0" style={{ paddingTop: 10, paddingBottom: 10, borderColor: "var(--agent-border-default)" }}>
        <div className="ms-dot ms-dot-nr flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 12, color: "var(--agent-text-muted)", textDecoration: "line-through" }}>{def.name}</p>
          {def.completion?.notRequiredReason && (
            <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 2, fontStyle: "italic" }}>{def.completion.notRequiredReason}</p>
          )}
          {(def.completion?.notRequiredAt ?? def.completion?.completedAt) && (
            <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 2 }}>{formatDate((def.completion?.notRequiredAt ?? def.completion?.completedAt) as Date)}</p>
          )}
        </div>
        <button
          onClick={handleReinstate}
          disabled={loading}
          className="agent-link flex-shrink-0"
          style={{ fontSize: 11 }}
        >
          {loading ? "…" : "Reinstate"}
        </button>
      </div>

      {showMortgageModal && (
        <MortgageModal
          onConfirmMortgage={() => doReinstate("mortgage")}
          onConfirmReinstate={() => doReinstate()}
          onCancel={() => setShowMortgageModal(false)}
        />
      )}
    </>
  );
}
