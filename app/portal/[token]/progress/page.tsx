import { notFound } from "next/navigation";
import { getPortalData, getPortalMilestones } from "@/lib/services/portal";
import { getMilestoneCopy, WHO_LABELS } from "@/lib/portal-copy";
import { PortalMilestoneList } from "@/components/portal/PortalMilestoneList";
import { P } from "@/components/portal/portal-ui";

function toPortalShape(milestones: Awaited<ReturnType<typeof getPortalMilestones>>) {
  return milestones.map((m) => ({
    id:              m.id,
    code:            m.code,
    orderIndex:      m.orderIndex,
    isComplete:      m.isComplete,
    isNotRequired:   m.isNotRequired,
    isAvailable:     m.isAvailable,
    isPostExchange:  m.isPostExchange,
    isExchangeGate:  m.isExchangeGate,
    timeSensitive:   m.timeSensitive,
    completedAt:     m.completedAt,
    eventDate:       m.eventDate,
    confirmedByClient: m.confirmedByClient,
    label:           getMilestoneCopy(m.code).label,
    who:             getMilestoneCopy(m.code).who,
    whoLabel:        WHO_LABELS[getMilestoneCopy(m.code).who] ?? getMilestoneCopy(m.code).who,
  }));
}

export default async function PortalProgressPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) notFound();

  const { contact, transaction } = data;
  const side      = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const otherSide = side === "vendor" ? "purchaser" : "vendor";

  const [milestones, otherSideMilestones] = await Promise.all([
    getPortalMilestones(transaction.id, side),
    getPortalMilestones(transaction.id, otherSide),
  ]);

  const hasExchanged = milestones.some((m) => (m.code === "VM12" || m.code === "PM16") && m.isComplete);

  const preExchange = milestones.filter((m) => !m.isPostExchange && !m.isExchangeGate && !m.isNotRequired);
  const completed   = preExchange.filter((m) => m.isComplete);
  const percent     = preExchange.length > 0 ? Math.round((completed.length / preExchange.length) * 100) : 0;

  const portalMilestones      = toPortalShape(milestones);
  const otherPortalMilestones = toPortalShape(otherSideMilestones);

  const nextUp = portalMilestones.find((m) => !m.isComplete && !m.isNotRequired && !m.isPostExchange && !m.isExchangeGate && m.isAvailable);

  return (
    <div className="space-y-4">
      {/* ── Progress header ─────────────────────────────────── */}
      <div className="rounded-2xl px-5 py-4" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>
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
      </div>

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
