"use client";

// Overview restyle 2026-07-03 — new agent-side sidebar for the file
// detail page. Renders 5 stacked cards matching the mock:
//
//   1. Sale health   - status glyph + progress bar + time on file +
//                      current stage + risk level + "View health details"
//   2. Key dates     - exchange forecast + completion forecast + weeks
//                      to exchange + "View full forecast"
//   3. Agent         - owner name + firm + email + "Message agent"
//                      button (hidden when the viewer IS the agent)
//   4. Fees          - purchase price + agent fee + progressor fee +
//                      total. Edit link if allowed.
//   5. Quick links   - Open in client portal / View file documents /
//                      Send secure message
//
// The old TransactionSidebar.tsx remains in place for the internal
// dashboard file page (/transactions/[id]) to avoid churning that
// surface. The two implementations will converge later.

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildCheckInMessage, type DueStep } from "@/lib/chase/step-questions";
import { markStepsChasedAction } from "@/app/actions/tasks";
import { formatPrice, formatFee, calculateOurFee } from "@/lib/services/fees";
import { sendQuoteLinkToBuyerAction } from "@/app/actions/send-quote-link";
import { formatElapsedDays } from "@/lib/utils";
import { formatPredictedBand } from "@/lib/utils/format-predicted-band";
import { formatTimeToExchange } from "@/lib/utils/format-time-to-exchange";
import { MEDIANS_READY } from "@/lib/services/milestone-staleness";
import { AgentFeeInline } from "@/components/transaction/AgentFeeInline";
import { StampDutyQuickAction } from "@/components/transaction/StampDutyDrawer";
import { CompletionDateInline } from "@/components/transaction/CompletionDateInline";
import { useTabContext } from "@/components/transaction/TabContext";
import { calculateRiskScore, RISK_CONFIG, type RiskInput } from "@/lib/services/risk";
import { Heartbeat, CalendarBlank, Storefront, CurrencyGbp, Link as LinkIcon, ArrowSquareOut, EnvelopeSimple, FolderSimple, PaperPlaneTilt, Wrench, CopySimple, Check, ArrowClockwise } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
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
  // Internal staff (SP/admin/superadmin) see the agent vs our-team time split.
  isInternal?: boolean;
  canEditSaleDetails?: boolean;
  hideCommercialFields?: boolean;
  agentSlot?: React.ReactNode;
  // Optional risk input; when supplied the Sale health card renders the
  // Low / Medium / High badge. When not supplied that row is hidden.
  riskInput?: RiskInput | null;
  // Session viewer id used to hide the "Message agent" button when the
  // viewer IS the owner agent (self-mail is a no-op).
  currentUserId?: string | null;
  // For the "Open in client portal" quick link — the first vendor
  // contact with a portal token. If unset, the link is hidden.
  primaryPortalHref?: string | null;
  // 2026-07-06 mock: Last activity timestamp on the file, shown as a
  // relative-time row in the Sale health card.
  lastActivityAt?: Date | null;
  // 2026-08-19: WhatsApp check-in copy (quick links). Each side carries
  // its outstanding-step questions (firm name pre-interpolated) plus the
  // client headcount for the group greeting; the message itself is built
  // at click time so the greeting matches the agent's clock. A side with
  // no due steps hides its row. transactionId feeds the one-tap
  // mark-as-chased follow-up.
  checkIn?: {
    transactionId: string;
    seller: CheckInSide;
    buyer: CheckInSide;
  };
};

type CheckInSide = { steps: DueStep[]; clientCount: number };

const PHASE_LABELS: Record<string, string> = {
  onboarding:   "Onboarding",
  conveyancing: "Conveyancing",
  pre_exchange: "Exchange",
  post_exchange: "Exchanged",
};

