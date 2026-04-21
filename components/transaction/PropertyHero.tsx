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
};

const STATUS_STYLE: Record<TransactionStatus, { bg: string; dot: string; label: string }> = {
  active:    { bg: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30", dot: "bg-emerald-400", label: "Active" },
  on_hold:   { bg: "bg-amber-500/15 text-amber-300 ring-amber-400/30",       dot: "bg-amber-400",   label: "On Hold" },
  completed: { bg: "bg-blue-500/15 text-blue-300 ring-blue-400/30",          dot: "bg-blue-400",    label: "Completed" },
  withdrawn: { bg: "bg-gray-500/15 text-gray-400 ring-gray-400/30",          dot: "bg-gray-400",    label: "Withdrawn" },
};

const TRACK_BAR: Record<string, string> = {
  on_track: "bg-emerald-400",
  at_risk:  "bg-amber-400",
  off_track: "bg-red-400",
  unknown:  "bg-blue-400",
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
  address, agencyName, status, tenure, purchaseType, purchasePrice, exchangeDate, percent, onTrack, backHref = "/dashboard",
}: Props) {
  const [line1, ...rest] = address.split(",");
  const line2 = rest.join(",").trim();

  const statusStyle = STATUS_STYLE[status];
  const barColor = TRACK_BAR[onTrack];

  const days = exchangeDate ? daysUntil(new Date(exchangeDate)) : null;
  const price = formatPrice(purchasePrice);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0f1e38 0%, #0b1525 55%, #0d1f40 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Dot grid texture */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Subtle radial glow — top right */}
      <div
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative px-8 pt-6 pb-7">
        {/* Top row: back link + agency + status */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              {backHref === "/agent/dashboard" ? "My Files" : "Dashboard"}
            </Link>
            <span className="text-slate-600 text-xs">·</span>
            <span className="text-xs text-slate-500">{agencyName}</span>
          </div>

          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${statusStyle.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            {statusStyle.label}
          </span>
        </div>

        {/* Address */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">{line1}</h1>
          {line2 && <p className="text-sm text-slate-400 mt-0.5">{line2}</p>}
        </div>

        {/* Bottom row: pills + stats */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          {/* Left: pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {tenure && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 text-slate-300 ring-1 ring-white/10">
                {formatTenure(tenure)}
              </span>
            )}
            {purchaseType && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 text-slate-300 ring-1 ring-white/10">
                {formatPurchaseType(purchaseType)}
              </span>
            )}
            {price && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white ring-1 ring-white/10">
                {price}
              </span>
            )}
          </div>

          {/* Right: progress + countdown */}
          <div className="flex items-center gap-5">
            {days !== null && (
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-0.5">Exchange target</p>
                <p className={`text-sm font-semibold ${days < 0 ? "text-red-400" : days <= 14 ? "text-amber-400" : "text-slate-200"}`}>
                  {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days} days`}
                </p>
              </div>
            )}
            <div className="min-w-[120px]">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-slate-500">Progress</p>
                <p className="text-xs font-semibold text-white">{percent}%</p>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
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
