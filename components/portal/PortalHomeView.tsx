"use client";

import { P } from "@/components/portal/portal-ui";
import { PortalMoney } from "@/components/portal/PortalMoney";
import { CircularProgress } from "@/components/portal/CircularProgress";
import { PortalNextActionCard } from "@/components/portal/PortalNextActionCard";

function fmtPrice(p: number) {
  return "£" + p.toLocaleString("en-GB");
}

type Props = {
  address: string;
  side: "vendor" | "purchaser";
  percent: number;
  completedCount: number;
  remainingCount: number;
  purchasePrice?: number | null;
  token: string;
  milestone: {
    id: string;
    label: string;
    who: string;
    code: string;
    eventDateRequired: boolean;
  };
  whatHappensNext?: string | null;
};

export function PortalHomeView({
  address,
  side,
  percent,
  completedCount,
  remainingCount,
  purchasePrice,
  token,
  milestone,
  whatHappensNext,
}: Props) {
  return (
    <div style={{ background: P.pageBg, borderRadius: 20, overflow: "hidden", padding: "0 4px 4px" }}>
      {/* Hero */}
      <div
        className="rounded-b-3xl px-5 pt-5 pb-6"
        style={{ background: P.heroGradient, boxShadow: P.heroGlow }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span
              className="inline-block text-[11px] font-bold uppercase tracking-[0.10em] mb-3 px-3 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.20)", color: "rgba(255,255,255,0.90)" }}
            >
              {side === "vendor" ? "Your sale of" : "Your purchase of"}
            </span>
            <h2 className="text-[18px] font-semibold text-white leading-snug">
              {address}
            </h2>
          </div>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <CircularProgress percent={percent} />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.70)" }}>
              Overall
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div
        className="rounded-2xl px-5 py-3 flex items-center justify-around mt-3"
        style={{ background: P.cardBg, boxShadow: P.shadowSm }}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[18px] font-bold tabular-nums" style={{ color: P.success }}>{completedCount}</span>
          <span className="text-[11px]" style={{ color: P.textMuted }}>Done</span>
        </div>
        <div className="w-px h-8" style={{ background: P.border }} />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[18px] font-bold tabular-nums" style={{ color: P.accent }}>{remainingCount}</span>
          <span className="text-[11px]" style={{ color: P.textMuted }}>Remaining</span>
        </div>
        {purchasePrice != null && (
          <>
            <div className="w-px h-8" style={{ background: P.border }} />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[18px] font-bold tabular-nums" style={{ color: P.textPrimary }}><PortalMoney>{fmtPrice(purchasePrice)}</PortalMoney></span>
              <span className="text-[11px]" style={{ color: P.textMuted }}>Price</span>
            </div>
          </>
        )}
      </div>

      {/* Next step card — identical to live portal */}
      <div className="mt-3">
        <PortalNextActionCard
          token={token}
          milestone={milestone}
          whatHappensNext={whatHappensNext ?? null}
        />
      </div>
    </div>
  );
}
