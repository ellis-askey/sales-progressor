"use client";
// components/transaction/TransactionSidebar.tsx
// Shows purchase price, fees, progress, and exchange prediction.

import { useState, useEffect } from "react";
import { formatPrice, formatFee, calculateOurFee } from "@/lib/services/fees";
import { formatElapsedDays } from "@/lib/utils";
import { formatPredictedBand } from "@/lib/utils/format-predicted-band";
import { formatTimeToExchange } from "@/lib/utils/format-time-to-exchange";
import { MEDIANS_READY } from "@/lib/services/milestone-staleness";
import { EditSaleDetailsDrawer } from "@/components/transaction/EditSaleDetailsDrawer";
import { Card } from "@/components/ui/Card";
import type { ProgressResult } from "@/lib/services/fees";
import type { ClientType, Tenure, PurchaseType } from "@prisma/client";

type KeyDate = { name: string; eventDate: Date };

type Props = {
  transaction: {
    id: string;
    propertyAddress: string;
    purchasePrice: number | null;
    tenure: Tenure | null;
    purchaseType: PurchaseType | null;
    isShareOfFreehold: boolean;
    chainLinkId?: string | null;
    overridePredictedDate: Date | null;
    completionDate: Date | null;
    agentFeeAmount: number | null;
    agentFeePercent: number | null;
    agentFeeIsVatInclusive: boolean | null;
    referralFee?: number | null;
    referredFirmName?: string | null;
    referredFirmId?: string | null;
    brokerReferralFee?: number | null;
    brokerFirmName?: string | null;
    serviceType?: "self_managed" | "outsourced" | null;
    // Trial-window flag — true when the file was created while the
    // agency was still inside its 14-day free trial. At exchange the
    // billing trigger reads this and skips invoicing. Sidebar uses it
    // to render "Free during your trial" in place of the price.
    freeOnExchange?: boolean | null;
  };
  recommendedFirms?: { id: string; name: string; defaultReferralFeePence: number | null }[] | null;
  assignedUser: {
    clientType: ClientType;
    legacyFee: number | null;
  } | null;
  agencyFeeOverride?: { feeTier: ClientType; legacyOutsourcedFeePence: number | null } | null;
  agentUser?: { id: string; name: string; email: string; firmName: string | null } | null;
  progress: ProgressResult;
  keyDates?: KeyDate[];
  exchangeConfirmed?: boolean;
  showOurFee?: boolean;
  fileTime?: { agentSeconds: number; teamSeconds: number; totalSeconds: number; lastActiveAt: Date | null; hasLiveSession: boolean };
  isInternal?: boolean;
  canEditSaleDetails?: boolean;
  hideCommercialFields?: boolean;
  // Optional content rendered at the bottom of the Agent card. Used by
  // the file detail page to inject the director-only "Reassign" control
  // (ReassignOwnerControl). Sidebar stays oblivious to the feature —
  // anyone needing to extend the agent card slots their own JSX here.
  agentSlot?: React.ReactNode;
};

function fmtTime(seconds: number): string {
  if (seconds < 60) return "Under a minute";
  if (seconds < 120) return "1 min";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mins`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (seconds < 86400) {
    if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
    return `${h}h ${m}m`;
  }
  const d = Math.floor(seconds / 86400);
  if (d < 7) return d === 1 ? "1 day" : `${d} days`;
  const w = Math.floor(d / 7);
  if (d < 30) return w === 1 ? "1 week" : `${w} weeks`;
  const mo = Math.floor(d / 30);
  return mo <= 1 ? "over a month" : `${mo} months`;
}

function fmtRelative(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return "Active just now";
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return "Active today";
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Active yesterday";
  if (diffDays < 7) return `Active ${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffDays < 30) return diffWeeks === 1 ? "Active 1 week ago" : `Active ${diffWeeks} weeks ago`;
  return "Last active over a month ago";
}

