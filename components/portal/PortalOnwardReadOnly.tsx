"use client";

// The "Your onward" / "Your related sale" tab when we DO run the neighbour file
// but couldn't tie this client to a confirmable contact on it. Shows the real,
// live progress of that property as a clean read-only view: the property address,
// a "View only" badge and an honest line that their team keeps it updated — then
// the real steps with every Confirm/Skip/Upload control stripped (no dead
// buttons). Matched the pattern to the other-side "View only" panel inside
// PortalMilestoneList so the two read as one system. Shared with the seeded
// /dev/onward-readonly preview so the look can be reviewed without real data.

import { ComponentProps } from "react";
import { PortalReadOnlyProvider } from "./PortalReadOnlyProvider";
import { PortalMilestoneList } from "./PortalMilestoneList";
import { P } from "./portal-ui";

type ListMilestones = ComponentProps<typeof PortalMilestoneList>["milestones"];

export function PortalOnwardReadOnly({
  address,
  milestones,
  side,
  hasExchanged,
  saleActive,
}: {
  address: string;
  milestones: ListMilestones;
  side: "vendor" | "purchaser";
  hasExchanged: boolean;
  saleActive: boolean;
}) {
  const done = milestones.filter((m) => m.isComplete).length;
  const total = milestones.filter((m) => !m.isNotRequired).length;
  // The neighbour file is their onward purchase (they're the buyer there) or the
  // sale funding their purchase (they're the seller there).
  const noun = side === "purchaser" ? "onward purchase" : "sale";
  return (
    <div className="space-y-3" style={{ paddingInline: 16 }}>
      <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowMd, borderLeft: `3px solid ${P.accent}` }}>
        <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${P.border}` }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: P.border, color: P.textMuted }}>View only</span>
            <p className="text-[12px]" style={{ color: P.textMuted }}>{done} of {total} steps done</p>
          </div>
          <p className="text-[14px] font-semibold mt-1.5 leading-snug" style={{ color: P.textPrimary }}>{address}</p>
          <p className="text-[12px] mt-0.5" style={{ color: P.textMuted }}>
            Your team keeps this updated as your {noun} progresses.
          </p>
        </div>
      </div>
      <PortalReadOnlyProvider readOnly={true}>
        <PortalMilestoneList
          token=""
          milestones={milestones}
          otherSideMilestones={[]}
          hasExchanged={hasExchanged}
          side={side}
          saleActive={saleActive}
        />
      </PortalReadOnlyProvider>
    </div>
  );
}
