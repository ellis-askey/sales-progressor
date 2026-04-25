"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { useTabContext } from "./TabContext";
import { confirmMilestoneAction } from "@/app/actions/milestones";

type NextMilestone = {
  id: string;
  name: string;
  code: string;
  timeSensitive: boolean;
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
  const { addToast } = useToast();
  const { setActiveTab } = useTabContext();
  const [loading, setLoading] = useState(false);
  const [showImplied, setShowImplied] = useState(false);
  const [implied, setImplied] = useState<{ id: string; name: string }[]>([]);

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

  if (milestone.timeSensitive) {
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
      const res = await fetch(
        `/api/milestones/implied?milestoneDefinitionId=${milestone!.id}&transactionId=${transactionId}`
      );
      const impliedList: { id: string; name: string }[] = await res.json();
      if (impliedList.length > 0) {
        setImplied(impliedList);
        setShowImplied(true);
        setLoading(false);
      } else {
        await doComplete([]);
      }
    } catch {
      setLoading(false);
    }
  }

  async function doComplete(impliedIds: string[]) {
    setLoading(true);
    setShowImplied(false);
    try {
      await confirmMilestoneAction({
        transactionId,
        milestoneDefinitionId: milestone!.id,
        impliedIds,
      });
      addToast(milestone!.name, "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to complete milestone";
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
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

      {/* Implied modal */}
      {showImplied && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="glass-card-strong w-full max-w-sm mx-4">
            <div className="px-5 py-4 border-b border-white/20">
              <p className="text-sm font-semibold text-slate-900/90">Also completing</p>
              <p className="text-xs text-slate-900/40 mt-0.5">These steps are implied by this milestone</p>
            </div>
            <ul className="px-5 py-3 space-y-1.5 max-h-48 overflow-y-auto">
              {implied.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-xs text-slate-900/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {m.name}
                </li>
              ))}
              <li className="flex items-center gap-2 text-xs font-semibold text-slate-900/90">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                {milestone.name}
              </li>
            </ul>
            <div className="px-5 py-4 border-t border-white/20 flex gap-2">
              <button
                onClick={() => doComplete(implied.map((m) => m.id))}
                className="flex-1 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
              >
                Confirm all
              </button>
              <button
                onClick={() => setShowImplied(false)}
                className="flex-1 py-2 text-xs text-slate-900/50 hover:text-slate-900/80 glass-subtle transition-colors"
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