// Local Risk-level labels for the Sale-health row.
// RISK_CONFIG.low.label = "On track" globally (used by RiskScoreWidget and
// RiskBadgeWithPopover), but here we want the risk level to read Low /
// Medium / High so it doesn't duplicate the file's on-track pill at the
// top of the same card. Scoped override, no global change.
const RISK_LEVEL_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const TRACK_HEALTH: Record<string, { label: string; blurb: string; color: string; bg: string }> = {
  on_track:  { label: "On track",   blurb: "Everything looks good.",                       color: "#047857", bg: "rgba(16, 185, 129, 0.14)" },
  at_risk:   { label: "At risk",    blurb: "Behind the 12-week pace.",                     color: "#b45309", bg: "rgba(245, 158, 11, 0.14)" },
  off_track: { label: "Off track",  blurb: "Well behind the 12-week pace.",                color: "#b91c1c", bg: "rgba(220, 38, 38, 0.14)"  },
  unknown:   { label: "Just started", blurb: "Not enough activity yet to score.",          color: "#1d4ed8", bg: "rgba(59, 130, 246, 0.12)" },
  on_hold:   { label: "On hold",    blurb: "Frozen, no signals accumulating.",             color: "#475569", bg: "rgba(100, 116, 139, 0.14)" },
};

function fmtLastActivity(at: Date | null | undefined): string | null {
  if (!at) return null;
  const now = new Date();
  const d = new Date(at);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEvent = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfEvent.getTime()) / 86400000);
  const timeText = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diffDays <= 0) return `Today, ${timeText}`;
  if (diffDays === 1) return `Yesterday, ${timeText}`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

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

