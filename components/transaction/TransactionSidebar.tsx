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
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90" style={{ overflow: "visible" }}>
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
            filter: percent > 0 ? "drop-shadow(0 0 5px rgba(var(--agent-coral-rgb), 0.56))" : "none",
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
  fileTime?: { agentSeconds: number; teamSeconds: number; totalSeconds: number; lastActiveAt: Date | null; hasLiveSession: boolean };
  isInternal?: boolean;
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

export function TransactionSidebar({ transaction, assignedUser, agentUser, progress, keyDates = [], exchangeConfirmed = false, showOurFee = true, recommendedFirms, fileTime, isInternal = false }: Props) {
  const [showEditDrawer, setShowEditDrawer] = useState(false);

  const ourFee = assignedUser
    ? calculateOurFee(assignedUser.clientType, assignedUser.legacyFee, transaction.purchasePrice)
    : transaction.serviceType === "self_managed"
      ? { fee: 5900, label: "£59 inc. VAT" }
      : { fee: null, label: "" };

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

      {/* Time on file card */}
      {fileTime && fileTime.totalSeconds > 0 && (
        <div className="glass-card p-4">
          <p className="agent-sidebar-label mb-3">Time on file</p>

          {/* Headline total */}
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.2 }}>
            {fmtTime(fileTime.totalSeconds)}
          </p>

          {/* Internal split rows */}
          {isInternal && (
            <div style={{ borderTop: "1px solid rgba(15,23,42,0.07)", paddingTop: 8, marginBottom: 8, display: "flex", flexDirection: "column", gap: 5 }}>
              <div className="flex justify-between items-center">
                <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>You</p>
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

          {/* Activity line */}
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
              <p className="text-xs text-slate-900/30 italic">Awaiting exchange</p>
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
          <p className="agent-sidebar-label">Fee Breakdown</p>
          <button
            onClick={() => setShowEditDrawer(true)}
            className="text-xs agent-link"
          >
            Edit details
          </button>
        </div>

        <div className="space-y-2">
          {/* Purchase price */}
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-900/40 max-w-[60%]">Purchase price</p>
            <p className="text-xs font-semibold text-slate-900/90">{formatPrice(transaction.purchasePrice) ?? "—"}</p>
          </div>

          {/* Agent fee */}
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-900/40 max-w-[60%]">Agent fee</p>
            <p className="text-xs font-semibold text-slate-900/90">
              {transaction.agentFeeAmount
                ? `${formatFee(transaction.agentFeeAmount)}${transaction.agentFeeIsVatInclusive === false ? " + VAT" : transaction.agentFeeIsVatInclusive === true ? " inc VAT" : ""}`
                : transaction.agentFeePercent
                  ? `${Number(transaction.agentFeePercent).toFixed(2)}%${transaction.agentFeeIsVatInclusive === false ? " + VAT" : ""}${transaction.purchasePrice ? ` = ${formatFee(Math.round(transaction.purchasePrice * Number(transaction.agentFeePercent) / 100))}` : ""}`
                  : "—"}
            </p>
          </div>

          {/* Solicitor referral fee */}
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

          {/* Broker referral fee */}
          {transaction.brokerFirmName && (
            <div className="flex justify-between items-center gap-3">
              <p className="text-xs text-slate-900/40 flex-shrink-0 max-w-[60%]">Broker referral</p>
              <p className="text-xs font-semibold text-slate-900/90 text-right">
                {transaction.brokerReferralFee != null ? formatFee(transaction.brokerReferralFee) : "—"}
              </p>
            </div>
          )}

          {/* Progressor fee */}
          {showOurFee && ourFee.fee != null && (
            <div className="flex justify-between items-baseline gap-3">
              <p className="text-xs text-slate-900/40 flex-shrink-0 max-w-[60%]">Progressor fee</p>
              <p className="text-xs font-semibold text-slate-900/90 text-right">{ourFee.label}</p>
            </div>
          )}

          {/* Net income */}
          {hasTotal && (
            <div className="pt-2.5 mt-1" style={{ borderTop: "1px solid rgba(15,23,42,0.08)" }}>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-900/40 max-w-[60%]">Net income</p>
                <p className="text-sm font-bold text-emerald-700">{formatFee(totalFeesPence)}</p>
              </div>
              {transaction.agentFeeIsVatInclusive === false && (
                <p className="text-xs text-slate-900/40 mt-0.5">Agent fee excludes VAT</p>
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
