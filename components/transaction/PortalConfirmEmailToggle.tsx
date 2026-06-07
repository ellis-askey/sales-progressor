"use client";

// Temporary internal-staff toggle for the buyer/seller portal confirmation
// email. When OFF, milestone confirms on this transaction skip the
// portal-progress email but everything else (chain notifications,
// celebrations, reminder engine knock-on) still runs. Per-transaction
// state lives in PropertyTransaction.suppressPortalConfirmEmails.
//
// Visibility is enforced at the parent: this component is only rendered
// when isInternalStaff === true.

import { useState, useTransition } from "react";
import { toggleSuppressPortalConfirmEmailsAction } from "@/app/actions/transactions";
import { useAgentToast } from "@/components/agent/AgentToaster";

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
  const [isPending, startTransition] = useTransition();
  const { toast } = useAgentToast();

  function handleClick() {
    if (isPending) return;
    const next = !emailsOn;
    const nextSuppressed = !next;
    setEmailsOn(next);
    startTransition(async () => {
      try {
        await toggleSuppressPortalConfirmEmailsAction(transactionId, nextSuppressed, pathname);
        toast.success(next ? "Portal emails on" : "Portal emails paused");
      } catch (err) {
        setEmailsOn(!next);
        toast.error("Couldn't update — try again");
      }
    });
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
      <button
        type="button"
        role="switch"
        aria-checked={emailsOn}
        aria-label={emailsOn ? "Pause portal confirmation emails on this file" : "Resume portal confirmation emails on this file"}
        onClick={handleClick}
        disabled={isPending}
        style={{
          position: "relative",
          height: 18,
          width: 32,
          borderRadius: 999,
          border: "none",
          padding: 0,
          background: emailsOn ? "var(--agent-coral, #FF6B4A)" : "rgba(15,23,42,0.20)",
          cursor: isPending ? "default" : "pointer",
          opacity: isPending ? 0.6 : 1,
          transition: "background 120ms ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            height: 14,
            width: 14,
            borderRadius: 999,
            background: "white",
            boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
            transform: emailsOn ? "translateX(14px)" : "translateX(0)",
            transition: "transform 120ms ease",
          }}
        />
      </button>
    </div>
  );
}
