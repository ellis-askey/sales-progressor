"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { TransactionStatus, Tenure, PurchaseType, ServiceType } from "@prisma/client";
import { HouseSimple } from "@phosphor-icons/react/dist/ssr";
import { StatusControl } from "./StatusControl";
import { SwitchServiceTypeModal } from "./SwitchServiceTypeModal";
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
  // Phase 1 commit 8 — slot for the round chip (alongside status +
  // service-type badges in the hero's badge row). Rendered as-is so
  // PropertyHero stays unaware of round semantics.
  roundChipSlot?: React.ReactNode;
  assignedUserName?: string | null;
  createdAt?: Date | string | null;
  transactionId?: string;
  hideServiceTypeBadge?: boolean;
  /** Pass-through to StatusControl so the withdraw success toast can tail
   *  " chain notified" only when the transaction is actually chain-linked. */
  inChain?: boolean;
  /** When true, the service-type pill becomes an interactive control that
   *  reveals a swap icon on hover and opens a confirm-and-switch modal.
   *  Set from the page-level `hasAdminPowers(session)` check. */
  isAdminViewer?: boolean;
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
  on_hold:   "bg-slate-300", // neutral grey  file is frozen, no track signal
};

const TRACK_PILL: Record<string, { label: string; color: string; bg: string }> = {
  on_track:  { label: "On track",   color: "#047857", bg: "rgba(16, 185, 129, 0.14)" },
  at_risk:   { label: "At risk",    color: "#b45309", bg: "rgba(245, 158, 11, 0.14)" },
  off_track: { label: "Off track",  color: "#b91c1c", bg: "rgba(220, 38, 38, 0.14)"  },
  unknown:   { label: "Just started", color: "#1d4ed8", bg: "rgba(59, 130, 246, 0.12)" },
  on_hold:   { label: "On hold",    color: "#475569", bg: "rgba(100, 116, 139, 0.14)" },
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

function formatElapsed(from: Date): string {
  const now = new Date();
  const days = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86400000));
  const weeks = Math.floor(days / 7);
  const remDays = days - weeks * 7;
  if (weeks === 0) {
    if (days === 0) return "Landed today";
    return days === 1 ? "1 day elapsed" : `${days} days elapsed`;
  }
  const weekLabel = weeks === 1 ? "1 week" : `${weeks} weeks`;
  if (remDays === 0) return `${weekLabel} elapsed`;
  const dayLabel = remDays === 1 ? "1 day" : `${remDays} days`;
  return `${weekLabel} ${dayLabel} elapsed`;
}

// Inline progress ring for the hero. Kept private to PropertyHero so the
// sidebar's ring (which lives in TransactionSidebar) stays untouched
// during this migration.
function HeroProgressRing({ percent, size = 72 }: { percent: number; size?: number }) {
  const strokeWidth = size >= 64 ? 5 : 4;
  const r = size / 2 - strokeWidth - 2;
  const circ = 2 * Math.PI * r;
  const target = circ * (1 - Math.min(100, Math.max(0, percent)) / 100);

  const [mounted, setMounted] = useState(false);
  const [offset, setOffset] = useState(circ);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const prefersRM = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(prefersRM);
    setMounted(true);
    if (prefersRM) {
      setOffset(target);
      return;
    }
    setOffset(circ);
    const t = setTimeout(() => setOffset(target), 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)", overflow: "visible" }}
      >
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(160, 120, 80, 0.18)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="var(--agent-coral-deep)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={mounted ? offset : circ}
          style={{
            transition: reduced ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)",
            filter: percent > 0 ? "drop-shadow(0 0 6px rgba(var(--agent-coral-rgb), 0.5))" : "none",
          }}
        />
      </svg>
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <span style={{
          fontSize: size >= 64 ? 15 : 12,
          fontWeight: 700,
          color: "var(--agent-text-primary)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
        }}>{percent}%</span>
      </div>
    </div>
  );
}

