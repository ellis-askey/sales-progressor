"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import type { MilestoneDefinition, MilestoneCompletion, PurchaseType } from "@prisma/client";
import { reverseMilestoneAction } from "@/app/actions/milestones";

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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/15 last:border-0">
        <div className="w-5 h-5 rounded-full bg-white/20 border border-white/20 flex items-center justify-center flex-shrink-0">
          <span className="text-slate-900/30 text-[10px] font-bold">—</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-900/50 truncate">{def.name}</p>
          {def.completion?.notRequiredReason && (
            <p className="text-xs text-slate-900/40 mt-0.5 italic">{def.completion.notRequiredReason}</p>
          )}
          {def.completion?.completedAt && (
            <p className="text-xs text-slate-900/30 mt-0.5">{formatDate(def.completion.completedAt)}</p>
          )}
        </div>
        <button
          onClick={handleReinstate}
          disabled={loading}
          className="text-xs text-slate-900/30 hover:text-blue-500 transition-colors font-medium disabled:opacity-40 flex-shrink-0"
        >
          {loading ? "…" : "Reinstate"}
        </button>
      </div>

      {showMortgageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="glass-card-strong rounded-2xl w-full max-w-sm mx-4" style={{ clipPath: "inset(0 round 16px)" }}>
            <div className="px-5 py-4 border-b border-white/20">
              <p className="text-sm font-semibold text-slate-900/90">Is this buyer now using a mortgage?</p>
              <p className="text-xs text-slate-900/40 mt-1">
                Reinstating this will re-open the mortgage milestones. We'll update the purchase method to match.
              </p>
            </div>
            <div className="px-5 py-4 space-y-2">
              <button
                onClick={() => doReinstate("mortgage")}
                className="w-full py-2.5 text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
              >
                Yes — mortgage buyer
              </button>
              <button
                onClick={() => doReinstate()}
                className="w-full py-2.5 text-sm text-slate-900/50 hover:text-slate-900/80 rounded-xl hover:bg-white/20 transition-colors"
              >
                Reinstate without changing purchase method
              </button>
              <button
                onClick={() => setShowMortgageModal(false)}
                className="w-full py-2 text-xs text-slate-900/30 hover:text-slate-900/60 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
