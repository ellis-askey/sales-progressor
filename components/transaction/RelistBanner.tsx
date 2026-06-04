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
};

export function RelistBanner({ show, transactionId, previousPurchasePrice }: Props) {
  const [open, setOpen] = useState(false);
  if (!show) return null;
  return (
    <>
      <AgentBanner
        kind="warning"
        icon={<ArrowsClockwise size={18} weight="fill" />}
        title="This sale fell through."
        body="When you find a new buyer, relist the sale to start a fresh buyer-side journey. The seller's progress stays where it is."
        action={{ label: "Relist sale", onClick: () => setOpen(true) }}
        className="mb-4"
      />
      <RelistFileModal
        open={open}
        transactionId={transactionId}
        previousPurchasePrice={previousPurchasePrice}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
