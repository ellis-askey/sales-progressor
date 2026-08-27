import { prisma } from "@/lib/prisma";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { resolveDisplayStages } from "@/lib/milestones/display-stages";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";
import { solicitorCodesForSide, solicitorStepLabel } from "@/lib/solicitor-confirm/codes";
import { getEnquiryTrackerView } from "@/lib/enquiries/tracker";
import { markChaseOpened, recipientForSide } from "@/lib/enquiries/chase-log";
import { SolicitorHero } from "../SolicitorHero";
import { ProgressOverviewCard, PortalCard } from "../portal-cards";
import { OpenUpdatesCard } from "../OpenUpdatesCard";
import { SolicitorEnquiries } from "../SolicitorEnquiries";
import { SolicitorRaisePanel } from "../SolicitorRaisePanel";
import { S } from "../ui";

export const dynamic = "force-dynamic";

function formatPrice(pence: number | null): string | null {
  if (pence == null) return null;
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}
function tenureLabel(tenure: string | null, isShareOfFreehold: boolean): string | null {
  if (isShareOfFreehold) return "Share of freehold";
  if (tenure === "freehold") return "Freehold";
  if (tenure === "leasehold") return "Leasehold";
  return null;
}
function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}
function fmtLastUpdated(d: Date): string {
  const dd = new Date(d);
  const same = dd.toDateString() === new Date().toDateString();
  if (same) return `Today, ${dd.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s/g, "")}`;
  return dd.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function SolicitorOverviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const decoded = verifySolicitorToken(token);
  if (!decoded) return null; // layout renders the invalid notice

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: decoded.transactionId },
    select: {
      id: true,
      propertyAddress: true,
      purchasePrice: true,
      tenure: true,
      isShareOfFreehold: true,
      activeBuyerRoundId: true,
      expectedExchangeDate: true,
      overridePredictedDate: true,
      completionDate: true,
      updatedAt: true,
      agency: { select: { name: true } },
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      contacts: { select: { name: true, roleType: true } },
    },
  });
  if (!tx) return null;

  const side = decoded.side;
  void markChaseOpened(tx.id, recipientForSide(side)).catch(() => {});

  const brand = tx.agency?.name ?? "Sales Progression";
  const sellerNames = joinNames(tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name));
  const buyerNames = joinNames(tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name));
  const firmName = side === "vendor" ? tx.vendorSolicitorFirm?.name ?? null : tx.purchaserSolicitorFirm?.name ?? null;

  // Own-side open solicitor steps.
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

  // Whole-sale 6-stage progress (both sides).
  const allRows = await prisma.milestoneCompletion.findMany({
    where: { transactionId: tx.id, ...milestoneScopeWhere(scope) },
    select: { state: true, completedAt: true, milestoneDefinition: { select: { code: true } } },
  });
  const displayStages = resolveDisplayStages(
    allRows.map((r) => ({ code: r.milestoneDefinition.code, isComplete: r.state === "complete", isNotRequired: r.state === "not_required", completion: { completedAt: r.completedAt } })),
    { expectedExchangeDate: tx.expectedExchangeDate ?? null, overridePredictedDate: tx.overridePredictedDate ?? null, targetCompletionDate: tx.completionDate ?? null },
  );

  // Enquiries loop / raise chase.
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

  const hasAnything = steps.length > 0 || enquiriesOpen || raiseOpen;

  // Hero data.
  const [line1, ...rest] = tx.propertyAddress.split(",");
  const completedCount = displayStages.filter((s) => s.status === "complete" || s.status === "skipped").length;
  const inProgCount = displayStages.filter((s) => s.status === "in_progress").length;
  const ringPercent = Math.round(((completedCount + inProgCount * 0.5) / displayStages.length) * 100);
  const firstActiveIdx = displayStages.findIndex((s) => s.status === "in_progress" || s.status === "up_next");
  const ringStep = firstActiveIdx >= 0 ? firstActiveIdx + 1 : displayStages.length;

  return (
    <div className="portal-reveal-stack" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="portal-reveal-host">
        <SolicitorHero
          matterTypeLabel={side === "vendor" ? "Seller matter" : "Buyer matter"}
          address={line1.trim()}
          addressLine2={rest.join(",").trim()}
          price={formatPrice(tx.purchasePrice)}
          tenure={tenureLabel(tx.tenure, tx.isShareOfFreehold)}
          actingForNames={side === "vendor" ? sellerNames : buyerNames}
          actingForRole={side === "vendor" ? "Seller" : "Buyer"}
          firmName={firmName}
          ringPercent={ringPercent}
          ringStep={ringStep}
          lastUpdated={fmtLastUpdated(tx.updatedAt)}
          agencyName={brand}
        />
      </div>

      <ProgressOverviewCard stages={displayStages} timelineHref={`/s/${token}/progress`} />

      {steps.length > 0 && <OpenUpdatesCard token={token} steps={steps} />}

      {enquiriesOpen && <SolicitorEnquiries token={token} side={side} courtLine={courtLine} outstandingNote={enquiries?.outstandingNote ?? null} />}

      {raiseOpen && <SolicitorRaisePanel token={token} />}

      {!hasAnything && (
        <PortalCard style={{ textAlign: "center", padding: "26px 22px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: S.ink }}>You&rsquo;re all caught up</p>
          <p style={{ margin: 0, fontSize: 13.5, color: S.muted, lineHeight: 1.6 }}>There&rsquo;s nothing outstanding from your side right now. Thank you for helping keep things moving.</p>
        </PortalCard>
      )}
    </div>
  );
}
