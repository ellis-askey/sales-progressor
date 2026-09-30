"use client";

// Phase 1 commit 6b — banner that surfaces the relist CTA on the file
// detail page. Visible only when the file is withdrawn AND has not
// exchanged. The relist action's server-side preconditions remain
// canonical (proven in rehearsal item 9b); this banner is convenience.

import { useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { AgentBanner } from "@/components/ui/AgentBanner";
import { RelistFileModal } from "./RelistFileModal";

type Props = {
  show: boolean;
  transactionId: string;
  previousPurchasePrice: number | null;
  // Closed-loop chain arc (2026-06-05): when true, the relist modal asks
  // the agent about the new buyer's onward sale and handles the chain
  // attachment (internal invite / external stub invite / flag pending).
  // When false (file isn't in a chain), the section is hidden entirely.
  inChain: boolean;
};

export function RelistBanner({ show, transactionId, previousPurchasePrice, inChain }: Props) {
  const [open, setOpen] = useState(false);
  if (!show) return null;
  return (
    <>
      <AgentBanner
        kind="warning"
        icon={<ArrowsClockwise size={18} weight="fill" />}
        title="This sale fell through."
        body="When you find a new buyer, add them here. Their steps start fresh, while the seller keeps anything that doesn't depend on the buyer."
        rightSlot={
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              font: "inherit", fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 999,
              border: "none", cursor: "pointer", whiteSpace: "nowrap",
              background: "var(--agent-coral-deep, #e8542f)", color: "#fff",
            }}
          >
            Add a new buyer
          </button>
        }
        rightSlotPlacement="inline-responsive"
        className="mb-4"
      />
      <RelistFileModal
        open={open}
        transactionId={transactionId}
        previousPurchasePrice={previousPurchasePrice}
        inChain={inChain}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
