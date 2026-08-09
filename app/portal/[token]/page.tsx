import { notFound } from "next/navigation";
import Link from "next/link";
import { getPortalData, getPortalMilestones, getPortalTimeline, portalOwnSideScope, portalOtherSideScope } from "@/lib/services/portal";
import type { TimelineEntry } from "@/lib/services/portal";
import { getMilestoneCopy, WHO_LABELS } from "@/lib/portal-copy";
import { P } from "@/components/portal/portal-ui";
import { calculateProgress } from "@/lib/services/fees";
import { formatPredictedBand } from "@/lib/utils/format-predicted-band";
import { MEDIANS_READY } from "@/lib/services/milestone-staleness";
import { PortalNextActionCard } from "@/components/portal/PortalNextActionCard";
import { CircularProgress } from "@/components/portal/CircularProgress";
import { ExchangeBanner, CompletionBanner } from "@/components/portal/ExchangeBanner";
import { detectStage, getStageTips, COMPLETED_NEXT } from "@/lib/portal-tips";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr";
import { ExplainEmailCard } from "@/components/portal/ExplainEmailCard";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { stripCommsLinksSilent } from "@/lib/utils/strip-comms-links";
import { PortalOverviewHero, type OverviewTile } from "@/components/portal/PortalOverviewHero";

