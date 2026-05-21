"use client";

import Link from "next/link";
import { getChainLinkStatus, chainLinkStatusLabel, chainLinkStatusColour } from "@/lib/chain/status";
import { displayChainPosition } from "@/lib/chain/positions";
import { formatPredictedBandShort } from "@/lib/utils/format-predicted-band";
import { MEDIANS_READY } from "@/lib/services/milestone-staleness";
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

function ChainStatusBadge({
  status,
  label,
}: {
  status: ReturnType<typeof getChainLinkStatus>;
  label: string;
}) {
  const colour = chainLinkStatusColour(status);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${colour}`}>
      {status.kind === "bounced" && <span aria-hidden>⚠</span>}
      {label}
      <span className="sr-only">Status: {label}</span>
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="h-1.5 rounded-full bg-slate-200/60 overflow-hidden mt-2"
      aria-label={`${clamped}% complete`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

type LinkCardProps = {
  link: ChainLinkV2;
  totalLinks: number;
  currentUserId: string;
  isYourFile: boolean;
  onResendInvite?: (linkId: string) => void;
  onEditStub?: (link: ChainLinkV2) => void;
  onDeleteStub?: (linkId: string) => void;
};

export function LinkCard({
  link,
  totalLinks,
  currentUserId,
  isYourFile,
  onResendInvite,
  onEditStub,
  onDeleteStub,
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
  const address1 = addressParts[0].trim();
  const address2 = addressParts.slice(1).join(",").trim();

  // Real weighted progress (pooled vendor + purchaser, applicable-only) computed
  // server-side in getChainV2. Falls back to 0 only when there's no claimed
  // transaction; render code below already gates ProgressBar + % on transaction.
  const progressPercent = link.progressPercent ?? 0;

  const borderClass = isYourFile
    ? "border-l-[#FF6B4A]"
    : "border-l-white/20";

  return (
    <div className={`glass-card border-l-4 ${borderClass} px-4 py-3`}>
      {/* Address + agency */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900/90 truncate">{address1}</p>
          {address2 && (
            <p className="text-xs text-slate-900/40 truncate">{address2}</p>
          )}
          {agencyName && (
            <p className="text-xs text-slate-900/50 mt-0.5">{agencyName}</p>
          )}
        </div>
        <ChainStatusBadge status={status} label={label} />
      </div>

      {/* Position + progress */}
      <div className="flex items-center gap-2 text-xs text-slate-900/40 mt-1">
        <span>Position {displayChainPosition(link.position, totalLinks)} of {totalLinks}</span>
        {link.transaction && (
          <span className="ml-auto">{progressPercent}%</span>
        )}
      </div>

      {link.transaction && <ProgressBar percent={progressPercent} />}

      {/* Predicted exchange band — only when we have a prediction, aren't
       * in early-estimate phase, AND medians are real (not the hardcoded
       * estimates currently in fees.ts). Re-enabled when MEDIANS_READY flips. */}
      {MEDIANS_READY && link.transaction && link.predictedExchangeDate && !link.isEarlyEstimate && (
        <p className="text-[11px] text-slate-900/40 mt-1.5">
          Exchange {formatPredictedBandShort(link.predictedExchangeDate)}
        </p>
      )}

      {/* Status descriptors for invited/bounced/declined */}
      {status.kind === "invited" && (
        <p className="text-xs text-slate-900/40 mt-1.5">
          Invite sent · {relativeTime(link.inviteSentAt)}
        </p>
      )}
      {status.kind === "bounced" && (
        <p className="text-xs text-amber-600 mt-1.5">Email bounced</p>
      )}
      {status.kind === "unclaimed_no_email" && (
        <p className="text-xs text-slate-900/40 mt-1.5">Email needed</p>
      )}
      {status.kind === "declined" && (
        <p className="text-xs text-slate-900/40 mt-1.5">
          Agent declined · {relativeTime(link.inviteDeclinedAt)}
        </p>
      )}

      {/* Withdrawn state */}
      {link.transaction?.status === "withdrawn" && (
        <span style={{
          display: "inline-block",
          marginTop: 6,
          fontSize: 10,
          fontWeight: 600,
          color: "#dc2626",
          background: "rgba(239,68,68,0.1)",
          border: "0.5px solid rgba(239,68,68,0.2)",
          borderRadius: 4,
          padding: "2px 6px",
        }}>
          Withdrawn
        </span>
      )}

      {/* Withdrawal response status */}
      {link.withdrawalStatus === "REMARKETING" && (
        <span style={{
          display: "inline-block",
          marginTop: 6,
          fontSize: 10,
          fontWeight: 600,
          color: "#7c3aed",
          background: "rgba(124,58,237,0.08)",
          border: "0.5px solid rgba(124,58,237,0.2)",
          borderRadius: 4,
          padding: "2px 6px",
        }}>
          Going back to market
        </span>
      )}
      {link.withdrawalStatus === "WAITING" && (
        <span style={{
          display: "inline-block",
          marginTop: 6,
          fontSize: 10,
          fontWeight: 600,
          color: "#0369a1",
          background: "rgba(3,105,161,0.08)",
          border: "0.5px solid rgba(3,105,161,0.2)",
          borderRadius: 4,
          padding: "2px 6px",
        }}>
          Waiting for chain to reform
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {/* "Your file" — open file link */}
        {isYourFile && link.transaction && (
          <Link
            href={`/agent/transactions/${link.transaction.id}`}
            className="text-xs agent-link-primary font-medium transition-colors"
          >
            Open file →
          </Link>
        )}

        {/* Originator actions on unclaimed stubs */}
        {isOriginator && isUnclaimed && (
          <>
            {status.kind === "unclaimed_no_email" && onEditStub && (
              <button
                onClick={() => onEditStub(link)}
                className="text-xs agent-link-primary font-medium transition-colors"
              >
                Add email &amp; invite
              </button>
            )}
            {status.kind === "unclaimed_unsent" && onResendInvite && (
              <button
                onClick={() => onResendInvite(link.id)}
                className="text-xs agent-link-primary font-medium transition-colors"
              >
                Send invite
              </button>
            )}
            {status.kind === "invited" && onResendInvite && (
              <button
                onClick={() => onResendInvite(link.id)}
                className="text-xs text-slate-900/50 hover:text-slate-900/80 font-medium transition-colors"
              >
                Resend invite
              </button>
            )}
            {status.kind === "bounced" && onEditStub && (
              <button
                onClick={() => onEditStub(link)}
                className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
              >
                Update email &amp; resend
              </button>
            )}
            {status.kind === "declined" && onResendInvite && (
              <button
                onClick={() => onResendInvite(link.id)}
                className="text-xs agent-link-primary font-medium transition-colors"
              >
                Resend
              </button>
            )}
            {onEditStub && status.kind !== "unclaimed_no_email" && (
              <button
                onClick={() => onEditStub(link)}
                className="text-xs text-slate-900/40 hover:text-slate-900/70 transition-colors"
              >
                Edit
              </button>
            )}
            {onDeleteStub && (
              <button
                onClick={() => onDeleteStub(link.id)}
                className="text-xs text-slate-900/30 hover:text-red-500 transition-colors"
              >
                Remove
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Connector visual between chain cards
export function ChainConnector() {
  return (
    <div className="flex items-center justify-center h-5">
      <div className="flex flex-col items-center gap-0.5">
        <span className="w-px h-2 bg-white/25" />
        <svg
          className="w-3 h-3 text-slate-900/25"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}
