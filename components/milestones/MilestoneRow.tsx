"use client";
// components/milestones/MilestoneRow.tsx

import { useState } from "react";
import type { MilestoneDefinition, MilestoneCompletion } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastContext";

type Props = {
  def: MilestoneDefinition & {
    activeCompletion: MilestoneCompletion | null;
    isComplete: boolean;
    isNotRequired: boolean;
    isAvailable: boolean;
  };
  transactionId: string;
  onRefresh: () => void;
};

// Only these milestones can be marked N/R by the user
const NR_ALLOWED = new Set(["PM4", "PM7"]);

async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 }, colors: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"] });
}

export function MilestoneRow({ def, transactionId, onRefresh }: Props) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEventDate, setShowEventDate] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [showNotRequired, setShowNotRequired] = useState(false);
  const [notRequiredReason, setNotRequiredReason] = useState("");

  // PM4 N/R purchase type modal
  const [showPurchaseTypeModal, setShowPurchaseTypeModal] = useState(false);
  const [selectedPurchaseType, setSelectedPurchaseType] = useState<"cash" | "cash_from_proceeds" | null>(null);

  // Implied predecessors pop-up state
  const [impliedPredecessors, setImpliedPredecessors] = useState<MilestoneDefinition[]>([]);
  const [showImpliedModal, setShowImpliedModal] = useState(false);

  // Reversal downstream state
  const [downstreamMilestones, setDownstreamMilestones] = useState<MilestoneDefinition[]>([]);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [currentPercent, setCurrentPercent] = useState(0);
  const [projectedPercent, setProjectedPercent] = useState(0);

  // Completion date prompt (after exchange confirmed)
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);
  const [completionInput, setCompletionInput] = useState("");
  const [savingCompletion, setSavingCompletion] = useState(false);

  const isCompleted = def.isComplete;
  const isNotRequired = def.isNotRequired;
  const isDone = isCompleted || isNotRequired;
  const isGate = def.isExchangeGate;
  const isPost = def.isPostExchange;
  const isPM4 = def.code === "PM4";
  const isExchangeMilestone = def.code === "VM12" || def.code === "PM16";

  async function handleConfirmClick() {
    setError(null);
    if (def.timeSensitive) { setShowEventDate(true); return; }
    await checkImplied();
  }

  async function checkImplied(ed?: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/milestones/implied?milestoneDefinitionId=${def.id}&transactionId=${transactionId}`);
      const implied: MilestoneDefinition[] = await res.json();
      if (implied.length > 0) {
        setImpliedPredecessors(implied);
        setShowImpliedModal(true);
        setLoading(false);
      } else {
        await doComplete([], ed);
      }
    } catch { setLoading(false); }
  }

  async function doComplete(impliedIds: string[], ed?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          transactionId,
          milestoneDefinitionId: def.id,
          eventDate: ed || eventDate || null,
          impliedIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not complete this milestone.");
        setShowImpliedModal(false);
        return;
      }
      setShowImpliedModal(false);
      setShowEventDate(false);
      setEventDate("");
      const count = impliedIds.length;
      addToast("Milestone confirmed", "success", count > 0 ? `+ ${count} implied milestone${count > 1 ? "s" : ""} also completed` : def.name);
      fireConfetti();
      if (isExchangeMilestone) {
        setShowCompletionPrompt(true);
      }
      onRefresh();
    } finally { setLoading(false); }
  }

  async function handleReverseClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/milestones/downstream?milestoneDefinitionId=${def.id}&transactionId=${transactionId}`);
      const data = await res.json();
      if (data.downstream?.length > 0) {
        setDownstreamMilestones(data.downstream);
        setCurrentPercent(data.currentPercent ?? 0);
        setProjectedPercent(data.projectedPercent ?? 0);
        setShowReverseModal(true);
        setLoading(false);
      } else {
        await doReverse([]);
      }
    } catch { setLoading(false); }
  }

  async function doReverse(downstreamIds: string[]) {
    setLoading(true);
    try {
      await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reverse", transactionId, milestoneDefinitionId: def.id, downstreamIds }),
      });
      setShowReverseModal(false);
      const count = downstreamIds.length;
      addToast("Milestone reversed", "info", count > 0 ? `+ ${count} downstream milestone${count > 1 ? "s" : ""} also undone` : def.name);
      onRefresh();
    } finally { setLoading(false); }
  }

  // PM4 N/R — show purchase type modal first
  function handleNRClick() {
    setError(null);
    if (isPM4) {
      setShowPurchaseTypeModal(true);
    } else {
      setShowNotRequired(true);
    }
  }

  async function doNotRequired(purchaseType?: string) {
    setLoading(true);
    setError(null);
    const finalReason = isPM4
      ? (purchaseType === "cash" ? "Cash buyer" : "Cash from proceeds")
      : notRequiredReason;
    try {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "not_required",
          transactionId,
          milestoneDefinitionId: def.id,
          reason: finalReason,
          ...(purchaseType ? { purchaseType } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not mark as not required.");
        return;
      }
      setShowNotRequired(false);
      setShowPurchaseTypeModal(false);
      setNotRequiredReason("");
      onRefresh();
    } finally { setLoading(false); }
  }

  async function saveCompletionDate() {
    if (!completionInput) { setShowCompletionPrompt(false); return; }
    setSavingCompletion(true);
    await fetch("/api/transactions/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId, completionDate: completionInput }),
    });
    setSavingCompletion(false);
    setShowCompletionPrompt(false);
    setCompletionInput("");
    onRefresh();
  }

  const isBlocked = !isDone && !def.isAvailable;
  const canBeNR = NR_ALLOWED.has(def.code);

  let rowBg = "";
  if (isDone) rowBg = isNotRequired ? "bg-white/10" : "bg-green-50/40";
  if (!isDone && isBlocked) rowBg = "bg-white/10";
  if (isGate && !isDone && !isBlocked) rowBg = "bg-amber-50/60";
  if (isPost) rowBg = "bg-white/5";

  // N/R milestones are rendered in the NotRequired section, not here
  if (isNotRequired) return null;

  return (
    <>
      <div className={`flex items-start gap-3 pl-4 pr-5 py-3.5 border-b border-white/15 last:border-0 ${rowBg}`}>
        {/* Timeline node */}
        <div className="mt-0.5 flex-shrink-0 z-10 relative">
          {isDone ? (
            <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-emerald-400 flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : isBlocked ? (
            <div className="w-6 h-6 rounded-full bg-white/30 border-2 border-white/30 flex items-center justify-center">
              <svg className="w-3 h-3 text-slate-900/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75" />
                <rect x="3" y="10.5" width="18" height="11" rx="2" />
              </svg>
            </div>
          ) : isPost ? (
            <div className="w-6 h-6 rounded-full bg-white/30 border-2 border-white/20" />
          ) : isGate ? (
            <div className="w-6 h-6 rounded-full bg-white border-2 border-amber-400 flex items-center justify-center shadow-sm">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-white border-2 border-blue-300 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug ${isDone ? "text-slate-900/50" : isPost ? "text-slate-900/40" : "text-slate-900/90"} ${isGate ? "font-semibold" : ""}`}>
            {def.name}
            {isGate && <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Exchange gate</span>}
          </p>
          {isDone && def.activeCompletion && (
            <p className="text-xs text-slate-900/40 mt-0.5">
              Completed {formatDate(def.activeCompletion.completedAt)}
              {def.activeCompletion.eventDate && <span className="ml-2">· Event: {formatDate(def.activeCompletion.eventDate)}</span>}
              {def.activeCompletion.statusReason === "Confirmed by client via portal" && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Client confirmed
                </span>
              )}
            </p>
          )}
          {isBlocked && <p className="text-xs text-slate-900/40 mt-0.5">Previous milestones must be completed first</p>}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

          {/* Event date input */}
          {showEventDate && (
            <div className="mt-2 flex items-center gap-2">
              <div>
                <label className="block text-xs text-slate-900/50 mb-1">Event date <span className="text-red-400">*</span></label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 focus:outline-none focus:border-blue-400" />
              </div>
              <button onClick={() => checkImplied(eventDate)} disabled={!eventDate || loading}
                className="mt-5 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300">Confirm</button>
              <button onClick={() => setShowEventDate(false)} className="mt-5 text-xs text-slate-900/40 hover:text-slate-900/70">Cancel</button>
            </div>
          )}

          {/* N/R reason (PM7 only — PM4 uses modal) */}
          {showNotRequired && !isPM4 && (
            <div className="mt-2 flex items-start gap-2">
              <div className="flex-1">
                <label className="block text-xs text-slate-900/50 mb-1">Reason <span className="text-red-400">*</span></label>
                <input type="text" value={notRequiredReason} onChange={(e) => setNotRequiredReason(e.target.value)}
                  placeholder="e.g. No survey needed" autoFocus
                  className="w-full px-2 py-1.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400" />
              </div>
              <button onClick={() => doNotRequired()} disabled={loading || !notRequiredReason.trim()}
                className="mt-5 px-3 py-1.5 text-xs font-medium bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-40">Confirm</button>
              <button onClick={() => { setShowNotRequired(false); setNotRequiredReason(""); }} className="mt-5 text-xs text-slate-900/40 hover:text-slate-900/70">Cancel</button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isDone && !showEventDate && !showNotRequired && (
            <>
              {def.isAvailable && (
                <button onClick={handleConfirmClick} disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors">
                  {loading ? "…" : "Confirm"}
                </button>
              )}
              {def.isAvailable && canBeNR && (
                <button onClick={handleNRClick}
                  className="px-2 py-1.5 text-xs text-slate-900/40 hover:text-slate-900/70 rounded-lg hover:bg-white/20 transition-colors"
                  title="Mark as not required">
                  N/R
                </button>
              )}
            </>
          )}
          {isDone && (
            <button onClick={handleReverseClick} disabled={loading} className="text-xs text-slate-900/30 hover:text-red-400 transition-colors">
              Undo
            </button>
          )}
        </div>
      </div>

      {/* PM4 purchase type modal */}
      {showPurchaseTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="glass-card-strong rounded-2xl w-full max-w-sm mx-4" style={{ clipPath: "inset(0 round 16px)" }}>
            <div className="px-5 py-4 border-b border-white/20">
              <p className="text-sm font-semibold text-slate-900/90">How is the buyer purchasing?</p>
              <p className="text-xs text-slate-900/40 mt-1">
                Marking mortgage milestones as not required — confirm the buyer's purchase method to update the file.
              </p>
            </div>
            <div className="px-5 py-4 space-y-2">
              <button onClick={() => doNotRequired("cash")}
                className="w-full py-2.5 text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors">
                Cash buyer
              </button>
              <button onClick={() => doNotRequired("cash_from_proceeds")}
                className="w-full py-2.5 text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors">
                Cash from proceeds
              </button>
              <button onClick={() => setShowPurchaseTypeModal(false)}
                className="w-full py-2 text-xs text-slate-900/30 hover:text-slate-900/60 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Implied predecessors modal */}
      {showImpliedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="glass-card-strong rounded-2xl max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-slate-900/90 mb-1">This milestone implies others</h3>
            <p className="text-sm text-slate-900/50 mb-4">
              You've confirmed <strong>"{def.name}"</strong>. That usually means the following milestone{impliedPredecessors.length > 1 ? "s are" : " is"} also complete:
            </p>
            <div className="rounded-lg border border-white/20 divide-y divide-white/15 mb-5">
              {impliedPredecessors.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-slate-900/80">{p.name}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-900/40 mb-4">Complete these as well? This will keep your progress clean and avoid confusion later.</p>
            <div className="flex gap-3">
              <button onClick={() => doComplete(impliedPredecessors.map((p) => p.id), eventDate || undefined)} disabled={loading}
                className="flex-1 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm font-medium text-white transition-colors">
                {loading ? "Completing…" : "Yes, complete all"}
              </button>
              <button onClick={() => doComplete([], eventDate || undefined)} disabled={loading}
                className="flex-1 py-2.5 rounded-lg border border-white/20 text-sm font-medium text-slate-900/70 hover:bg-white/20 transition-colors">
                No, just this one
              </button>
            </div>
            <p className="text-xs text-slate-900/40 text-center mt-3">You can undo this later from the milestone timeline</p>
          </div>
        </div>
      )}

      {/* Completion date prompt (after exchange confirmed) */}
      {showCompletionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
          <div className="glass-card-strong rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-semibold text-slate-900/90 mb-1">Exchange confirmed</h3>
            <p className="text-sm text-slate-900/50 mb-4">When is the expected completion date?</p>
            <input
              type="date"
              value={completionInput}
              onChange={(e) => setCompletionInput(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 focus:outline-none focus:border-blue-400 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={saveCompletionDate}
                disabled={savingCompletion || !completionInput}
                className="flex-1 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-sm font-medium text-white transition-colors"
              >
                {savingCompletion ? "Saving…" : "Set completion date"}
              </button>
              <button
                onClick={() => { setShowCompletionPrompt(false); setCompletionInput(""); }}
                className="flex-1 py-2.5 rounded-lg border border-white/20 text-sm text-slate-900/70 hover:bg-white/20 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reversal warning modal */}
      {showReverseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.35)" }}>
          <div className="glass-card-strong rounded-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900/90">This will undo other milestones</h3>
                <p className="text-sm text-slate-900/50 mt-0.5">Undoing <strong>"{def.name}"</strong> means the following completed milestones can no longer be true:</p>
              </div>
            </div>
            <div className="rounded-lg border border-orange-100 bg-orange-50/50 divide-y divide-orange-100 mb-4">
              {downstreamMilestones.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <svg className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <p className="text-sm text-slate-900/80">{m.name}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 glass-subtle rounded-xl px-4 py-3 mb-5">
              <div className="text-center">
                <p className="text-xs text-slate-900/40 mb-0.5">Current</p>
                <p className="text-xl font-semibold text-slate-900/80">{currentPercent}%</p>
              </div>
              <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <div className="text-center">
                <p className="text-xs text-slate-900/40 mb-0.5">After</p>
                <p className="text-xl font-semibold text-orange-500">{projectedPercent}%</p>
              </div>
              <div className="flex-1 text-right">
                <span className="text-sm font-medium text-orange-500">−{currentPercent - projectedPercent}%</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => doReverse(downstreamMilestones.map((m) => m.id))} disabled={loading}
                className="flex-1 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-sm font-medium text-white transition-colors disabled:opacity-50">
                {loading ? "Reversing…" : "Yes, undo all"}
              </button>
              <button onClick={() => setShowReverseModal(false)} disabled={loading}
                className="flex-1 py-2.5 rounded-lg border border-white/20 text-sm font-medium text-slate-900/70 hover:bg-white/20 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