function fmtPrice(p: number) { return "£" + p.toLocaleString("en-GB"); }
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDateShort(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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
  const [rawMilestones, rawOtherMilestones, timeline] = await Promise.all([
    getPortalMilestones(transaction.id, side, ownScope),
    getPortalMilestones(transaction.id, otherSide, otherScope),
    getPortalTimeline(transaction.id, side, contact.id, { buyerRoundId: contact.buyerRoundId, activeBuyerRoundId: transaction.activeBuyerRoundId }),
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

  const available  = milestones.filter((m) => !m.isComplete && !m.isNotRequired && !POST_EXCHANGE.has(m.code) && !EXCHANGE_GATES.has(m.code) && m.isAvailable);
  const nextAction = available[0] ?? null;
  const nextAfter  = available[1] ?? null;
  const comingUp   = available.slice(2, 5);

  const keyDates     = milestones.filter((m) => m.eventDate && m.isComplete);
  const recentActivity = timeline.slice(0, 3);

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
  const draftPackDone  = isMilestoneCompleteByCode("VM7");
  const pm8Done        = isMilestoneCompleteByCode("PM8");  // searches ordered
  const pm13Done       = isMilestoneCompleteByCode("PM13"); // results back
  const enquiriesDone  = isMilestoneCompleteByCode("PM14");
  const exchangeDone   = isMilestoneCompleteByCode(side === "vendor" ? "VM19" : "PM26");
  const completionDone = isMilestoneCompleteByCode(side === "vendor" ? "VM20" : "PM27");

  // First non-complete tile → active. Others → pending (or complete).
  // Sub-labels kept short so they don't truncate on mobile widths where
  // each tile has ~60px of horizontal room. "Underway" / "Prepping"
  // beat "In progress" / "Being prepared" on the narrow tile.
  const rawStages: {
    key: string;
    label: string;
    complete: boolean;
    activeText: string;   // shown when this is the active tile
    pendingText: string;  // shown when not active + not complete
    completeDate: Date | null;
    locked?: boolean;
  }[] = [
    {
      key: "instructed",
      label: "Instructed",
      complete: instructedDone,
      activeText: "Starting",
      pendingText: "Pending",
      completeDate: dateForCode(side === "vendor" ? "VM1" : "PM1"),
    },
    {
      key: "draft_pack",
      label: "Draft pack",
      complete: draftPackDone,
      activeText: "Prepping",
      pendingText: "Pending",
      completeDate: dateForCode("VM7"),
    },
    {
      key: "searches",
      label: "Searches",
      complete: pm13Done,
      // Ellis's don't-mislead: "In progress" only if searches confirmed
      // ordered (PM8). Otherwise "Awaiting" — searches haven't started.
      activeText: pm8Done ? "Underway" : "Awaiting",
      pendingText: "Pending",
      completeDate: dateForCode("PM13"),
    },
    {
      key: "enquiries",
      label: "Enquiries",
      complete: enquiriesDone,
      activeText: "Underway",
      pendingText: "Pending",
      completeDate: dateForCode("PM14"),
    },
    {
      key: "exchange",
      label: "Exchange",
      complete: exchangeDone,
      activeText: "Nearing",
      // Ellis's don't-mislead: NO forecast date on Exchange — clients
      // interpret it as set-in-stone. Just "Pending".
      pendingText: "Pending",
      completeDate: dateForCode(side === "vendor" ? "VM19" : "PM26"),
    },
    {
      key: "completion",
      label: "Completion",
      complete: completionDone,
      activeText: "Nearing",
      // Ellis's don't-mislead: lock icon + "TBC" until exchange
      // is confirmed complete. (Was "Locked until exchange" — truncated
      // on mobile; "TBC" carries the same meaning in 3 chars.)
      pendingText: exchangeDone ? "Pending" : "TBC",
      completeDate: dateForCode(side === "vendor" ? "VM20" : "PM27"),
      locked: !exchangeDone && !completionDone,
    },
  ];
  const firstIncompleteIdx = rawStages.findIndex((s) => !s.complete);
  const overviewTiles: OverviewTile[] = rawStages.map((s, i) => {
    const isComplete = s.complete;
    const isActive   = !isComplete && i === firstIncompleteIdx;
    const status: OverviewTile["status"] = isComplete ? "complete" : isActive ? "active" : "pending";
    const text = isComplete
      ? (s.completeDate ? fmtDateShort(s.completeDate) : "Done")
      : isActive
        ? s.activeText
        : s.pendingText;
    return {
      key: s.key,
      label: s.label,
      status,
      text,
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
    />
  );
  // Per-tip refinement: pass the customer's actual completed-milestone
  // set so getStageTips can hide tips whose underlying milestone has
  // already been ticked (e.g. "your lender will book a valuation" once
  // PM6 is complete). Without this, the stage gets us into the right
  // pool but individual tips can still talk about completed events.
  const doneCodes = new Set(milestones.filter((m) => m.isComplete).map((m) => m.code));
  const tips  = getStageTips(stage, side, token, doneCodes);

  return (
    <div className="space-y-4">

      {/* ── Completion banner ──────────────────────────────────── */}
      {hasCompleted && (
        <CompletionBanner
          token={token}
          saleWord={saleWord}
          completionDate={transaction.completionDate ? new Date(transaction.completionDate).toISOString() : null}
        />
      )}

      {/* ── Exchange banner ─────────────────────────────────────── */}
      {hasExchanged && !hasCompleted && (
        <>
          <ExchangeBanner
            token={token}
            completionDate={transaction.completionDate ? new Date(transaction.completionDate).toISOString() : null}
          />
          {transaction.completionDate && (
            <a
              href={`/api/portal/calendar-export/${token}`}
              download="completion-date.ics"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-[13px] font-semibold transition-colors"
              style={{ background: P.cardBg, boxShadow: P.shadowSm, color: P.accent }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Add completion date to calendar
            </a>
          )}
        </>
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
          nextAfterDescription={nextAfter ? (getMilestoneCopy(nextAfter.code).description ?? null) : null}
        />
      )}

      {/* ── Coming up (next 3 after next action) ─────────────────── */}
      {comingUp.length > 0 && !hasCompleted && (
        <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>
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
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                style={
                  m.who === "you"
                    ? { background: P.primaryBg, color: P.primaryText }
                    : { background: P.accentBg, color: P.accent }
                }
              >
                {m.who === "you" ? "You" : m.whoLabel}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Key dates ────────────────────────────────────────────── */}
      {keyDates.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>
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
        </div>
      )}

      {/* ── Target exchange date ──────────────────────────────────── */}
      {transaction.expectedExchangeDate && !hasExchanged && (
        <div
          className="flex items-center justify-between px-5 py-4 rounded-2xl"
          style={{ background: P.cardBg, boxShadow: P.shadowSm }}
        >
          <p className="text-[13px]" style={{ color: P.textSecondary }}>Target exchange</p>
          <p className="text-[13px] font-semibold" style={{ color: P.accent }}>
            {fmtDate(transaction.expectedExchangeDate)}
          </p>
        </div>
      )}

      {/* ── Tips / What's next ───────────────────────────────────── */}
      {stage === "completed" ? (
        <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${P.border}` }}>
            <p className="text-[13px] font-bold" style={{ color: P.textPrimary }}>What happens next</p>
          </div>
          {COMPLETED_NEXT[side].map((text, i) => (
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
              <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>{text}</p>
            </div>
          ))}
        </div>
      ) : tips.length > 0 ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3 px-1" style={{ color: P.textMuted }}>
            Helpful to know
          </p>
          <div className="flex gap-3 overflow-x-auto snap-x pb-1" style={{ scrollbarWidth: "none" }}>
            {tips.map((tip, i) => (
              <div
                key={i}
                className="flex-shrink-0 snap-start rounded-2xl p-4"
                style={{ background: P.cardBg, boxShadow: P.shadowSm, width: "220px" }}
              >
                <Lightbulb size={18} weight="fill" color={P.warning} style={{ marginBottom: 8 }} />
                <p className="text-[13px] leading-relaxed" style={{ color: P.textPrimary }}>{tip.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Explain-my-email ─────────────────────────────────────── */}
      {!hasCompleted && <ExplainEmailCard token={token} />}

      {/* ── Feedback widget ──────────────────────────────────────── */}
      <FeedbackWidget portalToken={token} />

      {/* ── Latest updates ───────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <p className="text-[13px] font-bold" style={{ color: P.textPrimary }}>Latest updates</p>
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
              {entry.type === "milestone" ? (
                <>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: P.successBg }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium leading-snug" style={{ color: P.textPrimary }}>{entry.label}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: P.textMuted }}>{fmtDateShort(entry.createdAt ?? new Date())}</p>
                  </div>
                </>
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
      </div>

    </div>
  );
}