export function AgentFileSidebar({
  transaction,
  assignedUser,
  agencyFeeOverride,
  agentUser,
  progress,
  keyDates = [],
  exchangeConfirmed = false,
  showOurFee = true,
  recommendedFirms,
  fileTime,
  isInternal = false,
  hideCommercialFields = false,
  agentSlot,
  riskInput,
  currentUserId,
  primaryPortalHref,
  lastActivityAt,
  checkIn,
}: Props) {
  const { setActiveTab } = useTabContext();

  const health = TRACK_HEALTH[progress.onTrack] ?? TRACK_HEALTH.unknown;
  const risk = riskInput ? calculateRiskScore(riskInput) : null;
  const riskConfig = risk && risk.level !== "no_data" ? RISK_CONFIG[risk.level] : null;

  // Fee arithmetic (unchanged from TransactionSidebar) — self-managed is
  // always £59, outsourced honours SP override → agency legacy → sliding
  // scale via calculateOurFee.
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

  // Free-plan agencies (Agency.feeTier === "free") are never charged the
  // progressor fee, on any file — hide the row and keep it out of net income,
  // even on files that pre-date the plan flip (whose freeOnExchange may still
  // be false until the retroactive stamp runs).
  const agencyIsFree = agencyFeeOverride?.feeTier === "free";
  const progressorFeePence =
    showOurFee && ourFee.fee != null && !transaction.freeOnExchange && !agencyIsFree ? ourFee.fee : 0;
  const totalFeesPence =
    (agentFeeCalcPence ?? 0)
    + (transaction.referralFee ?? 0)
    + (transaction.brokerReferralFee ?? 0)
    - progressorFeePence;
  const hasTotal = agentFeeCalcPence != null;

  const agentFeeValue = transaction.agentFeeAmount
    ? `${formatFee(transaction.agentFeeAmount)}${transaction.agentFeeIsVatInclusive === false ? " + VAT" : transaction.agentFeeIsVatInclusive === true ? " inc VAT" : ""}`
    : transaction.agentFeePercent
      ? `${Number(transaction.agentFeePercent).toFixed(2)}%${transaction.agentFeeIsVatInclusive === false ? " + VAT" : ""}${transaction.purchasePrice ? ` = ${formatFee(Math.round(transaction.purchasePrice * Number(transaction.agentFeePercent) / 100))}` : ""}`
      : "–";

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

  const showMessageAgent = !!(agentUser && agentUser.email && currentUserId !== agentUser.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ─── 1. Sale health ────────────────────────────────────────────── */}
      <GlassCard glassId="sidebar-sale-health" label="Sidebar · Sale health" defaultVariant="v06" style={{ padding: "14px 16px", borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 7,
            background: health.bg, color: health.color,
          }}>
            <Heartbeat size={14} weight="regular" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" }}>Sale health</p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: health.color }}>{health.label}</p>
          </div>
        </div>

        {/* 2026-07-06 audit fix: blurb line dropped (redundant with the
            pill above), Progress bar dropped (redundant with hero ring
            + stats strip). Card is now pill + rows + link. */}
        <div style={{ marginTop: 4 }}>
          <SidebarRow label="Time on file" value={fileTime && fileTime.totalSeconds > 0 ? fmtTime(fileTime.totalSeconds) : formatElapsedDays(progress.daysElapsed)} />
          {isInternal && fileTime && fileTime.totalSeconds > 0 && (
            <>
              <SidebarRow label="Agent" labelStyle={{ paddingLeft: 12 }} value={fileTime.agentSeconds > 0 ? fmtTime(fileTime.agentSeconds) : "–"} />
              <SidebarRow label="Our team" labelStyle={{ paddingLeft: 12 }} value={fileTime.teamSeconds > 0 ? fmtTime(fileTime.teamSeconds) : "–"} />
            </>
          )}
          {progress.fileLevelPhase && (
            <SidebarRow label="Stage" value={PHASE_LABELS[progress.fileLevelPhase] ?? progress.fileLevelPhase} />
          )}
          {riskConfig && (
            <SidebarRow
              label="Risk level"
              value={<span style={{
                fontSize: 12, fontWeight: 600, color: riskConfig.color,
              }}>
                {RISK_LEVEL_LABEL[risk!.level] ?? riskConfig.label}
              </span>}
            />
          )}
          {fmtLastActivity(lastActivityAt) && (
            <SidebarRow label="Last activity" value={fmtLastActivity(lastActivityAt)!} />
          )}
        </div>

        {/* Health meter - subtle bar at the bottom of the card, tinted by
            onTrack. Not a duplicate of the hero ring (that's the number
            reading); this is a color-coded visual health indicator for
            the whole card. 2026-07-06 mock addition. */}
        <div style={{
          marginTop: 12,
          height: 4,
          background: "rgba(15, 23, 42, 0.05)",
          borderRadius: 999,
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${Math.max(progress.percent, 4)}%`,
            background: progress.onTrack === "on_track" ? "var(--agent-success, #10b981)"
              : progress.onTrack === "at_risk" ? "var(--agent-warning, #f59e0b)"
              : progress.onTrack === "off_track" ? "var(--agent-danger, #ef4444)"
              : "rgba(15, 23, 42, 0.2)",
            borderRadius: 999,
            transition: "width 700ms ease-out",
          }} />
        </div>

        <button
          type="button"
          onClick={() => {
            // Scroll to the risk score widget on the Overview tab.
            const el = document.getElementById("risk-score");
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
              setActiveTab("overview");
            }
          }}
          className="agent-link"
          style={{
            fontSize: 11,
            marginTop: 10,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          View health details →
        </button>
      </GlassCard>

      {/* ─── 2. Key dates ─────────────────────────────────────────────── */}
      <GlassCard glassId="sidebar-key-dates" label="Sidebar · Key dates" defaultVariant="v06" style={{ padding: "14px 16px", borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 7,
            background: "rgba(var(--agent-coral-rgb), 0.10)",
            color: "var(--agent-coral-deep)",
          }}>
            <CalendarBlank size={14} weight="regular" />
          </span>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" }}>Key dates</p>
        </div>

        {!progress.isEarlyEstimate && (
          <SidebarRow
            label="12-week target"
            value={progress.twelveWeekTarget
              ? progress.twelveWeekTarget.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
              : "–"}
          />
        )}
        {(transaction.overridePredictedDate || MEDIANS_READY) && (
          <SidebarRow
            label="Exchange forecast"
            value={<span style={{ color: transaction.overridePredictedDate ? "#1d4ed8" : "var(--agent-text-primary)" }}>
              {progress.predictedExchangeDate
                ? transaction.overridePredictedDate
                  ? progress.predictedExchangeDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  : formatPredictedBand(progress.predictedExchangeDate)
                : "–"}
            </span>}
          />
        )}
        <CompletionDateInline
          transactionId={transaction.id}
          completionDate={transaction.completionDate ?? null}
          exchangeConfirmed={exchangeConfirmed}
        />
        {progress.weeksRemaining !== null && !exchangeConfirmed && (() => {
          const t = formatTimeToExchange(progress.predictedExchangeDate ?? null, progress.weeksRemaining);
          return (
            <SidebarRow
              label="Time to exchange"
              value={<span style={{ color: t.amber ? "#b45309" : "var(--agent-text-primary)" }}>{t.text}</span>}
            />
          );
        })()}
        {transaction.chainLinkId && !exchangeConfirmed && (
          <p style={{ fontSize: 10, color: "var(--agent-text-muted)", fontStyle: "italic", marginTop: 8 }}>
            Chain not factored. This prediction is for this sale alone.
          </p>
        )}

        {keyDates.length > 0 && (
          <div style={{ borderTop: "0.5px solid var(--agent-border-default)", paddingTop: 10, marginTop: 10 }}>
            <p style={{
              margin: "0 0 6px",
              fontSize: 10,
              fontWeight: 600,
              color: "var(--agent-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}>Milestone dates</p>
            {keyDates.map((kd) => {
              const isPast = kd.eventDate < new Date();
              return (
                <SidebarRow
                  key={kd.name}
                  label={kd.name}
                  labelStyle={{ maxWidth: "60%", lineHeight: 1.35 }}
                  value={<span style={{ color: isPast ? "var(--agent-text-muted)" : "var(--agent-text-primary)" }}>
                    {kd.eventDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {isPast && <span style={{ marginLeft: 4, color: "var(--agent-text-muted)" }}>(past)</span>}
                  </span>}
                />
              );
            })}
          </div>
        )}

      </GlassCard>

      {/* ─── 3. Agent ─────────────────────────────────────────────────── */}
      {agentUser && (
        <GlassCard glassId="sidebar-agent" label="Sidebar · Agent" defaultVariant="v06" style={{ padding: "14px 16px", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: 7,
              background: "rgba(15, 23, 42, 0.05)",
              color: "var(--agent-text-secondary)",
            }}>
              <Storefront size={14} weight="regular" />
            </span>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" }}>Agent</p>
          </div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{agentUser.name}</p>
          {agentUser.firmName && (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>{agentUser.firmName}</p>
          )}
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{agentUser.email}</p>

          {showMessageAgent && (
            <a
              href={`mailto:${agentUser.email}?subject=${encodeURIComponent(`Update on ${transaction.propertyAddress}`)}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                marginTop: 12,
                padding: "7px 12px",
                fontSize: 12, fontWeight: 600,
                color: "var(--agent-text-primary)",
                background: "var(--agent-surface-elevated)",
                border: "0.5px solid var(--agent-border-default)",
                borderRadius: 8,
                textDecoration: "none",
              }}
              className="agent-hover-row"
            >
              <EnvelopeSimple size={13} weight="regular" />
              Message agent
            </a>
          )}

          {agentSlot && <div style={{ marginTop: 12 }}>{agentSlot}</div>}
        </GlassCard>
      )}

      {/* ─── 4. Fees ──────────────────────────────────────────────────── */}
      <GlassCard glassId="sidebar-fees" label="Sidebar · Fees" defaultVariant="v06" style={{ padding: "14px 16px", borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: 7,
              background: "rgba(15, 23, 42, 0.05)",
              color: "var(--agent-text-secondary)",
            }}>
              <CurrencyGbp size={14} weight="regular" />
            </span>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" }}>Fees</p>
          </div>
        </div>

        <SidebarRow label="Purchase price" value={formatPrice(transaction.purchasePrice) ?? "–"} />
        {hideCommercialFields ? (
          <SidebarRow label="Agent fee" value={agentFeeValue} />
        ) : (
          <AgentFeeInline
            transactionId={transaction.id}
            agentFeeAmount={transaction.agentFeeAmount}
            agentFeePercent={transaction.agentFeePercent}
            agentFeeIsVatInclusive={transaction.agentFeeIsVatInclusive}
            purchasePrice={transaction.purchasePrice}
          />
        )}
        {((recommendedFirms != null && recommendedFirms.length > 0) || transaction.referredFirmName) && (
          <SidebarRow
            label="Solicitor referral"
            value={transaction.referredFirmName
              ? (transaction.referralFee != null ? formatFee(transaction.referralFee) : "–")
              : "–"}
          />
        )}
        {transaction.brokerFirmName && (
          <SidebarRow
            label="Broker referral"
            value={transaction.brokerReferralFee != null ? formatFee(transaction.brokerReferralFee) : "–"}
          />
        )}
        {showOurFee && ourFee.fee != null && !agencyIsFree && (
          <SidebarRow
            label="Progressor fee"
            value={transaction.freeOnExchange
              ? <span style={{ color: "var(--agent-coral)" }} title="Free during your 14-day trial.">Free during your trial</span>
              : ourFee.label}
          />
        )}
        {hasTotal && (
          <div style={{ borderTop: "0.5px solid var(--agent-border-default)", marginTop: 10, paddingTop: 10 }}>
            {grossTotalPence != null && (
              <SidebarRow label="Gross income" value={<span style={{ color: "var(--agent-text-muted)" }}>{formatFee(grossTotalPence)}</span>} />
            )}
            <SidebarRow
              label="Net income"
              value={<span style={{ fontSize: 14, fontWeight: 700, color: "#047857" }}>{formatFee(netTotalPence)}</span>}
            />
          </div>
        )}
      </GlassCard>

      {/* ─── 5. Quick links ──────────────────────────────────────────── */}
      <GlassCard glassId="sidebar-quick-links" label="Sidebar · Quick links" defaultVariant="v06" style={{ padding: "14px 16px", borderRadius: 14 }}>
        <p style={{
          margin: "0 0 8px",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--agent-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>Quick links</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {primaryPortalHref && (
            <QuickLinkExternal href={primaryPortalHref} label="Open in client portal" Icon={LinkIcon} />
          )}
          {transaction.purchasePrice != null && transaction.purchasePrice > 0 && (
            <StampDutyQuickAction priceGBP={transaction.purchasePrice / 100} />
          )}
          <QuickLinkButton
            label="View file documents"
            Icon={FolderSimple}
            onClick={() => setActiveTab("activity")}
          />
          <QuickLinkButton
            label="Send secure message"
            Icon={PaperPlaneTilt}
            onClick={() => setActiveTab("activity")}
          />
          <SendQuoteLinkQuickAction transactionId={transaction.id} />
          {checkIn && checkIn.seller.steps.length > 0 && (
            <CheckInQuickAction label="Copy seller check-in" side={checkIn.seller} transactionId={checkIn.transactionId} />
          )}
          {checkIn && checkIn.buyer.steps.length > 0 && (
            <CheckInQuickAction label="Copy buyer check-in" side={checkIn.buyer} transactionId={checkIn.transactionId} />
          )}
        </div>
      </GlassCard>

    </div>
  );
}