export function PropertyHero({
  address, agencyName, status, tenure, purchaseType, purchasePrice, exchangeDate, percent, onTrack, serviceType, backHref = "/dashboard", flagSlot, roundChipSlot, assignedUserName, createdAt, transactionId, hideServiceTypeBadge = false, inChain = false, isAdminViewer = false,
}: Props) {
  const [line1, ...rest] = address.split(",");
  const line2 = rest.join(",").trim();
  const barColor = TRACK_BAR[onTrack];
  const days = exchangeDate ? daysUntil(new Date(exchangeDate)) : null;
  const price = formatPrice(purchasePrice);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const canSwitchService = isAdminViewer && !!transactionId && !!serviceType && !hideServiceTypeBadge;
  const isAgent = backHref === "/agent/transactions" || backHref === "/agent/dashboard";

  if (isAgent) {
    // ─────────────────────────────────────────────────────────────────
    // Agent path (light warm cream + coral).
    // 2026-07-03 Overview-restyle rewrite: house glyph on the left, big
    // progress ring on the right, pills row between address + agent
    // meta, stat row (Sale price / Sale type / Progress %) along the
    // bottom edge in place of the old 4px coral bar. Hero is shared
    // page shell — visible on every tab.
    // ─────────────────────────────────────────────────────────────────
    const elapsedText = createdAt ? formatElapsed(new Date(createdAt)) : null;
    const metaParts = [
      assignedUserName ?? null,
      createdAt != null ? `Added ${formatDate(createdAt)}` : null,
      elapsedText,
    ].filter(Boolean);
    const metaText = metaParts.join(" · ");

    // 2026-07-06 pass 3 — page-level structural redesign.
    // Hero renders on the peachy backdrop with:
    //   - Left: large property icon tile + title (32/700) + address
    //     (16/500) + status/tenure/purchase-type/service pills + agent
    //     meta (14/muted).
    //   - Right: ring wrapped in its OWN soft-elevated container so it
    //     reads as a component, not a floating element.
    // Stat row lifted OUT to TransactionStatsStrip (Zone 2). Ring
    // container padding/proportions tuned so the whole hero baseline
    // aligns with the sidebar rhythm.
    return (
      <div className="animate-enter" style={{
        position: "relative",
        background: "transparent",
        overflow: "visible",
      }}>
        {/* Back link row */}
        <div style={{ padding: "8px 4px 0" }}>
          <Link
            href={backHref}
            className="agent-link agent-link-muted"
            style={{ fontSize: 11, display: "inline-block", textDecoration: "none" }}
          >
            ← Back to files
          </Link>
        </div>

        {/* Main row: property icon tile + title column + ring
            Desktop: tile on left, title column, ring on right.
            Mobile (< md): tile hidden, ring replaces it in the top-left
            slot, title column takes the rest of the row width. Right
            ring hidden. Everything below (address, pills, meta) flows
            full-width below the ring on mobile. */}
        <div className="agent-hero-row" style={{
          position: "relative",
          padding: "8px 4px 0",
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}>
          {/* Desktop-only property icon tile */}
          <div className="hidden md:flex" style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: "linear-gradient(135deg, rgba(var(--agent-coral-rgb), 0.16) 0%, rgba(var(--agent-coral-rgb), 0.06) 100%)",
            border: "0.5px solid rgba(var(--agent-coral-rgb), 0.20)",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--agent-coral-deep)",
            flexShrink: 0,
          }}>
            <HouseSimple size={28} weight="regular" />
          </div>

          {/* Mobile-only ring - sits in the tile's slot. Small (56px)
              so it doesn't dominate. No caption underneath (elapsed is
              in the meta line now). */}
          <div className="md:hidden" style={{ flexShrink: 0 }}>
            <HeroProgressRing percent={percent} size={56} />
          </div>

          {/* Title column */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <h1
              data-sensitive="true"
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--agent-text-primary)",
                margin: "0 0 2px",
                letterSpacing: "-0.015em",
                lineHeight: 1.25,
              }}
            >
              {line1}
            </h1>
            {line2 && (
              <p
                data-sensitive="true"
                style={{
                  margin: "0 0 10px",
                  fontSize: 13,
                  color: "var(--agent-text-muted)",
                  lineHeight: 1.35,
                }}
              >
                {line2}
              </p>
            )}

            {/* Pills row */}
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
              {!hideServiceTypeBadge && serviceType && (() => {
                const isSelf = serviceType === "self_managed";
                const label = isSelf ? "Self-managed" : "With progressor";
                const baseStyle: React.CSSProperties = {
                  fontSize: 10,
                  fontWeight: 500,
                  color: isSelf ? "var(--agent-text-secondary)" : "var(--agent-coral)",
                  background: isSelf ? "rgba(15,23,42,0.06)" : "rgba(var(--agent-coral-rgb), 0.1)",
                  borderRadius: 6,
                  padding: "2px 7px",
                  whiteSpace: "nowrap",
                };
                if (!canSwitchService) {
                  return <span style={baseStyle}>{label}</span>;
                }
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setSwitchModalOpen(true)}
                      title={isSelf ? "Switch to outsourced" : "Switch to self-progress"}
                      className="v2-swap-btn group"
                      style={{
                        ...baseStyle,
                        border: "none",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontFamily: "inherit",
                      }}
                    >
                      {label}
                      <span className="v2-swap-arrow opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
                        ⇄
                      </span>
                    </button>
                    {transactionId && (
                      <SwitchServiceTypeModal
                        open={switchModalOpen}
                        transactionId={transactionId}
                        current={serviceType}
                        onClose={() => setSwitchModalOpen(false)}
                      />
                    )}
                  </>
                );
              })()}
              {roundChipSlot}
            </div>

            {/* Agent meta - Ellis Askey · Added on 20 May 2026 */}
            {metaText && (
              <p style={{
                margin: "10px 0 0",
                fontSize: 12,
                color: "var(--agent-text-muted)",
                lineHeight: 1.4,
              }}>{metaText}</p>
            )}
          </div>

          {/* Desktop-only ring on the right. Elapsed caption removed -
              it lives in the meta line above so we don't render it
              twice. On-track signal lives in the Sale health card. */}
          <div className="hidden md:flex" style={{
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            flexShrink: 0,
          }}>
            <HeroProgressRing percent={percent} />
          </div>

          {flagSlot}
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

