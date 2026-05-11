"use client";
// components/transaction/TransactionSidebar.tsx
// Shows purchase price, fees, progress, and exchange prediction.

function ProgressRing({ percent }: { percent: number }) {
  const r = 28;
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

  return (
    <div className="relative flex-shrink-0 w-[72px] h-[72px]">
      <style>{`
        @keyframes ring-glow-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.78; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ring-glow { animation: none; }
        }
      `}</style>
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(160,120,80,0.18)" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="ring-glow"
          style={{
            stroke: "var(--agent-coral-deep)",
            transition: prefersRM ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)",
            filter: percent > 0 ? "drop-shadow(0 0 5px rgba(255,107,74,0.56))" : "none",
            animation: percent > 0 ? "ring-glow-pulse 3s ease-in-out infinite" : "none",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[15px] font-bold text-slate-900/80 leading-none">{percent}%</span>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { formatPrice, formatFee, calculateOurFee } from "@/lib/services/fees";
import { EditSaleDetailsDrawer } from "@/components/transaction/EditSaleDetailsDrawer";
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
  };
  recommendedFirms?: { id: string; name: string; defaultReferralFeePence: number | null }[] | null;
  assignedUser: {
    clientType: ClientType;
    legacyFee: number | null;
  } | null;
  agentUser?: { id: string; name: string; email: string; firmName: string | null } | null;
  progress: ProgressResult;
  keyDates?: KeyDate[];
  exchangeConfirmed?: boolean;
  showOurFee?: boolean;
};

export function TransactionSidebar({ transaction, assignedUser, agentUser, progress, keyDates = [], exchangeConfirmed = false, showOurFee = true, recommendedFirms }: Props) {
  const [showEditDrawer, setShowEditDrawer] = useState(false);

  const ourFee = assignedUser
    ? calculateOurFee(assignedUser.clientType, assignedUser.legacyFee, transaction.purchasePrice)
    : transaction.serviceType === "self_managed"
      ? { fee: 5900, label: "Self-managed · £59 inc. VAT" }
      : { fee: null, label: "No progressor assigned" };

  const agentFeeCalcPence: number | null =
    transaction.agentFeeAmount != null
      ? transaction.agentFeeAmount
      : transaction.agentFeePercent != null && transaction.purchasePrice != null
        ? Math.round(transaction.purchasePrice * Number(transaction.agentFeePercent) / 100)
        : null;

  const progressorFeePence = showOurFee && ourFee.fee != null ? ourFee.fee : 0;
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
  const TRACK_LABEL: Record<string, string> = {
    on_track:  "On track",
    at_risk:   "At risk",
    off_track: "Off track",
    unknown:   "No data yet",
  };

  return (
    <>
    <div className="space-y-4">

      {/* Progress card */}
      <div className="glass-card p-4">
        <p className="agent-sidebar-label mb-4">Progress</p>

        <div className="flex items-center gap-4">
          <ProgressRing percent={progress.percent} />

          <div className="flex-1 space-y-2">
            <span className={`agent-pill ${TRACK_PILL[progress.onTrack]}`}>
              {TRACK_LABEL[progress.onTrack]}
            </span>
            <p className="text-xs text-slate-900/40">
              {progress.weeksElapsed} week{progress.weeksElapsed !== 1 ? "s" : ""} elapsed
            </p>
          </div>
        </div>
      </div>

      {/* Exchange dates card */}
      <div className="glass-card px-4 py-3">
        <p className="agent-sidebar-label mb-4">Exchange Forecast</p>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-900/40">12-week target</p>
            <p className="text-xs font-semibold text-slate-900/90">
              {progress.twelveWeekTarget
                ? progress.twelveWeekTarget.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : "—"}
            </p>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-900/40">Expected exchange</p>
            <p className={`text-xs font-semibold ${transaction.overridePredictedDate ? "text-blue-600" : "text-slate-900/90"}`}>
              {progress.predictedExchangeDate
                ? progress.predictedExchangeDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : "—"}
              {transaction.overridePredictedDate && (
                <span className="ml-1 text-xs text-blue-500">(overridden)</span>
              )}
            </p>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-900/40">Completion date</p>
            {exchangeConfirmed ? (
              <p className={`text-xs font-semibold ${transaction.completionDate ? "text-emerald-700" : "text-slate-900/40"}`}>
                {transaction.completionDate
                  ? new Date(transaction.completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  : "Not set"}
              </p>
            ) : (
              <p className="text-xs text-slate-900/30 italic">Set once exchange is confirmed</p>
            )}
          </div>

          {progress.weeksRemaining !== null && (
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-900/40">Weeks to exchange</p>
              <p className={`text-xs font-semibold ${
                progress.weeksRemaining < 0 ? "text-red-600" :
                progress.weeksRemaining <= 2 ? "text-amber-600" : "text-slate-900/90"
              }`}>
                {progress.weeksRemaining < 0
                  ? `${Math.abs(progress.weeksRemaining)} weeks overdue`
                  : `~${progress.weeksRemaining} weeks`}
              </p>
            </div>
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
      </div>

      {/* Agent card */}
      {agentUser && (
        <div className="glass-card p-5">
          <p className="agent-sidebar-label mb-3">Agent</p>
          <p className="text-sm font-semibold text-slate-900/90">{agentUser.name}</p>
          {agentUser.firmName && <p className="text-xs text-slate-900/60">{agentUser.firmName}</p>}
          <p className="text-xs text-slate-900/40 mt-0.5">{agentUser.email}</p>
        </div>
      )}

      {/* Price & fees card */}
      <div className="glass-card px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <p className="agent-sidebar-label">Price &amp; Fees</p>
          <button
            onClick={() => setShowEditDrawer(true)}
            className="text-xs agent-link"
          >
            Edit details
          </button>
        </div>

        <div className="space-y-3">
          {/* Purchase price */}
          <div>
            <p className="text-xs text-slate-900/40 mb-1">Purchase price</p>
            <p className="text-sm font-bold text-slate-900/90">{formatPrice(transaction.purchasePrice)}</p>
          </div>

          {/* Tenure + purchase type */}
          <div className="flex items-center gap-2 flex-wrap">
            {transaction.tenure && (
              <span className="glass-subtle text-xs text-slate-900/70 px-2.5 py-0.5 font-medium capitalize">
                {transaction.tenure}
              </span>
            )}
            {transaction.purchaseType && (
              <span className="glass-subtle text-xs text-slate-900/70 px-2.5 py-0.5 font-medium capitalize">
                {transaction.purchaseType.replace(/_/g, " ")}
              </span>
            )}
          </div>

          {/* Agent fee */}
          <div className="pt-2 border-t border-white/20">
            <p className="text-xs text-slate-900/40 mb-0.5">Agent fee</p>
            {transaction.agentFeeAmount ? (
              <p className="text-sm font-semibold text-slate-900/90">
                {formatFee(transaction.agentFeeAmount)}
                {transaction.agentFeeIsVatInclusive !== null && (
                  <span className="ml-1 text-xs text-slate-900/40">
                    {transaction.agentFeeIsVatInclusive ? "inc VAT" : "+ VAT"}
                  </span>
                )}
              </p>
            ) : transaction.agentFeePercent ? (
              <p className="text-sm font-semibold text-slate-900/90">
                {Number(transaction.agentFeePercent).toFixed(2)}%
                {transaction.agentFeeIsVatInclusive !== null && (
                  <span className="ml-1 text-xs text-slate-900/40">
                    {transaction.agentFeeIsVatInclusive ? "inc VAT" : "+ VAT"}
                  </span>
                )}
                {transaction.purchasePrice && (
                  <span className="ml-1 text-xs text-slate-900/50">
                    = {formatFee(Math.round(transaction.purchasePrice * Number(transaction.agentFeePercent) / 100))}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-slate-900/30 italic">Not set</p>
            )}
          </div>

          {/* Solicitor referral fee */}
          {((recommendedFirms != null && recommendedFirms.length > 0) || transaction.referredFirmName) && (
            <div className="pt-2 border-t border-white/20">
              <p className="text-xs text-slate-900/40 mb-0.5">Solicitor referral</p>
              {transaction.referredFirmName ? (
                <>
                  <p className="text-sm font-semibold text-slate-900/90">
                    {transaction.referralFee != null ? formatFee(transaction.referralFee) : "No fee set"}
                  </p>
                  <p className="text-xs text-slate-900/40">{transaction.referredFirmName}</p>
                </>
              ) : (
                <p className="text-sm text-slate-900/30 italic">Not set</p>
              )}
            </div>
          )}

          {/* Broker referral fee */}
          {transaction.brokerFirmName && (
            <div className="pt-2 border-t border-white/20">
              <p className="text-xs text-slate-900/40 mb-0.5">Broker referral</p>
              <p className="text-sm font-semibold text-slate-900/90">
                {transaction.brokerReferralFee != null ? formatFee(transaction.brokerReferralFee) : "No fee set"}
              </p>
              <p className="text-xs text-slate-900/40">{transaction.brokerFirmName}</p>
            </div>
          )}

          {/* Progressor fee */}
          {showOurFee && (
            <div className="pt-2 border-t border-white/20">
              <p className="text-xs text-slate-900/40 mb-0.5">Progressor fee</p>
              <p className="text-sm font-bold text-slate-900/90">{formatFee(ourFee.fee)}</p>
              <p className="text-xs text-slate-900/40">{ourFee.label}</p>
            </div>
          )}

          {/* Total */}
          {hasTotal && (
            <div className="pt-3 mt-1 border-t-2 border-white/40">
              <p className="text-xs text-slate-900/40 mb-0.5">Net income</p>
              <p className="text-base font-bold text-emerald-700">{formatFee(totalFeesPence)}</p>
              {transaction.agentFeeIsVatInclusive === false && (
                <p className="text-xs text-slate-900/40">Agent fee excludes VAT</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {showEditDrawer && (
      <EditSaleDetailsDrawer
        transactionId={transaction.id}
        propertyAddress={transaction.propertyAddress}
        tenure={transaction.tenure ?? null}
        purchaseType={transaction.purchaseType ?? null}
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
        onClose={() => setShowEditDrawer(false)}
      />
    )}
    </>
  );
}
