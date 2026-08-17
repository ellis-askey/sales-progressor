import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import Link from "next/link";
import { getPortalData, getPortalMilestones, getPortalTimeline, getPortalTeam, getPortalSurveyQuotes, portalOwnSideScope, portalOtherSideScope } from "@/lib/services/portal";
import type { TimelineEntry } from "@/lib/services/portal";
import { getMilestoneCopy, WHO_LABELS, getMilestoneUpdateSubtext, getMilestoneUpdateSubtextOther } from "@/lib/portal-copy";
import { getUpdateOverrideMap } from "@/lib/services/milestone-update-overrides";
import { P, PortalPill } from "@/components/portal/portal-ui";
import { calculateProgress } from "@/lib/services/fees";
import { formatPredictedBand } from "@/lib/utils/format-predicted-band";
import { MEDIANS_READY } from "@/lib/services/milestone-staleness";
import { PortalNextActionCard } from "@/components/portal/PortalNextActionCard";
import { PortalTeamCard } from "@/components/portal/PortalTeamCard";
import { CircularProgress } from "@/components/portal/CircularProgress";
import { ExchangeBanner, CompletionBanner } from "@/components/portal/ExchangeBanner";
import { detectStage, getStageTips, COMPLETED_NEXT } from "@/lib/portal-tips";
import { isPortalAgentOnly } from "@/lib/chase/portal-agent-only-codes";
import { Lightbulb, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { UserAvatar } from "@/components/ui/Avatar";
import { portalConfirmationSentence } from "@/lib/updates-copy";
import { ExplainEmailCard } from "@/components/portal/ExplainEmailCard";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { stripCommsLinksSilent } from "@/lib/utils/strip-comms-links";
import { PortalOverviewHero, type OverviewTile } from "@/components/portal/PortalOverviewHero";
import { PortalGlassCard } from "@/components/portal/PortalGlassCard";
import { PortalCostsCard } from "@/components/portal/PortalCostsCard";
import { PortalCustomizeOverview } from "@/components/portal/PortalCustomizeOverview";

function fmtPrice(p: number) { return "£" + p.toLocaleString("en-GB"); }
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDateShort(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
function fmtDayMonth(d: Date | string): string {
  const date = new Date(d);
  return `${ordinal(date.getDate())} ${date.toLocaleDateString("en-GB", { month: "long" })}`;
}



export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPortalData(token);
  // Layout has already rendered the dead-round notice or notFound;
  // these handlers exist to satisfy the type narrowing and as
  // defence-in-depth in case a future routing change skips the layout.
  if (!result || result.kind === "deadRound") notFound();
  const data = result.data;

  const { contact, transaction } = data;

const side      = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const otherSide = side === "vendor" ? "purchaser" : "vendor";
  const saleWord  = side === "vendor" ? "sale" : "purchase";

  const ownScope   = portalOwnSideScope(contact, transaction);
  const otherScope = portalOtherSideScope(contact, transaction);
  const [rawMilestones, rawOtherMilestones, timeline, team] = await Promise.all([
    getPortalMilestones(transaction.id, side, ownScope),
    getPortalMilestones(transaction.id, otherSide, otherScope),
    getPortalTimeline(transaction.id, side, contact.id, { buyerRoundId: contact.buyerRoundId, activeBuyerRoundId: transaction.activeBuyerRoundId }),
    getPortalTeam(transaction.id, side),
  ]);

  const milestones = rawMilestones.map((m) => ({
    ...m,
    label:           getMilestoneCopy(m.code).label,
    who:             getMilestoneCopy(m.code).who,
    whoLabel:        WHO_LABELS[getMilestoneCopy(m.code).who] ?? getMilestoneCopy(m.code).who,
    typicalDuration: getMilestoneCopy(m.code).typicalDuration ?? null,
  }));

  const POST_EXCHANGE = new Set(["VM19", "VM20", "PM26", "PM27"]);
  const EXCHANGE_GATES = new Set(["VM18", "PM25"]);

  // Overview % — weighted combined ratio, same formula as agent transaction page
  const vendorRaw    = side === "vendor" ? rawMilestones : rawOtherMilestones;
  const purchaserRaw = side === "purchaser" ? rawMilestones : rawOtherMilestones;
  const toWeight = (ms: typeof rawMilestones) =>
    ms.map((m) => ({ weight: m.weight, isComplete: m.isComplete, isNotRequired: m.isNotRequired }));
  const progress  = calculateProgress(toWeight(vendorRaw), toWeight(purchaserRaw), new Date(transaction.createdAt), transaction.overridePredictedDate ?? null);
  const percent   = progress.percent;

  // Stat pill counts (Done / Remaining) — simple count, both sides, pre-exchange

  const hasExchanged = milestones.some((m) => (m.code === "VM19" || m.code === "PM26") && m.isComplete);
  const hasCompleted = milestones.some((m) => (m.code === "VM20" || m.code === "PM27") && m.isComplete);

  // Exchange date (for the completion-countdown progress bar in the banner):
  // the real eventDate on the exchange milestone, else when we marked it complete.
  const exchangeMilestone = milestones.find((m) => (m.code === "VM19" || m.code === "PM26") && m.isComplete);
  const exchangeDate = exchangeMilestone?.eventDate
    ? new Date(exchangeMilestone.eventDate).toISOString()
    : exchangeMilestone?.completedAt
      ? new Date(exchangeMilestone.completedAt).toISOString()
      : null;

  // Exclude agent/solicitor-only steps (exchange gates, exchange/completion, and
  // "all enquiries satisfied" PM20/VM21) from the client's next-action CTA — a
  // client is never asked to confirm a solicitor's legal sign-off.
  const available  = milestones.filter((m) => !m.isComplete && !m.isNotRequired && !POST_EXCHANGE.has(m.code) && !EXCHANGE_GATES.has(m.code) && !isPortalAgentOnly(m.code) && m.isAvailable);
  const nextAction = available[0] ?? null;
  const comingUp   = available.slice(2, 5);

  const keyDates     = milestones.filter((m) => m.eventDate && m.isComplete);
  const recentActivity = timeline.slice(0, 3);
  const updateOverrides = await getUpdateOverrideMap();

  // "New since your last visit" — mark timeline entries created after the
  // client's previous visit. Null on a first visit, so nothing is flagged then.
  const lastVisit = contact.lastVisitedPortalAt ?? null;
  const isNew = (e: TimelineEntry) => !!lastVisit && !!e.createdAt && new Date(e.createdAt) > new Date(lastVisit);
  const newCount = timeline.filter(isNew).length;

  const stage = detectStage(milestones, side);

  // ── 6-tile Progress Overview data (2026-08-09 hero rebuild) ──────────
  // Independent of the mock's "Progress" tab; drives the 1-2-3-4-5-6 row
  // on the Overview hero card. Uses the milestone codes agreed with Ellis:
  //   Instructed  → VM1 / PM1 (first-side completion)
  //   Draft pack  → VM7        (vendor sole responsibility)
  //   Searches    → PM13 result received; "In progress" only if PM8 ordered
  //   Enquiries   → PM14 first enquiries reply
  //   Exchange    → VM19 / PM26; NO forecast date shown when pending
  //   Completion  → VM20 / PM27; LOCKED until exchange complete
  // See docs/help/_discovery/portal-flags.md if you're wondering why the
  // client-facing wording never contradicts the raw stage state.
  const isMilestoneCompleteByCode = (code: string): boolean => {
    const m = milestones.find((mm) => mm.code === code);
    if (m?.isComplete) return true;
    // Sole-side check for vendor-only codes when the current portal user is
    // a purchaser: we fetched rawOtherMilestones so we can see across.
    const other = rawOtherMilestones.find((mm) => mm.code === code);
    return !!other?.isComplete;
  };
  const dateForCode = (code: string): Date | null => {
    const m = milestones.find((mm) => mm.code === code);
    if (m?.completedAt) return new Date(m.completedAt);
    const other = rawOtherMilestones.find((mm) => mm.code === code);
    return other?.completedAt ? new Date(other.completedAt) : null;
  };

  const instructedDone = isMilestoneCompleteByCode(side === "vendor" ? "VM1" : "PM1");
  // Once the buyer's survey is booked (PM9) the quote prompt is redundant.
  // Reactive to milestone state, so undoing PM9 brings the card back.
  const surveyBooked = milestones.some((m) => m.code === "PM9" && m.isComplete);

  // Has this buyer already requested survey quotes? Distinct firms + latest
  // submit, so we can acknowledge it rather than showing "Get a survey quote"
  // as if nothing happened. Own data (scoped by this contact's id).
  const surveyQuotes = side === "purchaser"
    ? await getPortalSurveyQuotes(contact.id)
    : { firmNames: [], lastQuotedAt: null, bookedFirmName: null, bookedAt: null };
  const quotedFirmNames = surveyQuotes.firmNames;
  const lastQuotedAt = surveyQuotes.lastQuotedAt;
  const hasRequestedQuote = quotedFirmNames.length > 0;
  const bookedSurveyorName = surveyQuotes.bookedFirmName ?? transaction.bookedSurveyorName ?? null;
  const bookedSurveyorAt = surveyQuotes.bookedAt;
  const draftPackDone  = isMilestoneCompleteByCode("VM7");
  const pm8Done        = isMilestoneCompleteByCode("PM8");  // searches ordered
  const pm13Done       = isMilestoneCompleteByCode("PM13"); // results back
  // Enquiries rework: the tile completes when enquiries are SATISFIED (PM20),
  // not merely raised (PM14) — matching display-stages.ts and avoiding telling
  // a client "Enquiries: Completed" while their solicitor is still working.
  const enquiriesDone  = isMilestoneCompleteByCode("PM20");
  const exchangeDone   = isMilestoneCompleteByCode(side === "vendor" ? "VM19" : "PM26");
  const completionDone = isMilestoneCompleteByCode(side === "vendor" ? "VM20" : "PM27");

  // First non-complete tile → active. Others → pending (or complete).
  // Stage config. Pills are the short right-side label; descriptions
  // are the plain-English sentence under each row on the mobile
  // timeline. Copy approved with Ellis 2026-08-09.
  //
  // SIDE-AWARE COPY — the flow is asymmetric in conveyancing:
  //   Draft pack — vendor's solicitor prepares; buyer waits
  //   Searches   — buyer's solicitor orders + receives; vendor waits
  //   Enquiries  — buyer's solicitor RAISES; vendor's solicitor ANSWERS
  //   Instructed / Exchange / Completion — symmetric
  // Descriptions here pick between vendor / purchaser wording via a
  // `pick()` helper below.
  //
  // Voice rules: plain English, no exclamation, no self-refs to
  // "the system", present-tense on active, past on complete.
  const pick = (vendorStr: string, purchaserStr: string) =>
    side === "vendor" ? vendorStr : purchaserStr;
  // "Your sale" for the vendor, "Your purchase" for the purchaser —
  // reads warmer than "The sale" on the completion tile.
  const yourDeal = side === "vendor" ? "Your sale" : "Your purchase";

  const rawStages: {
    key: string;
    label: string;
    complete: boolean;
    activeText: string;              // pill copy when active
    pendingText: string;             // pill copy when pending
    completeText: string;            // pill copy when complete
    descPending: string;
    descActive: string;
    descComplete: string;
    completeDate: Date | null;
    locked?: boolean;
  }[] = [
    {
      key: "instructed",
      label: "Instructed",
      complete: instructedDone,
      activeText: "Underway",
      pendingText: "Pending",
      completeText: "Completed",
      // Neutral copy — this stage is about the file being opened /
      // agent engaged, not the solicitor being instructed (that was
      // the pre-2026-08-09 error).
      descPending: "Your file is being set up",
      descActive:  "Your file is being set up",
      descComplete:"Your file was opened",
      completeDate: dateForCode(side === "vendor" ? "VM1" : "PM1"),
    },
    {
      key: "draft_pack",
      label: "Draft pack",
      complete: draftPackDone,
      activeText: "In progress",
      pendingText: "Pending",
      completeText: "Completed",
      // Vendor's solicitor prepares this. Buyer waits for it.
      descPending: pick(
        "Your solicitor will prepare the draft contract pack",
        "The seller's solicitor will send over the draft pack",
      ),
      descActive: pick(
        "Your solicitor is preparing your draft documents",
        "The seller's solicitor is preparing the draft pack",
      ),
      descComplete: pick(
        "Your solicitor issued the draft pack",
        "The seller's solicitor issued the draft pack",
      ),
      completeDate: dateForCode("VM7"),
    },
    {
      key: "searches",
      label: "Searches",
      complete: pm13Done,
      // Don't-mislead: "In progress" only if searches confirmed
      // ordered (PM8). Otherwise "Not started".
      activeText: pm8Done ? "In progress" : "Not started",
      pendingText: "Pending",
      completeText: "Completed",
      // Searches are the buyer's action. Vendor waits.
      descPending: pick(
        "The buyer will order property searches",
        "Your solicitor will order property searches",
      ),
      descActive: pm8Done
        ? pick(
            "The buyer's searches are with the providers",
            "Your searches are with the providers, waiting for results",
          )
        : pick(
            "The buyer's solicitor will order searches shortly",
            "Your solicitor will order searches shortly",
          ),
      descComplete: pick(
        "The buyer's search results came back",
        "Your search results came back",
      ),
      completeDate: dateForCode("PM13"),
    },
    {
      key: "enquiries",
      label: "Enquiries",
      complete: enquiriesDone,
      activeText: "In progress",
      pendingText: "Pending",
      completeText: "Completed",
      // Buyer's solicitor RAISES enquiries; vendor's solicitor ANSWERS.
      descPending: pick(
        "The buyer's solicitor will raise enquiries about the property",
        "Your solicitor will raise enquiries with the seller's solicitor",
      ),
      descActive: pick(
        "Your solicitor is answering the buyer's enquiries",
        "Your solicitor is raising enquiries; the seller's is answering",
      ),
      descComplete: pick(
        "The buyer's enquiries were answered",
        "Your enquiries were answered",
      ),
      completeDate: dateForCode("PM20"),
    },
    {
      key: "exchange",
      label: "Exchange",
      complete: exchangeDone,
      activeText: "Nearing",
      // Don't-mislead: NO forecast date on Exchange when pending.
      pendingText: "Pending",
      completeText: "Completed",
      // Symmetric — both sides exchange contracts on the same day.
      descPending: "Contracts will be exchanged when both sides are ready",
      descActive:  "Both sides are getting ready to exchange",
      descComplete:"Contracts were exchanged",
      completeDate: dateForCode(side === "vendor" ? "VM19" : "PM26"),
    },
    {
      key: "completion",
      label: "Completion",
      complete: completionDone,
      activeText: "Nearing",
      // Locked + "TBC" until exchange confirms.
      pendingText: exchangeDone ? "Pending" : "TBC",
      completeText: "Completed",
      // Symmetric event; "Your sale" / "Your purchase" reads warmer.
      descPending: exchangeDone
        ? `${yourDeal} will complete on the agreed date`
        : "Set on the day contracts exchange",
      descActive:  `${yourDeal} is close to completion`,
      descComplete:`${yourDeal} completed`,
      completeDate: dateForCode(side === "vendor" ? "VM20" : "PM27"),
      locked: !exchangeDone && !completionDone,
    },
  ];
  const firstIncompleteIdx = rawStages.findIndex((s) => !s.complete);
  const overviewTiles: OverviewTile[] = rawStages.map((s, i) => {
    const isComplete = s.complete;
    const isActive   = !isComplete && i === firstIncompleteIdx;
    const status: OverviewTile["status"] = isComplete ? "complete" : isActive ? "active" : "pending";
    // Pill copy — "Completed" everywhere on complete rows now (was:
    // showing the date in the pill). Date now lives in its own small
    // label next to the pill per Ellis's approved layout.
    const text = isComplete
      ? s.completeText
      : isActive
        ? s.activeText
        : s.pendingText;
    const description = isComplete
      ? s.descComplete
      : isActive
        ? s.descActive
        : s.descPending;
    return {
      key: s.key,
      label: s.label,
      status,
      text,
      description,
      completedDate: isComplete && s.completeDate ? fmtDateShort(s.completeDate) : undefined,
      // Only show the lock while completion is pending AND exchange is
      // pending. Once exchange completes, the number returns.
      locked: s.key === "completion" ? s.locked === true && !isComplete : false,
    };
  });

  const completedStageCount = rawStages.filter((s) => s.complete).length;
  // Ring number = the CURRENT step position (1..6), not the count of
  // completed stages. Matches the mock's "3 of 6" when Searches is
  // active (position 3), not when 3 stages are complete. If everything
  // is complete → 6.
  const currentStepNumber = firstIncompleteIdx >= 0 ? firstIncompleteIdx + 1 : rawStages.length;

  // 4-stage collapse for the "CURRENT STAGE" eyebrow.
  const currentStage4 = stage === "onboarding"
    ? "Onboarding"
    : stage === "completed"
      ? "Completion"
      : stage === "exchanged"
        ? "Exchange"
        : "Conveyancing";

  // Sub-label from the active 6-tile (matches the mock's "Searches underway").
  const activeTileIdx = overviewTiles.findIndex((t) => t.status === "active");
  const activeTile    = activeTileIdx >= 0 ? overviewTiles[activeTileIdx] : null;
  const currentStageSubLabel = (() => {
    if (!activeTile) {
      if (completionDone) return "Complete";
      return ""; // all pending — nothing sensible to say
    }
    // Take the tile's active copy, phrased for the sub-line.
    if (activeTile.key === "instructed")  return "Getting started";
    if (activeTile.key === "draft_pack")  return "Draft pack being prepared";
    if (activeTile.key === "searches")    return pm8Done ? "Searches underway" : "Awaiting searches";
    if (activeTile.key === "enquiries")   return "Enquiries in progress";
    if (activeTile.key === "exchange")    return "Nearing exchange";
    if (activeTile.key === "completion")  return "Approaching completion";
    return "";
  })();

  // Hero "Expected exchange" — prefer what the AGENT explicitly set on
  // the file (transaction.expectedExchangeDate or overridePredictedDate)
  // over the algorithmic median prediction. If the agent set a target,
  // the client should see that everywhere it appears (matches the
  // "Target exchange" row further down the page). Only fall back to
  // the algo if no agent value exists.
  const heroExchangeDate: Date | null =
    transaction.overridePredictedDate
      ? new Date(transaction.overridePredictedDate)
      : transaction.expectedExchangeDate
        ? new Date(transaction.expectedExchangeDate)
        : progress.predictedExchangeDate
          ? new Date(progress.predictedExchangeDate)
          : null;

  // Days until the hero's exchange date (UK-timezone comparison, whole
  // days only). Null when there's no date to count against.
  const daysUntilPredicted = (() => {
    if (!heroExchangeDate) return null;
    const now = new Date();
    const startOfNow = new Date(now); startOfNow.setUTCHours(0, 0, 0, 0);
    const startOfTgt = new Date(heroExchangeDate); startOfTgt.setUTCHours(0, 0, 0, 0);
    return Math.round((startOfTgt.getTime() - startOfNow.getTime()) / 86_400_000);
  })();

  // Address split for the sub-line ("London, SW2 3AF" style).
  const addressParts = transaction.propertyAddress.split(",").map((s) => s.trim());
  const addressLine1 = addressParts[0];
  const addressLine2 = addressParts.length > 1 ? addressParts.slice(1).join(", ") : null;

  const overviewHero = (
    <PortalOverviewHero
      address={addressLine1}
      addressLine2={addressLine2}
      photoUrl={transaction.photoUrl ?? null}
      status={transaction.status}
      tenure={transaction.tenure}
      purchaseType={transaction.purchaseType}
      percent={percent}
      currentStepNumber={currentStepNumber}
      currentStage4={currentStage4}
      currentStageSubLabel={currentStageSubLabel}
      tiles={overviewTiles}
      predictedExchangeDate={heroExchangeDate}
      daysUntilPredicted={daysUntilPredicted}
      progressHref={`/portal/${token}/progress`}
    />
  );
  // Per-tip refinement: pass the customer's actual completed-milestone
  // set so getStageTips can hide tips whose underlying milestone has
  // already been ticked (e.g. "your lender will book a valuation" once
  // PM6 is complete). Without this, the stage gets us into the right
  // pool but individual tips can still talk about completed events.
  // "Done" for tip gating = completed OR not_required, so a step the client
  // opted out of (e.g. "not getting a survey") also hides its tips.
  const doneCodes = new Set(milestones.filter((m) => m.isComplete || m.isNotRequired).map((m) => m.code));
  const tips  = getStageTips(stage, side, token, doneCodes);

  // ── Customize overview (Batch 1): which moveable cards are present + order ──
  const showSurveyQuote    = side === "purchaser" && instructedDone && !surveyBooked && !hasExchanged && !hasCompleted && !hasRequestedQuote && !bookedSurveyorName;
  const showSurveyStatus   = side === "purchaser" && !hasExchanged && !hasCompleted && hasRequestedQuote && (!!bookedSurveyorName || !surveyBooked);
  const showCosts          = side === "purchaser" && !hasCompleted && transaction.purchasePrice != null;
  const showComingUp       = comingUp.length > 0 && !hasCompleted;
  const showImportantDates = keyDates.length > 0;
  const showGuidance       = stage === "completed" ? true : tips.length > 0;
  const showExplain        = !hasCompleted;

  const MOVABLE_KEYS = ["survey-quote","survey-status","costs","team","coming-up","important-dates","guidance","explain-email","feedback","latest-updates"] as const;
  const MOVABLE_LABELS: Record<string, string> = {
    "survey-quote": "Get a survey quote",
    "survey-status": "Survey",
    "costs": "Your costs",
    "team": "Your team",
    "coming-up": "Coming up",
    "important-dates": "Important dates",
    "guidance": stage === "completed" ? "What happens next" : "Helpful to know",
    "explain-email": "Explain my email",
    "feedback": "Feedback",
    "latest-updates": "Latest updates",
  };
  const MOVABLE_PRESENT: Record<string, boolean> = {
    "survey-quote": showSurveyQuote,
    "survey-status": showSurveyStatus,
    "costs": showCosts,
    "team": true,
    "coming-up": showComingUp,
    "important-dates": showImportantDates,
    "guidance": showGuidance,
    "explain-email": showExplain,
    "feedback": true,
    "latest-updates": true,
  };

  const overviewLayoutSaved = (contact.overviewLayout ?? null) as { order?: string[]; hidden?: string[] } | null;
  const layoutOrder = Array.isArray(overviewLayoutSaved?.order) ? overviewLayoutSaved!.order! : [];
  const layoutHidden = new Set(Array.isArray(overviewLayoutSaved?.hidden) ? overviewLayoutSaved!.hidden! : []);
  const orderedMovableKeys = [
    ...layoutOrder.filter((k) => (MOVABLE_KEYS as readonly string[]).includes(k)),
    ...MOVABLE_KEYS.filter((k) => !layoutOrder.includes(k)),
  ];
  const movableOrderIndex = new Map<string, number>();
  orderedMovableKeys.forEach((k, i) => movableOrderIndex.set(k, i));
  const slot = (key: string): CSSProperties => ({ order: movableOrderIndex.get(key) ?? 99, display: layoutHidden.has(key) ? "none" : undefined });

  const customizeMovable = MOVABLE_KEYS.filter((k) => MOVABLE_PRESENT[k]).map((k) => ({ key: k, label: MOVABLE_LABELS[k] }));
  const customizeFixed: string[] = [];
  if (hasCompleted) customizeFixed.push(side === "vendor" ? "Sale complete" : "Purchase complete");
  else if (hasExchanged) customizeFixed.push("Completion countdown");
  else customizeFixed.push("Your progress");
  if (nextAction && !hasCompleted) customizeFixed.push("Your next step");
  if (!hasExchanged && !hasCompleted && transaction.expectedExchangeDate) customizeFixed.push("Add to calendar");

  return (
    <div className="space-y-4 portal-fade-in">

      {/* ── Completion banner ──────────────────────────────────── */}
      {hasCompleted && (
        <CompletionBanner
          token={token}
          saleWord={saleWord}
          completionDate={transaction.completionDate ? new Date(transaction.completionDate).toISOString() : null}
        />
      )}

      {/* ── Exchange banner (now carries the completion countdown) ─── */}
      {hasExchanged && !hasCompleted && (
        <ExchangeBanner
          token={token}
          completionDate={transaction.completionDate ? new Date(transaction.completionDate).toISOString() : null}
          exchangeDate={exchangeDate}
          photoUrl={transaction.photoUrl ?? null}
        />
      )}

      {/* ── Photo hero + Progress Overview + Expected exchange ─────
             2026-08-09 rebuild per the founder mock. Replaces the old
             coral gradient strip (kept only under the Completion /
             Exchange banners above, which have their own celebratory
             design). The new hero shows the property photo, address,
             status pills, ring, and the 6-tile progress row below. */}
      {!hasExchanged && !hasCompleted && overviewHero}


      {/* ── Next action CTA ──────────────────────────────────────── */}
      {nextAction && !hasCompleted && (
        <PortalNextActionCard
          token={token}
          milestone={{
            id:                nextAction.id,
            label:             nextAction.label,
            who:               nextAction.who,
            code:              nextAction.code,
            eventDateRequired: nextAction.eventDateRequired,
          }}
          whatHappensNext={getMilestoneCopy(nextAction.code).next ?? null}
        />
      )}

      {/* ── Add the expected exchange date to your calendar (pre-exchange) ── */}
      {!hasExchanged && !hasCompleted && transaction.expectedExchangeDate && (
        <a
          href={`/api/portal/calendar-export/${token}?event=exchange`}
          download="exchange-target.ics"
          className="pbtn pbtn-press flex items-center justify-center gap-2 rounded-2xl py-3.5"
          style={{ background: P.cardBg, boxShadow: P.shadowSm, color: P.accent, fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Add expected exchange to your calendar
        </a>
      )}

      <div className="flex flex-col gap-4">

      {/* ── Survey quote prompt (purchasers, once instructed, pre-exchange) ── */}
      {showSurveyQuote && (
        <div style={slot("survey-quote")}>
        <Link
          href={`/quote/${token}`}
          className="pbtn pbtn-press block"
          style={{
            borderRadius: 16,
            textDecoration: "none",
            padding: 16,
            background: "linear-gradient(160deg, rgba(10,132,255,0.10), rgba(10,132,255,0.03))",
            border: "0.5px solid rgba(10,132,255,0.12)",
            boxShadow: P.shadowSm,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 52, height: 52, borderRadius: 14, background: "#fff", color: "#0A84FF", boxShadow: "0 2px 8px rgba(10,132,255,0.20)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold" style={{ color: P.textPrimary, marginBottom: 2 }}>
              Get a survey quote
            </p>
            <p className="text-[12px]" style={{ color: P.textSecondary, lineHeight: 1.4 }}>
              Local firms in your area, <b style={{ color: "#0060DF" }}>from &pound;400</b>.
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
        </div>
      )}

      {/* ── Survey status (purchasers): booked with a named firm, or quote requested ── */}
      {showSurveyStatus && (
        <div style={slot("survey-status")}>
        <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>
          <div className="flex items-center gap-3 p-5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: P.accentBg, color: P.accent }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              {bookedSurveyorName ? (
                <>
                  <p className="text-[14px] font-bold" style={{ color: P.textPrimary, marginBottom: 2 }}>
                    Survey booked with {bookedSurveyorName}
                  </p>
                  <p className="text-[12px]" style={{ color: P.textSecondary, lineHeight: 1.4 }}>
                    {bookedSurveyorAt ? `Booked for ${fmtDate(bookedSurveyorAt)}.` : ""} They&apos;ll be in touch to arrange access.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-bold" style={{ color: P.textPrimary, marginBottom: 2 }}>
                    Survey quote requested
                  </p>
                  <p className="text-[12px]" style={{ color: P.textSecondary, lineHeight: 1.4 }}>
                    {quotedFirmNames.length === 1
                      ? `${quotedFirmNames[0]} will be in touch with a quote.`
                      : `${quotedFirmNames.length} firms will be in touch with a quote.`}
                    {lastQuotedAt ? ` Requested ${fmtDate(lastQuotedAt)}.` : ""} Not heard back? Let your agent know.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ── Your costs (buyers, pre-completion) ──────────────────── */}
      {showCosts && (
        <div style={slot("costs")}>
        <PortalCostsCard
          priceGBP={transaction.purchasePrice! / 100}
          hasExchanged={hasExchanged}
          isCash={transaction.purchaseType === "cash_buyer" || transaction.purchaseType === "cash_from_proceeds"}
          savedDeposit={transaction.clientDepositGBP != null ? transaction.clientDepositGBP / 100 : null}
          savedMortgage={transaction.clientMortgageGBP != null ? transaction.clientMortgageGBP / 100 : null}
          token={token}
        />
        </div>
      )}

      {/* ── Your team (audit #16) ────────────────────────────────── */}
      <div style={slot("team")}><PortalTeamCard team={team} token={token} /></div>

      {/* ── Coming up (next 3 after next action) ─────────────────── */}
      {showComingUp && (
        <div style={slot("coming-up")}>
        <PortalGlassCard glassId="coming-up" label="Coming up" className="overflow-hidden">
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${P.border}` }}>
            <p className="text-[13px] font-bold" style={{ color: P.textPrimary }}>Coming up</p>
          </div>
          {comingUp.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center gap-3.5 px-5 py-3.5"
              style={{ borderBottom: i < comingUp.length - 1 ? `1px solid ${P.border}` : undefined }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold"
                style={{ background: P.accentBg, color: P.accent }}
              >
                {i + 2}
              </div>
              <p className="flex-1 text-[13px]" style={{ color: P.textSecondary }}>{m.label}</p>
              <span className="flex-shrink-0">
                <PortalPill tone={m.who === "you" ? "coral" : "blue"}>
                  {m.who === "you" ? "You" : m.whoLabel}
                </PortalPill>
              </span>
            </div>
          ))}
        </PortalGlassCard>
        </div>
      )}

      {/* ── Key dates ────────────────────────────────────────────── */}
      {showImportantDates && (
        <div style={slot("important-dates")}>
        <PortalGlassCard glassId="important-dates" label="Important dates" className="overflow-hidden">
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${P.border}` }}>
            <p className="text-[13px] font-bold" style={{ color: P.textPrimary }}>Important dates</p>
          </div>
          {keyDates.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: i < keyDates.length - 1 ? `1px solid ${P.border}` : undefined }}
            >
              <p className="text-[14px]" style={{ color: P.textPrimary }}>{m.label}</p>
              <p className="text-[13px] font-semibold" style={{ color: P.primary }}>
                {fmtDate(m.eventDate!)}
              </p>
            </div>
          ))}
        </PortalGlassCard>
        </div>
      )}

      {/* Target-exchange card removed 2026-08-12 — it duplicated the
          "12-week target" already shown in the hero. */}

      {/* ── Tips / What's next ───────────────────────────────────── */}
      {showGuidance ? (
        <div style={slot("guidance")}>
        {stage === "completed" ? (
        <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${P.border}` }}>
            <p className="text-[13px] font-bold" style={{ color: P.textPrimary }}>What happens next</p>
          </div>
          {COMPLETED_NEXT[side].map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3.5 px-5 py-3.5"
              style={{ borderBottom: i < COMPLETED_NEXT[side].length - 1 ? `1px solid ${P.border}` : undefined }}
            >
              <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center" style={{ background: P.successBg }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold" style={{ color: P.textPrimary }}>{item.title}</p>
                <p className="text-[13px] leading-relaxed mt-0.5" style={{ color: P.textSecondary }}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      ) : tips.length > 0 ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3 px-1" style={{ color: P.textMuted }}>
            Helpful to know
          </p>
          {tips.length === 1 ? (
            // Single tip spreads full-width instead of a narrow scroll card.
            <PortalGlassCard glassId="helpful-to-know" label="Helpful to know" className="p-4">
              <Lightbulb size={18} weight="fill" color={P.warning} style={{ marginBottom: 8 }} />
              <p className="text-[13.5px] font-semibold mb-1" style={{ color: P.textPrimary }}>{tips[0].title}</p>
              <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>{tips[0].text}</p>
            </PortalGlassCard>
          ) : (
            <div className="flex gap-3 overflow-x-auto snap-x pb-1" style={{ scrollbarWidth: "none" }}>
              {tips.map((tip, i) => (
                <PortalGlassCard
                  key={i}
                  glassId="helpful-to-know"
                  label="Helpful to know"
                  className="flex-shrink-0 snap-start p-4"
                  style={{ width: "220px" }}
                >
                  <Lightbulb size={18} weight="fill" color={P.warning} style={{ marginBottom: 8 }} />
                  <p className="text-[13.5px] font-semibold mb-1" style={{ color: P.textPrimary }}>{tip.title}</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>{tip.text}</p>
                </PortalGlassCard>
              ))}
            </div>
          )}
        </div>
      ) : null}
        </div>
      ) : null}

      {/* ── Explain-my-email ─────────────────────────────────────── */}
      {showExplain && (<div style={slot("explain-email")}><ExplainEmailCard token={token} /></div>)}

      {/* ── Feedback widget ──────────────────────────────────────── */}
      <div style={slot("feedback")}><FeedbackWidget portalToken={token} /></div>

      {/* ── Latest updates ───────────────────────────────────────── */}
      <div style={slot("latest-updates")}>
      <PortalGlassCard glassId="latest-updates" label="Latest updates" className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold" style={{ color: P.textPrimary }}>Latest updates</p>
            {newCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: P.primaryBg, color: P.primary }}>
                {newCount} new
              </span>
            )}
          </div>
          {recentActivity.length > 0 && (
            <Link href={`/portal/${token}/updates`} className="text-[13px] font-semibold" style={{ color: P.accent }}>
              See all
            </Link>
          )}
        </div>
        {recentActivity.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[14px]" style={{ color: P.textSecondary }}>
              Your team will share {saleWord} updates here.
            </p>
          </div>
        ) : (
          recentActivity.map((entry: TimelineEntry, i) => (
            <div
              key={entry.id}
              className="px-5 py-4 flex items-start gap-3"
              style={{ borderBottom: i < recentActivity.length - 1 ? `1px solid ${P.border}` : undefined }}
            >
              {isNew(entry) && (
                <span className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ background: P.primary }} aria-label="New" title="New" />
              )}
              {entry.type === "milestone" ? (
                <>
                  {/* Avatar. Own side: the client's own photo on steps they
                      confirmed, the team member's photo on steps we confirmed,
                      else our bright orange icon. Other side: always a green
                      icon, never a photo (we don't share the other side's
                      pictures across the deal). */}
                  {(() => {
                    const isOtherSide = entry.side !== side;
                    const photo = isOtherSide
                      ? null
                      : entry.confirmedByClient
                        ? entry.confirmedByContactImage
                        : entry.completedByImage;
                    return photo ? (
                      <UserAvatar user={{ name: entry.confirmedByClient ? "You" : (entry.completedByName ?? "Your team"), image: photo }} size={28} />
                    ) : (
                      <UserCircle size={28} weight="fill" className="flex-shrink-0" style={{ color: isOtherSide ? P.success : P.primary }} />
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium leading-snug" style={{ color: P.textPrimary }}>
                      {portalConfirmationSentence({
                        code: entry.code,
                        side: entry.side,
                        viewerSide: side,
                        confirmer: entry.confirmedByClient
                          ? { kind: "client" }
                          : entry.confirmedBySolicitorFirmName
                            ? { kind: "solicitor", firm: entry.confirmedBySolicitorFirmName }
                            : { kind: "agent", name: entry.completedByName ?? "Your team" },
                        milestoneName: entry.label,
                        coreOverride: updateOverrides.get(entry.code)?.core ?? null,
                      })}
                    </p>
                    {(() => {
                      const ov = updateOverrides.get(entry.code);
                      const sub = entry.side === side
                        ? (ov?.subtextOwn ?? getMilestoneUpdateSubtext(entry.code))
                        : (ov?.subtextOther ?? getMilestoneUpdateSubtextOther(entry.code));
                      return sub ? (
                        <p className="text-[12.5px] leading-snug mt-1" style={{ color: P.textSecondary }}>{sub}</p>
                      ) : null;
                    })()}
                    <p className="text-[12px] mt-1.5" style={{ color: P.textMuted }}>{fmtDayMonth(entry.createdAt ?? new Date())}</p>
                  </div>
                  {/* Bare green tick — the step is done. */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </>
              ) : entry.type === "document" ? (
                <div className="flex-1 min-w-0">
                  {entry.url ? (
                    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium leading-snug" style={{ color: P.accent, textDecoration: "underline", textUnderlineOffset: 2, wordBreak: "break-word" }}>
                      {entry.filename}
                    </a>
                  ) : (
                    <p className="text-[14px] font-medium leading-snug" style={{ color: P.textPrimary, wordBreak: "break-word" }}>{entry.filename}</p>
                  )}
                  <p className="text-[12px] mt-1.5" style={{ color: P.textMuted }}>{fmtDateShort(entry.createdAt ?? new Date())}</p>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  {/* Strip portal deep-links + unsubscribe URLs from the
                      preview — same treatment as the Updates tab (see
                      app/portal/[token]/updates/page.tsx:174). Without this
                      the "Latest updates" card leaked long URLs to the
                      client, per Ellis's 2026-08-09 flag. */}
                  <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: P.textPrimary }}>{stripCommsLinksSilent(entry.content)}</p>
                  <p className="text-[12px] mt-1.5" style={{ color: P.textMuted }}>{fmtDateShort(entry.createdAt ?? new Date())}</p>
                </div>
              )}
            </div>
          ))
        )}
      </PortalGlassCard>
      </div>

      </div>

      {/* ── Customize overview (Edit + reorder) ──────────────────── */}
      <PortalCustomizeOverview
        token={token}
        movable={customizeMovable}
        order={orderedMovableKeys}
        hidden={[...layoutHidden]}
        fixed={customizeFixed}
      />

    </div>
  );
}
