import { prisma } from "@/lib/prisma";
import { forRound, vendorOnly, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { getPortalMilestones, type PortalMilestone } from "@/lib/services/portal";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { solicitorOwnLabel } from "@/lib/solicitor-confirm/feed-copy";
import { solicitorCodesForSide, solicitorStepLabel } from "@/lib/solicitor-confirm/codes";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";
import { OpenUpdatesCard } from "../../OpenUpdatesCard";
import { ProgressMirror, type MRow } from "../../ProgressMirror";

export const dynamic = "force-dynamic";

export default async function SolicitorProgressPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const decoded = verifySolicitorToken(token);
  if (!decoded) return null;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: decoded.transactionId },
    select: { id: true, activeBuyerRoundId: true },
  });
  if (!tx) return null;

  const side = decoded.side;
  const otherSide = side === "vendor" ? "purchaser" : "vendor";
  const ownScope = side === "purchaser" ? forRound(tx.activeBuyerRoundId, tx.id) : vendorOnly();
  const otherScope = otherSide === "purchaser" ? forRound(tx.activeBuyerRoundId, tx.id) : vendorOnly();

  // Own-side open solicitor steps to confirm — the same "Open updates" card as
  // the Overview, shown at the top of the Progress tab.
  const stepScope = forRound(tx.activeBuyerRoundId, tx.id);
  const stepRows = await prisma.milestoneCompletion.findMany({
    where: { transactionId: tx.id, state: "available", milestoneDefinition: { code: { in: Array.from(solicitorCodesForSide(side)) } }, ...milestoneScopeWhere(stepScope) },
    select: { expectedDate: true, milestoneDefinition: { select: { id: true, code: true, name: true, orderIndex: true } } },
    orderBy: { milestoneDefinition: { orderIndex: "asc" } },
  });
  const steps = stepRows.map((r) => ({
    id: r.milestoneDefinition.id,
    code: r.milestoneDefinition.code,
    label: solicitorStepLabel(r.milestoneDefinition.code, r.milestoneDefinition.name),
    expectedDate: r.expectedDate ? r.expectedDate.toISOString().slice(0, 10) : null,
  }));

  const [ownM, otherM] = await Promise.all([
    getPortalMilestones(tx.id, side, ownScope),
    getPortalMilestones(tx.id, otherSide, otherScope),
  ]);

  const toRow = (m: PortalMilestone, own: boolean): MRow => {
    const copy = getMilestoneCopy(m.code);
    return {
      code: m.code,
      label: solicitorOwnLabel(m.code, copy.label),
      labelOther: copy.labelOther ?? copy.label,
      isComplete: m.isComplete,
      isNotRequired: m.isNotRequired,
      date: own && m.isComplete ? (m.eventDate ?? m.completedAt)?.toISOString() ?? null : null,
    };
  };

  return (
    <div className="portal-reveal-stack" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {steps.length > 0 && <OpenUpdatesCard token={token} steps={steps} />}
      <ProgressMirror side={side} ownRows={ownM.map((m) => toRow(m, true))} otherRows={otherM.map((m) => toRow(m, false))} />
    </div>
  );
}
