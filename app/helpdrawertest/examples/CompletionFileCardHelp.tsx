"use client";

import {
  CompletionFileRowView,
  GROUP_STYLES,
  type CompletionFileRow,
} from "@/components/completions/CompletionFileRowView";

const EIGHT_DAYS_AGO = new Date(Date.now() - 8 * 86400000).toISOString();
const SIX_DAYS_FROM_NOW = new Date(Date.now() + 6 * 86400000).toISOString();

const MOCK_FILE: CompletionFileRow = {
  id: "help-completion-demo",
  propertyAddress: "12 Birchwood Lane, Guildford, Surrey",
  purchasePrice: 34200000,   // £342,000 in pence
  agentFeeAmount: 195000,    // £1,950 in pence
  purchasers: ["Sarah Mitchell"],
  assignedUserName: null,
  exchangedAtIso: EIGHT_DAYS_AGO,
  completionDateIso: SIX_DAYS_FROM_NOW,
  vendorSolicitorName: "Smith & Jones LLP",
  purchaserSolicitorName: "Gordon & Co Solicitors",
};

const s = GROUP_STYLES["this_week"];

export function CompletionFileCardHelpExample(_props: Record<string, string>) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "0.5px solid rgba(255,255,255,0.25)",
        background: "rgba(255,255,255,0.45)",
        backdropFilter: "blur(12px)",
        overflow: "hidden",
      }}
    >
      <div
        className={`glass-card px-5 py-4 border ${s.border}`}
      >
        <CompletionFileRowView file={MOCK_FILE} groupKey="this_week" />
      </div>
    </div>
  );
}
