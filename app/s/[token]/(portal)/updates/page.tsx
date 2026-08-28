import { prisma } from "@/lib/prisma";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";
import { solicitorCodesForSide, solicitorStepLabel } from "@/lib/solicitor-confirm/codes";
import { getEnquiryTrackerView } from "@/lib/enquiries/tracker";
import { getSolicitorUpdates } from "@/lib/services/solicitor-updates";
import { OpenUpdatesCard } from "../../OpenUpdatesCard";
import { UpdatesFeed } from "../../UpdatesFeed";
import { SolicitorEnquiries } from "../../SolicitorEnquiries";
import { SolicitorRaisePanel } from "../../SolicitorRaisePanel";
import { PortalCard } from "../../portal-cards";
import { S } from "../../ui";

export const dynamic = "force-dynamic";

export default async function SolicitorUpdatesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const decoded = verifySolicitorToken(token);
  if (!decoded) return null;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: decoded.transactionId },
    select: { id: true, activeBuyerRoundId: true },
  });
  if (!tx) return null;

  const side = decoded.side;
  const scope = forRound(tx.activeBuyerRoundId, tx.id);
  const rows = await prisma.milestoneCompletion.findMany({
    where: { transactionId: tx.id, state: "available", milestoneDefinition: { code: { in: Array.from(solicitorCodesForSide(side)) } }, ...milestoneScopeWhere(scope) },
    select: { expectedDate: true, milestoneDefinition: { select: { id: true, code: true, name: true, orderIndex: true } } },
    orderBy: { milestoneDefinition: { orderIndex: "asc" } },
  });
  const steps = rows.map((r) => ({
    id: r.milestoneDefinition.id,
    code: r.milestoneDefinition.code,
    label: solicitorStepLabel(r.milestoneDefinition.code, r.milestoneDefinition.name),
    expectedDate: r.expectedDate ? r.expectedDate.toISOString().slice(0, 10) : null,
  }));

  const enquiries = await getEnquiryTrackerView(tx.id);
  const enquiriesOpen = !!enquiries && enquiries.status !== "closed";
  const courtLine =
    enquiries?.currentlyWith === "buyer_solicitor"
      ? "The enquiries are with the buyer's solicitor to review the replies."
      : "We're waiting on the seller's solicitor to answer the outstanding enquiries.";
  const raiseChase =
    side === "purchaser"
      ? await prisma.enquiryRaiseChase.findUnique({ where: { transactionId: tx.id }, select: { closedAt: true } })
      : null;
  const raiseOpen = !!raiseChase && !raiseChase.closedAt && !enquiriesOpen;

  // The chronological feed: own-side events dated + attributed, other side
  // dateless (still in order, so recency reads without a shown date).
  const feed = await getSolicitorUpdates(tx.id, side, scope);
  const otherSideTag = side === "vendor" ? "Buyer's side" : "Seller's side";

  const hasAnything = steps.length > 0 || enquiriesOpen || raiseOpen;

  return (
    <div className="portal-reveal-stack" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {steps.length > 0 && <OpenUpdatesCard token={token} steps={steps} />}
      {enquiriesOpen && <SolicitorEnquiries token={token} side={side} courtLine={courtLine} outstandingNote={enquiries?.outstandingNote ?? null} />}
      {raiseOpen && <SolicitorRaisePanel token={token} />}

      <UpdatesFeed entries={feed} otherSideTag={otherSideTag} />

      {!hasAnything && feed.length === 0 && (
        <PortalCard glassId="sol-nothing-yet" label="Nothing yet" style={{ textAlign: "center", padding: "26px 22px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: S.ink }}>Nothing yet</p>
          <p style={{ margin: 0, fontSize: 13.5, color: S.muted, lineHeight: 1.6 }}>Updates on this matter will appear here as things happen.</p>
        </PortalCard>
      )}
    </div>
  );
}
