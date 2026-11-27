"use client";

// Invoice scheduling controls on the business Invoices page (billing suite
// Phase 3): auto-issue monthly on the 1st, and a day-before-completion reminder.
// Saves immediately on toggle (optimistic, reverts on failure), like the agent
// notification prefs.

import { useState, useTransition } from "react";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { updateInvoiceScheduleAction } from "@/app/actions/progression-clients";

export function InvoiceScheduleForm({ initialAutoMonthly, initialRemindDayBefore }: { initialAutoMonthly: boolean; initialRemindDayBefore: boolean }) {
  const { toast } = useAgentToast();
  const [autoMonthly, setAutoMonthly] = useState(initialAutoMonthly);
  const [remind, setRemind] = useState(initialRemindDayBefore);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function save(nextAuto: boolean, nextRemind: boolean, revert: () => void) {
    if (busy) return;
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await updateInvoiceScheduleAction(nextAuto, nextRemind);
        if (!res.ok) { revert(); toast.error(res.error); }
      } catch { revert(); toast.error("Couldn't save. Try again."); }
      finally { setBusy(false); }
    });
  }

  return (
    <AccountCard title="Schedule" subtitle="When invoices go out, and reminders — on top of sending manually any time." style={{ marginBottom: 18 }}>
      <div className="isf-row">
        <div>
          <div className="isf-lab">Send automatically on the 1st</div>
          <div className="isf-hint">Each month we issue + email each client their prior-month invoice, like a standing order. You can still send manually any time.</div>
        </div>
        <LiquidToggle checked={autoMonthly} onChange={() => { const n = !autoMonthly; setAutoMonthly(n); save(n, remind, () => setAutoMonthly(!n)); }} width={44} height={24} color="var(--agent-coral, #FF8A65)" disabled={busy} aria-label="Send automatically on the 1st" />
      </div>
      <div className="isf-row" style={{ borderTop: "0.5px solid var(--agent-border-subtle)" }}>
        <div>
          <div className="isf-lab">Remind the day before completion</div>
          <div className="isf-hint">Email the client a heads-up the day before one of their sales completes.</div>
        </div>
        <LiquidToggle checked={remind} onChange={() => { const n = !remind; setRemind(n); save(autoMonthly, n, () => setRemind(!n)); }} width={44} height={24} color="var(--agent-coral, #FF8A65)" disabled={busy} aria-label="Remind the day before completion" />
      </div>
      <style>{`
        .isf-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; }
        .isf-row:first-of-type { padding-top: 2px; }
        .isf-lab { font-size: 13.5px; font-weight: 600; color: var(--agent-text-primary); }
        .isf-hint { font-size: 12px; color: var(--agent-text-muted); margin-top: 4px; line-height: 1.55; max-width: 52ch; }
      `}</style>
    </AccountCard>
  );
}
