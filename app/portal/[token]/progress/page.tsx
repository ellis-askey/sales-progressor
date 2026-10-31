import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getPortalData, getPortalMilestones, portalOwnSideScope, portalOtherSideScope, getPortalChainAgent } from "@/lib/services/portal";
import { calculateProgress } from "@/lib/services/fees";
import { getMilestoneCopy, WHO_LABELS } from "@/lib/portal-copy";
import { PortalMilestoneList } from "@/components/portal/PortalMilestoneList";
import { PortalOnwardPanel } from "@/components/portal/PortalOnwardPanel";
import { getOnwardTrackerView, getRelatedSaleSignalForFile, resolveOwnOnwardFileId } from "@/lib/services/onward";
import { resolveTwinContactOnFile } from "@/lib/services/portal-twin";
import { PortalOnwardReadOnly } from "@/components/portal/PortalOnwardReadOnly";
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
    expectedDate:    m.expectedDate,
    confirmedByPortal: m.confirmedByPortal,
    label:           getMilestoneCopy(m.code).label,
    labelOther:      getMilestoneCopy(m.code).labelOther ?? null,
    who:             getMilestoneCopy(m.code).who,
    whoLabel:        WHO_LABELS[getMilestoneCopy(m.code).who] ?? getMilestoneCopy(m.code).who,
    description:        getMilestoneCopy(m.code).description ?? null,
    eventDateRequired:  m.eventDateRequired,
  }));
}

// Onward portal mirror (docs/active/onward-portal-mirror.md): when the client's
// onward purchase / related sale is a file WE run (resolveOwnOnwardFileId), the
// side tab shows that file's REAL steps instead of the lightweight stand-in.
//
//   - CONFIRMABLE when we can tie this person to their OWN contact on the
//     neighbour (resolveTwinContactOnFile): render a nested PortalMilestoneList
//     under their own token, so confirming records on the real file and fires
//     its normal emails. It inherits the ambient read-only context, so an agent
//     previewing the portal still sees it inert.
//   - READ-ONLY when we can't tie them (no matching email / dead round): still
//     show the real progress — step status only, no personal data — wrapped in a
//     forced read-only provider so nothing writes. They can see it; they just
//     can't tick it until tied (Phase 2 adds an agent-confirmed tie).
//
// A nested PortalMilestoneList with no onward/other panels renders exactly the
// solo column. Returns null only when the neighbour isn't our live file, so the
// caller falls back to the stand-in (and reverts there automatically if the
// neighbour is later withdrawn — resolveOwnOnwardFileId gates on a live file).
// Kill switch for this silent, client-facing feature: set
// ONWARD_PORTAL_MIRROR_ENABLED=false in Vercel to disable it instantly without a
// code revert — every file falls back to the lightweight stand-in.
const ONWARD_MIRROR_ENABLED = process.env.ONWARD_PORTAL_MIRROR_ENABLED !== "false";

async function buildNeighbourStepsPanel(
  sourceTxId: string,
  sourceContactId: string,
  kind: "onward_purchase" | "related_sale",
  sourceToken: string,
): Promise<ReactNode | null> {
  if (!ONWARD_MIRROR_ENABLED) return null;
  try {
  const neighbourId = await resolveOwnOnwardFileId(sourceTxId, kind);
  if (!neighbourId) return null;

  // Confirmable path: this person's own token on the neighbour file.
  const twin = await resolveTwinContactOnFile(sourceContactId, neighbourId);
  if (twin?.portalToken) {
    const bData = await getPortalData(twin.portalToken);
    if (bData && bData.kind !== "deadRound") {
      const bContact = bData.data.contact;
      const bTx = bData.data.transaction;
      const bSide = bContact.roleType === "vendor" ? "vendor" : "purchaser";
      const bMilestones = await getPortalMilestones(bTx.id, bSide, portalOwnSideScope(bContact, bTx));
      const bHasExchanged = bMilestones.some((m) => (m.code === "VM19" || m.code === "PM26") && m.isComplete);
      return (
        <PortalMilestoneList
          token={twin.portalToken}
          milestones={toPortalShape(bMilestones)}
          otherSideMilestones={[]}
          hasExchanged={bHasExchanged}
          side={bSide}
          saleActive={bTx.status !== "withdrawn" && bTx.status !== "completed"}
          mirrorSourceToken={sourceToken}
        />
      );
    }
  }

  // Read-only fallback: the neighbour is ours and live, but we can't tie this
  // person to a confirmable contact on it. Show the real progress read-only.
  // Side they'd be on: buying the file above (purchaser) / selling the file
  // below (vendor). A synthetic active-round scope reads the live progress.
  const bTx = await prisma.propertyTransaction.findUnique({
    where: { id: neighbourId },
    select: { id: true, status: true, activeBuyerRoundId: true, propertyAddress: true },
  });
  if (!bTx) return null;
  const bSide: "vendor" | "purchaser" = kind === "onward_purchase" ? "purchaser" : "vendor";
  const scope = portalOwnSideScope({ roleType: bSide, buyerRoundId: bTx.activeBuyerRoundId }, bTx);
  const bMilestones = await getPortalMilestones(bTx.id, bSide, scope);
  const bHasExchanged = bMilestones.some((m) => (m.code === "VM19" || m.code === "PM26") && m.isComplete);
  return (
    <PortalOnwardReadOnly
      address={bTx.propertyAddress}
      milestones={toPortalShape(bMilestones)}
      side={bSide}
      hasExchanged={bHasExchanged}
      saleActive={bTx.status !== "withdrawn" && bTx.status !== "completed"}
    />
  );
  } catch (err) {
    // Fail safe: a hiccup resolving the neighbour must NEVER break the client's
    // progress page — fall back to the lightweight stand-in instead.
    console.error("[onward-mirror] neighbour panel failed; using stand-in", err);
    return null;
  }
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
    // Onward is a file we run + person tied → show its real confirmable steps.
    onwardPanel = (await buildNeighbourStepsPanel(transaction.id, contact.id, "onward_purchase", token)) ?? undefined;
    if (!onwardPanel) {
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
    }
  } else {
    // Related sale is a file we run + person tied → show its real confirmable steps.
    const mirror = await buildNeighbourStepsPanel(transaction.id, contact.id, "related_sale", token);
    if (mirror) {
      onwardLabel = "Your sale";
      onwardPanel = mirror;
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
