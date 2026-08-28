import { prisma } from "@/lib/prisma";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { resolveDisplayStages } from "@/lib/milestones/display-stages";
import { getPortalMilestones } from "@/lib/services/portal";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";
import { solicitorCodesForSide, solicitorStepLabel } from "@/lib/solicitor-confirm/codes";
import { getEnquiryTrackerView } from "@/lib/enquiries/tracker";
import { markChaseOpened, recipientForSide } from "@/lib/enquiries/chase-log";
import { getChainForTransactionV2 } from "@/lib/services/chains";
import { getSignedUrl } from "@/lib/supabase-storage";
import { SolicitorHero } from "../SolicitorHero";
import { PointOfContactCard } from "../PointOfContactCard";
import { DocumentsCard } from "../DocumentsCard";
import { ProgressOverviewCard, PortalCard, StatusBanner, ComingUpCard } from "../portal-cards";
import { OpenUpdatesCard } from "../OpenUpdatesCard";
import { OtherSideCard, otherSideConfig } from "../OtherSideCard";
import { ChainCard, type ChainNode } from "../ChainCard";
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
function purchaseTypeLabel(t: string | null): string | null {
  if (t === "mortgage") return "Mortgage";
  if (t === "cash_buyer") return "Cash buyer";
  if (t === "cash_from_proceeds") return "Cash (from sale)";
  return null;
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
      purchaseType: true,
      activeBuyerRoundId: true,
      expectedExchangeDate: true,
      overridePredictedDate: true,
      completionDate: true,
      updatedAt: true,
      agency: { select: { name: true } },
      assignedUser: { select: { name: true, phone: true, email: true, image: true } },
      agentUser: { select: { name: true, phone: true, email: true, image: true } },
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      contacts: { select: { name: true, roleType: true } },
    },
  });
  if (!tx) return null;

  const person = tx.assignedUser ?? tx.agentUser;

  const side = decoded.side;
  void markChaseOpened(tx.id, recipientForSide(side)).catch(() => {});

  const brand = tx.agency?.name ?? "Sales Progression";
  const sellerNames = joinNames(tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name));
  const buyerNames = joinNames(tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name));
  const firmName = side === "vendor" ? tx.vendorSolicitorFirm?.name ?? null : tx.purchaserSolicitorFirm?.name ?? null;
  const otherFirmName = side === "vendor" ? tx.purchaserSolicitorFirm?.name ?? null : tx.vendorSolicitorFirm?.name ?? null;

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

  // Other side (decision A2): the counterparty's key milestone STATES only — no
  // dates. Curated per side.
  const otherSide = side === "vendor" ? "purchaser" : "vendor";
  const osConfig = otherSideConfig(otherSide);
  const osRows = await prisma.milestoneCompletion.findMany({
    where: { transactionId: tx.id, milestoneDefinition: { code: { in: osConfig.items.map((i) => i.code) } }, ...milestoneScopeWhere(scope) },
    select: { state: true, milestoneDefinition: { select: { code: true } } },
  });
  const doneCodes = new Set(osRows.filter((r) => r.state === "complete").map((r) => r.milestoneDefinition.code));
  const otherSideRows = osConfig.items.map((it) => ({ key: it.code, label: it.label, icon: it.icon, done: doneCodes.has(it.code), doneWord: it.doneWord, pendingWord: it.pendingWord }));

  // Chain (decision B2): shape + rolled-up % + address only. Called with no
  // viewer, so the service strips stuck-step labels + prices automatically.
  const chain = await getChainForTransactionV2(tx.id).catch(() => null);
  let chainNodes: ChainNode[] = [];
  if (chain && chain.links.length > 1) {
    const thisPos = chain.links.find((l) => l.transactionId === tx.id)?.position ?? 0;
    chainNodes = [...chain.links]
      .sort((a, b) => b.position - a.position)
      .map((l) => {
        const isThis = l.transactionId === tx.id;
        const addr = l.transaction?.propertyAddress ?? l.stubPropertyAddress ?? null;
        const role = l.position < thisPos ? "Onward purchase" : "Buyer";
        return { key: l.id, label: isThis ? (addr ? addr.split(",")[0].trim() : "This matter") : addr ? addr.split(",")[0].trim() : role, percent: l.progressPercent, isThisMatter: isThis, claimed: !!l.transactionId };
      });
  }

  // Documents shared with this matter (MOS + anything shared cross-side) —
  // view/download only.
  const sharedDocs = await prisma.transactionDocument.findMany({
    where: { transactionId: tx.id, OR: [{ source: "mos" }, { sharedWithOtherSide: true }] },
    select: { id: true, filename: true, storagePath: true, source: true },
    orderBy: { createdAt: "desc" },
  });
  const docsForCard = await Promise.all(
    sharedDocs.map(async (d) => ({
      id: d.id,
      filename: d.filename,
      url: await getSignedUrl(d.storagePath).catch(() => null),
      label: d.source === "mos" ? "Memorandum of sale" : "Shared document",
    })),
  );

  // Status banner (exchanged / completed).
  const completedNow = displayStages.find((s) => s.key === "completion")?.status === "complete";
  const exchangedNow = displayStages.find((s) => s.key === "exchange")?.status === "complete";

  // "Coming up" — the next 2-3 own-side steps that aren't due yet (a look-ahead).
  const ownMilestones = await getPortalMilestones(tx.id, side, scope);
  const comingUp = ownMilestones
    .filter((m) => !m.isComplete && !m.isNotRequired && !m.isAvailable)
    .slice(0, 3)
    .map((m) => getMilestoneCopy(m.code).label);

  // Hero data.
  const [line1, ...rest] = tx.propertyAddress.split(",");
  const completedCount = displayStages.filter((s) => s.status === "complete" || s.status === "skipped").length;
  const inProgCount = displayStages.filter((s) => s.status === "in_progress").length;
  const ringPercent = Math.round(((completedCount + inProgCount * 0.5) / displayStages.length) * 100);
  const firstActiveIdx = displayStages.findIndex((s) => s.status === "in_progress" || s.status === "up_next");
  const ringStep = firstActiveIdx >= 0 ? firstActiveIdx + 1 : displayStages.length;
  const currentStageName = (firstActiveIdx >= 0 ? displayStages[firstActiveIdx] : displayStages[displayStages.length - 1])?.name ?? null;

  // Prefilled subject for the "Email" contact action: "Sale/Purchase of {full
  // address} - Client: {names}" (names joined with & for more than one).
  const clientNames = side === "vendor" ? sellerNames : buyerNames;
  const emailSubject = `${side === "vendor" ? "Sale" : "Purchase"} of ${tx.propertyAddress}${clientNames ? ` - Client: ${clientNames}` : ""}`;

  return (
    <div className="portal-reveal-stack" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <StatusBanner exchanged={exchangedNow} completed={completedNow} completionDate={tx.completionDate ?? null} />

      <div className="portal-reveal-host">
        <SolicitorHero
          matterTypeLabel={side === "vendor" ? "Seller matter" : "Buyer matter"}
          address={line1.trim()}
          addressLine2={rest.join(",").trim()}
          price={formatPrice(tx.purchasePrice)}
          tenure={tenureLabel(tx.tenure, tx.isShareOfFreehold)}
          purchaseType={purchaseTypeLabel(tx.purchaseType)}
          actingForNames={side === "vendor" ? sellerNames : buyerNames}
          firmName={firmName}
          ringPercent={ringPercent}
          ringStep={ringStep}
          currentStageName={currentStageName}
          lastUpdated={fmtLastUpdated(tx.updatedAt)}
          agencyName={brand}
        />
      </div>

      {person?.name && <PointOfContactCard person={person} agencyName={brand} emailSubject={emailSubject} />}

      <ProgressOverviewCard stages={displayStages} timelineHref={`/s/${token}/progress`} />

      {steps.length > 0 && <OpenUpdatesCard token={token} steps={steps} />}

      <ComingUpCard labels={comingUp} />

      {enquiriesOpen && <SolicitorEnquiries token={token} side={side} courtLine={courtLine} outstandingNote={enquiries?.outstandingNote ?? null} />}

      {raiseOpen && <SolicitorRaisePanel token={token} />}

      <OtherSideCard title={osConfig.title} rows={otherSideRows} firmName={otherFirmName} />

      {chainNodes.length > 1 && <ChainCard nodes={chainNodes} />}

      <DocumentsCard docs={docsForCard} />

      {!hasAnything && (
        <PortalCard glassId="sol-caught-up" label="Caught up" style={{ textAlign: "center", padding: "26px 22px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: S.ink }}>You&rsquo;re all caught up</p>
          <p style={{ margin: 0, fontSize: 13.5, color: S.muted, lineHeight: 1.6 }}>There&rsquo;s nothing outstanding from your side right now. Thank you for helping keep things moving.</p>
        </PortalCard>
      )}
    </div>
  );
}
