"use client";

import Link from "next/link";
import type { TransactionStatus, Tenure, PurchaseType } from "@prisma/client";

type Props = {
  address: string;
  agencyName: string;
  status: TransactionStatus;
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  purchasePrice: number | null;
  exchangeDate: Date | null;
  percent: number;
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown";
  backHref?: string;
  flagSlot?: React.ReactNode;
};

const DARK_STATUS: Record<TransactionStatus, { bg: string; dot: string; label: string }> = {
  active:    { bg: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30", dot: "bg-emerald-400", label: "Active" },
  on_hold:   { bg: "bg-amber-500/15 text-amber-300 ring-amber-400/30",       dot: "bg-amber-400",   label: "On Hold" },
  completed: { bg: "bg-blue-500/15 text-blue-300 ring-blue-400/30",          dot: "bg-blue-400",    label: "Completed" },
  withdrawn: { bg: "bg-gray-500/15 text-gray-400 ring-gray-400/30",          dot: "bg-gray-400",    label: "Withdrawn" },
};

const WARM_STATUS: Record<TransactionStatus, { dot: string; text: string; bg: string }> = {
  active:    { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50/90" },
  on_hold:   { dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50/90"   },
  completed: { dot: "bg-blue-500",    text: "text-blue-700",    bg: "bg-blue-50/90"    },
  withdrawn: { dot: "bg-gray-400",    text: "text-gray-600",    bg: "bg-gray-100/80"   },
};

const STATUS_LABEL: Record<TransactionStatus, string> = {
  active: "Active", on_hold: "On Hold", completed: "Completed", withdrawn: "Withdrawn",
};

const TRACK_BAR: Record<string, string> = {
  on_track:  "bg-emerald-500",
  at_risk:   "bg-amber-400",
  off_track: "bg-red-500",
  unknown:   "bg-blue-400",
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
  return { mortgage: "Mortgage", cash: "Cash", cash_from_proceeds: "Cash from Proceeds" }[p] ?? p;
}

export function PropertyHero({
  address, agencyName, status, tenure, purchaseType, purchasePrice, exchangeDate, percent, onTrack, backHref = "/dashboard", flagSlot,
}: Props) {
  const [line1, ...rest] = address.split(",");
  const line2 = rest.join(",").trim();
  const barColor = TRACK_BAR[onTrack];
  const days = exchangeDate ? daysUntil(new Date(exchangeDate)) : null;
  const price = formatPrice(purchasePrice);
  const isAgent = backHref === "/agent/dashboard";

  if (isAgent) {
    const ws = WARM_STATUS[status];
    return (
      <div style={{
        background: "rgba(255,255,255,0.58)",
        backdropFilter: "blur(32px) saturate(180%)",
        WebkitBackdropFilter: "blur(32px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.72)",
        boxShadow: "0 6px 36px rgba(255,138,101,0.09), 0 1px 0 rgba(255,255,255,0.85) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Coral bloom — top right */}
        <div aria-hidden="true" style={{ position: "absolute", top: -90, right: -60, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,101,0.20) 0%, transparent 70%)", pointerEvents: "none" }} />
        {/* Warm yellow — bottom left */}
        <div aria-hidden="true" style={{ position: "absolute", bottom: -60, left: -20, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,210,80,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        {/* Lavender centre accent */}
        <div aria-hidden="true" style={{ position: "absolute", top: "20%", left: "35%", width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,150,210,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", padding: "20px 32px 26px" }}>
          {/* Breadcrumb + status */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link
                href={backHref}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--agent-text-tertiary)", textDecoration: "none", fontWeight: 500 }}
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                My Files
              </Link>
              <span style={{ color: "var(--agent-border-subtle)", fontSize: 14 }}>·</span>
              <span style={{ fontSize: 12, color: "var(--agent-text-muted)", fontWeight: 500 }}>{agencyName}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {flagSlot}
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ring-1 ring-inset ring-black/5 ${ws.bg} ${ws.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ws.dot}`} />
                {STATUS_LABEL[status]}
              </span>
            </div>
          </div>

          {/* Address */}
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.025em", lineHeight: 1.1 }}>{line1}</h1>
            {line2 && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-tertiary)", fontWeight: 500 }}>{line2}</p>}
          </div>

          {/* Bottom row: price/pills + exchange/progress */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <div>
              {price && (
                <p style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.015em" }}>{price}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {tenure && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.65)", color: "var(--agent-text-secondary)", border: "0.5px solid rgba(180,130,90,0.20)" }}>
                    {formatTenure(tenure)}
                  </span>
                )}
                {purchaseType && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.65)", color: "var(--agent-text-secondary)", border: "0.5px solid rgba(180,130,90,0.20)" }}>
                    {formatPurchaseType(purchaseType)}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 28, flexShrink: 0 }}>
              {days !== null && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 700, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Exchange</p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: days < 0 ? "var(--agent-danger)" : days <= 14 ? "var(--agent-warning)" : "var(--agent-text-primary)" }}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`}
                  </p>
                </div>
              )}
              <div style={{ minWidth: 150 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Progress</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{percent}%</p>
                </div>
                <div style={{ height: 8, background: "rgba(180,130,90,0.15)", borderRadius: 999, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)" }}>
                  <div
                    className={barColor}
                    style={{ height: "100%", borderRadius: 999, transition: "width 0.65s cubic-bezier(0.34,1.3,0.64,1)", width: `${Math.max(percent, 2)}%`, position: "relative", overflow: "hidden" }}
                  >
                    <div aria-hidden="true" style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.52) 50%, transparent 100%)",
                      animation: "hero-bar-shimmer 3s ease-in-out infinite",
                    }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <style>{`
          @keyframes hero-bar-shimmer {
            0%, 100% { transform: translateX(-100%); }
            40%, 60% { transform: translateX(250%); }
          }
        `}</style>
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
          <h1 className="text-[2.125rem] font-bold text-white leading-tight tracking-tight">{line1}</h1>
          {line2 && <p className="text-sm text-slate-400 mt-1 font-medium">{line2}</p>}
        </div>

        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            {price && <p className="text-xl font-bold text-white tracking-tight mb-2.5">{price}</p>}
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
