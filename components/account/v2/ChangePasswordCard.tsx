"use client";

// components/account/v2/ChangePasswordCard.tsx
//
// Change-password card for the Security tab. Current + new + confirm, with a
// Save action in the card header (matching the other Account forms). Verifies
// server-side via changePasswordAction; clears the fields on success.

import { useState } from "react";
import { Lock } from "@/components/icons/ph";
import { changePasswordAction } from "@/app/actions/change-password";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { Button } from "@/components/arc/button/button";
import { LabelInput } from "@/components/ui/LabelInput";
import { FieldStack } from "@/components/ui/FieldStack";
import { InlineAlert } from "@/components/ui/InlineAlert";

const MIN = 8;
const coralPrimary = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;
const hintStyle: React.CSSProperties = { margin: "6px 0 0", fontSize: 12, color: "var(--agent-danger, #C73E3E)" };

export function ChangePasswordCard() {
  const { toast } = useAgentToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tooShort = next.length > 0 && next.length < MIN;
  const mismatch = confirm.length > 0 && confirm !== next;
  const formValid = current.length > 0 && next.length >= MIN && confirm === next;

  async function handleSave() {
    if (!formValid || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await changePasswordAction({ currentPassword: current, newPassword: next });
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success("Password changed");
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountCard
      icon={<Lock size={18} weight="bold" />}
      title="Password"
      subtitle="Change the password you use to sign in."
      headerAction={
        <Button variant="primary" size="sm" style={coralPrimary} onClick={handleSave} disabled={!formValid} loading={saving}>
          Change password
        </Button>
      }
    >
      <div style={{ maxWidth: 420 }}>
        <FieldStack>
          <LabelInput field="Password" label="Current password" size="sm" fullWidth accent="#FF6B4A" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          <div>
            <LabelInput field="Password" label="New password" size="sm" fullWidth accent="#FF6B4A" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            {tooShort && <p style={hintStyle}>Use at least {MIN} characters.</p>}
          </div>
          <div>
            <LabelInput field="Password" label="Confirm new password" size="sm" fullWidth accent="#FF6B4A" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {mismatch && <p style={hintStyle}>The two passwords don&apos;t match.</p>}
          </div>
          {error && <InlineAlert kind="danger">{error}</InlineAlert>}
        </FieldStack>
      </div>
    </AccountCard>
  );
}
