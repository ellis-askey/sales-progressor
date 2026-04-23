import { notFound } from "next/navigation";
import Link from "next/link";
import { getPortalData, getPortalMilestones, getPortalTimeline } from "@/lib/services/portal";
import type { TimelineEntry } from "@/lib/services/portal";
import { getMilestoneCopy, WHO_LABELS } from "@/lib/portal-copy";
import { P } from "@/components/portal/portal-ui";
import { PortalNextActionCard } from "@/components/portal/PortalNextActionCard";
import { CircularProgress } from "@/components/portal/CircularProgress";
import { ExchangeBanner, CompletionBanner } from "@/components/portal/ExchangeBanner";
import { detectStage, getStageTips, COMPLETED_NEXT } from "@/lib/portal-tips";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr";

function fmtPrice(p: number) { return "£" + p.toLocaleString("en-GB"); }
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDateShort(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}


function StatPill({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[18px] font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[11px]" style={{ color: P.textMuted }}>{label}</span>
    </div>
  );
}

export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) notFound();

  const { contact, transaction } = data;
  const side     = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const saleWord = side === "vendor" ? "sale" : "purchase";

  const [rawMilestones, timeline] = await Promise.all([
    getPortalMilestones(transaction.id, side),
    getPortalTimeline(transaction.id, side, contact.id),
  ]);

  const milestones = rawMilestones.map((m) => ({
    ...m,
    label:           getMilestoneCopy(m.code).label,
    who:             getMilestoneCopy(m.code).who,
    whoLabel:        WHO_LABELS[getMilestoneCopy(m.code).who] ?? getMilestoneCopy(m.code).who,
    typicalDuration: getMilestoneCopy(m.code).typicalDuration ?? null,
  }));

  const preExchange = milestones.filter((m) => !m.isPostExchange && !m.isExchangeGate && !m.isNotRequired);
  const completed   = preExchange.filter((m) => m.isComplete);
  const percent     = preExchange.length > 0 ? Math.round((completed.length / preExchange.length) * 100) : 0;

  const hasExchanged = milestones.some((m) => (m.code === "VM12" || m.code === "PM16") && m.isComplete);
  const hasCompleted = milestones.some((m) => (m.code === "VM13" || m.code === "PM17") && m.isComplete);

  const available  = milestones.filter((m) => !m.isComplete && !m.isNotRequired && !m.isPostExchange && !m.isExchangeGate && m.isAvailable);
  const nextAction = available[0] ?? null;
  const nextAfter  = available[1] ?? null;
  const comingUp   = available.slice(2, 5);

  const keyDates     = milestones.filter((m) => m.timeSensitive && m.eventDate && m.isComplete);
  const recentActivity = timeline.slice(0, 3);

  const stage = detectStage(milestones, side);
  const tips  = getStageTips(stage, side, token);

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

      {/* ── Hero gradient strip ──────────────────────────────────── */}
      {!hasExchanged && !hasCompleted && (
        <div
          className="rounded-b-3xl -mx-4 px-5 pt-6 pb-7"
          style={{ background: P.heroGradient, boxShadow: P.heroGlow }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span
                className="inline-block text-[11px] font-bold uppercase tracking-[0.10em] mb-3 px-3 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.20)", color: "rgba(255,255,255,0.90)" }}
              >
                {transaction.agencyName}
              </span>
              <h2 className="text-[22px] font-semibold text-white leading-snug">
                {transaction.propertyAddress}
              </h2>
            </div>
            <CircularProgress percent={percent} />
          </div>
        </div>
      )}

      {/* ── Stats row ────────────────────────────────────────────── */}
      {!hasExchanged && !hasCompleted && (
        <div
          className="rounded-2xl px-5 py-4 flex items-center justify-around"
          style={{ background: P.cardBg, boxShadow: P.shadowSm }}
        >
          <StatPill value={completed.length} label="Done" color={P.success} />
          <div className="w-px h-8" style={{ background: P.border }} />
          <StatPill value={preExchange.length - completed.length} label="Remaining" color={P.accent} />
          {transaction.purchasePrice && (
            <>
              <div className="w-px h-8" style={{ background: P.border }} />
              <StatPill value={fmtPrice(transaction.purchasePrice)} label="Price" color={P.textPrimary} />
            </>
          )}
        </div>
      )}

      {/* ── Next action CTA ──────────────────────────────────────── */}
      {nextAction && !hasCompleted && (
        <PortalNextActionCard
          token={token}
          milestone={{
            id:            nextAction.id,
            label:         nextAction.label,
            who:           nextAction.who,
            timeSensitive: nextAction.timeSensitive,
            code:          nextAction.code,
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
                    <p className="text-[12px] mt-0.5" style={{ color: P.textMuted }}>{fmtDateShort(entry.createdAt)}</p>
                  </div>
                </>
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] leading-relaxed" style={{ color: P.textPrimary }}>{entry.content}</p>
                  <p className="text-[12px] mt-1.5" style={{ color: P.textMuted }}>{fmtDateShort(entry.createdAt)}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
}
