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

function DonutRing({ percent, size = 120 }: { percent: number; size?: number }) {
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  const color = percent >= 80 ? "#16A34A" : percent >= 50 ? P.primary : "#D97706";
  const cx = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={P.border} strokeWidth="10" />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: "stroke-dasharray 0.7s ease" }}
      />
      <text x={cx} y={cx - 6} textAnchor="middle" fontSize={size * 0.18} fontWeight="800" fill={P.textPrimary} fontFamily="-apple-system, sans-serif">
        {percent}%
      </text>
      <text x={cx} y={cx + 12} textAnchor="middle" fontSize={size * 0.1} fill={P.textSecondary} fontFamily="-apple-system, sans-serif">
        done
      </text>
    </svg>
  );
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
      {/* ── Progress ring card ───────────────────────────────── */}
      <div className="rounded-2xl px-5 py-5" style={{ background: P.card, boxShadow: P.shadow }}>
        <div className="flex items-center gap-5">
          <DonutRing percent={percent} size={110} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: P.textMuted }}>
              {side === "vendor" ? "Sale" : "Purchase"} progress
            </p>
            <p className="text-[20px] font-bold leading-tight" style={{ color: P.textPrimary }}>
              {completed.length} of {preExchange.length}
              <span className="text-[14px] font-medium ml-1" style={{ color: P.textSecondary }}>steps done</span>
            </p>
            {hasExchanged ? (
              <p className="text-[13px] font-semibold mt-2" style={{ color: "#16A34A" }}>✓ Contracts exchanged</p>
            ) : nextUp ? (
              <div className="mt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: P.textMuted }}>Next</p>
                <p className="text-[13px] font-semibold" style={{ color: P.primary }}>{nextUp.label}</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Thin progress bar below */}
        <div className="mt-4 w-full rounded-full overflow-hidden" style={{ height: 6, background: P.border }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${percent}%`,
              background: `linear-gradient(90deg, ${percent >= 80 ? "#16A34A" : percent >= 50 ? P.primary : "#D97706"} 0%, transparent 100%)`,
              transition: "width 0.7s ease",
            }}
          />
        </div>
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