// size/2 - strokeWidth - 2 preserves original r=28 for default (72, 6)
function ProgressRing({ percent, size = 72, strokeWidth = 6 }: { percent: number; size?: number; strokeWidth?: number }) {
  const r = size / 2 - strokeWidth - 2;
  const circ = 2 * Math.PI * r;
  const target = circ * (1 - percent / 100);

  const prefersRM = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [offset, setOffset] = useState(prefersRM ? target : circ);

  useEffect(() => {
    if (prefersRM) { setOffset(target); return; }
    setOffset(circ);
    const t = setTimeout(() => setOffset(target), 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <style>{`
        @keyframes ring-glow-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.78; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ring-glow { animation: none; }
        }
      `}</style>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={{ overflow: "visible" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(160,120,80,0.18)" strokeWidth={strokeWidth} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="ring-glow"
          style={{
            stroke: "var(--agent-coral-deep)",
            transition: prefersRM ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)",
            filter: (percent > 0 && size >= 64) ? "drop-shadow(0 0 5px rgba(var(--agent-coral-rgb), 0.56))" : "none",
            animation: percent > 0 ? "ring-glow-pulse 3s ease-in-out infinite" : "none",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold text-slate-900/80 leading-none ${size >= 64 ? "text-[15px]" : "text-[10px]"}`}>{percent}%</span>
      </div>
    </div>
  );
}

export function TransactionSidebar({ transaction, assignedUser, agencyFeeOverride, agentUser, progress, keyDates = [], exchangeConfirmed = false, showOurFee = true, recommendedFirms, fileTime, isInternal = false, canEditSaleDetails = true, hideCommercialFields = false, agentSlot }: Props) {
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Self-managed is always £59 (hardcoded — agency override does NOT apply here).
  // Outsourced: if SP assigned, calculateOurFee honours agency override → per-SP legacy → sliding scale.
  // Outsourced without an SP yet: the agency-level legacy override is the only thing that can produce a fee.
  //
  // Labels always render as the actual £ figure (no "inc. VAT" suffix, no
  // descriptive classification like "Standard (£500k+)") — see
  // calculateOurFee for the same convention on the outsourced branches.
  const ourFee = transaction.serviceType === "self_managed"
    ? { fee: 5900, label: formatFee(5900) }
    : assignedUser
      ? calculateOurFee(assignedUser.clientType, assignedUser.legacyFee, transaction.purchasePrice, agencyFeeOverride ?? null)
      : agencyFeeOverride?.feeTier === "legacy" && agencyFeeOverride.legacyOutsourcedFeePence != null
        ? { fee: agencyFeeOverride.legacyOutsourcedFeePence, label: formatFee(agencyFeeOverride.legacyOutsourcedFeePence) }
        : { fee: null, label: "" };

  const agentFeeCalcPence: number | null =
    transaction.agentFeeAmount != null
      ? transaction.agentFeeAmount
      : transaction.agentFeePercent != null && transaction.purchasePrice != null
        ? Math.round(transaction.purchasePrice * Number(transaction.agentFeePercent) / 100)
        : null;

  // Trial-free files don't actually charge the SP fee — exclude it from
  // the net-income subtraction so the agent's bottom line is accurate
  // for trial files. UI shows "Free during your trial" in the row above.
  const progressorFeePence =
    showOurFee && ourFee.fee != null && !transaction.freeOnExchange
      ? ourFee.fee
      : 0;
  const totalFeesPence =
    (agentFeeCalcPence ?? 0)
    + (transaction.referralFee ?? 0)
    + (transaction.brokerReferralFee ?? 0)
    - progressorFeePence;
  const hasTotal = agentFeeCalcPence != null;

  const TRACK_PILL: Record<string, string> = {
    on_track:  "agent-pill-active",
    at_risk:   "agent-pill-hold",
    off_track: "agent-pill-withdrawn",
    unknown:   "",
  };
  const PHASE_LABELS: Record<string, string> = {
    onboarding:   "Onboarding",
    conveyancing: "Conveyancing",
    pre_exchange: "Exchange",
    post_exchange: "Exchanged",
  };
  const TRACK_LABEL: Record<string, string> = {
    on_track:  "On track",
    at_risk:   "At risk",
    off_track: "Off track",
    unknown:   "No data yet",
  };
  const TRACK_TOOLTIP: Record<string, string> = {
    on_track:  "You're ahead of the 12-week pace, based on steps completed",
    at_risk:   "Behind the 12-week pace, based on steps completed",
    off_track: "Well behind the 12-week pace, based on steps completed",
    unknown:   "",
  };

  // Shared fee rows used by both desktop and mobile layouts
  const agentFeeValue = transaction.agentFeeAmount
    ? `${formatFee(transaction.agentFeeAmount)}${transaction.agentFeeIsVatInclusive === false ? " + VAT" : transaction.agentFeeIsVatInclusive === true ? " inc VAT" : ""}`
    : transaction.agentFeePercent
      ? `${Number(transaction.agentFeePercent).toFixed(2)}%${transaction.agentFeeIsVatInclusive === false ? " + VAT" : ""}${transaction.purchasePrice ? ` = ${formatFee(Math.round(transaction.purchasePrice * Number(transaction.agentFeePercent) / 100))}` : ""}`
      : "—";

  const VAT = 1.2;
  const referrals = (transaction.referralFee ?? 0) + (transaction.brokerReferralFee ?? 0);
  const grossTotalPence: number | null =
    agentFeeCalcPence != null && transaction.agentFeeIsVatInclusive != null
      ? transaction.agentFeeIsVatInclusive
        ? agentFeeCalcPence + referrals - progressorFeePence
        : Math.round(agentFeeCalcPence * VAT) + referrals - progressorFeePence
      : null;
  const netTotalPence: number =
    transaction.agentFeeIsVatInclusive === true && agentFeeCalcPence != null
      ? Math.round(agentFeeCalcPence / VAT) + referrals - progressorFeePence
      : totalFeesPence;

  return (
    <>
    {/* ── Desktop card stack — ≥768px ──────────────────────────────────────── */}
    <div className="hidden md:block space-y-4">

      {/* Progress card */}
      <Card>
        <p className="agent-sidebar-label mb-4">Progress</p>

        <div className="flex items-center gap-4">
          <ProgressRing percent={progress.percent} />

          <div className="flex-1 space-y-2">
            <span className={`agent-pill ${TRACK_PILL[progress.onTrack]}`} title={TRACK_TOOLTIP[progress.onTrack]}>
              {TRACK_LABEL[progress.onTrack]}
            </span>
            <p className="text-xs text-slate-900/40">
              {formatElapsedDays(progress.daysElapsed)}
            </p>
          </div>
        </div>

        {progress.fileLevelPhase && (
          <p style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 10 }}>
            Transaction stage: <span style={{ fontWeight: 600 }}>{PHASE_LABELS[progress.fileLevelPhase]}</span>
          </p>
        )}
      </Card>

      {/* Time on file card */}
      {fileTime && fileTime.totalSeconds > 0 && (
        <Card>
          <p className="agent-sidebar-label mb-3">Time on file</p>

          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.2 }}>
            {fmtTime(fileTime.totalSeconds)}
          </p>

          {isInternal && (
            <div style={{ borderTop: "1px solid var(--agent-border-default)", paddingTop: 8, marginBottom: 8, display: "flex", flexDirection: "column", gap: 5 }}>
              <div className="flex justify-between items-center">
                <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>Agent</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>
                  {fileTime.agentSeconds > 0 ? fmtTime(fileTime.agentSeconds) : "—"}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>Our team</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>
                  {fileTime.teamSeconds > 0 ? fmtTime(fileTime.teamSeconds) : "—"}
                </p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {fileTime.hasLiveSession ? (
              <>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--agent-success)",
                  display: "inline-block", flexShrink: 0,
                  animation: "agent-pulse-dot 2s ease-in-out infinite",
                }} />
                <span style={{ fontSize: 11, color: "var(--agent-success)", fontWeight: 500 }}>Active now</span>
              </>
            ) : fileTime.lastActiveAt ? (
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{fmtRelative(fileTime.lastActiveAt)}</span>
            ) : null}
          </div>
        </Card>
      )}

      {/* Exchange dates card */}
      <Card padding="none" className="px-4 py-3">
        <p className="agent-sidebar-label mb-4">Exchange Forecast</p>

        <div className="space-y-3">
          {!progress.isEarlyEstimate && (
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-900/40">12-week target</p>
              <p className="text-xs font-semibold text-slate-900/90">
                {progress.twelveWeekTarget
                  ? progress.twelveWeekTarget.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  : "—"}
              </p>
            </div>
          )}

          {(transaction.overridePredictedDate || MEDIANS_READY) && (
            <div className="flex justify-between items-start">
              <p className="text-xs text-slate-900/40">Expected exchange</p>
              <div className="text-right">
                <p className={`text-xs font-semibold ${transaction.overridePredictedDate ? "text-blue-600" : "text-slate-900/90"}`}>
                  {progress.predictedExchangeDate
                    ? transaction.overridePredictedDate
                      ? progress.predictedExchangeDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                      : formatPredictedBand(progress.predictedExchangeDate)
                    : "—"}
                  {transaction.overridePredictedDate && (
                    <span className="ml-1 text-xs text-blue-500">(overridden)</span>
                  )}
                </p>
                {progress.isEarlyEstimate ? (
                  <p className="text-[10px] text-slate-900/30 mt-0.5">
                    Too early to predict, using your 12-week target
                  </p>
                ) : progress.predictedExchangeDate && !transaction.overridePredictedDate ? (
                  <p className="text-[10px] text-slate-900/30 mt-0.5">
                    Based on similar files, could shift by a week or two
                  </p>
                ) : null}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-900/40">Completion date</p>
            {exchangeConfirmed ? (
              <p className={`text-xs font-semibold ${transaction.completionDate ? "text-emerald-700" : "text-slate-900/40"}`}>
                {transaction.completionDate
                  ? new Date(transaction.completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  : "Not set"}
              </p>
            ) : (
              <p className="text-xs text-slate-900/30 italic">Awaiting exchange</p>
            )}
          </div>

          {progress.weeksRemaining !== null && !exchangeConfirmed && (() => {
            const t = formatTimeToExchange(progress.predictedExchangeDate ?? null, progress.weeksRemaining);
            return (
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-900/40">Time to exchange</p>
                <p className={`text-xs font-semibold ${t.amber ? "text-amber-600" : "text-slate-900/90"}`}>{t.text}</p>
              </div>
            );
          })()}

          {transaction.chainLinkId && !exchangeConfirmed && (
            <p style={{ fontSize: 10, color: "var(--agent-text-muted)", fontStyle: "italic", marginTop: 4 }}>
              Chain not factored. This prediction is for this sale alone.
            </p>
          )}

          {keyDates.length > 0 && (
            <div className="pt-3 border-t border-white/20">
              <p className="agent-sidebar-label mb-2">Key Dates</p>
              <div className="space-y-2">
                {keyDates.map((kd) => {
                  const isPast = kd.eventDate < new Date();
                  return (
                    <div key={kd.name} className="flex justify-between items-center">
                      <p className="text-xs text-slate-900/40 leading-snug">{kd.name}</p>
                      <p className={`text-xs font-semibold ${isPast ? "text-slate-900/40" : "text-slate-900/90"}`}>
                        {kd.eventDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {isPast && <span className="ml-1 text-xs text-slate-900/30">(past)</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Agent card */}
      {agentUser && (
        <Card padding="none" className="p-5">
          <p className="agent-sidebar-label mb-3">Agent</p>
          <p className="text-sm font-semibold text-slate-900/90">{agentUser.name}</p>
          {agentUser.firmName && <p className="text-xs text-slate-900/60">{agentUser.firmName}</p>}
          <p className="text-xs text-slate-900/40 mt-0.5">{agentUser.email}</p>
          {agentSlot && <div className="mt-3">{agentSlot}</div>}
        </Card>
      )}

      {/* Price & fees card */}
      <Card padding="none" className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <p className="agent-sidebar-label">Fee Breakdown</p>
          {canEditSaleDetails && (
            <button
              onClick={() => setShowEditDrawer(true)}
              className="text-xs agent-link"
            >
              {hideCommercialFields ? "Edit price" : "Edit details"}
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-900/40 max-w-[60%]">Purchase price</p>
            <p className="text-xs font-semibold text-slate-900/90">{formatPrice(transaction.purchasePrice) ?? "—"}</p>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-900/40 max-w-[60%]">Agent fee</p>
            <p className="text-xs font-semibold text-slate-900/90">{agentFeeValue}</p>
          </div>

          {((recommendedFirms != null && recommendedFirms.length > 0) || transaction.referredFirmName) && (
            <div className="flex justify-between items-center gap-3">
              <p className="text-xs text-slate-900/40 flex-shrink-0 max-w-[60%]">Solicitor referral</p>
              <p className="text-xs font-semibold text-slate-900/90 text-right">
                {transaction.referredFirmName
                  ? (transaction.referralFee != null ? formatFee(transaction.referralFee) : "—")
                  : "—"}
              </p>
            </div>
          )}

          {transaction.brokerFirmName && (
            <div className="flex justify-between items-center gap-3">
              <p className="text-xs text-slate-900/40 flex-shrink-0 max-w-[60%]">Broker referral</p>
              <p className="text-xs font-semibold text-slate-900/90 text-right">
                {transaction.brokerReferralFee != null ? formatFee(transaction.brokerReferralFee) : "—"}
              </p>
            </div>
          )}

          {showOurFee && ourFee.fee != null && (
            <div className="flex justify-between items-baseline gap-3">
              <p className="text-xs text-slate-900/40 flex-shrink-0 max-w-[60%]">Progressor fee</p>
              {transaction.freeOnExchange ? (
                <p
                  className="text-xs font-semibold text-right"
                  style={{ color: "var(--agent-coral)" }}
                  title="This sale was started during your free 14-day trial. No fee will be charged at exchange."
                >
                  Free during your trial
                </p>
              ) : (
                <p className="text-xs font-semibold text-slate-900/90 text-right">{ourFee.label}</p>
              )}
            </div>
          )}

          {hasTotal && (
            <div className="pt-2.5 mt-1" style={{ borderTop: "1px solid var(--agent-border-default)" }}>
              {grossTotalPence != null && (
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs text-slate-900/40 max-w-[60%]">Gross income</p>
                  <p className="text-xs font-semibold text-slate-900/50">{formatFee(grossTotalPence)}</p>
                </div>
              )}
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-900/40 max-w-[60%]">Net income</p>
                <p className="text-sm font-bold text-emerald-700">{formatFee(netTotalPence)}</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>

    {/* ── Mobile unified card — <768px ─────────────────────────────────────── */}
    <div className="md:hidden">
      <div className="agent-glass-strong overflow-hidden" style={{ borderRadius: "var(--agent-radius-xl)" }}>

        {/* Zone 1 — Trigger header (always visible) */}
        <div
          className="agent-acc-hdr"
          style={{ cursor: "pointer", padding: "14px 16px" }}
          role="button"
          tabIndex={0}
          onClick={() => setMobileOpen((o) => !o)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMobileOpen((o) => !o); } }}
          aria-expanded={mobileOpen}
          aria-label="File details"
        >
          {/* Top row: compact ring + pill + weeks dots column + chevron */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ProgressRing percent={progress.percent} size={44} strokeWidth={4} />
            <span className={`agent-pill ${TRACK_PILL[progress.onTrack]}`} style={{ flexShrink: 0 }} title={TRACK_TOOLTIP[progress.onTrack]}>
              {TRACK_LABEL[progress.onTrack]}
            </span>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: "var(--agent-text-muted)" }} />
                <span style={{ fontSize: 10, color: "var(--agent-text-muted)", lineHeight: 1 }}>
                  {formatElapsedDays(progress.daysElapsed, { compact: true })}
                </span>
              </div>
              {progress.weeksRemaining !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                    background: progress.onTrack === "on_track" ? "var(--agent-success)"
                      : progress.onTrack === "at_risk" ? "var(--agent-warning)"
                      : "var(--agent-danger)",
                  }} />
                  <span style={{ fontSize: 10, color: "var(--agent-text-muted)", lineHeight: 1 }}>
                    ~{progress.weeksRemaining} wk{progress.weeksRemaining !== 1 ? "s" : ""} to exchange
                  </span>
                </div>
              )}
            </div>
            <svg
              style={{
                width: 16, height: 16, color: "var(--agent-text-muted)", flexShrink: 0,
                transition: mobileOpen
                  ? "transform 200ms cubic-bezier(0.16,1,0.3,1)"
                  : "transform 150ms cubic-bezier(0.16,1,0.3,1)",
                transform: mobileOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Zone 2 — Accordion content */}
        <div className={`agent-acc${mobileOpen ? " open" : ""}`}>
          <div className="agent-acc-in">

            {/* Transaction stage */}
            {progress.fileLevelPhase && (
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--agent-border-default)" }}>
                <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>
                  Transaction stage: <span style={{ fontWeight: 600 }}>{PHASE_LABELS[progress.fileLevelPhase]}</span>
                </p>
              </div>
            )}

            {/* Time on file */}
            {fileTime && fileTime.totalSeconds > 0 && (
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--agent-border-default)" }}>
                <p className="agent-sidebar-label" style={{ marginBottom: 8 }}>Time on file</p>
                <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.2 }}>
                  {fmtTime(fileTime.totalSeconds)}
                </p>
                {isInternal && (
                  <div style={{ borderTop: "0.5px solid var(--agent-border-default)", paddingTop: 6, marginTop: 4, marginBottom: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                    <div className="flex justify-between items-center">
                      <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>Agent</p>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>
                        {fileTime.agentSeconds > 0 ? fmtTime(fileTime.agentSeconds) : "—"}
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>Our team</p>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>
                        {fileTime.teamSeconds > 0 ? fmtTime(fileTime.teamSeconds) : "—"}
                      </p>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {fileTime.hasLiveSession ? (
                    <>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "var(--agent-success)",
                        display: "inline-block", flexShrink: 0,
                        animation: "agent-pulse-dot 2s ease-in-out infinite",
                      }} />
                      <span style={{ fontSize: 11, color: "var(--agent-success)", fontWeight: 500 }}>Active now</span>
                    </>
                  ) : fileTime.lastActiveAt ? (
                    <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{fmtRelative(fileTime.lastActiveAt)}</span>
                  ) : null}
                </div>
              </div>
            )}

            {/* Exchange Forecast */}
            <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--agent-border-default)" }}>
              <p className="agent-sidebar-label" style={{ marginBottom: 10 }}>Exchange Forecast</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {!progress.isEarlyEstimate && (
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-900/40">12-week target</p>
                    <p className="text-xs font-semibold text-slate-900/90">
                      {progress.twelveWeekTarget
                        ? progress.twelveWeekTarget.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                        : "—"}
                    </p>
                  </div>
                )}
                {(transaction.overridePredictedDate || MEDIANS_READY) && (
                  <div className="flex justify-between items-start">
                    <p className="text-xs text-slate-900/40">Expected exchange</p>
                    <div className="text-right">
                      <p className={`text-xs font-semibold ${transaction.overridePredictedDate ? "text-blue-600" : "text-slate-900/90"}`}>
                        {progress.predictedExchangeDate
                          ? transaction.overridePredictedDate
                            ? progress.predictedExchangeDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                            : formatPredictedBand(progress.predictedExchangeDate)
                          : "—"}
                        {transaction.overridePredictedDate && (
                          <span className="ml-1 text-xs text-blue-500">(overridden)</span>
                        )}
                      </p>
                      {progress.isEarlyEstimate ? (
                        <p className="text-[10px] text-slate-900/30 mt-0.5">
                          Too early to predict, using your 12-week target
                        </p>
                      ) : progress.predictedExchangeDate && !transaction.overridePredictedDate ? (
                        <p className="text-[10px] text-slate-900/30 mt-0.5">
                          Based on similar files, could shift by a week or two
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-900/40">Completion date</p>
                  {exchangeConfirmed ? (
                    <p className={`text-xs font-semibold ${transaction.completionDate ? "text-emerald-700" : "text-slate-900/40"}`}>
                      {transaction.completionDate
                        ? new Date(transaction.completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                        : "Not set"}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-900/30 italic">Awaiting exchange</p>
                  )}
                </div>
                {progress.weeksRemaining !== null && !exchangeConfirmed && (() => {
                  const t = formatTimeToExchange(progress.predictedExchangeDate ?? null, progress.weeksRemaining);
                  return (
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-slate-900/40">Time to exchange</p>
                      <p className={`text-xs font-semibold ${t.amber ? "text-amber-600" : "text-slate-900/90"}`}>{t.text}</p>
                    </div>
                  );
                })()}
                {transaction.chainLinkId && !exchangeConfirmed && (
                  <p style={{ fontSize: 10, color: "var(--agent-text-muted)", fontStyle: "italic", marginTop: 4 }}>
                    Chain not factored. This prediction is for this sale alone.
                  </p>
                )}

                {keyDates.length > 0 && (
                  <div style={{ paddingTop: 10, marginTop: 2, borderTop: "0.5px solid var(--agent-border-default)" }}>
                    <p className="agent-sidebar-label" style={{ marginBottom: 8 }}>Key Dates</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {keyDates.map((kd) => {
                        const isPast = kd.eventDate < new Date();
                        return (
                          <div key={kd.name} className="flex justify-between items-center">
                            <p className="text-xs text-slate-900/40 leading-snug">{kd.name}</p>
                            <p className={`text-xs font-semibold ${isPast ? "text-slate-900/40" : "text-slate-900/90"}`}>
                              {kd.eventDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              {isPast && <span className="ml-1 text-xs text-slate-900/30">(past)</span>}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Agent */}
            {agentUser && (
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--agent-border-default)" }}>
                <p className="agent-sidebar-label" style={{ marginBottom: 8 }}>Agent</p>
                <p style={{ margin: "0 0 1px", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{agentUser.name}</p>
                {agentUser.firmName && (
                  <p style={{ margin: "0 0 1px", fontSize: 12, color: "var(--agent-text-secondary)" }}>{agentUser.firmName}</p>
                )}
                <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>{agentUser.email}</p>
                {agentSlot && <div style={{ marginTop: 10 }}>{agentSlot}</div>}
              </div>
            )}

            {/* Fee Breakdown */}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p className="agent-sidebar-label">Fee Breakdown</p>
                {canEditSaleDetails && (
                  <button onClick={() => setShowEditDrawer(true)} className="text-xs agent-link">
                    {hideCommercialFields ? "Edit price" : "Edit details"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-900/40 max-w-[60%]">Purchase price</p>
                  <p className="text-xs font-semibold text-slate-900/90">{formatPrice(transaction.purchasePrice) ?? "—"}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-900/40 max-w-[60%]">Agent fee</p>
                  <p className="text-xs font-semibold text-slate-900/90">{agentFeeValue}</p>
                </div>
                {((recommendedFirms != null && recommendedFirms.length > 0) || transaction.referredFirmName) && (
                  <div className="flex justify-between items-center gap-3">
                    <p className="text-xs text-slate-900/40 flex-shrink-0 max-w-[60%]">Solicitor referral</p>
                    <p className="text-xs font-semibold text-slate-900/90 text-right">
                      {transaction.referredFirmName
                        ? (transaction.referralFee != null ? formatFee(transaction.referralFee) : "—")
                        : "—"}
                    </p>
                  </div>
                )}
                {transaction.brokerFirmName && (
                  <div className="flex justify-between items-center gap-3">
                    <p className="text-xs text-slate-900/40 flex-shrink-0 max-w-[60%]">Broker referral</p>
                    <p className="text-xs font-semibold text-slate-900/90 text-right">
                      {transaction.brokerReferralFee != null ? formatFee(transaction.brokerReferralFee) : "—"}
                    </p>
                  </div>
                )}
                {showOurFee && ourFee.fee != null && (
                  <div className="flex justify-between items-baseline gap-3">
                    <p className="text-xs text-slate-900/40 flex-shrink-0 max-w-[60%]">Progressor fee</p>
                    <p className="text-xs font-semibold text-slate-900/90 text-right">{ourFee.label}</p>
                  </div>
                )}
                {hasTotal && (
                  <div style={{ paddingTop: 8, marginTop: 4, borderTop: "0.5px solid var(--agent-border-default)" }}>
                    {grossTotalPence != null && (
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs text-slate-900/40 max-w-[60%]">Gross income</p>
                        <p className="text-xs font-semibold text-slate-900/50">{formatFee(grossTotalPence)}</p>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-slate-900/40 max-w-[60%]">Net income</p>
                      <p className="text-sm font-bold text-emerald-700">{formatFee(netTotalPence)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>

    {/* Edit drawer — shared by both layouts */}
    {showEditDrawer && (
      <EditSaleDetailsDrawer
        transactionId={transaction.id}
        propertyAddress={transaction.propertyAddress}
        tenure={transaction.tenure ?? null}
        purchaseType={transaction.purchaseType ?? null}
        isShareOfFreehold={transaction.isShareOfFreehold}
        purchasePrice={transaction.purchasePrice ?? null}
        agentFeeAmount={transaction.agentFeeAmount ?? null}
        agentFeePercent={transaction.agentFeePercent ?? null}
        agentFeeIsVatInclusive={transaction.agentFeeIsVatInclusive ?? null}
        referralFee={transaction.referralFee ?? null}
        referredFirmName={transaction.referredFirmName ?? null}
        referredFirmId={transaction.referredFirmId ?? null}
        recommendedFirms={recommendedFirms}
        overridePredictedDate={transaction.overridePredictedDate ?? null}
        predictedExchangeDate={progress.predictedExchangeDate ?? null}
        completionDate={transaction.completionDate ?? null}
        exchangeConfirmed={exchangeConfirmed}
        hideCommercialFields={hideCommercialFields}
        onClose={() => setShowEditDrawer(false)}
      />
    )}
    </>
  );
}