function SidebarRow({
  label, value, labelStyle,
}: {
  label: string;
  value: React.ReactNode;
  labelStyle?: React.CSSProperties;
}) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: 12,
      padding: "4px 0",
    }}>
      <span style={{ fontSize: 12, color: "var(--agent-text-muted)", ...labelStyle }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function SendQuoteLinkQuickAction({ transactionId }: { transactionId: string }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok"; email: string }
    | { kind: "err"; msg: string }
  >({ kind: "idle" });

  function fire() {
    if (pending) return;
    startTransition(async () => {
      const r = await sendQuoteLinkToBuyerAction(transactionId);
      if (r.ok) {
        setStatus({ kind: "ok", email: r.recipientEmail });
        setTimeout(() => setStatus({ kind: "idle" }), 4000);
      } else {
        setStatus({ kind: "err", msg: r.error });
        setTimeout(() => setStatus({ kind: "idle" }), 6000);
      }
    });
  }

  return (
    <>
      <QuickLinkButton
        label={pending ? "Sending…" : "Send survey quote link to buyer"}
        Icon={Wrench}
        onClick={fire}
      />
      {status.kind === "ok" && (
        <p style={{ fontSize: 11, color: "var(--agent-success, #16a34a)", margin: "2px 0 0 34px" }}>
          Sent to {status.email}
        </p>
      )}
      {status.kind === "err" && (
        <p style={{ fontSize: 11, color: "var(--agent-danger, #dc2626)", margin: "2px 0 0 34px" }}>
          {status.msg}
        </p>
      )}
    </>
  );
}

function QuickLinkExternal({
  href, label, Icon,
}: {
  href: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 6px",
        borderRadius: 8,
        textDecoration: "none",
        color: "inherit",
        transition: "background 140ms ease",
      }}
      className="agent-hover-row"
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 26, height: 26, borderRadius: 7,
          background: "rgba(15,23,42,0.05)", color: "var(--agent-text-secondary)",
        }}>
          <Icon size={14} weight="regular" />
        </span>
        <span style={{ fontSize: 13, color: "var(--agent-text-primary)", fontWeight: 500 }}>{label}</span>
      </span>
      <ArrowSquareOut size={13} weight="regular" style={{ color: "var(--agent-text-muted)" }} />
    </Link>
  );
}

