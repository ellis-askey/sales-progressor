"use client";

import { TransactionRowView } from "@/components/transactions/TransactionRowView";
import type { TransactionRow } from "@/components/transactions/TransactionRowView";

const FOURTEEN_DAYS = new Date(Date.now() + 14 * 86400000);
const FOUR_DAYS_AGO = new Date(Date.now() - 4 * 86400000);
const CREATED_AT = new Date(Date.now() - 56 * 86400000);

const MOCK_TX: TransactionRow = {
  id: "help-tx-allfiles-demo",
  propertyAddress: "12 Birchwood Lane, Guildford, Surrey",
  status: "active",
  expectedExchangeDate: FOURTEEN_DAYS,
  createdAt: CREATED_AT,
  assignedUser: { id: "u1", name: "Sophie Clarke" },
  health: {
    pendingOverdueTasks: 0,
    escalatedTasks: 0,
    lastActivityAt: FOUR_DAYS_AGO,
    nextActionLabel: "Vendor solicitor — contract pack",
    nextMilestoneLabel: null,
    daysStuckOnMilestone: 10,
    onTrack: "at_risk", // → score 20 → "Watch" (medium)
  },
  serviceType: "self_managed",
  agentUser: { id: "a1", name: "Tom Reynolds", role: "director" },
  contacts: [
    { id: "c1", name: "James Patel", roleType: "vendor" },
    { id: "c2", name: "Sarah Mitchell", roleType: "purchaser" },
  ],
};

export function TransactionRowHelpExample(_props: Record<string, string>) {
  return (
    <div
      style={{
        minWidth: 700,
        overflow: "hidden",
        borderRadius: 16,
        border: "0.5px solid rgba(255,255,255,0.25)",
        background: "rgba(255,255,255,0.45)",
        backdropFilter: "blur(12px)",
      }}
    >
      <TransactionRowView
        tx={MOCK_TX}
        showOwner={false}
        basePath="/agent/transactions"
        isLast={true}
      />
    </div>
  );
}
