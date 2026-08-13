"use client";

import Link from "next/link";
import { getChainLinkStatus, chainLinkStatusLabel } from "@/lib/chain/status";
import { displayChainPosition } from "@/lib/chain/positions";
import { formatPredictedBandShort } from "@/lib/utils/format-predicted-band";
import { MEDIANS_READY } from "@/lib/services/milestone-staleness";
import { formatChainPriceFull } from "@/lib/chain/summary";
import type { ChainLinkV2 } from "@/lib/services/chains";

function relativeTime(date: Date | string | null): string {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  return `${days}d ago`;
}

// Status pill styled with agent tokens (theme-aware across every agent theme).
// Colour follows the same semantics as the mock: your file = coral, claimed =
// success, invited = warning, declined/bounced = danger, unclaimed = neutral.
function statusPillStyle(kind: ReturnType<typeof getChainLinkStatus>["kind"]): {
  color: string;
  background: string;
} {
  switch (kind) {
    case "claimed_own":
    case "your_transaction":
      return { color: "var(--agent-coral-darker)", background: "var(--agent-coral-bg-tint)" };
    case "claimed_other":
      return { color: "var(--agent-success)", background: "var(--agent-success-bg)" };
    case "invited":
      return { color: "var(--agent-warning)", background: "var(--agent-warning-bg)" };
    case "bounced":
    case "declined":
      return { color: "var(--agent-danger)", background: "var(--agent-danger-bg)" };
    default:
      return { color: "var(--agent-text-muted)", background: "var(--agent-border-subtle)" };
  }
}

