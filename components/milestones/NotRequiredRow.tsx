"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import type { MilestoneDefinition, MilestoneCompletion, PurchaseType } from "@prisma/client";
import { reverseMilestoneAction, reinstateAsMortgageBuyerAction } from "@/app/actions/milestones";
import { MortgageModal, type MortgageChoice } from "@/components/milestones/MortgageModal";

// The three purchase-type steps a cash buyer has auto-marked not-required.
// Reinstating any of them asks whether the buyer's switched to a mortgage.
const MORTGAGE_NR_CODES = new Set(["PM5", "PM6", "PM11"]);

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
  // Buyer name(s) for the mortgage modal's subtitle. Only used by the mortgage
  // steps; harmless elsewhere.
  buyerNames?: string[];
};

export function NotRequiredRow({ def, transactionId, buyerNames = [] }: Props) {
  const [loading, setLoading] = useState(false);
  const [showMortgageModal, setShowMortgageModal] = useState(false);

  const isMortgageStep = MORTGAGE_NR_CODES.has(def.code);

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

  async function convertWithOffer() {
    setLoading(true);
    setShowMortgageModal(false);
    try {
      await reinstateAsMortgageBuyerAction({
        transactionId,
        milestoneDefinitionId: def.id,
        offerAlreadyReceived: true,
      });
    } catch {
      // silent — optimistic pattern; page re-renders on success
    } finally {
      setLoading(false);
    }
  }

  function handleReinstate() {
    if (isMortgageStep) {
      setShowMortgageModal(true);
    } else {
      doReinstate();
    }
  }

  function handleMortgageChoice(choice: MortgageChoice) {
    if (!choice.convertToMortgage) {
      doReinstate();            // keep as cash buyer, just re-open the step
    } else if (choice.offerAlreadyReceived) {
      convertWithOffer();       // convert + back-fill applied/valuation/offer
    } else {
      doReinstate("mortgage");  // convert, leave the steps outstanding
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
          buyerNames={buyerNames}
          onConfirm={handleMortgageChoice}
          onCancel={() => setShowMortgageModal(false)}
        />
      )}
    </>
  );
}
