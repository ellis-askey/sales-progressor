"use client";
// components/milestones/MilestoneRow.tsx

import { useState, useOptimistic, useTransition, useEffect, useRef } from "react";
import type { MilestoneDefinition, MilestoneCompletion } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { confirmMilestoneAction, markNotRequiredAction, reverseMilestoneAction, getExchangeReconciliationList, confirmExchangeReconciliationAction, getUndoImpactAction, executeUndoMilestoneAction, changeBookingDateAction } from "@/app/actions/milestones";
import type { UndoImpact } from "@/app/actions/milestones";
import { getEventDateLabel } from "@/lib/portal-copy";
import { ExchangeCelebration } from "@/components/milestones/ExchangeCelebration";
import { SurveyNrConfirmModal } from "@/components/milestones/SurveyNrConfirmModal";
import { SurveyBookingModal } from "@/components/milestones/SurveyBookingModal";
import { ChangeBookingDateModal } from "@/components/milestones/ChangeBookingDateModal";
import { getSurveyBookingOptions, recordSurveyBooking } from "@/app/actions/survey-booking";
import type { SurveyBookingOption, SurveyBookingChoice } from "@/lib/services/survey-booking";
import { UndoMilestoneModal } from "@/components/milestones/UndoMilestoneModal";
import { ReconciliationDrawer } from "@/components/milestones/ReconciliationDrawer";
import type { ReconciliationItem } from "@/components/milestones/ReconciliationDrawer";
import type { SlownessSignal, StalenessSignal } from "@/lib/services/milestone-staleness";
import type { AggregatedClientChase } from "@/lib/services/client-chase-state";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ActorAvatar, type ActorRole } from "@/components/ui/Avatar";
import { useSession } from "next-auth/react";
import { useFileProgress } from "@/components/transaction/FileProgressContext";
import { CaretDown, CalendarBlank } from "@phosphor-icons/react";
import { DateField } from "@/components/ui/DateField";
import { personaliseStepName, type PartyNameContext } from "@/lib/milestones/step-name";

type Props = {
  def: Omit<MilestoneDefinition, "weight"> & {
    weight: number;
    completion: MilestoneCompletion | null;
    isComplete: boolean;
    isNotRequired: boolean;
    isAvailable: boolean;
    confirmedBySolicitorFirmName?: string | null;
    bookedSurveyorName?: string | null;
    completedByName?: string | null;
    confirmedByClientName?: string | null;
    completedByImage?: string | null;
    confirmedByClientImage?: string | null;
  };
  transactionId: string;
  onConfirmStart?: () => void;
  // Phase 5 (2026-09-18): fired on the structured prerequisite failure so the
  // panel can re-lock the dependents it optimistically opened at confirm-start.
  onConfirmFailed?: () => void;
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
  // Real party names for personalising the step label (firm + seller/buyer),
  // Steps-tab only. Absent → the plain stored label is shown unchanged.
  partyNames?: PartyNameContext;
};

// Codes that can be manually marked N/R regardless of purchaseType.
// PM24 (deposit): a buyer whose funds are locked in the equity of a related
// sale transfers no separate deposit, so the progressor skips it once they
// learn that. The step still unlocks in its normal place (after signed
// contracts); marking it N/R hides it from the client, drops its weight from
// the % and unlocks ready-to-exchange. (The auto-skip for cash_from_proceeds
// is separate, in milestone-auto-nr.ts.)
const NR_ALLOWED_BASE = new Set(["PM9", "PM24"]);
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

// "24 Sep 2026 at 9:52am" — date (shared formatter) + a compact 12h time.
function fmtDateTime(d: Date | string | null): string {
  if (!d) return "";
  const time = new Date(d)
    .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s/g, "")
    .toLowerCase();
  return `${formatDate(d)} at ${time}`;
}

