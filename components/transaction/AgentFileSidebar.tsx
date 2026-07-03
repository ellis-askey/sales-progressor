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

import { useState } from "react";
import Link from "next/link";
import { formatPrice, formatFee, calculateOurFee } from "@/lib/services/fees";
import { formatElapsedDays } from "@/lib/utils";
import { formatPredictedBand } from "@/lib/utils/format-predicted-band";
import { MEDIANS_READY } from "@/lib/services/milestone-staleness";
import { EditSaleDetailsDrawer } from "@/components/transaction/EditSaleDetailsDrawer";
import { useTabContext } from "@/components/transaction/TabContext";
import { calculateRiskScore, RISK_CONFIG, type RiskInput } from "@/lib/services/risk";
import { Heartbeat, CalendarBlank, Storefront, CurrencyGbp, Link as LinkIcon, ArrowSquareOut, EnvelopeSimple, FolderSimple, PaperPlaneTilt } from "@phosphor-icons/react";
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
};

const PHASE_LABELS: Record<string, string> = {
  onboarding:   "Onboarding",
  conveyancing: "Conveyancing",
  pre_exchange: "Exchange",
  post_exchange: "Exchanged",
};

const TRACK_HEALTH: Record<string, { label: string; blurb: string; color: string; bg: string }> = {
  on_track:  { label: "On track",   blurb: "Everything looks good.",                       color: "#047857", bg: "rgba(16, 185, 129, 0.14)" },
  at_risk:   { label: "At risk",    blurb: "Behind the 12-week pace.",                     color: "#b45309", bg: "rgba(245, 158, 11, 0.14)" },
  off_track: { label: "Off track",  blurb: "Well behind the 12-week pace.",                color: "#b91c1c", bg: "rgba(220, 38, 38, 0.14)"  },
  unknown:   { label: "Just started", blurb: "Not enough activity yet to score.",          color: "#1d4ed8", bg: "rgba(59, 130, 246, 0.12)" },
  on_hold:   { label: "On hold",    blurb: "Frozen, no signals accumulating.",             color: "#475569", bg: "rgba(100, 116, 139, 0.14)" },
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
  canEditSaleDetails = true,
  hideCommercialFields = false,
  agentSlot,
  riskInput,
  currentUserId,
  primaryPortalHref,
}: Props) {
  const [showEditDrawer, setShowEditDrawer] = useState(false);
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

  const progressorFeePence =
    showOurFee && ourFee.fee != null && !transaction.freeOnExchange ? ourFee.fee : 0;
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
    <div className="space-y-4">
      {/* ─── 1. Sale health ────────────────────────────────────────────── */}
      <div className="agent-glass" style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 9,
            background: health.bg, color: health.color,
          }}>
            <Heartbeat size={16} weight="regular" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" }}>Sale health</p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: health.color }}>{health.label}</p>
          </div>
        </div>

        <p style={{
          margin: "0 0 12px",
          fontSize: 12,
          color: "var(--agent-text-muted)",
          lineHeight: 1.5,
        }}>{health.blurb}</p>

        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Progress</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{progress.percent}%</span>
          </div>
          <div style={{
            height: 6,
            background: "rgba(15, 23, 42, 0.06)",
            borderRadius: 999,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.max(progress.percent, 2)}%`,
              background: "linear-gradient(90deg, var(--agent-coral-deep), var(--agent-coral))",
              borderRadius: 999,
              transition: "width 700ms ease-out",
            }} />
          </div>
        </div>

        <SidebarRow label="Time on file" value={fileTime && fileTime.totalSeconds > 0 ? fmtTime(fileTime.totalSeconds) : formatElapsedDays(progress.daysElapsed)} />
        {progress.fileLevelPhase && (
          <SidebarRow label="Stage" value={PHASE_LABELS[progress.fileLevelPhase] ?? progress.fileLevelPhase} />
        )}
        {riskConfig && (
          <SidebarRow
            label="Risk level"
            value={<span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: 600, color: riskConfig.color,
              background: riskConfig.bg,
              padding: "2px 8px",
              borderRadius: 6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: riskConfig.dot }} />
              {riskConfig.label}
            </span>}
          />
        )}

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
      </div>

      {/* ─── 2. Key dates ─────────────────────────────────────────────── */}
      <div className="agent-glass" style={{ padding: "16px 18px" }}>
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
        <SidebarRow
          label="Completion forecast"
          value={
            exchangeConfirmed
              ? (transaction.completionDate
                  ? new Date(transaction.completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  : "Not set")
              : <span style={{ color: "var(--agent-text-muted)", fontStyle: "italic" }}>Awaiting exchange</span>
          }
        />
        {progress.weeksRemaining !== null && (
          <SidebarRow
            label="Weeks to exchange"
            value={<span style={{
              color: progress.weeksRemaining < 0 ? "#b91c1c"
                : progress.weeksRemaining <= 2 ? "#b45309"
                : "var(--agent-text-primary)",
            }}>
              {progress.weeksRemaining < 0
                ? `${Math.abs(progress.weeksRemaining)} weeks overdue`
                : `~${progress.weeksRemaining} weeks`}
            </span>}
          />
        )}
        {transaction.chainLinkId && !exchangeConfirmed && (
          <p style={{ fontSize: 10, color: "var(--agent-text-muted)", fontStyle: "italic", marginTop: 8 }}>
            Chain not factored — prediction is for this sale alone.
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

        <button
          type="button"
          onClick={() => setActiveTab("milestones")}
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
          View full forecast →
        </button>
      </div>

      {/* ─── 3. Agent ─────────────────────────────────────────────────── */}
      {agentUser && (
        <div className="agent-glass" style={{ padding: "16px 18px" }}>
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
                background: "white",
                border: "0.5px solid var(--agent-border-default)",
                borderRadius: 8,
                textDecoration: "none",
              }}
              className="hover:bg-black/[0.03]"
            >
              <EnvelopeSimple size={13} weight="regular" />
              Message agent
            </a>
          )}

          {agentSlot && <div style={{ marginTop: 12 }}>{agentSlot}</div>}
        </div>
      )}

      {/* ─── 4. Fees ──────────────────────────────────────────────────── */}
      <div className="agent-glass" style={{ padding: "16px 18px" }}>
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
          {canEditSaleDetails && (
            <button
              onClick={() => setShowEditDrawer(true)}
              className="agent-link"
              style={{ fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
            >
              {hideCommercialFields ? "Edit price" : "Edit"}
            </button>
          )}
        </div>

        <SidebarRow label="Purchase price" value={formatPrice(transaction.purchasePrice) ?? "–"} />
        <SidebarRow label="Agent fee" value={agentFeeValue} />
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
        {showOurFee && ourFee.fee != null && (
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
      </div>

      {/* ─── 5. Quick links ──────────────────────────────────────────── */}
      <div className="agent-glass" style={{ padding: "14px 16px" }}>
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
        </div>
      </div>

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
      className="hover:bg-black/[0.03]"
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
      className="hover:bg-black/[0.03]"
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
