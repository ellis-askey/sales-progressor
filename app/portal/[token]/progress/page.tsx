import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getPortalData, getPortalMilestones, portalOwnSideScope, portalOtherSideScope, getPortalChainAgent } from "@/lib/services/portal";
import { calculateProgress } from "@/lib/services/fees";
import { getMilestoneCopy, WHO_LABELS } from "@/lib/portal-copy";
import { PortalMilestoneList } from "@/components/portal/PortalMilestoneList";
import { PortalOnwardPanel } from "@/components/portal/PortalOnwardPanel";
import { getOnwardTrackerView, getRelatedSaleSignalForFile } from "@/lib/services/onward";
import { prisma } from "@/lib/prisma";
import { PortalProgressHeader } from "@/components/portal/PortalProgressHeader";
import { recordPortalEvent } from "@/lib/services/portal-events";

const POST_EXCHANGE_PORTAL = new Set(["VM19", "VM20", "PM26", "PM27"]);
const EXCHANGE_GATES_PORTAL = new Set(["VM18", "PM25"]);

function toPortalShape(milestones: Awaited<ReturnType<typeof getPortalMilestones>>) {
  return milestones.map((m) => ({
    id:              m.id,
    code:            m.code,
    orderIndex:      m.orderIndex,
    isComplete:      m.isComplete,
    isNotRequired:   m.isNotRequired,
    isAvailable:     m.isAvailable,
    isPostExchange:  POST_EXCHANGE_PORTAL.has(m.code),
    isExchangeGate:  EXCHANGE_GATES_PORTAL.has(m.code),
    completedAt:     m.completedAt,
    eventDate:       m.eventDate,
    confirmedByPortal: m.confirmedByPortal,
    label:           getMilestoneCopy(m.code).label,
    labelOther:      getMilestoneCopy(m.code).labelOther ?? null,
    who:             getMilestoneCopy(m.code).who,
    whoLabel:        WHO_LABELS[getMilestoneCopy(m.code).who] ?? getMilestoneCopy(m.code).who,
    description:        getMilestoneCopy(m.code).description ?? null,
    eventDateRequired:  m.eventDateRequired,
  }));
}

export default async function PortalProgressPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPortalData(token);
  if (!result || result.kind === "deadRound") notFound();
  // Portal Engagement v2 (Phase 1): section view. Fire-and-forget, best-effort.
  void recordPortalEvent("portal_section_viewed", result.data.contact.id, { section: "progress" });
  const data = result.data;

  const { contact, transaction } = data;
  const side      = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const otherSide = side === "vendor" ? "purchaser" : "vendor";

  const ownScope   = portalOwnSideScope(contact, transaction);
  const otherScope = portalOtherSideScope(contact, transaction);
  const [milestones, otherSideMilestones] = await Promise.all([
    getPortalMilestones(transaction.id, side, ownScope),
    getPortalMilestones(transaction.id, otherSide, otherScope),
  ]);

  const hasExchanged = milestones.some((m) => (m.code === "VM19" || m.code === "PM26") && m.isComplete);

  // Step count — exclude only post-exchange; exchange gate IS a confirmable step
  const preExchange = milestones.filter((m) => !POST_EXCHANGE_PORTAL.has(m.code) && !m.isNotRequired);
  const completed   = preExchange.filter((m) => m.isComplete);

  // Weighted % — same formula as agent transaction page
  const vendorMilestones    = side === "vendor" ? milestones : otherSideMilestones;
  const purchaserMilestones = side === "purchaser" ? milestones : otherSideMilestones;
  const toWeight = (ms: typeof milestones) =>
    ms.map((m) => ({ weight: m.weight, isComplete: m.isComplete, isNotRequired: m.isNotRequired }));
  const progress = calculateProgress(toWeight(vendorMilestones), toWeight(purchaserMilestones), new Date(transaction.createdAt), transaction.overridePredictedDate ?? null);
  const percent  = side === "vendor" ? progress.vendorPercent : progress.purchaserPercent;

  const portalMilestones      = toPortalShape(milestones);
  const otherPortalMilestones = toPortalShape(otherSideMilestones);

  // Extra swipe panel on the Progress tab:
  //   - sellers (vendor): their onward purchase (the link above), when they've
  //     started tracking, said they're buying onward, or a chain link exists above.
  //   - buyers (purchaser): their related sale (the link below, the property they're
  //     selling to fund the purchase), when they've started tracking, we've detected
  //     they're selling, or a chain link exists below.
  let onwardPanel: ReactNode = undefined;
  let onwardLabel = "Your onward";
  if (side === "vendor") {
    const [onwardView, moveInfo, chainAgent] = await Promise.all([
      getOnwardTrackerView(transaction.id),
      prisma.clientMoveInfo.findUnique({
        where: { transactionId_side: { transactionId: transaction.id, side: "vendor" } },
        select: { buyingOnward: true },
      }),
      getPortalChainAgent(transaction.id, "vendor").catch(() => null),
    ]);
    const ca = chainAgent as { present?: boolean; propertyAddress?: string | null } | null;
    const onwardLinkKnown = !!ca?.present;
    // The onward property address is already known from the chain (the link
    // above), so the seller doesn't re-enter it — they only set tenure + method.
    const onwardAddress = ca?.propertyAddress ?? null;
    if (onwardView.exists || moveInfo?.buyingOnward === true || onwardLinkKnown) {
      onwardPanel = <PortalOnwardPanel token={token} initialView={onwardView} onwardAddress={onwardAddress} />;
    }
  } else {
    const [relatedView, signal, chainAgent] = await Promise.all([
      getOnwardTrackerView(transaction.id, "related_sale"),
      getRelatedSaleSignalForFile(transaction.id),
      getPortalChainAgent(transaction.id, "purchaser").catch(() => null),
    ]);
    const ca = chainAgent as { present?: boolean; propertyAddress?: string | null } | null;
    const relatedLinkKnown = !!ca?.present;
    // Address of the property they're selling (the link below), if known.
    const relatedAddress = ca?.propertyAddress ?? signal.relatedAddress ?? null;
    if (relatedView.exists || signal.selling || relatedLinkKnown) {
      onwardLabel = "Your sale";
      onwardPanel = (
        <PortalOnwardPanel token={token} initialView={relatedView} onwardAddress={relatedAddress} direction="related" />
      );
    }
  }

  const nextUp = portalMilestones.find((m) => !m.isComplete && !m.isNotRequired && !m.isPostExchange && !m.isExchangeGate && (m.isAvailable ?? false));

  return (
    <div className="space-y-4 portal-reveal-stack">
      {/* ── Progress header ─────────────────────────────────── */}
      {/* The completion percentage + bar are gated by the agency's "Progress
          figure" display setting; the step count stays either way. */}
      <PortalProgressHeader
        completed={completed.length}
        total={preExchange.length}
        percent={percent}
        showPercent={transaction.portalDisplay.progressPercent}
        hasExchanged={hasExchanged}
        nextLabel={nextUp?.label ?? null}
      />

      {/* ── Grouped milestone sections ───────────────────────── */}
      <PortalMilestoneList
        token={token}
        milestones={portalMilestones}
        otherSideMilestones={otherPortalMilestones}
        hasExchanged={hasExchanged}
        side={side}
        onwardPanel={onwardPanel}
        onwardLabel={onwardLabel}
        saleActive={transaction.status !== "withdrawn" && transaction.status !== "completed"}
      />
    </div>
  );
}
