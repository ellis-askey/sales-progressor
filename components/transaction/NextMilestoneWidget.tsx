"use client";

import { useState } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { useTabContext } from "./TabContext";
import { confirmMilestoneAction } from "@/app/actions/milestones";

type NextMilestone = {
  id: string;
  name: string;
  code: string;
  eventDateRequired: boolean;
};

type Props = {
  transactionId: string;
  vendorNext: NextMilestone | null;
  purchaserNext: NextMilestone | null;
};

function MilestoneQuickComplete({
  milestone,
  label,
  transactionId,
}: {
  milestone: NextMilestone | null;
  label: string;
  transactionId: string;
}) {
  const { toast } = useAgentToast();
  const { setActiveTab } = useTabContext();
  const [loading, setLoading] = useState(false);

  if (!milestone) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-900/40">{label}</p>
          <p className="text-xs text-emerald-600 font-medium">All milestones complete</p>
        </div>
      </div>
    );
  }

  if (milestone.eventDateRequired) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-5 h-5 rounded-full bg-blue-50 border-2 border-blue-200 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-900/40">{label}</p>
          <p className="text-xs font-semibold text-slate-900/80 truncate">{milestone.name}</p>
        </div>
        <button
          onClick={() => setActiveTab("milestones")}
          className="text-xs text-blue-500 hover:text-blue-600 font-medium flex-shrink-0 transition-colors"
        >
          Complete →
        </button>
      </div>
    );
  }

  async function handleClick() {
    setLoading(true);
    try {
      await confirmMilestoneAction({
        transactionId,
        milestoneDefinitionId: milestone!.id,
      });
      toast.success(milestone!.name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to complete milestone";
      toast.error("Couldn't complete milestone", { description: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-5 h-5 rounded-full bg-blue-50 border-2 border-blue-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-900/40">{label}</p>
        <p className="text-xs font-semibold text-slate-900/80 truncate">{milestone.name}</p>
      </div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors"
      >
        {loading ? "…" : "Complete"}
      </button>
    </div>
  );
}

export function NextMilestoneWidget({ transactionId, vendorNext, purchaserNext }: Props) {
  if (!vendorNext && !purchaserNext) return null;

  return (
    <div className="glass-card">
      <div className="px-4 py-2.5 border-b border-white/20">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <h3 className="text-xs font-semibold text-slate-900/70">Next steps</h3>
        </div>
      </div>
      <div className="divide-y divide-white/15">
        <MilestoneQuickComplete
          milestone={vendorNext}
          label="Vendor"
          transactionId={transactionId}
        />
        <MilestoneQuickComplete
          milestone={purchaserNext}
          label="Purchaser"
          transactionId={transactionId}
        />
      </div>
    </div>
  );
}