export function MilestoneRow({ def, transactionId, onConfirmStart, onConfirmFailed, onNRStart, onUndoStart, optimisticallyAvailable, optimisticallyRelocked, counterpartNotice, slownessSignal, stalenessSignal, clientChase, purchaseType, partyNames }: Props) {
  const { toast } = useAgentToast();
  // Steps-tab label with the real names filled in (firm + seller/buyer), falling
  // back per slot to the stored generic wording. Used for the row label + toasts.
  const displayName = partyNames ? personaliseStepName(def.name, def.code, partyNames) : def.name;
  // Phase 2 (2026-09-17): the transition exists so useOptimistic persists
  // until canonical server data lands, but the row's CONTROLS are gated on
  // the ack-scoped `loading` flag below, not on isPending — isPending stays
  // true through the whole post-ack RSC re-render, which is exactly the
  // window the agent should already be free in.
  const [, startTransition] = useTransition();
  const [optimisticState, addOptimistic] = useOptimistic(
    { isComplete: def.isComplete, isNotRequired: def.isNotRequired },
    (_, action: "complete" | "not_required" | "reverse") => {
      if (action === "complete")     return { isComplete: true,  isNotRequired: false };
      if (action === "not_required") return { isComplete: false, isNotRequired: true  };
      return                                { isComplete: false, isNotRequired: false };
    }
  );
  const [loading, setLoading] = useState(false);
  // Current user — for the instant an agent confirms, so the panel shows
  // "Confirmed by {you}" straight away instead of waiting for the server refresh
  // (killed the brief wrong-name flash). Server data reconciles it on refresh.
  const { data: sessionData } = useSession();
  const currentUserName = sessionData?.user?.name ?? null;
  const [error, setError] = useState<string | null>(null);
  const [showEventDate, setShowEventDate] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [desktopValuation, setDesktopValuation] = useState(false);
  // Survey (PM9) / valuation (PM6) only: does the surveyor/valuer collect keys
  // from the branch? Ticked = keys from us; left unticked = straight to the
  // property. Drives the keys line and whether the diary email sends.
  const [keyCollection, setKeyCollection] = useState(false);
  // PM9 no-quote route: capture the surveyor firm inline (no modal). Saved to
  // transaction.bookedSurveyorName, which the completed panel then shows.
  const [surveyorName, setSurveyorName] = useState("");
  const [showNotRequired, setShowNotRequired] = useState(false);
  const [notRequiredReason, setNotRequiredReason] = useState("");

  // PM9 N/R — simple survey confirmation modal
  const [showSurveyNrConfirm, setShowSurveyNrConfirm] = useState(false);

  // PM9 survey-booking picker (only when the file requested quotes).
  const [showSurveyBooking, setShowSurveyBooking] = useState(false);
  const [surveyBookingOptions, setSurveyBookingOptions] = useState<SurveyBookingOption[]>([]);
  const [surveyBookingSaving, setSurveyBookingSaving] = useState(false);

  // Undo modal state (two-step: read impact → show modal → confirm)
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [undoData, setUndoData] = useState<UndoImpact | null>(null);
  const [showChangeDate, setShowChangeDate] = useState(false);
  const [changeDateSaving, setChangeDateSaving] = useState(false);

  // Exchange / completion reconciliation state
  const [reconciliationOutstanding, setReconciliationOutstanding] = useState<ReconciliationItem[]>([]);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [reconcileInitialDate, setReconcileInitialDate] = useState("");
  const [showCounterpartNotice, setShowCounterpartNotice] = useState(false);

  // Completed rows collapse to a clickable bar; the details (who/when/event
  // date + Undo) slide open on demand.
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  // Report this row's live (optimistic) completion state up to the file-page
  // progress provider, so the hero % moves together with the tick. Follows the
  // row's own useOptimistic value, so it auto-reverts on error and reconciles
  // when fresh server data lands. No-op when rendered outside the provider.
  const reportProgress = useFileProgress()?.report;
  useEffect(() => {
    reportProgress?.(def.id, {
      isComplete: optimisticState.isComplete,
      isNotRequired: optimisticState.isNotRequired,
    });
  }, [reportProgress, def.id, optimisticState.isComplete, optimisticState.isNotRequired]);

  useEffect(() => {
    if (!counterpartNotice) setShowCounterpartNotice(false);
  }, [counterpartNotice]);

  // Exchange celebration overlay
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationAddress, setCelebrationAddress] = useState("");
  const [celebrationExchangeDate, setCelebrationExchangeDate] = useState<string | undefined>(undefined);
  const [celebrationCompletionDate, setCelebrationCompletionDate] = useState<string | undefined>(undefined);

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
    // Survey booked: if the buyer requested quotes through us, capture the date
    // AND which surveyor they booked in one modal. No quotes → fall through to
    // the normal date modal.
    if (isPM9) {
      setLoading(true);
      getSurveyBookingOptions(transactionId)
        .then((opts) => {
          setLoading(false);
          if (opts.length > 0) {
            setSurveyBookingOptions(opts);
            setShowSurveyBooking(true);
          } else {
            setShowEventDate(true); // eventDateRequired → stays blank
          }
        })
        .catch(() => {
          setLoading(false);
          setShowEventDate(true);
        });
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
    if (loading) return; // double-submit guard — ack-scoped
    setShowEventDate(false);
    setDesktopValuation(false);
    setSurveyorName("");
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

    setLoading(true);
    startTransition(async () => {
      addOptimistic("complete");
      try {
        const result = await confirmMilestoneAction({
          transactionId,
          milestoneDefinitionId: def.id,
          eventDate: eventDate || null,
          keyCollectionRequired: (isPM6 || isPM9) ? keyCollection : undefined,
          surveyorName: isPM9 && surveyorName.trim() ? surveyorName.trim() : undefined,
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
            onConfirmFailed?.(); // re-lock optimistically-opened dependents
            setError(msg);
            return;
          }
        } else if (result.triggeredCelebration && result.propertyAddress) {
          setCelebrationAddress(result.propertyAddress);
          setCelebrationExchangeDate(eventDate || undefined);
          setCelebrationCompletionDate(undefined);
          setCelebrating(true);
        } else {
          const notified = result.notifications
            .filter(n => (n.role === "seller" || n.role === "buyer") && n.status === "queued")
            .map(n => n.contactDisplayName);
          const description = notified.length > 0
            ? `${notified.length === 1 ? "Client" : "Clients"} notified: ${notified.join(" / ")}`
            : undefined;
          toast.success(displayName, description ? { description } : undefined);
        }
      } catch (err: unknown) {
        setError(softenServerError(err, "Could not complete this step."));
      } finally {
        setLoading(false);
        setEventDate("");
        setKeyCollection(false);
      }
    });
  }

  function doReconciliationConfirm(
    ed: string | undefined,
    outstandingIds: string[],
    outstandingDates: Record<string, string>,
    completionDate?: string
  ) {
    if (loading) return;
    setShowReconciliationModal(false);
    setLoading(true);
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
            setCelebrationExchangeDate(ed);
            setCelebrationCompletionDate(completionDate);
            setCelebrating(true);
          }, 200);
        } else {
          const count = outstandingIds.length;
          toast.success(displayName, count > 0 ? { description: `+${count} step${count > 1 ? "s" : ""} marked done` } : undefined);
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
    if (!undoData || loading) return;
    setShowUndoModal(false);
    onUndoStart?.();
    setLoading(true);
    startTransition(async () => {
      addOptimistic("reverse");
      try {
        await executeUndoMilestoneAction({ transactionId, milestoneDefinitionId: def.id, mode });
        const count = mode === "cascade" ? undoData.cascade.length : 0;
        toast.info("Step undone", {
          description: count > 0 ? `+${count} linked step${count > 1 ? "s" : ""} also undone` : displayName,
        });
      } catch (err: unknown) {
        setError(softenServerError(err, "Could not undo this step."));
      } finally {
        setLoading(false);
      }
    });
  }

  // Move an already-confirmed survey / valuation to a new date. Fires the
  // change action (updates the date, tells the agent, self-corrects the
  // morning reminder); errors surface inline on the row.
  function doChangeDate(newDate: string) {
    if (!def.completion || changeDateSaving) return;
    setError(null);
    setChangeDateSaving(true);
    startTransition(async () => {
      try {
        const res = await changeBookingDateAction({ transactionId, completionId: def.completion!.id, newDate });
        if (res.ok) {
          toast.success("Date changed");
          setShowChangeDate(false);
        } else {
          setError(res.error);
        }
      } catch (err: unknown) {
        setError(softenServerError(err, "Could not change the date."));
      } finally {
        setChangeDateSaving(false);
      }
    });
  }

  // Survey booked confirm: complete PM9 with the survey date, then record which
  // surveyor was booked. Booking is best-effort — a failure there never blocks
  // the milestone (the surveyor is the backstop).
  function doSurveyBookingConfirm(surveyDate: string, choice: SurveyBookingChoice, keyCollectionRequired: boolean) {
    if (surveyBookingSaving) return;
    setSurveyBookingSaving(true);
    startTransition(async () => {
      addOptimistic("complete");
      try {
        const result = await confirmMilestoneAction({
          transactionId,
          milestoneDefinitionId: def.id,
          eventDate: surveyDate || null,
          keyCollectionRequired,
        });
        if (result.ok === false && result.kind === "prereqs_missing") {
          const first = result.missing[0];
          addOptimistic("reverse");
          onConfirmFailed?.(); // re-lock optimistically-opened dependents
          setError(first ? `Confirm "${first.name}" first.` : "An earlier step needs to be confirmed first.");
          return;
        }
        await recordSurveyBooking({ transactionId, choice }).catch(() => {});
        toast.success(displayName);
      } catch (err: unknown) {
        setError(softenServerError(err, "Could not complete this step."));
      } finally {
        setSurveyBookingSaving(false);
        setShowSurveyBooking(false);
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
    setLoading(true);
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

  const isExpanded = showEventDate || showNotRequired || showCounterpartNotice || (isDone && detailsOpen);

  return (
    <>
      <div
        className={`flex gap-3 px-4 border-b last:border-0 transition-colors duration-[150ms] ${rowBg} ${justUnlocked ? "ms-unlock-enter" : ""}`}
        style={{ paddingTop: 10, paddingBottom: 10, borderColor: "var(--agent-border-default)", alignItems: isExpanded ? "flex-start" : "center" }}
      >
        {/* State dot — turns into a filled blue "selected" radio while this row
            is being confirmed (mock), reverts otherwise. Visual only. */}
        <div
          className={`flex-shrink-0 ${isDone ? "ms-dot ms-dot-done ms-pop" : isBlocked ? "ms-dot ms-dot-locked" : "ms-dot ms-dot-avail"}`}
          style={{
            ...(isExpanded ? { marginTop: 3 } : {}),
            transition: "background 200ms, box-shadow 200ms",
            ...(showEventDate ? { background: "#2563eb", boxShadow: "0 0 0 3px rgba(37,99,235,0.22)" } : {}),
          }}
        />

        {/* Name + meta. Completed rows turn the whole name area into a
            disclosure bar — click to reveal who confirmed it, when, the event
            date, and the Undo control. */}
        <div
          className="flex-1 min-w-0"
          onClick={isDone ? () => setDetailsOpen((o) => !o) : undefined}
          onKeyDown={isDone ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailsOpen((o) => !o); } } : undefined}
          role={isDone ? "button" : undefined}
          tabIndex={isDone ? 0 : undefined}
          aria-expanded={isDone ? detailsOpen : undefined}
          style={isDone ? { cursor: "pointer" } : undefined}
        >
          <p style={{ fontSize: 12, fontWeight: isBlocked ? 400 : 600, color: isDone || isBlocked ? "var(--agent-text-muted)" : "var(--agent-text-primary)" }}>
            {displayName}
            {/* Chips wrapper — see .ms-pills-row in agent-system.css.
             * Desktop: display:inline (chips render after name as today).
             * Mobile (<=640px): display:flex flex-wrap, becomes a block-
             * level row beneath the name so chips no longer wrap mid-
             * sentence. */}
            <span className="ms-pills-row">
              {isGate && <Pill glass tone="brand" size="md" className="ml-2">Last step before exchange</Pill>}
              {slownessSignal && !isDone && !isBlocked && (
                <Pill
                  glass dot tone="warning" size="md" className="ml-2"
                  title={`Typical for this step: ${slownessSignal.median} days. This file is on day ${slownessSignal.daysAvailable}.`}
                >
                  {slownessSignal.daysOver} days slower than typical
                </Pill>
              )}
              {stalenessSignal && !isDone && !isBlocked && (
                <Pill
                  glass dot tone="warning" size="md" className="ml-2"
                  title={`Chase rule allows ${stalenessSignal.graceDays} days before this is considered overdue. This file is on day ${stalenessSignal.daysAwaiting}.`}
                >
                  Awaiting {stalenessSignal.daysAwaiting} days
                </Pill>
              )}
              {/* Client-chase chip (B6 of the client-chase arc). One of three
                * states. Same eligibility as slowness/staleness chips. */}
              {clientChase && !isDone && !isBlocked && (() => {
                const tone: "success" | "muted" | "warning" = clientChase.kind === "engaged"
                  ? "success"
                  : clientChase.kind === "opted_out"
                  ? "muted"
                  : "warning";
                const text = clientChase.kind === "engaged"
                  ? `Client engaged ${formatRelative(clientChase.lastEngagedAt)}`
                  : clientChase.kind === "opted_out"
                  ? "Opted out of emails"
                  : clientChase.kind === "exhausted"
                  ? `Chased ${clientChase.chaseCount} time${clientChase.chaseCount === 1 ? "" : "s"}, no reply`
                  : `Client chased ${formatRelative(clientChase.lastChasedAt)}`;
                const tooltip = [
                  clientChase.lastChasedAt ? `Last chased: ${formatDate(clientChase.lastChasedAt)}` : null,
                  clientChase.lastEngagedAt ? `Last engaged: ${formatDate(clientChase.lastEngagedAt)}` : null,
                  clientChase.contactCount > 1 ? `Across ${clientChase.contactCount} contacts` : null,
                ].filter(Boolean).join(" • ");
                return <Pill glass dot tone={tone} size="md" className="ml-2" title={tooltip}>{text}</Pill>;
              })()}
              {isDone && isPM9 && def.bookedSurveyorName && (
                <Pill glass tone="info" size="md" className="ml-2">Booked with {def.bookedSurveyorName}</Pill>
              )}
            </span>
          </p>
          {isDone && detailsOpen && (def.completion || isCompleted) && (
            <div
              className="agent-reveal-in"
              onClick={(e) => e.stopPropagation()}
              style={{ marginTop: 8, paddingTop: 8, borderTop: "0.5px solid var(--agent-border-default)" }}
            >
              {/* Confirmed-by header: avatar (photo, else role-coloured art) +
                  full name, date & time beneath, channel pill + actions in a
                  right column. Attribution resolves client → solicitor → agent,
                  never "Unknown". With no server completion yet (the instant of
                  confirm) it shows the current user, so there's no wrong-name flash. */}
              {(() => {
                const comp = def.completion;
                const confirmer: { name: string; role: ActorRole; image: string | null; channel: "app" | "portal" | "sol" } =
                  comp?.confirmedByPortal
                    ? { name: def.confirmedByClientName ?? "the client", role: def.side === "vendor" ? "seller" : "buyer", image: def.confirmedByClientImage ?? null, channel: "portal" }
                    : comp?.confirmedBySolicitorFirmId
                    ? { name: def.confirmedBySolicitorFirmName ?? "the solicitor", role: "solicitor", image: null, channel: "sol" }
                    : { name: def.completedByName ?? currentUserName ?? "your agency", role: "agent", image: def.completedByImage ?? null, channel: "app" };
                const channelLabel = confirmer.channel === "portal" ? "Client portal" : confirmer.channel === "sol" ? "Solicitor" : "In-app";
                const channelTone: "info" | "success" | "brand" = confirmer.channel === "portal" ? "info" : confirmer.channel === "sol" ? "success" : "brand";
                return (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                    <ActorAvatar name={confirmer.name} role={confirmer.role} image={confirmer.image} size={34} />
                    <div style={{ minWidth: 0, flex: 1, paddingTop: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-primary)", lineHeight: 1.3 }}>
                        <span style={{ color: "var(--agent-text-secondary)" }}>Confirmed by </span>
                        <span style={{ fontWeight: 650 }}>{confirmer.name}</span>
                      </p>
                      <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--agent-text-secondary)", display: "flex", alignItems: "center", gap: 5, fontVariantNumeric: "tabular-nums" }}>
                        <CalendarBlank size={12} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
                        {comp?.completedAt ? fmtDateTime(comp.completedAt) : "just now"}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      <Pill glass tone={channelTone} size="sm">{channelLabel}</Pill>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                        {(isPM6 || isPM9) && comp?.eventDate && (
                          <button onClick={(e) => { e.stopPropagation(); setError(null); setShowChangeDate(true); }} disabled={loading} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Change date</button>
                        )}
                        <button onClick={handleUndoClick} disabled={loading} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>{loading ? "…" : "Undo"}</button>
                      </span>
                    </div>
                  </div>
                );
              })()}
              {/* Fact grid — only what this step actually captured. */}
              {def.completion && ((def.completion.eventDate && formatDate(def.completion.eventDate) !== formatDate(def.completion.completedAt)) || def.bookedSurveyorName) && (
                <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", margin: "13px 0 0", paddingTop: 12, borderTop: "0.5px solid var(--agent-border-default)" }}>
                  {def.completion.eventDate && formatDate(def.completion.eventDate) !== formatDate(def.completion.completedAt) && (
                    <>
                      <dt style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{isPM9 ? "Survey date" : isPM6 ? "Valuation date" : "Event date"}</dt>
                      <dd style={{ margin: 0, fontSize: 12.5, fontWeight: 550, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{formatDate(def.completion.eventDate)}</dd>
                    </>
                  )}
                  {def.bookedSurveyorName && (
                    <>
                      <dt style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Surveyor</dt>
                      <dd style={{ margin: 0, fontSize: 12.5, fontWeight: 550, color: "var(--agent-text-primary)" }}>{def.bookedSurveyorName}</dd>
                    </>
                  )}
                </dl>
              )}
              {def.completion?.outOfOrderCompletion && (
                <div style={{ marginTop: 12 }}>
                  <Pill glass tone="warning" size="sm">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
                    An earlier step was reopened
                  </Pill>
                </div>
              )}
            </div>
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
              <div>
                <label className="block text-xs text-slate-900/50 mb-1">
                  {def.eventDateRequired ? getEventDateLabel(def.code) : "Date this happened"}
                  {def.eventDateRequired && <span className="text-red-400"> *</span>}
                </label>
                {/* Booking steps (PM6 valuation, PM9 survey) record an
                    APPOINTMENT, usually in the future, so they accept any
                    date. Every other step records when something happened
                    and stays clamped to today. The 2026-08-09 backdate
                    change (f9974bf) assumed past-only and accidentally
                    clamped the two bookings too. */}
                <DateField
                  value={eventDate}
                  max={def.code === "PM6" || def.code === "PM9" ? undefined : new Date().toISOString().split("T")[0]}
                  disabled={isPM6 && desktopValuation}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="glass-input px-2 py-1.5 text-sm disabled:opacity-40"
                  wrapperStyle={{ display: "inline-block" }}
                />
              </div>
              {/* No-quote survey route: name the surveyor inline (optional), so
                  it lands on the file without a modal. */}
              {isPM9 && (
                <div>
                  <label className="block text-xs text-slate-900/50 mb-1">
                    Surveyor / firm <span className="text-slate-900/35">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={surveyorName}
                    onChange={(e) => setSurveyorName(e.target.value)}
                    placeholder="e.g. RICS Surveyors Ltd"
                    className="glass-input w-full px-2 py-1.5 text-sm"
                  />
                </div>
              )}
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
                    onChange={(e) => { setDesktopValuation(e.target.checked); if (e.target.checked) { setEventDate(""); setKeyCollection(false); } }}
                    className="rounded"
                  />
                  Desktop valuation, no date
                </label>
              )}
              {/* Keys/access. A desktop valuation never attends the property, so
                  the keys question doesn't apply there. */}
              {(isPM9 || isPM6) && !(isPM6 && desktopValuation) && (
                <label
                  className="flex items-center gap-2 text-xs text-slate-900/50 cursor-pointer select-none"
                  title="Tick if the surveyor or valuer collects keys from the branch. Leave it clear if they go straight to the property."
                >
                  <input
                    type="checkbox"
                    checked={keyCollection}
                    onChange={(e) => setKeyCollection(e.target.checked)}
                    className="rounded"
                  />
                  {isPM6 ? "Valuer collecting keys from the branch" : "Surveyor collecting keys from the branch"}
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

        {/* Actions. Confirm stays pinned top-right (N/R sits to its LEFT so its
            right edge never moves); Cancel drops to a second line bottom-right,
            so an in-time confirm is a same-spot double-tap that can't land on
            Cancel. Completed rows show only the disclosure chevron — Undo lives
            inside the drop-down. */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {!isDone && (
            <div className="flex items-center gap-2">
              {/* Cancel sits to the LEFT of Confirm on the same line (mock),
                  instead of dropping below it. Same handler. */}
              {showEventDate && (
                <button
                  onClick={() => { setShowEventDate(false); setDesktopValuation(false); setEventDate(""); setKeyCollection(false); setSurveyorName(""); }}
                  className="agent-link agent-link-muted"
                  style={{ fontSize: 12 }}
                >
                  Cancel
                </button>
              )}
              {!showEventDate && !showNotRequired && !showCounterpartNotice && effectivelyAvailable && canBeNR && (
                <button
                  onClick={handleNRClick}
                  disabled={loading}
                  className="agent-link agent-link-muted"
                  style={{ fontSize: 11 }}
                  title="This step isn't needed for this sale, so it won't appear on the progress bar or in the client portal."
                >
                  Not required
                </button>
              )}
              {!showNotRequired && !showCounterpartNotice && effectivelyAvailable && (
                <Button
                  size="sm"
                  onClick={showEventDate ? () => doComplete() : handleConfirmClick}
                  disabled={(showEventDate && def.eventDateRequired && !eventDate && !(isPM6 && desktopValuation)) || loading}
                  className="ms-appear"
                  style={{ minWidth: 76 }}
                >
                  {loading ? <><span className="agent-btn-spinner" />Confirming…</> : "Confirm"}
                </Button>
              )}
            </div>
          )}
          {isDone && (
            <button
              onClick={() => setDetailsOpen((o) => !o)}
              aria-expanded={detailsOpen}
              aria-label={detailsOpen ? "Hide details" : "Show details"}
              className="agent-icon-btn agent-icon-btn-sm"
              style={{ color: "var(--agent-text-muted)" }}
            >
              <CaretDown
                size={14}
                weight="bold"
                style={{ transition: "transform 200ms cubic-bezier(0.4,0,0.2,1)", transform: detailsOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
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

      {/* PM9 survey-booking picker (file requested quotes) */}
      {showSurveyBooking && (
        <SurveyBookingModal
          options={surveyBookingOptions}
          saving={surveyBookingSaving}
          onConfirm={doSurveyBookingConfirm}
          onCancel={() => setShowSurveyBooking(false)}
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

      {/* Change the date of a confirmed survey / valuation booking */}
      {showChangeDate && def.completion && (
        <ChangeBookingDateModal
          currentDate={def.completion.eventDate ? new Date(def.completion.eventDate).toISOString().slice(0, 10) : ""}
          noun={isPM6 ? "lender valuation" : "survey"}
          saving={changeDateSaving}
          onConfirm={doChangeDate}
          onCancel={() => setShowChangeDate(false)}
        />
      )}

      {/* Undo milestone modal — target_only or cascade */}
      {showUndoModal && undoData && (
        <UndoMilestoneModal
          milestoneName={displayName}
          milestoneId={def.id}
          undoData={undoData}
          isPending={loading}
          onConfirm={(mode) => doUndo(mode)}
          onCancel={() => setShowUndoModal(false)}
        />
      )}
      {celebrating && (
        <ExchangeCelebration
          address={celebrationAddress}
          exchangeDate={celebrationExchangeDate}
          completionDate={celebrationCompletionDate}
          onDismiss={() => setCelebrating(false)}
        />
      )}
    </>
  );
}

