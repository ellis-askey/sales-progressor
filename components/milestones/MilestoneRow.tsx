"use client";
// components/milestones/MilestoneRow.tsx

import { useState, useOptimistic, useTransition, useEffect, useRef } from "react";
import type { MilestoneDefinition, MilestoneCompletion } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { confirmMilestoneAction, markNotRequiredAction, reverseMilestoneAction, getExchangeReconciliationList, confirmExchangeReconciliationAction, getUndoImpactAction, executeUndoMilestoneAction } from "@/app/actions/milestones";
import type { UndoImpact } from "@/app/actions/milestones";
import { getEventDateLabel } from "@/lib/portal-copy";
import { ExchangeCelebration } from "@/components/milestones/ExchangeCelebration";
import { SurveyNrConfirmModal } from "@/components/milestones/SurveyNrConfirmModal";
import { UndoMilestoneModal } from "@/components/milestones/UndoMilestoneModal";
import { ReconciliationDrawer } from "@/components/milestones/ReconciliationDrawer";
import type { ReconciliationItem } from "@/components/milestones/ReconciliationDrawer";
import type { SlownessSignal, StalenessSignal } from "@/lib/services/milestone-staleness";
import type { AggregatedClientChase } from "@/lib/services/client-chase-state";
import { Button } from "@/components/ui/Button";

type Props = {
  def: Omit<MilestoneDefinition, "weight"> & {
    weight: number;
    completion: MilestoneCompletion | null;
    isComplete: boolean;
    isNotRequired: boolean;
    isAvailable: boolean;
    confirmedBySolicitorFirmName?: string | null;
  };
  transactionId: string;
  onConfirmStart?: () => void;
  onNRStart?: () => void;
  onUndoStart?: () => void;
  optimisticallyAvailable?: boolean;
  optimisticallyRelocked?: boolean;
  counterpartNotice?: string;
  // Slowness signal computed by the parent panel from the platform-wide
  // median (MILESTONE_DURATION_MEDIANS in lib/services/fees.ts). Null = no
  // badge — either the milestone has no recorded "became available" anchor
  // (no prereqs complete yet) or it's still under threshold.
  slownessSignal?: SlownessSignal | null;
  // Staleness signal computed against ReminderRule.graceDays — fires when a
  // milestone has been available longer than its configured chase grace
  // window. Independent of slowness (medians aren't required), so it's safe
  // to show without MEDIANS_READY.
  stalenessSignal?: StalenessSignal | null;
  // Client-chase chip (B6 of the client-chase arc). When the system has
  // chased the client about this milestone, the chip surfaces the latest
  // state to the agent: "Client chased Nd ago" (amber), "Client engaged Nd
  // ago" (green), or "Client opted out" (grey). Null = no chip; the same
  // row eligibility as slowness/staleness applies (available + not done +
  // not NR).
  clientChase?: AggregatedClientChase | null;
  // PurchaseType drives conditional N/R availability. For cash_buyer and
  // cash_from_proceeds files, PM8 (searches ordered) becomes manually
  // N/R-able too — searches aren't needed for cash. Cascades to PM13 via
  // NR_CASCADE.
  purchaseType?: "mortgage" | "cash_buyer" | "cash_from_proceeds" | null;
};

// Codes that can be manually marked N/R regardless of purchaseType.
const NR_ALLOWED_BASE = new Set(["PM9"]);
// Codes that become manually N/R-able when purchaseType is cash.
const NR_ALLOWED_CASH = new Set(["PM8"]);
const POST_EXCHANGE_CODES = new Set(["VM19", "VM20", "PM26", "PM27"]);
const RECONCILIATION_CODES = new Set(["VM19", "PM26", "VM20", "PM27"]);

