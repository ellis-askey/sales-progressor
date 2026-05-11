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

export type MilestoneSideState =
  | { state: "hasNext"; milestone: NextMilestone }
  | { state: "gatePending"; gateType: "exchange_gate" | "post_exchange" }
  | { state: "completionPending"; completionDate: Date }
  | { state: "allComplete" };

type Props = {
  transactionId: string;
  vendorSide: MilestoneSideState;
  purchaserSide: MilestoneSideState;
};

function MilestoneSideRow({
  side,
  label,
  transactionId,
}: {
  side: MilestoneSideState;
  label: string;
  transactionId: string;
}) {
  const { toast } = useAgentToast();
  const { setActiveTab } = useTabContext();
  const [loading, setLoading] = useState(false);

  if (side.state === "allComplete") {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-900/40">{label}</p>
          <p className="text-xs text-emerald-600 font-medium">All steps complete</p>
        </div>
      </div>
    );
  }

  if (side.state === "gatePending") {
    const copy =
      side.gateType === "exchange_gate"
        ? "Awaiting exchange-readiness"
        : "Awaiting exchange confirmation";
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-5 h-5 rounded-full bg-amber-50 border-2 border-amber-200 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-slate-900/40">{label}</p>
          <p className="text-xs text-amber-700 font-medium">{copy}</p>
        </div>
      </div>
    );
  }

  if (side.state === "completionPending") {
    const formatted = side.completionDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-5 h-5 rounded-full bg-blue-50 border-2 border-blue-200 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-slate-900/40">{label}</p>
          <p className="text-xs text-blue-700 font-medium">Completion due {formatted}</p>
        </div>
      </div>
    );
  }

  // side.state === "hasNext"
  const { milestone } = side;

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
          className="text-xs agent-link-primary font-medium flex-shrink-0 transition-colors"
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
        milestoneDefinitionId: milestone.id,
      });
      toast.success(milestone.name);
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
        className="agent-btn agent-btn-sm agent-btn-primary"
      >
        {loading ? "…" : "Complete"}
      </button>
    </div>
  );
}

export function NextMilestoneWidget({ transactionId, vendorSide, purchaserSide }: Props) {
  if (vendorSide.state === "allComplete" && purchaserSide.state === "allComplete") return null;

  return (
    <div className="glass-card overflow-hidden rounded-[12px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/20">
        <h3 className="text-xs font-semibold text-slate-900/70">Next steps</h3>
      </div>
      <div className="divide-y divide-white/15">
        <MilestoneSideRow side={vendorSide} label="Vendor" transactionId={transactionId} />
        <MilestoneSideRow side={purchaserSide} label="Purchaser" transactionId={transactionId} />
      </div>
    </div>
  );
}
