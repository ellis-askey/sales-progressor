"use client";

// components/account/v2/ChangePasswordCard.tsx
//
// Change-password card for the Security tab. Current + new + confirm, with a
// Save action in the card header (matching the other Account forms). Verifies
// server-side via changePasswordAction; clears the fields on success.

import { useState } from "react";
import { Lock } from "@phosphor-icons/react";
import { changePasswordAction } from "@/app/actions/change-password";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { AccountCard } from "@/components/account/chrome/AccountCard";

const MIN = 8;

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 0.7,
  fontWeight: 500,
  marginBottom: 5,
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 13.5,
  color: "#111827",
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.16)",
  borderRadius: 8,
  outline: "none",
};

export function ChangePasswordCard() {
  const { toast } = useAgentToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tooShort = next.length > 0 && next.length < MIN;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSave = current.length > 0 && next.length >= MIN && confirm === next && !saving;

  async function handleSave() {
    if (!canSave) return;
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
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="account-btn-primary"
          style={{ padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: canSave ? "pointer" : "default" }}
        >
          {saving ? "Saving…" : "Change password"}
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
        <div>
          <label style={labelStyle}>Current password</label>
          <input className="account-input" style={fieldStyle} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>New password</label>
          <input className="account-input" style={fieldStyle} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          {tooShort && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626" }}>Use at least {MIN} characters.</p>}
        </div>
        <div>
          <label style={labelStyle}>Confirm new password</label>
          <input className="account-input" style={fieldStyle} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {mismatch && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626" }}>The two passwords don&apos;t match.</p>}
        </div>
        {error && <p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>{error}</p>}
      </div>
    </AccountCard>
  );
}
