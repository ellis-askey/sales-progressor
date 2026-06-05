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
        body="When you find a new buyer, relist the sale. The new buyer's steps start fresh, and the seller keeps everything that doesn't depend on the buyer."
        action={{ label: "Relist sale", onClick: () => setOpen(true) }}
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
