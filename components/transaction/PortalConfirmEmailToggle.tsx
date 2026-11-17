"use client";

// Temporary internal-staff toggle for the buyer/seller portal confirmation
// email. When OFF, milestone confirms on this transaction skip the
// portal-progress email but everything else (chain notifications,
// celebrations, reminder engine knock-on) still runs. Per-transaction
// state lives in PropertyTransaction.suppressPortalConfirmEmails.
//
// Visibility is enforced at the parent: this component is only rendered
// when isInternalStaff === true.

import { useState } from "react";
import { toggleSuppressPortalConfirmEmailsAction } from "@/app/actions/transactions";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { LiquidToggle } from "@/components/ui/LiquidToggle";

type Props = {
  transactionId: string;
  initialValue: boolean;
  pathname: string;
};

export function PortalConfirmEmailToggle({
  transactionId,
  initialValue,
  pathname,
}: Props) {
  // Toggle convention: emailsOn === true means emails SEND (suppressed=false).
  // The DB column is the inverse, so flip at the boundary.
  const [emailsOn, setEmailsOn] = useState(!initialValue);
  // Phase 2 (2026-09-17): ack-scoped pending — the switch is live again the
  // moment the server acknowledges the write, instead of staying dimmed
  // through the whole page re-render. Optimistic flip + rollback unchanged.
  const [saving, setSaving] = useState(false);
  const { toast } = useAgentToast();

  async function handleClick() {
    if (saving) return;
    const next = !emailsOn;
    const nextSuppressed = !next;
    setEmailsOn(next);
    setSaving(true);
    try {
      await toggleSuppressPortalConfirmEmailsAction(transactionId, nextSuppressed, pathname);
      toast.success(next ? "Portal emails on" : "Portal emails paused");
    } catch {
      setEmailsOn(!next);
      toast.error("Couldn't update. Try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 999,
        background: emailsOn ? "transparent" : "rgba(234, 88, 12, 0.08)",
        border: emailsOn ? "0.5px solid var(--agent-border-default, rgba(15,23,42,0.12))" : "0.5px solid rgba(234, 88, 12, 0.3)",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
      title={
        emailsOn
          ? "Buyer/seller portal confirmation emails will send when steps are confirmed."
          : "Buyer/seller portal confirmation emails are paused for this file. Other side effects (chain notifications, reminders) still run."
      }
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: emailsOn ? "var(--agent-text-muted, #64748b)" : "#9a3412",
          letterSpacing: 0.02,
        }}
      >
        Portal emails {emailsOn ? "on" : "paused"}
      </span>
      <span style={{ display: "inline-flex", flexShrink: 0 }}>
        <LiquidToggle
          checked={emailsOn}
          onChange={() => handleClick()}
          width={32}
          height={18}
          color="var(--agent-coral, #FF6B4A)"
          disabled={saving}
          aria-label={emailsOn ? "Pause portal confirmation emails on this file" : "Resume portal confirmation emails on this file"}
        />
      </span>
    </div>
  );
}
