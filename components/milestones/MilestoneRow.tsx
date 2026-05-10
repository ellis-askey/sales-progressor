"use client";
// components/milestones/MilestoneRow.tsx

import { useState, useOptimistic, useTransition, useEffect, useRef } from "react";
import type { MilestoneDefinition, MilestoneCompletion } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { confirmMilestoneAction, markNotRequiredAction, reverseMilestoneAction, getExchangeReconciliationList, confirmExchangeReconciliationAction, getUndoImpactAction, executeUndoMilestoneAction } from "@/app/actions/milestones";
import type { UndoImpact, NotificationStatus } from "@/app/actions/milestones";
import { getEventDateLabel } from "@/lib/portal-copy";
import { ExchangeCelebration } from "@/components/milestones/ExchangeCelebration";
import { SurveyNrConfirmModal } from "@/components/milestones/SurveyNrConfirmModal";
import { UndoMilestoneModal } from "@/components/milestones/UndoMilestoneModal";
import { ReconciliationDrawer } from "@/components/milestones/ReconciliationDrawer";
import type { ReconciliationItem } from "@/components/milestones/ReconciliationDrawer";

type Props = {
  def: Omit<MilestoneDefinition, "weight"> & {
    weight: number;
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
  counterpartNotice?: string;
};

// Only PM9 (mortgage application) can be manually marked N/R
const NR_ALLOWED = new Set(["PM9"]);
const POST_EXCHANGE_CODES = new Set(["VM19", "VM20", "PM26", "PM27"]);
const RECONCILIATION_CODES = new Set(["VM19", "PM26", "VM20", "PM27"]);

export function MilestoneRow({ def, transactionId, onConfirmStart, onNRStart, onUndoStart, optimisticallyAvailable, optimisticallyRelocked, counterpartNotice }: Props) {
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

  // Exchange / completion reconciliation state
  const [reconciliationOutstanding, setReconciliationOutstanding] = useState<ReconciliationItem[]>([]);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [reconcileInitialDate, setReconcileInitialDate] = useState("");
  const [showCounterpartNotice, setShowCounterpartNotice] = useState(false);

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

  useEffect(() => {
    if (!counterpartNotice) setShowCounterpartNotice(false);
  }, [counterpartNotice]);

  // Exchange celebration overlay
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationAddress, setCelebrationAddress] = useState("");

  // Post-confirm notification feedback
  const [confirmedNotifications, setConfirmedNotifications] = useState<NotificationStatus[] | null>(null);
  const notifDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showNotifications(notifs: NotificationStatus[]) {
    if (notifDismissRef.current) clearTimeout(notifDismissRef.current);
    setConfirmedNotifications(notifs);
    notifDismissRef.current = setTimeout(() => setConfirmedNotifications(null), 5000);
  }

  const isCompleted = optimisticState.isComplete;
  const isNotRequired = optimisticState.isNotRequired;
  const isDone = isCompleted || isNotRequired;
  const isGate = def.code === "VM18" || def.code === "PM25";
  const isPost = POST_EXCHANGE_CODES.has(def.code);
  const isPM9 = def.code === "PM9";
  const isExchangeMilestone = def.code === "VM19" || def.code === "PM26";
  const effectivelyAvailable = (def.isAvailable || (optimisticallyAvailable ?? false)) && !(optimisticallyRelocked ?? false);

  function handleConfirmClick() {
    setError(null);
    if (RECONCILIATION_CODES.has(def.code) && counterpartNotice) {
      setShowCounterpartNotice(true);
      return;
    }
    onConfirmStart?.();
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
          setReconcileInitialDate(eventDate || todayStr);
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
        if (result.notifications.length > 0) {
          showNotifications(result.notifications);
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
          const addr = result.propertyAddress;
          setTimeout(() => {
            setCelebrationAddress(addr);
            setCelebrating(true);
          }, 200);
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
      setShowUndoModal(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load undo information");
    } finally {
      setLoading(false);
    }
  }

  function doUndo(mode: "target_only" | "cascade") {
    if (!undoData) return;
    setShowUndoModal(false);
    onUndoStart?.();
    startTransition(async () => {
      addOptimistic("reverse");
      try {
        await executeUndoMilestoneAction({ transactionId, milestoneDefinitionId: def.id, mode });
        const count = mode === "cascade" ? undoData.cascade.length : 0;
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

          {/* Counterpart-readiness notice */}
          {showCounterpartNotice && counterpartNotice && (
            <div className="mt-2 space-y-2">
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs text-amber-800">{counterpartNotice}</p>
              </div>
              <button
                onClick={() => setShowCounterpartNotice(false)}
                className="text-xs text-slate-900/40 hover:text-slate-900/70 transition-colors"
              >
                OK
              </button>
            </div>
          )}

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
                  className="mt-5 px-3 py-1.5 text-xs font-medium agent-btn-color-primary rounded-lg disabled:opacity-40"
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
          {!isDone && !showEventDate && !showNotRequired && !showCounterpartNotice && (
            <>
              {effectivelyAvailable && (
                <button onClick={handleConfirmClick} disabled={loading || isPending}
                  className="px-3 py-1.5 text-xs font-medium agent-btn-color-primary rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1.5 min-w-[80px] justify-center">
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
      {showSurveyNrConfirm && (
        <SurveyNrConfirmModal
          onConfirm={() => doNotRequired()}
          onCancel={() => setShowSurveyNrConfirm(false)}
        />
      )}

      {/* Exchange / completion reconciliation drawer */}
      {showReconciliationModal && (
        <ReconciliationDrawer
          isExchangeFlow={isExchangeMilestone}
          outstanding={reconciliationOutstanding}
          initialEventDate={reconcileInitialDate}
          pendingEventDate={eventDate || undefined}
          onConfirm={(ed, ids, dates, cd) => doReconciliationConfirm(ed, ids, dates, cd)}
          onCancel={() => setShowReconciliationModal(false)}
        />
      )}

      {/* Undo milestone modal — target_only or cascade */}
      {showUndoModal && undoData && (
        <UndoMilestoneModal
          milestoneName={def.name}
          milestoneId={def.id}
          undoData={undoData}
          isPending={isPending}
          onConfirm={(mode) => doUndo(mode)}
          onCancel={() => setShowUndoModal(false)}
        />
      )}
      {confirmedNotifications && confirmedNotifications.length > 0 && (
        <NotificationFeedback
          notifications={confirmedNotifications}
          onDismiss={() => setConfirmedNotifications(null)}
        />
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

// ─── Notification feedback panel ──────────────────────────────────────────────

const NOTIF_ROLE_LABELS: Record<string, string> = {
  seller: "Seller",
  buyer: "Buyer",
  agent: "Agent",
  progressor: "Progressor",
};

const NOTIF_PILL_STYLES: Record<string, { bg: string; text: string }> = {
  seller:     { bg: "bg-blue-50",   text: "text-blue-700"  },
  buyer:      { bg: "bg-emerald-50", text: "text-emerald-700" },
  agent:      { bg: "bg-amber-50",  text: "text-amber-700"  },
  progressor: { bg: "bg-amber-50",  text: "text-amber-700"  },
};

function NotificationFeedback({
  notifications,
  onDismiss,
}: {
  notifications: NotificationStatus[];
  onDismiss: () => void;
}) {
  return (
    <div className="mx-4 mb-2 px-3 py-2.5 rounded-xl bg-white/40 border border-white/40 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-slate-900/50 uppercase tracking-wider">Notifications</p>
        <button
          onClick={onDismiss}
          className="text-[10px] text-slate-900/30 hover:text-slate-900/60 transition-colors"
        >
          Dismiss
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {notifications.map((n, i) => {
          const label = NOTIF_ROLE_LABELS[n.role] ?? n.role;
          const pillStyle = NOTIF_PILL_STYLES[n.role] ?? { bg: "bg-slate-50", text: "text-slate-600" };
          const isSkipped = n.status !== "queued";

          if (isSkipped) {
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-slate-300/60 text-slate-900/40"
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {label} — {n.contactDisplayName} · no email on file
              </span>
            );
          }

          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${pillStyle.bg} ${pillStyle.text}`}
            >
              <svg className="w-3 h-3 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {label} — {n.contactDisplayName}
            </span>
          );
        })}
      </div>
    </div>
  );
}
