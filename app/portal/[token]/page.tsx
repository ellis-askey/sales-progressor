import { notFound } from "next/navigation";
import Link from "next/link";
import { getPortalData, getPortalMilestones, getPortalUpdates } from "@/lib/services/portal";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { P } from "@/components/portal/portal-ui";

function fmtPrice(p: number) { return "£" + p.toLocaleString("en-GB"); }
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function daysUntil(d: Date | string) {
  const diff = Math.round((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `${diff} days away`;
}

function buildRightmoveUrl(postcode: string | null) {
  if (!postcode) return null;
  return `https://www.rightmove.co.uk/house-prices/${encodeURIComponent(postcode)}.html`;
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
  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";

  const [milestones, updates] = await Promise.all([
    getPortalMilestones(transaction.id, side),
    getPortalUpdates(transaction.id),
  ]);

  const preExchange = milestones.filter((m) => !m.isPostExchange && !m.isExchangeGate && !m.isNotRequired);
  const completed   = preExchange.filter((m) => m.isComplete);
  const percent     = preExchange.length > 0 ? Math.round((completed.length / preExchange.length) * 100) : 0;

  const hasExchanged = milestones.some((m) => (m.code === "VM12" || m.code === "PM16") && m.isComplete);
  const hasCompleted = milestones.some((m) => (m.code === "VM13" || m.code === "PM17") && m.isComplete);

  // Exchange ready = all pre-exchange blocksExchange milestones done, but not yet exchanged
  const gateCode = side === "vendor" ? "VM20" : "PM27";
  const isExchangeReady = milestones.some((m) => m.code === gateCode && m.isComplete) && !hasExchanged;

  const nextAction = milestones.find(
    (m) => !m.isComplete && !m.isNotRequired && !m.isPostExchange && !m.isExchangeGate && m.isAvailable
  ) ?? null;

  // Key dates from time-sensitive completed milestones with an event date
  const keyDates = milestones.filter((m) => m.timeSensitive && m.eventDate && m.isComplete);

  const recentUpdates = updates.slice(0, 3);
  const saleWord = side === "vendor" ? "sale" : "purchase";
  const rightmoveUrl = buildRightmoveUrl(transaction.postcode);

  const progressColor = percent >= 80 ? "#16A34A" : percent >= 50 ? P.primary : "#D97706";

  return (
    <div className="space-y-4">

      {/* ── Completion banner ──────────────────────────────────── */}
      {hasCompleted && (
        <div className="rounded-2xl px-5 py-5" style={{ background: "linear-gradient(135deg, #16A34A 0%, #059669 100%)" }}>
          <p className="text-[18px] font-bold text-white">Your {saleWord} is complete! 🎉</p>
          {transaction.completionDate && (
            <p className="text-[13px] text-white/75 mt-1">Completed {fmtDate(transaction.completionDate)}</p>
          )}
        </div>
      )}

      {/* ── Exchange banner ─────────────────────────────────────── */}
      {hasExchanged && !hasCompleted && (
        <div className="rounded-2xl px-5 py-5" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDark} 100%)` }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1">Contracts exchanged</p>
              <p className="text-[17px] font-bold text-white">Your {saleWord} is legally binding</p>
            </div>
            <span className="text-2xl">🤝</span>
          </div>
          {transaction.completionDate && (
            <div className="mt-4 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.15)" }}>
              <p className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Completion</p>
              <p className="text-[16px] font-bold text-white mt-0.5">{fmtDate(transaction.completionDate)}</p>
              <p className="text-[13px] text-white/75">{daysUntil(transaction.completionDate)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Exchange ready banner ───────────────────────────────── */}
      {isExchangeReady && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-4" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <span className="text-2xl">🔑</span>
          <div>
            <p className="text-[15px] font-bold" style={{ color: "#92400E" }}>Ready to exchange!</p>
            <p className="text-[13px] mt-0.5" style={{ color: "#B45309" }}>
              All steps are done — your agent will be in touch to arrange exchange of contracts.
            </p>
          </div>
        </div>
      )}

      {/* ── Property card ───────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: P.card, boxShadow: P.shadow }}>
        {/* Gradient header */}
        <div
          className="px-5 py-5 flex items-start justify-between"
          style={{ background: `linear-gradient(135deg, ${P.primaryLight} 0%, #f0f4ff 100%)` }}
        >
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: P.primary }}>Your property</p>
            <p className="text-[16px] font-bold leading-snug" style={{ color: P.textPrimary }}>{transaction.propertyAddress}</p>
            {transaction.postcode && (
              <p className="text-[13px] mt-0.5 font-medium" style={{ color: P.textSecondary }}>{transaction.postcode}</p>
            )}
          </div>
          <div className="text-3xl flex-shrink-0">🏡</div>
        </div>

        {/* Links row */}
        {rightmoveUrl && (
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderTop: `1px solid ${P.border}` }}>
            <a
              href={rightmoveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-white active:opacity-80 transition-opacity"
              style={{ background: "#00deb6" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              View on Rightmove
            </a>
            <p className="text-[11px]" style={{ color: P.textMuted }}>Sold prices for {transaction.postcode}</p>
          </div>
        )}
      </div>

      {/* ── Progress card ───────────────────────────────────────── */}
      <div className="rounded-2xl px-5 py-5" style={{ background: P.card, boxShadow: P.shadow }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: P.textMuted }}>Your progress</p>
            <p className="text-[24px] font-bold" style={{ color: P.textPrimary }}>{percent}%</p>
            <p className="text-[13px]" style={{ color: P.textSecondary }}>{completed.length} of {preExchange.length} steps done</p>
          </div>
          {transaction.purchasePrice && (
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: P.textMuted }}>{side === "vendor" ? "Sale" : "Purchase"} price</p>
              <p className="text-[18px] font-bold" style={{ color: P.textPrimary }}>{fmtPrice(transaction.purchasePrice)}</p>
            </div>
          )}
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 10, background: P.border }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${progressColor}, ${progressColor}cc)` }}
          />
        </div>
        {transaction.expectedExchangeDate && !hasExchanged && (
          <p className="text-[12px] mt-3" style={{ color: P.textMuted }}>
            Target exchange: <span className="font-semibold" style={{ color: P.textSecondary }}>{fmtDate(transaction.expectedExchangeDate)}</span>
          </p>
        )}
      </div>

      {/* ── Key dates ───────────────────────────────────────────── */}
      {keyDates.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: P.card, boxShadow: P.shadow }}>
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${P.border}` }}>
            <p className="text-[14px] font-bold" style={{ color: P.textPrimary }}>Important dates</p>
          </div>
          {keyDates.map((m, i) => (
            <div key={m.id} className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: i < keyDates.length - 1 ? `1px solid ${P.border}` : undefined }}>
              <p className="text-[14px]" style={{ color: P.textPrimary }}>{getMilestoneCopy(m.code).label}</p>
              <p className="text-[13px] font-semibold" style={{ color: P.primary }}>
                {fmtDate(m.eventDate!)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Next step ───────────────────────────────────────────── */}
      {nextAction && !hasCompleted && (
        <Link href={`/portal/${token}/progress`} className="block rounded-2xl px-5 py-4 active:scale-[0.98] transition-transform" style={{ background: P.card, boxShadow: P.shadow }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: P.textMuted }}>What happens next</p>
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: P.primaryLight }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold" style={{ color: P.textPrimary }}>{getMilestoneCopy(nextAction.code).label}</p>
              <p className="text-[13px] mt-0.5" style={{ color: P.textSecondary }}>
                {getMilestoneCopy(nextAction.code).who === "you" ? "Action needed from you" : `Waiting on your ${getMilestoneCopy(nextAction.code).who}`}
              </p>
            </div>
            {getMilestoneCopy(nextAction.code).who === "you" && (
              <span className="flex-shrink-0 px-4 py-2 rounded-xl text-[13px] font-bold" style={{ background: P.primary, color: "#fff" }}>
                Confirm
              </span>
            )}
          </div>
        </Link>
      )}

      {/* ── Updates ─────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: P.card, boxShadow: P.shadow }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${P.border}` }}>
          <p className="text-[14px] font-bold" style={{ color: P.textPrimary }}>Latest updates</p>
          {recentUpdates.length > 0 && (
            <Link href={`/portal/${token}/updates`} className="text-[13px] font-semibold" style={{ color: P.primary }}>See all</Link>
          )}
        </div>
        {recentUpdates.length === 0 ? (
          <div className="px-5 py-7 text-center">
            <p className="text-[14px]" style={{ color: P.textSecondary }}>Your agent will share {saleWord} updates here.</p>
          </div>
        ) : (
          recentUpdates.map((u, i) => (
            <div key={u.id} className="px-5 py-4" style={{ borderBottom: i < recentUpdates.length - 1 ? `1px solid ${P.border}` : undefined }}>
              <p className="text-[14px] leading-relaxed" style={{ color: P.textPrimary }}>{u.content}</p>
              <p className="text-[12px] mt-1.5" style={{ color: P.textMuted }}>
                {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
