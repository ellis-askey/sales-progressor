"use client";

import Link from "next/link";
import type { TransactionStatus, Tenure, PurchaseType, ServiceType } from "@prisma/client";
import { StatusControl } from "./StatusControl";
import { formatDate } from "@/lib/utils";

type Props = {
  address: string;
  agencyName: string;
  status: TransactionStatus;
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  purchasePrice: number | null;
  exchangeDate: Date | null;
  percent: number;
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown" | "on_hold";
  serviceType?: ServiceType | null;
  backHref?: string;
  flagSlot?: React.ReactNode;
  assignedUserName?: string | null;
  createdAt?: Date | string | null;
  transactionId?: string;
  hideServiceTypeBadge?: boolean;
  /** Pass-through to StatusControl so the withdraw success toast can tail
   *  "— chain notified" only when the transaction is actually chain-linked. */
  inChain?: boolean;
};

const DARK_STATUS: Record<TransactionStatus, { bg: string; dot: string; label: string }> = {
  draft:     { bg: "bg-slate-500/15 text-slate-300 ring-slate-400/30",       dot: "bg-slate-400",   label: "Draft" },
  active:    { bg: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30", dot: "bg-emerald-400", label: "Active" },
  on_hold:   { bg: "bg-amber-500/15 text-amber-300 ring-amber-400/30",       dot: "bg-amber-400",   label: "On hold" },
  completed: { bg: "bg-blue-500/15 text-blue-300 ring-blue-400/30",          dot: "bg-blue-400",    label: "Completed" },
  withdrawn: { bg: "bg-gray-500/15 text-gray-400 ring-gray-400/30",          dot: "bg-gray-400",    label: "Withdrawn" },
};

const STATUS_PILL: Record<TransactionStatus, string> = {
  draft:     "",
  active:    "agent-pill-active",
  on_hold:   "agent-pill-hold",
  completed: "agent-pill-completed",
  withdrawn: "agent-pill-withdrawn",
};

const STATUS_LABEL: Record<TransactionStatus, string> = {
  draft: "Draft", active: "Active", on_hold: "On hold", completed: "Completed", withdrawn: "Withdrawn",
};

const TRACK_BAR: Record<string, string> = {
  on_track:  "bg-emerald-500",
  at_risk:   "bg-amber-400",
  off_track: "bg-red-500",
  unknown:   "bg-blue-400",
  on_hold:   "bg-slate-300", // neutral grey — file is frozen, no track signal
};

function formatPrice(pence: number | null): string | null {
  if (!pence) return null;
  return "£" + (pence / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function formatTenure(t: Tenure): string {
  return t === "leasehold" ? "Leasehold" : "Freehold";
}

function formatPurchaseType(p: PurchaseType): string {
  return { mortgage: "Mortgage", cash_buyer: "Cash buyer", cash_from_proceeds: "Cash from Proceeds" }[p] ?? p;
}

export function PropertyHero({
  address, agencyName, status, tenure, purchaseType, purchasePrice, exchangeDate, percent, onTrack, serviceType, backHref = "/dashboard", flagSlot, assignedUserName, createdAt, transactionId, hideServiceTypeBadge = false, inChain = false,
}: Props) {
  const [line1, ...rest] = address.split(",");
  const line2 = rest.join(",").trim();
  const barColor = TRACK_BAR[onTrack];
  const days = exchangeDate ? daysUntil(new Date(exchangeDate)) : null;
  const price = formatPrice(purchasePrice);
  // backHref="/agent/transactions" since 2026-05-12 merge; "/agent/dashboard" kept
  // for any legacy callers (now extinct in-tree but defensive against external use).
  const isAgent = backHref === "/agent/transactions" || backHref === "/agent/dashboard";

  if (isAgent) {
    const metaParts = [
      assignedUserName ?? null,
      createdAt != null ? `Added on ${formatDate(createdAt)}` : null,
    ].filter(Boolean);
    const metaText = metaParts.join(" · ");

    return (
      <div className="property-hero-glass" style={{
        background: "var(--agent-surface-elevated)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "0.5px solid var(--agent-border-default)",
        borderLeft: "0.5px solid var(--agent-border-default)",
        borderRight: "0.5px solid var(--agent-border-default)",
        borderBottom: "none",
        borderRadius: "14px 14px 0 0",
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <Link
              href={backHref}
              className="agent-link agent-link-muted"
              style={{ fontSize: 11, marginBottom: 8, display: "block", textDecoration: "none" }}
            >
              ← Back
            </Link>
            <h1
              data-sensitive="true"
              style={{ fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", margin: "0 0 8px", letterSpacing: "-0.015em", lineHeight: 1.2 }}
            >
              {address}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {transactionId
                ? <StatusControl transactionId={transactionId} currentStatus={status} inChain={inChain} />
                : <span className={`agent-pill ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
              }
              {tenure && (
                <span style={{ fontSize: 10, fontWeight: 500, color: "var(--agent-text-secondary)", background: "rgba(15,23,42,0.06)", borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>
                  {formatTenure(tenure)}
                </span>
              )}
              {purchaseType && (
                <span style={{ fontSize: 10, fontWeight: 500, color: "var(--agent-text-secondary)", background: "rgba(15,23,42,0.06)", borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>
                  {formatPurchaseType(purchaseType)}
                </span>
              )}
              {!hideServiceTypeBadge && serviceType === "self_managed" && (
                <span style={{ fontSize: 10, fontWeight: 500, color: "var(--agent-text-secondary)", background: "rgba(15,23,42,0.06)", borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>
                  Self-managed
                </span>
              )}
              {!hideServiceTypeBadge && serviceType === "outsourced" && (
                <span style={{ fontSize: 10, fontWeight: 500, color: "var(--agent-coral)", background: "rgba(var(--agent-coral-rgb), 0.1)", borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>
                  With progressor
                </span>
              )}
              {metaText && (
                <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{metaText}</span>
              )}
            </div>
          </div>
          {flagSlot}
        </div>
        <div style={{ height: 4, background: "rgba(30,45,74,0.08)", position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${Math.max(percent, 2)}%`,
            background: "linear-gradient(90deg, var(--agent-coral-deep), var(--agent-coral-light))",
            transition: "width 700ms ease-out",
          }} />
        </div>
      </div>
    );
  }

  // Dark (progressor) version — unchanged
  const statusStyle = DARK_STATUS[status];
  return (
    <div className="glass-panel-dark relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.045,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "80px 60px",
        }}
      />
      <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 65%)" }} />
      <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)" }} />

      <div className="relative px-8 pt-6 pb-8 animate-enter">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Dashboard
            </Link>
            <span className="text-slate-600 text-xs">·</span>
            <span className="text-xs text-slate-500 font-medium">{agencyName}</span>
          </div>
          <span className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full ring-1 ${statusStyle.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            {statusStyle.label}
          </span>
        </div>

        <div className="mb-5">
          <h1 data-sensitive="true" className="text-[2.125rem] font-bold text-white leading-tight tracking-tight">{line1}</h1>
          {line2 && <p data-sensitive="true" className="text-sm text-slate-400 mt-1 font-medium">{line2}</p>}
        </div>

        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            {price && <p data-sensitive="true" className="text-xl font-bold text-white tracking-tight mb-2.5">{price}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              {tenure && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/12 text-slate-200 ring-1 ring-white/25">
                  {formatTenure(tenure)}
                </span>
              )}
              {purchaseType && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/12 text-slate-200 ring-1 ring-white/25">
                  {formatPurchaseType(purchaseType)}
                </span>
              )}
              {!hideServiceTypeBadge && serviceType === "outsourced" && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/30">
                  Outsourced to us
                </span>
              )}
              {!hideServiceTypeBadge && serviceType === "self_managed" && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                  Self-managed
                </span>
              )}
            </div>
          </div>

          <div className="flex items-end gap-6">
            {days !== null && (
              <div className="text-right">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Exchange</p>
                <p className={`text-base font-bold tabular-nums ${
                  days < 0 ? "text-red-400" : days <= 14 ? "text-amber-400" : "text-slate-100"
                }`}>
                  {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`}
                </p>
              </div>
            )}
            <div className="min-w-[140px]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Progress</p>
                <p className="text-sm font-bold text-white tabular-nums">{percent}%</p>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.max(percent, 2)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
