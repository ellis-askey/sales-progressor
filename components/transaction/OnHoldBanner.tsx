"use client";

// Calm warning banner shown at the top of the transaction-detail page while
// a file is on hold. Renders nothing when the file isn't on hold — caller
// decides visibility based on PropertyTransaction.status.

import { Warning } from "@phosphor-icons/react";
import { AgentBanner } from "@/components/ui/AgentBanner";

export function OnHoldBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <AgentBanner
      kind="warning"
      icon={<Warning size={18} weight="fill" />}
      title="This file is on hold."
      body="Everything is paused: no client emails, agent reminders or escalations. Reactivate the file when you're ready to resume."
      className="mb-4"
    />
  );
}