function ChainStatusBadge({
  status,
  label,
}: {
  status: ReturnType<typeof getChainLinkStatus>;
  label: string;
}) {
  const s = statusPillStyle(status.kind);
  return (
    <span
      className="chain-status-pill"
      style={{ color: s.color, background: s.background }}
    >
      {status.kind === "bounced" && <span aria-hidden>⚠ </span>}
      {label}
      <span className="sr-only">Status: {label}</span>
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <span
      className="chain-bar"
      aria-label={`${clamped}% complete`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i style={{ width: `${clamped}%` }} />
    </span>
  );
}

type DirectionalState = {
  upward: string | null;   // ChainWithdrawalStatus value or null
  downward: string | null;
};

type LinkCardProps = {
  link: ChainLinkV2;
  totalLinks: number;
  currentUserId: string;
  isYourFile: boolean;
  /** Which end of the chain this link sits at, for the "· top / · bottom"
   *  position tag. Omitted for interior links and by the demo pages. */
  edge?: "top" | "bottom";
  onResendInvite?: (linkId: string) => void;
  onEditStub?: (link: ChainLinkV2) => void;
  onDeleteStub?: (linkId: string) => void;
  /** Per-direction response state for cascade-aware badge rendering.
   *  Computed at /api/chains and passed down. Omitted → falls back to the
   *  single denormalised link.withdrawalStatus for backwards safety. */
  directional?: DirectionalState;
};

const BADGE_STYLE = {
  REMARKETING: { color: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.2)", label: "Going back to market" },
  WAITING:     { color: "#0369a1", bg: "rgba(3,105,161,0.08)",  border: "rgba(3,105,161,0.2)",  label: "Waiting for chain to reform" },
  BREAK_CHAIN: { color: "#b45309", bg: "rgba(180,83,9,0.08)",   border: "rgba(180,83,9,0.2)",   label: "Proceeding without onward purchase" },
  WITHDRAWN:   { color: "#525252", bg: "rgba(82,82,82,0.10)",   border: "rgba(82,82,82,0.25)",  label: "Withdrawn" },
} as const;

type BadgeKind = keyof typeof BADGE_STYLE;

function Badge({ kind, arrow }: { kind: BadgeKind; arrow?: "↑" | "↓" }) {
  const s = BADGE_STYLE[kind];
  return (
    <span style={{
      display: "inline-block",
      marginTop: 6,
      marginRight: 6,
      fontSize: 10,
      fontWeight: 600,
      color: s.color,
      background: s.bg,
      border: `0.5px solid ${s.border}`,
      borderRadius: 4,
      padding: "2px 6px",
    }}>
      {arrow ? `${arrow} ` : ""}{s.label}
    </span>
  );
}

export function LinkCard({
  link,
  totalLinks,
  currentUserId,
  isYourFile,
  edge,
  onResendInvite,
  onEditStub,
  onDeleteStub,
  directional,
}: LinkCardProps) {
  const status = getChainLinkStatus(
    {
      transactionId: link.transactionId,
      claimedByUserId: link.claimedByUserId,
      stubAgentEmail: link.stubAgentEmail,
      inviteStatus: link.inviteStatus,
    },
    currentUserId,
    {
      claimerName: link.claimedBy?.name,
      claimerAgency: link.claimedBy?.firmName,
    },
  );

  const label = chainLinkStatusLabel(status);
  const isOriginator = link.createdByUserId === currentUserId;
  const isUnclaimed = link.transactionId === null;

  const addressRaw = link.transaction?.propertyAddress ?? link.stubPropertyAddress ?? "";
  const agencyName = link.claimedBy?.firmName ?? link.stubAgencyName ?? "";
  const addressParts = addressRaw.split(",");
  const address1 = addressParts[0].trim() || "Sale to be added";
  const address2 = addressParts.slice(1).join(",").trim();

  // Real weighted progress (pooled vendor + purchaser, applicable-only) computed
  // server-side in getChainV2. Falls back to 0 only when there's no claimed
  // transaction; the % + bar only render when a transaction exists.
  const progressPercent = link.progressPercent ?? 0;

  // Position tag — "· your file" wins, else the chain-end tag.
  const positionTag = isYourFile ? "your file" : edge ?? null;

  // Photo — real signed URL on claimed links, else the house illustration.
  const photoUrl = link.transaction?.photoUrl ?? null;

  // Price — full figure when known, "Price TBC" for live-but-unpriced, "—" for
  // dead links (declined / bounced).
  const price = link.transaction?.purchasePrice ?? null;
  const isDead = status.kind === "declined" || status.kind === "bounced";
  const priceLabel =
    price != null ? formatChainPriceFull(price) : isDead ? "—" : "Price TBC";

  // Meta descriptor for the bottom bar (left side).
  let meta = "";
  if (status.kind === "invited") meta = `Invite sent · ${relativeTime(link.inviteSentAt)}`;
  else if (status.kind === "bounced") meta = "Email bounced";
  else if (status.kind === "declined") meta = `Agent declined · ${relativeTime(link.inviteDeclinedAt)}`;
  else if (status.kind === "unclaimed_no_email") meta = "Email needed";
  else if (status.kind === "claimed_other") meta = link.claimedBy?.name ? `Claimed by ${link.claimedBy.name}` : "Claimed";
  else if (status.kind === "claimed_own" || status.kind === "your_transaction") meta = "Your file";

  return (
    <div className={`chain-card${isYourFile ? " chain-card-you" : ""}`}>
      {/* Property photo / illustration */}
      <div className={`chain-photo${photoUrl ? "" : " chain-photo-illus"}`}>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" loading="lazy" />
        )}
      </div>

      <div className="chain-body">
        <div className="chain-body-top">
          <div className="chain-cmain">
            <div className="chain-cpos">
              Position {displayChainPosition(link.position, totalLinks)} of {totalLinks}
              {positionTag && <span className="chain-cpos-tag"> · {positionTag}</span>}
            </div>
            <p className="chain-caddr">{address1}</p>
            {(address2 || agencyName) && (
              <p className="chain-cag">
                {address2}
                {address2 && agencyName && " · "}
                {agencyName && <b>{agencyName}</b>}
              </p>
            )}

            {link.transaction && (
              <div className="chain-cprog">
                <span className="chain-pct">{progressPercent}%</span>
                <ProgressBar percent={progressPercent} />
              </div>
            )}

            {/* Predicted exchange band — only when we have a prediction, aren't
             * in early-estimate phase, AND medians are real (MEDIANS_READY). */}
            {MEDIANS_READY && link.transaction && link.predictedExchangeDate && !link.isEarlyEstimate && (
              <p className="chain-band">Exchange {formatPredictedBandShort(link.predictedExchangeDate)}</p>
            )}

            {/* Withdrawn (canonical transaction.status) + cascade directional
             *  badges — carried over unchanged from the prior card. */}
            <div className="chain-badges">
              {link.transaction?.status === "withdrawn" && (
                <span style={{
                  display: "inline-block",
                  marginTop: 6,
                  marginRight: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--agent-danger)",
                  background: "var(--agent-danger-bg)",
                  border: "0.5px solid var(--agent-danger-border)",
                  borderRadius: 4,
                  padding: "2px 6px",
                }}>
                  Withdrawn
                </span>
              )}

              {link.withdrawalStatus === "WITHDRAWN" && link.transaction?.status !== "withdrawn" ? (
                <Badge kind="WITHDRAWN" />
              ) : directional ? (
                <>
                  {directional.upward && BADGE_STYLE[directional.upward as BadgeKind] && (
                    <Badge kind={directional.upward as BadgeKind} arrow="↑" />
                  )}
                  {directional.downward && BADGE_STYLE[directional.downward as BadgeKind] && (
                    <Badge kind={directional.downward as BadgeKind} arrow="↓" />
                  )}
                </>
              ) : (
                link.withdrawalStatus && BADGE_STYLE[link.withdrawalStatus as BadgeKind] && (
                  <Badge kind={link.withdrawalStatus as BadgeKind} />
                )
              )}
            </div>
          </div>

          <div className="chain-cright">
            <div className={`chain-price${price == null ? " chain-price-tbc" : ""}`}>{priceLabel}</div>
            <ChainStatusBadge status={status} label={label} />
          </div>
        </div>

        {/* Bottom action bar — meta on the left, action links on the right.
         *  Every action + its gating condition is carried over unchanged. */}
        <div className="chain-acts">
          {meta && <span className="chain-acts-meta">{meta}</span>}

          {isYourFile && link.transaction && (
            <Link
              href={`/agent/transactions/${link.transaction.id}`}
              className="chain-act-link chain-act-primary"
            >
              Open file →
            </Link>
          )}

          {isOriginator && isUnclaimed && (
            <>
              {status.kind === "unclaimed_no_email" && onEditStub && (
                <button onClick={() => onEditStub(link)} className="chain-act-link chain-act-primary">
                  Add email &amp; invite
                </button>
              )}
              {status.kind === "unclaimed_unsent" && onResendInvite && (
                <button onClick={() => onResendInvite(link.id)} className="chain-act-link chain-act-primary">
                  Send invite
                </button>
              )}
              {status.kind === "invited" && onResendInvite && (
                <button onClick={() => onResendInvite(link.id)} className="chain-act-link">
                  Resend invite
                </button>
              )}
              {status.kind === "bounced" && onEditStub && (
                <button onClick={() => onEditStub(link)} className="chain-act-link chain-act-warn">
                  Update email &amp; resend
                </button>
              )}
              {status.kind === "declined" && onResendInvite && (
                <button onClick={() => onResendInvite(link.id)} className="chain-act-link chain-act-primary">
                  Resend
                </button>
              )}
              {onEditStub && status.kind !== "unclaimed_no_email" && (
                <button onClick={() => onEditStub(link)} className="chain-act-link">
                  Edit
                </button>
              )}
              {onDeleteStub && (
                <button onClick={() => onDeleteStub(link.id)} className="chain-act-link chain-act-danger">
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Connector visual between chain cards
export function ChainConnector() {
  return <div className="chain-connector" aria-hidden />;
}
