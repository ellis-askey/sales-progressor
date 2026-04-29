"use client";
// components/milestones/MilestoneRow.tsx

import { useState, useOptimistic, useTransition, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { MilestoneDefinition, MilestoneCompletion } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { confirmMilestoneAction, markNotRequiredAction, reverseMilestoneAction, getExchangeReconciliationList, confirmExchangeReconciliationAction, getUndoImpactAction, executeUndoMilestoneAction } from "@/app/actions/milestones";
import type { UndoImpact } from "@/app/actions/milestones";
import { getEventDateLabel } from "@/lib/portal-copy";
import { ExchangeCelebration } from "@/components/milestones/ExchangeCelebration";

type Props = {
  def: MilestoneDefinition & {
    completion: MilestoneCompletion | null;
    isComplete: boolean;
    isNotRequired: boolean;
    isAvailable: boolean;
  };
  transactionId: string;
  onConfirmStart?: () => void;
  onNRStart?: () => void;
  onUndoStart?: () => void;
  optimisticallyAvailable?: boolean;
  optimisticallyRelocked?: boolean;
};

// Only PM9 (mortgage application) can be manually marked N/R
const NR_ALLOWED = new Set(["PM9"]);
const POST_EXCHANGE_CODES = new Set(["VM19", "VM20", "PM26", "PM27"]);
const RECONCILIATION_CODES = new Set(["VM19", "PM26", "VM20", "PM27"]);

export function MilestoneRow({ def, transactionId, onConfirmStart, onNRStart, onUndoStart, optimisticallyAvailable, optimisticallyRelocked }: Props) {
  const { toast } = useAgentToast();
  const [isPending, startTransition] = useTransition();
  const [optimisticState, addOptimistic] = useOptimistic(
    { isComplete: def.isComplete, isNotRequired: def.isNotRequired },
    (_, action: "complete" | "not_required" | "reverse") => {
      if (action === "complete")     return { isComplete: true,  isNotRequired: false };
      if (action === "not_required") return { isComplete: false, isNotRequired: true  };
      return                                { isComplete: false, isNotRequired: false };
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEventDate, setShowEventDate] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [desktopValuation, setDesktopValuation] = useState(false);
  const [showNotRequired, setShowNotRequired] = useState(false);
  const [notRequiredReason, setNotRequiredReason] = useState("");

  // PM9 N/R — simple survey confirmation modal
  const [showSurveyNrConfirm, setShowSurveyNrConfirm] = useState(false);

  // Undo modal state (two-step: read impact → show modal → confirm)
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [undoData, setUndoData] = useState<UndoImpact | null>(null);
  const [undoMode, setUndoMode] = useState<"target_only" | "cascade">("target_only");
  const [undoCascadeExpanded, setUndoCascadeExpanded] = useState(false);

  // Exchange / completion reconciliation state
  type ReconciliationItem = { id: string; name: string; side: string; code: string; eventDateRequired: boolean };
  const [reconciliationOutstanding, setReconciliationOutstanding] = useState<ReconciliationItem[]>([]);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [reconciledIds, setReconciledIds] = useState<Set<string>>(new Set());
  const [reconciledDates, setReconciledDates] = useState<Record<string, string>>({});
  const [reconciliationExpanded, setReconciliationExpanded] = useState(false);
  const [pendingReconcileEd, setPendingReconcileEd] = useState<string | undefined>(undefined);
  const [reconcileEventDate, setReconcileEventDate] = useState("");
  const [reconcileCompletionDate, setReconcileCompletionDate] = useState("");

  // Detect when this row transitions from blocked → available and play unlock animation
  const wasAvailableRef = useRef(def.isAvailable);
  const [justUnlocked, setJustUnlocked] = useState(false);
  useEffect(() => {
    if (!wasAvailableRef.current && def.isAvailable) {
      setJustUnlocked(true);
      const t = setTimeout(() => setJustUnlocked(false), 900);
      return () => clearTimeout(t);
    }
    wasAvailableRef.current = def.isAvailable;
  }, [def.isAvailable]);

  useEffect(() => {
    if (def.isComplete) setError(null);
  }, [def.isComplete]);

  // Exchange celebration overlay
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationAddress, setCelebrationAddress] = useState("");

  const isCompleted = optimisticState.isComplete;
  const isNotRequired = optimisticState.isNotRequired;
  const isDone = isCompleted || isNotRequired;
  const isGate = def.code === "VM18" || def.code === "PM25";
  const isPost = POST_EXCHANGE_CODES.has(def.code);
  const isPM9 = def.code === "PM9";
  const isExchangeMilestone = def.code === "VM19" || def.code === "PM26";
  const effectivelyAvailable = (def.isAvailable || (optimisticallyAvailable ?? false)) && !(optimisticallyRelocked ?? false);

  function handleConfirmClick() {
    onConfirmStart?.();
    setError(null);
    if (def.eventDateRequired && !RECONCILIATION_CODES.has(def.code)) {
      setShowEventDate(true);
      return;
    }
    doComplete();
  }

  function doComplete() {
    setShowEventDate(false);
    setDesktopValuation(false);
    setError(null);

    if (RECONCILIATION_CODES.has(def.code)) {
      setLoading(true);
      getExchangeReconciliationList({ transactionId, milestoneDefinitionId: def.id })
        .then((data) => {
          setLoading(false);
          const todayStr = new Date().toISOString().split("T")[0];
          setReconciliationOutstanding(data.outstanding);
          setReconciledIds(new Set(data.outstanding.map((m) => m.id)));
          setReconciledDates({});
          setReconciliationExpanded(false);
          setPendingReconcileEd(eventDate || undefined);
          setReconcileEventDate(eventDate || todayStr);
          setReconcileCompletionDate("");
          setShowReconciliationModal(true);
        })
        .catch((err: unknown) => {
          setLoading(false);
          setError(err instanceof Error ? err.message : "Could not load reconciliation data");
        });
      return;
    }

    startTransition(async () => {
      addOptimistic("complete");
      try {
        const result = await confirmMilestoneAction({
          transactionId,
          milestoneDefinitionId: def.id,
          eventDate: eventDate || null,
        });
        if (result.triggeredCelebration && result.propertyAddress) {
          setCelebrationAddress(result.propertyAddress);
          setCelebrating(true);
        } else {
          toast.success(def.name);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Could not complete this milestone.";
        setError(message);
      } finally {
        setLoading(false);
        setEventDate("");
      }
    });
  }

  function doReconciliationConfirm(
    ed: string | undefined,
    outstandingIds: string[],
    outstandingDates: Record<string, string>,
    completionDate?: string
  ) {
    setShowReconciliationModal(false);
    startTransition(async () => {
      addOptimistic("complete");
      try {
        const result = await confirmExchangeReconciliationAction({
          transactionId,
          milestoneDefinitionId: def.id,
          eventDate: ed || null,
          outstandingIds,
          outstandingDates,
          completionDate: completionDate || undefined,
        });
        if (result.triggeredCelebration && result.propertyAddress) {
          setCelebrationAddress(result.propertyAddress);
          setCelebrating(true);
        } else {
          const count = outstandingIds.length;
          toast.success(def.name, count > 0 ? { description: `+${count} milestone${count > 1 ? "s" : ""} reconciled` } : undefined);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Could not complete this milestone.";
        setError(message);
      } finally {
        setLoading(false);
      }
    });
  }

  async function handleUndoClick() {
    setError(null);
    setLoading(true);
    try {
      const data = await getUndoImpactAction({ transactionId, milestoneDefinitionId: def.id });
      setUndoData(data);
      setUndoMode("target_only");
      setUndoCascadeExpanded(false);
      setShowUndoModal(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load undo information");
    } finally {
      setLoading(false);
    }
  }

  function doUndo() {
    if (!undoData) return;
    setShowUndoModal(false);
    onUndoStart?.();
    startTransition(async () => {
      addOptimistic("reverse");
      try {
        await executeUndoMilestoneAction({ transactionId, milestoneDefinitionId: def.id, mode: undoMode });
        const count = undoMode === "cascade" ? undoData.cascade.length : 0;
        toast.info("Milestone reversed", {
          description: count > 0 ? `+${count} downstream milestone${count > 1 ? "s" : ""} also undone` : def.name,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Could not reverse this milestone.";
        setError(message);
      } finally {
        setLoading(false);
      }
    });
  }

  // PM9 N/R — simple survey confirmation
  function handleNRClick() {
    setError(null);
    if (isPM9) {
      setShowSurveyNrConfirm(true);
    } else {
      setShowNotRequired(true);
    }
  }

  function doNotRequired() {
    const finalReason = isPM9 ? "Buyer confirmed no private survey required" : notRequiredReason;
    setShowNotRequired(false);
    setShowSurveyNrConfirm(false);
    setNotRequiredReason("");
    setError(null);
    onNRStart?.();
    startTransition(async () => {
      addOptimistic("not_required");
      try {
        await markNotRequiredAction({
          transactionId,
          milestoneDefinitionId: def.id,
          reason: finalReason,
        });
        toast.success("Marked not required");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Could not mark as not required.";
        setError(message);
      } finally {
        setLoading(false);
      }
    });
  }

  const isPM6 = def.code === "PM6";
  const isBlocked = !isDone && !effectivelyAvailable;
  const canBeNR = NR_ALLOWED.has(def.code);

  let rowBg = "";
  if (isDone) rowBg = isNotRequired ? "bg-white/10" : "bg-green-50/40";
  else if (isBlocked) rowBg = "bg-white/10";
  else if (isGate && !isBlocked) rowBg = "bg-amber-50/60";
  else if (isPost) rowBg = "bg-white/5";

  // N/R milestones are rendered in the NotRequired section, not here
  if (isNotRequired) return null;

  return (
    <>
      <div className={`flex items-start gap-3 pl-4 pr-5 py-3.5 border-b border-white/15 last:border-0 transition-colors duration-[150ms] ${rowBg} ${justUnlocked ? "ms-unlock-enter" : ""}`}>
        {/* Timeline node */}
        <div className="mt-0.5 flex-shrink-0 z-10 relative">
          {isDone ? (
            <div className="ms-node-pop w-6 h-6 rounded-full bg-emerald-500 border-2 border-emerald-400 flex items-center justify-center shadow-sm">
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
          {isDone && def.completion && (
            <p className="text-xs text-slate-900/40 mt-0.5">
              Completed {formatDate(def.completion.completedAt)}
              {def.completion.eventDate && <span className="ml-2">· Event: {formatDate(def.completion.eventDate)}</span>}
              {def.completion.confirmedByPortal && (
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
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <div>
                  <label className="block text-xs text-slate-900/50 mb-1">
                    {getEventDateLabel(def.code)} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    disabled={isPM6 && desktopValuation}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="glass-input px-2 py-1.5 text-sm disabled:opacity-40"
                  />
                </div>
                <button
                  onClick={() => doComplete()}
                  disabled={(!eventDate && !(isPM6 && desktopValuation)) || loading || isPending}
                  className="mt-5 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
                >
                  Confirm
                </button>
                <button
                  onClick={() => { setShowEventDate(false); setDesktopValuation(false); setEventDate(""); }}
                  className="mt-5 text-xs text-slate-900/40 hover:text-slate-900/70"
                >
                  Cancel
                </button>
              </div>
              {isPM6 && (
                <label className="flex items-center gap-2 text-xs text-slate-900/50 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={desktopValuation}
                    onChange={(e) => { setDesktopValuation(e.target.checked); if (e.target.checked) setEventDate(""); }}
                    className="rounded"
                  />
                  Desktop valuation — no date
                </label>
              )}
            </div>
          )}

          {/* N/R reason (PM9 uses modal, others shouldn't reach here) */}
          {showNotRequired && !isPM9 && (
            <div className="mt-2 flex items-start gap-2">
              <div className="flex-1">
                <label className="block text-xs text-slate-900/50 mb-1">Reason <span className="text-red-400">*</span></label>
                <input type="text" value={notRequiredReason} onChange={(e) => setNotRequiredReason(e.target.value)}
                  placeholder="e.g. No survey needed" autoFocus
                  className="glass-input w-full px-2 py-1.5 text-sm" />
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
              {effectivelyAvailable && (
                <button onClick={handleConfirmClick} disabled={loading || isPending}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-400 transition-colors flex items-center gap-1.5 min-w-[80px] justify-center">
                  {loading ? (
                    <>
                      <svg className="animate-spin w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Confirming…
                    </>
                  ) : "Confirm"}
                </button>
              )}
              {effectivelyAvailable && canBeNR && (
                <button onClick={handleNRClick}
                  disabled={loading || isPending}
                  className="px-2 py-1.5 text-xs text-slate-900/40 hover:text-slate-900/70 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-40"
                  title="Mark as not required">
                  N/R
                </button>
              )}
            </>
          )}
          {isDone && (
            <button onClick={handleUndoClick} disabled={loading || isPending} className="text-xs text-slate-900/30 hover:text-red-400 transition-colors">
              {loading ? "…" : "Undo"}
            </button>
          )}
        </div>
      </div>

      {/* PM9 N/R — survey confirmation */}
      {showSurveyNrConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900/90">No private survey required?</p>
              <p className="text-xs text-slate-900/50 mt-1">
                Please confirm the buyer does not require a private Level 2 or Level 3 survey. The survey report milestone will also be marked as not required.
              </p>
            </div>
            <div className="px-5 py-4 space-y-2">
              <button onClick={() => doNotRequired()}
                className="w-full py-2.5 text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors">
                Yes, mark as not required
              </button>
              <button onClick={() => setShowSurveyNrConfirm(false)}
                className="w-full py-2 text-xs text-slate-900/30 hover:text-slate-900/60 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Exchange / completion reconciliation modal */}
      {showReconciliationModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <h3 className="text-base font-semibold text-slate-900 mb-3">
              {def.code === "VM19" || def.code === "PM26" ? "Confirm exchange" : "Confirm completion"}
            </h3>

            {/* Date inputs */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-3 flex-shrink-0">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  {def.code === "VM19" || def.code === "PM26" ? "Date contracts exchanged" : "Date sale completed"}
                </label>
                <input
                  type="date"
                  value={reconcileEventDate}
                  onChange={(e) => setReconcileEventDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-xs text-slate-400 mt-1">Pre-filled with today — change if it was different</p>
              </div>
              {(def.code === "VM19" || def.code === "PM26") && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Expected completion date <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={reconcileCompletionDate}
                    onChange={(e) => setReconcileCompletionDate(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              )}
            </div>

            {reconciliationOutstanding.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex-shrink-0">Outstanding milestones</p>
                <p className="text-xs text-slate-400 mb-3 flex-shrink-0">
                  These haven{"'"}t been confirmed yet. Tick those that are done — they{"'"}ll be marked as reconciled at exchange.
                  Untick or leave a date blank to exclude.
                </p>

                <div className="rounded-lg border border-slate-100 divide-y divide-slate-100 mb-3 overflow-y-auto flex-1 min-h-0">
                  {(reconciliationExpanded ? reconciliationOutstanding : reconciliationOutstanding.slice(0, 5)).map((item) => (
                    <div key={item.id} className="px-4 py-2.5">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded"
                          checked={reconciledIds.has(item.id)}
                          onChange={(e) => {
                            setReconciledIds((prev) => {
                              const next = new Set(prev);
                              e.target.checked ? next.add(item.id) : next.delete(item.id);
                              return next;
                            });
                          }}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="text-sm text-slate-700 block">{item.name}</span>
                          <span className="text-xs text-slate-400">{item.side === "vendor" ? "Vendor" : "Purchaser"}</span>
                        </span>
                      </label>
                      {item.eventDateRequired && reconciledIds.has(item.id) && (
                        <div className="mt-2 ml-6">
                          <label className="block text-xs text-slate-500 mb-1">{getEventDateLabel(item.code)} <span className="text-slate-400">(blank = exclude)</span></label>
                          <input
                            type="date"
                            value={reconciledDates[item.id] ?? ""}
                            onChange={(e) => setReconciledDates((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-[180px]"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {reconciliationOutstanding.length > 5 && (
                  <button
                    onClick={() => setReconciliationExpanded((v) => !v)}
                    className="text-xs text-blue-500 hover:text-blue-600 mb-3 text-left flex-shrink-0"
                  >
                    {reconciliationExpanded
                      ? "Show fewer"
                      : `Show ${reconciliationOutstanding.length - 5} more`}
                  </button>
                )}
              </>
            )}

            <div className="flex gap-3 pt-1 flex-shrink-0">
              <button
                onClick={() => {
                  const effectiveIds = [...reconciledIds].filter((id) => {
                    const item = reconciliationOutstanding.find((m) => m.id === id);
                    if (!item) return false;
                    if (item.eventDateRequired && !reconciledDates[id]) return false;
                    return true;
                  });
                  doReconciliationConfirm(
                    reconcileEventDate || pendingReconcileEd,
                    effectiveIds,
                    Object.fromEntries(
                      Object.entries(reconciledDates).filter(([, v]) => !!v)
                    ),
                    reconcileCompletionDate || undefined
                  );
                }}
                className="flex-1 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm font-medium text-white transition-colors"
              >
                {isExchangeMilestone ? "Confirm exchange" : "Confirm completion"}
              </button>
              <button
                onClick={() => setShowReconciliationModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Undo milestone modal — target_only or cascade */}
      {showUndoModal && undoData && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[88vh] flex flex-col">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Undo milestone</h3>
                <button
                  onClick={() => setShowUndoModal(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {undoData.cascade.length > 0
                  ? `${def.name} — what would you like to do?`
                  : `Are you sure you want to undo "${def.name}"?`}
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto flex-1">
              {undoData.cascade.length === 0 ? (
                /* No cascade — simple confirmation */
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Reverse this milestone. Use this if you ticked the wrong one or it hasn{"'"}t happened yet.
                  </p>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-0.5">Current</p>
                      <p className="text-xl font-semibold text-slate-700">{undoData.currentPercent}%</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-0.5">After</p>
                      <p className={`text-xl font-semibold ${undoData.targetOnlyPercent < undoData.currentPercent ? "text-orange-500" : "text-slate-700"}`}>
                        {undoData.targetOnlyPercent}%
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Two options */
                <div className="space-y-3">
                  {/* Option 1 — target only */}
                  <label
                    className={`block rounded-xl border-2 p-4 cursor-pointer transition-all ${
                      undoMode === "target_only"
                        ? "border-blue-500 bg-blue-50/50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name={`undoMode-${def.id}`}
                        value="target_only"
                        checked={undoMode === "target_only"}
                        onChange={() => setUndoMode("target_only")}
                        className="mt-0.5 accent-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Undo this milestone only</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Reverse this milestone but keep downstream work as-is. Use this if you ticked the wrong one or it hasn{"'"}t happened yet.
                        </p>
                        <p className="text-xs text-slate-500 mt-1.5">
                          Progress: <span className="font-medium">{undoData.currentPercent}% → {undoData.targetOnlyPercent}%</span>
                        </p>
                        <p className="text-xs text-orange-600 mt-1.5">
                          Note: {undoData.cascade.length} downstream milestone{undoData.cascade.length !== 1 ? "s are" : " is"} complete. {undoData.cascade.length !== 1 ? "They" : "It"} will stay complete and may need re-checking later if this milestone is permanently undone.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Option 2 — cascade */}
                  <label
                    className={`block rounded-xl border-2 p-4 cursor-pointer transition-all ${
                      undoMode === "cascade"
                        ? "border-blue-500 bg-blue-50/50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name={`undoMode-${def.id}`}
                        value="cascade"
                        checked={undoMode === "cascade"}
                        onChange={() => setUndoMode("cascade")}
                        className="mt-0.5 accent-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Undo this and downstream milestones</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Reverse this milestone and all completed dependents. Use this if the chain of work genuinely didn{"'"}t happen.
                        </p>
                        <p className="text-xs text-slate-500 mt-1.5">
                          Progress: <span className="font-medium">{undoData.currentPercent}% → {undoData.cascadePercent}%</span>
                        </p>
                        <div className="mt-2 rounded-lg border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                          {(undoCascadeExpanded ? undoData.cascade : undoData.cascade.slice(0, 5)).map((item) => (
                            <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                              <svg className="w-3 h-3 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <span className="text-xs text-slate-700 flex-1 min-w-0 truncate">{item.name}</span>
                              {item.reconciledAtExchange && (
                                <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-100 rounded px-1 py-0.5 flex-shrink-0">reconciled</span>
                              )}
                            </div>
                          ))}
                        </div>
                        {undoData.cascade.length > 5 && (
                          <button
                            onClick={(e) => { e.preventDefault(); setUndoCascadeExpanded((v) => !v); }}
                            className="text-xs text-blue-500 hover:text-blue-600 mt-1"
                          >
                            {undoCascadeExpanded ? "Show fewer" : `Show ${undoData.cascade.length - 5} more`}
                          </button>
                        )}
                        {(() => {
                          const rc = undoData.cascade.filter((m) => m.reconciledAtExchange).length;
                          return rc > 0 ? (
                            <p className="text-xs text-slate-400 mt-2">
                              Note: {rc} milestone{rc !== 1 ? "s" : ""} marked complete during exchange reconciliation will also be reversed.
                            </p>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex gap-3">
              <button
                onClick={doUndo}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
              >
                {isPending
                  ? "Undoing…"
                  : undoMode === "cascade" && undoData.cascade.length > 0
                  ? `Undo milestone and ${undoData.cascade.length} dependent${undoData.cascade.length !== 1 ? "s" : ""}`
                  : "Undo milestone"}
              </button>
              <button
                onClick={() => setShowUndoModal(false)}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {celebrating && (
        <ExchangeCelebration
          address={celebrationAddress}
          onDismiss={() => setCelebrating(false)}
        />
      )}
    </>
  );
}
