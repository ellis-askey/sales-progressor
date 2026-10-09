"use client";

// The Sales-tab action row on a client's workspace: "Add a sale" and "Bring in a
// sale", both card-gated once collection is live, plus a standing "set up billing"
// prompt. Hosts the add-a-card modal and the bring-in-a-sale drawer.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { MilestoneDefinitionLite } from "@/components/milestones/ReconcileMilestonePicker";
import { AddCardGateModal, type CardGatePreview } from "./AddCardGateModal";
import { BringInSaleDrawer } from "./BringInSaleDrawer";

export function BusinessSalesActions({
  agencyId,
  billingActive,
  collecting,
  publishableKey,
  milestoneDefinitions,
  migrationWindow,
  cardGatePreview = null,
}: {
  agencyId: string;
  billingActive: boolean;
  collecting: boolean;
  publishableKey: string;
  milestoneDefinitions: MilestoneDefinitionLite[];
  migrationWindow: { open: boolean; hoursLeft: number; everStarted: boolean };
  cardGatePreview?: CardGatePreview | null;
}) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [cardOpen, setCardOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Only gate once collection is live and there's no card. While billing is dark,
  // everything behaves exactly as before (no gate, no prompt).
  const needsCard = collecting && !billingActive;

  function addSale() {
    if (needsCard) { setCardOpen(true); return; }
    router.push(`/agent/transactions/new?clientAgencyId=${agencyId}`);
  }
  function bringIn() {
    if (!migrationWindow.open) {
      toast.info("Your migration window has closed. Contact support to bring in more sales.");
      return;
    }
    if (needsCard) { setCardOpen(true); return; }
    setDrawerOpen(true);
  }

  return (
    <>
      {needsCard && (
        <div className="bsa-prompt">
          <span className="bsa-i" aria-hidden>i</span>
          <span className="bsa-ptxt"><b>Billing isn&rsquo;t set up yet.</b> Add a card to activate your plan. We&rsquo;ll only start charging once it&rsquo;s on file.</span>
          <button type="button" className="bsa-pbtn" onClick={() => setCardOpen(true)}>Add card <ArrowRight size={12} weight="bold" /></button>
        </div>
      )}

      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="agent-btn agent-btn-primary agent-btn-sm" onClick={addSale}>
          <Plus size={14} weight="bold" /> Add a sale
        </button>
        <button type="button" className="agent-btn agent-btn-neutral agent-btn-sm" onClick={bringIn}>
          Bring in a sale
        </button>
      </div>

      {cardOpen && <AddCardGateModal publishableKey={publishableKey} preview={cardGatePreview} onClose={() => { setCardOpen(false); router.refresh(); }} />}
      {drawerOpen && (
        <BringInSaleDrawer
          agencyId={agencyId}
          milestoneDefinitions={milestoneDefinitions}
          hoursLeft={migrationWindow.hoursLeft}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      <style>{`
        .bsa-prompt { display: flex; align-items: center; gap: 11px; padding: 11px 14px; border-radius: 13px; margin-bottom: 14px; background: rgba(61,122,184,0.09); border: 1px solid rgba(61,122,184,0.28); }
        .bsa-i { flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: #fff; background: var(--agent-info, #3D7AB8); }
        .bsa-ptxt { font-size: 12.5px; color: var(--agent-text-secondary); line-height: 1.5; }
        .bsa-ptxt b { color: var(--agent-text-primary); font-weight: 650; }
        .bsa-pbtn { margin-left: auto; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 700; color: var(--agent-info, #3D7AB8); background: none; border: none; cursor: pointer; white-space: nowrap; }
        .bsa-pbtn:hover { text-decoration: underline; }
      `}</style>
    </>
  );
}