// WhatsApp check-in copy (2026-08-19, upgraded 2026-08-21). Builds the full
// message at click time (greeting matches the agent's clock), copies it, then
// offers a one-tap "mark as chased" follow-up that stamps a manual chase on
// every copied step's open task — same effect as the ↻ Chased button per row.
function CheckInQuickAction({
  label, side, transactionId,
}: {
  label: string;
  side: CheckInSide;
  transactionId: string;
}) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);
  const [offerMark, setOfferMark] = useState(false);
  const [markState, setMarkState] = useState<"idle" | "working" | { marked: number }>("idle");

  function copy() {
    const text = buildCheckInMessage({ steps: side.steps, clientCount: side.clientCount });
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setOfferMark(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  function markChased() {
    if (markState !== "idle") return;
    setMarkState("working");
    markStepsChasedAction(transactionId, side.steps.map((s) => s.code), pathname)
      .then((result) => setMarkState({ marked: result.marked }))
      .catch(() => setMarkState("idle"));
  }

  const stepWord = side.steps.length === 1 ? "step" : "steps";
  const markLabel =
    markState === "idle" ? `Mark ${side.steps.length} ${stepWord} as chased`
    : markState === "working" ? "Marking as chased..."
    : markState.marked > 0 ? `${markState.marked} marked as chased`
    : "No open chases to mark";

  return (
    <>
      <QuickLinkButton
        onClick={copy}
        label={copied ? "Copied. Paste into WhatsApp" : label}
        Icon={copied ? Check : CopySimple}
      />
      {offerMark && (
        <QuickLinkButton
          onClick={markChased}
          label={markLabel}
          Icon={typeof markState === "object" ? Check : ArrowClockwise}
        />
      )}
    </>
  );
}

function QuickLinkButton({
  onClick, label, Icon,
}: {
  onClick: () => void;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "8px 6px",
        borderRadius: 8,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        fontFamily: "inherit",
        transition: "background 140ms ease",
      }}
      className="agent-hover-row"
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 26, height: 26, borderRadius: 7,
          background: "rgba(15,23,42,0.05)", color: "var(--agent-text-secondary)",
        }}>
          <Icon size={14} weight="regular" />
        </span>
        <span style={{ fontSize: 13, color: "var(--agent-text-primary)", fontWeight: 500 }}>{label}</span>
      </span>
    </button>
  );
}
