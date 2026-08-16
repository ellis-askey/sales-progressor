import { notFound } from "next/navigation";
import { getPortalData, getPortalMilestones, portalOwnSideScope, portalOtherSideScope } from "@/lib/services/portal";
import { calculateProgress } from "@/lib/services/fees";
import { getMilestoneCopy, WHO_LABELS } from "@/lib/portal-copy";
import { PortalMilestoneList } from "@/components/portal/PortalMilestoneList";
import { P } from "@/components/portal/portal-ui";
import { PortalGlassCard } from "@/components/portal/PortalGlassCard";

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

  const nextUp = portalMilestones.find((m) => !m.isComplete && !m.isNotRequired && !m.isPostExchange && !m.isExchangeGate && (m.isAvailable ?? false));

  return (
    <div className="space-y-4">
      {/* ── Progress header ─────────────────────────────────── */}
      <PortalGlassCard glassId="progress-header" label="Progress: steps-done header" defaultVariant="v25" className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[15px] font-semibold" style={{ color: P.textPrimary }}>
            {completed.length} of {preExchange.length} steps done
          </p>
          <p className="text-[15px] font-bold" style={{ color: P.accent }}>{percent}%</p>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: P.border }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${percent}%`,
              background: percent >= 80 ? P.success : P.accent,
            }}
          />
        </div>
        {hasExchanged ? (
          <p className="text-[12px] mt-3 font-semibold" style={{ color: P.success }}>Contracts exchanged</p>
        ) : nextUp ? (
          <p className="text-[12px] mt-3" style={{ color: P.textMuted }}>
            Next: <span style={{ color: P.textSecondary }}>{nextUp.label}</span>
          </p>
        ) : null}
      </PortalGlassCard>

      {/* ── Grouped milestone sections ───────────────────────── */}
      <PortalMilestoneList
        token={token}
        milestones={portalMilestones}
        otherSideMilestones={otherPortalMilestones}
        hasExchanged={hasExchanged}
        side={side}
      />
    </div>
  );
}
