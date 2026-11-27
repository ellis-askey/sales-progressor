"use client";

// components/account/v2/SessionsCard.tsx
//
// "Signed-in devices" card for the Security tab. With stateless JWT sessions
// there's no per-device list to show, so this offers the one meaningful action:
// sign out everywhere (bumps sessionVersion server-side, then signs the current
// device out). Used after a shared/lost device.

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Devices } from "@/components/icons/ph";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { signOutAllDevicesAction } from "@/app/actions/sessions";
import { Button } from "@/components/arc/button/button";
import { InlineAlert } from "@/components/ui/InlineAlert";

const coralPrimary = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

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
      subtitle="Used a shared device or lost one? Sign out everywhere."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 460 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
          This signs you out on every device, including this one. You&apos;ll sign back in as normal.
        </p>
        {!confirming ? (
          <div>
            <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
              Sign out of all devices
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#111827" }}>Sign out everywhere?</span>
            <Button variant="primary" size="sm" style={coralPrimary} onClick={signOutAll} loading={busy}>
              Yes, sign out
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        )}
        {error && <InlineAlert kind="danger">{error}</InlineAlert>}
      </div>
    </AccountCard>
  );
}