// Mask the Next.js production server-action error template ("An error
// occurred in the Server Components render. The specific message is
// omitted in production builds…"). When a "use server" action throws in
// prod, the message arriving at the client is that wall of text, which
// reads as a scary system failure in the row description slot. The agent
// just needs a plain "didn't work, try again" — the real stack lives in
// Vercel runtime logs keyed by the digest hash on the original Error.
function softenServerError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : fallback;
  if (/server components render|digest property/i.test(message)) {
    return `${fallback} Try again, or refresh the page.`;
  }
  return message;
}

// Relative time formatter for the B6 client-chase chip. "today", "yesterday",
// "Nd ago" for under a week, then "Nw ago". Used in chip text where the
// agent wants quick glanceability, not an absolute date.
function formatRelative(d: Date | null): string {
  if (!d) return "recently";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 0) return "just now";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function MilestoneRow({ def, transactionId, onConfirmStart, onNRStart, onUndoStart, optimisticallyAvailable, optimisticallyRelocked, counterpartNotice, slownessSignal, stalenessSignal, clientChase, purchaseType }: Props) {
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
    // Exchange / completion capture their date in the reconciliation modal.
    if (RECONCILIATION_CODES.has(def.code)) {
      doComplete();
      return;
    }
    // Every other step surfaces the real event date on confirm. Ordinary
    // steps pre-fill to today so a real-time confirm is one tap; the agent
    // changes it when catching up a file. Required-date steps (valuation,
    // survey) stay blank so the agent consciously enters the real date. This
    // is what populates eventDate across the journey for velocity averages.
    if (!def.eventDateRequired) {
      setEventDate(new Date().toISOString().split("T")[0]);
    }
    setShowEventDate(true);
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
          setError(softenServerError(err, "Could not load reconciliation data."));
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
        // Prereq gate (2026-06-05): the action returns a structured failure
        // when the user clicks Confirm before a prereq has been committed
        // (rapid-click race — see app/actions/milestones.ts). Render the
        // specific missing-step name so the agent knows what to do next,
        // instead of the generic Next.js production error wrapper.
        if (result.ok === false) {
          if (result.kind === "prereqs_missing") {
            const first = result.missing[0];
            const msg = first
              ? `Confirm "${first.name}" first.`
              : "An earlier step needs to be confirmed first.";
            addOptimistic("reverse");
            setError(msg);
            return;
          }
        } else if (result.triggeredCelebration && result.propertyAddress) {
          setCelebrationAddress(result.propertyAddress);
          setCelebrating(true);
        } else {
          const notified = result.notifications
            .filter(n => (n.role === "seller" || n.role === "buyer") && n.status === "queued")
            .map(n => n.contactDisplayName);
          const description = notified.length > 0
            ? `${notified.length === 1 ? "Client" : "Clients"} notified: ${notified.join(" / ")}`
            : undefined;
          toast.success(def.name, description ? { description } : undefined);
        }
      } catch (err: unknown) {
        setError(softenServerError(err, "Could not complete this step."));
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
          toast.success(def.name, count > 0 ? { description: `+${count} step${count > 1 ? "s" : ""} reconciled` } : undefined);
        }
      } catch (err: unknown) {
        setError(softenServerError(err, "Could not complete this step."));
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
      setError(softenServerError(err, "Could not load undo information."));
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
        toast.info("Step undone", {
          description: count > 0 ? `+${count} linked step${count > 1 ? "s" : ""} also undone` : def.name,
        });
      } catch (err: unknown) {
        setError(softenServerError(err, "Could not undo this step."));
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
        toast.success("Skipped");
      } catch (err: unknown) {
        setError(softenServerError(err, "Could not skip this step."));
      } finally {
        setLoading(false);
      }
    });
  }

  const isPM6 = def.code === "PM6";
  const isBlocked = !isDone && !effectivelyAvailable;
  const isCashFile = purchaseType === "cash_buyer" || purchaseType === "cash_from_proceeds";
  const canBeNR = NR_ALLOWED_BASE.has(def.code) || (isCashFile && NR_ALLOWED_CASH.has(def.code));

  let rowBg = "";
  if (isDone) rowBg = "bg-green-50/30";

  // N/R milestones are rendered in the NotRequired section, not here
  if (isNotRequired) return null;

  const isExpanded = showEventDate || showNotRequired || showCounterpartNotice;

  return (
    <>
      <div
        className={`flex gap-3 px-4 border-b last:border-0 transition-colors duration-[150ms] ${rowBg} ${justUnlocked ? "ms-unlock-enter" : ""}`}
        style={{ paddingTop: 10, paddingBottom: 10, borderColor: "var(--agent-border-default)", alignItems: isExpanded ? "flex-start" : "center" }}
      >
        {/* State dot */}
        <div
          className={`flex-shrink-0 ${isDone ? "ms-dot ms-dot-done ms-pop" : isBlocked ? "ms-dot ms-dot-locked" : "ms-dot ms-dot-avail"}`}
          style={isExpanded ? { marginTop: 3, transition: "background 200ms" } : { transition: "background 200ms" }}
        />

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 12, fontWeight: isBlocked ? 400 : 600, color: isDone || isBlocked ? "var(--agent-text-muted)" : "var(--agent-text-primary)" }}>
            {def.name}
            {/* Chips wrapper — see .ms-pills-row in agent-system.css.
             * Desktop: display:inline (chips render after name as today).
             * Mobile (<=640px): display:flex flex-wrap, becomes a block-
             * level row beneath the name so chips no longer wrap mid-
             * sentence. */}
            <span className="ms-pills-row">
              {isGate && <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Exchange gate</span>}
              {slownessSignal && !isDone && !isBlocked && (
                <span
                  className="ml-2 text-[10px] font-normal text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"
                  title={`Typical for this step: ${slownessSignal.median} days. This file is on day ${slownessSignal.daysAvailable}.`}
                >
                  {slownessSignal.daysOver} days slower than typical
                </span>
              )}
              {stalenessSignal && !isDone && !isBlocked && (
                <span
                  className="ml-2 text-[10px] font-normal text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5"
                  title={`Chase rule allows ${stalenessSignal.graceDays} days before this is considered overdue. This file is on day ${stalenessSignal.daysAwaiting}.`}
                >
                  Awaiting {stalenessSignal.daysAwaiting} days
                </span>
              )}
              {/* Client-chase chip (B6 of the client-chase arc). One of three
                * states. Same eligibility as slowness/staleness chips. */}
              {clientChase && !isDone && !isBlocked && (() => {
                const cn = clientChase.kind === "engaged"
                  ? "ml-2 text-[10px] font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5"
                  : clientChase.kind === "opted_out"
                  ? "ml-2 text-[10px] font-normal text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5"
                  : "ml-2 text-[10px] font-normal text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5";
                const text = clientChase.kind === "engaged"
                  ? `Client engaged ${formatRelative(clientChase.lastEngagedAt)}`
                  : clientChase.kind === "opted_out"
                  ? "Client opted out"
                  : `Client chased ${formatRelative(clientChase.lastChasedAt)}`;
                const tooltip = [
                  clientChase.lastChasedAt ? `Last chased: ${formatDate(clientChase.lastChasedAt)}` : null,
                  clientChase.lastEngagedAt ? `Last engaged: ${formatDate(clientChase.lastEngagedAt)}` : null,
                  clientChase.contactCount > 1 ? `Across ${clientChase.contactCount} contacts` : null,
                ].filter(Boolean).join(" • ");
                return <span className={cn} title={tooltip}>{text}</span>;
              })()}
            </span>
          </p>
          {isDone && def.completion && (
            <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 2 }}>
              Completed {formatDate(def.completion.completedAt)}
              {def.completion.eventDate && <span style={{ marginLeft: 8 }}>· Event: {formatDate(def.completion.eventDate)}</span>}
              {def.completion.confirmedByPortal && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Client confirmed
                </span>
              )}
              {def.completion.confirmedBySolicitorFirmId && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {def.confirmedBySolicitorFirmName ? `Confirmed by ${def.confirmedBySolicitorFirmName}` : "Solicitor confirmed"}
                </span>
              )}
            </p>
          )}
          {isBlocked && <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 2 }}>Previous steps must be completed first</p>}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

          {/* Counterpart-readiness notice */}
          {showCounterpartNotice && counterpartNotice && (
            <div className="mt-2 space-y-2 agent-reveal-in">
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs text-amber-800">{counterpartNotice}</p>
              </div>
              <button
                onClick={() => setShowCounterpartNotice(false)}
                className="text-xs agent-link-muted"
              >
                OK
              </button>
            </div>
          )}

          {/* Event date input — shown on confirm for every non-reconciliation
              step. Ordinary steps arrive pre-filled to today (change it when
              the step happened earlier); required-date steps (valuation,
              survey) arrive blank and must be filled. */}
          {showEventDate && (
            <div className="mt-2 space-y-2 agent-reveal-in">
              <div className="flex items-center gap-2">
                <div>
                  <label className="block text-xs text-slate-900/50 mb-1">
                    {def.eventDateRequired ? getEventDateLabel(def.code) : "Date this happened"}
                    {def.eventDateRequired && <span className="text-red-400"> *</span>}
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    max={new Date().toISOString().split("T")[0]}
                    disabled={isPM6 && desktopValuation}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="glass-input px-2 py-1.5 text-sm disabled:opacity-40"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => doComplete()}
                  disabled={(def.eventDateRequired && !eventDate && !(isPM6 && desktopValuation)) || loading || isPending}
                  className="mt-5"
                >
                  Confirm
                </Button>
                <button
                  onClick={() => { setShowEventDate(false); setDesktopValuation(false); setEventDate(""); }}
                  className="mt-5 agent-link agent-link-muted" style={{ fontSize: 11 }}
                >
                  Cancel
                </button>
              </div>
              {!def.eventDateRequired && (
                <p className="text-[10px] text-slate-900/50">
                  Defaults to today. Change it only if this step happened earlier.
                </p>
              )}
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
            <div className="mt-2 flex items-start gap-2 agent-reveal-in">
              <div className="flex-1">
                <label className="block text-xs text-slate-900/50 mb-1">Reason <span className="text-red-400">*</span></label>
                <input type="text" value={notRequiredReason} onChange={(e) => setNotRequiredReason(e.target.value)}
                  placeholder="e.g. No survey needed" autoFocus
                  className="glass-input w-full px-2 py-1.5 text-sm" />
              </div>
              <Button size="sm" onClick={() => doNotRequired()} disabled={loading || !notRequiredReason.trim()}
                className="mt-5">Confirm</Button>
              <button onClick={() => { setShowNotRequired(false); setNotRequiredReason(""); }} className="mt-5 agent-link agent-link-muted" style={{ fontSize: 11 }}>Cancel</button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isDone && !showEventDate && !showNotRequired && !showCounterpartNotice && (
            <>
              {effectivelyAvailable && (
                <Button
                  size="sm"
                  onClick={handleConfirmClick}
                  disabled={loading || isPending}
                  className="ms-appear"
                  style={{ minWidth: 76 }}
                >
                  {loading ? <><span className="agent-btn-spinner" />Confirming…</> : "Confirm"}
                </Button>
              )}
              {effectivelyAvailable && canBeNR && (
                <button
                  onClick={handleNRClick}
                  disabled={loading || isPending}
                  className="agent-link agent-link-muted"
                  style={{ fontSize: 11 }}
                  title="Mark as not required"
                >
                  N/R
                </button>
              )}
            </>
          )}
          {isDone && (
            <button
              onClick={handleUndoClick}
              disabled={loading || isPending}
              className="agent-link agent-link-muted"
              style={{ fontSize: 11 }}
            >
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
      {celebrating && (
        <ExchangeCelebration
          address={celebrationAddress}
          onDismiss={() => setCelebrating(false)}
        />
      )}
    </>
  );
}

