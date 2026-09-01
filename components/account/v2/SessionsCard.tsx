"use client";

// components/account/v2/SessionsCard.tsx
//
// "Signed-in devices" card for the Security tab. With stateless JWT sessions
// there's no per-device list to show, so this offers the one meaningful action:
// sign out everywhere (bumps sessionVersion server-side, then signs the current
// device out). Used after a shared/lost device.

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Devices } from "@phosphor-icons/react";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { signOutAllDevicesAction } from "@/app/actions/sessions";

const primaryBtn: React.CSSProperties = { padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
const secondaryBtn: React.CSSProperties = {
  padding: "8px 14px", fontSize: 12.5, fontWeight: 500, color: "#374151", background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8, cursor: "pointer",
};

export function SessionsCard() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOutAll() {
    setBusy(true);
    setError("");
    const res = await signOutAllDevicesAction();
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <AccountCard
      icon={<Devices size={18} weight="bold" />}
      title="Signed-in devices"
      subtitle="Used a shared or lost device? Sign out everywhere."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 460 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
          This signs you out on every device, including this one. You&apos;ll sign back in as normal.
        </p>
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)} className="account-btn-secondary account-press" style={{ ...secondaryBtn, color: "#b91c1c", alignSelf: "flex-start" }}>
            Sign out of all devices
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#111827" }}>Sign out everywhere?</span>
            <button type="button" onClick={signOutAll} disabled={busy} className="account-btn-primary" style={primaryBtn}>
              {busy ? "Signing out…" : "Yes, sign out"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="account-btn-secondary account-press" style={secondaryBtn}>
              Cancel
            </button>
          </div>
        )}
        {error && <p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>{error}</p>}
      </div>
    </AccountCard>
  );
}
