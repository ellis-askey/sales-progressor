"use client";

// components/account/v2/TwoFactorCard.tsx
//
// Two-step verification (TOTP) card for the Security tab. Walks the user through
// scan-a-QR -> enter-a-code -> save-backup-codes, shows the on/off state, and
// lets them turn it off with their password. Server logic in
// app/actions/two-factor.ts; the login flow enforces the code.

import { useEffect, useState } from "react";
import { ShieldCheck, Check } from "@/components/icons/ph";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/ui/Badge";
import { LabelInput } from "@/components/ui/LabelInput";
import { InlineAlert } from "@/components/ui/InlineAlert";
import {
  getTwoFactorStatus,
  startTwoFactorEnrollment,
  enableTwoFactor,
  disableTwoFactor,
} from "@/app/actions/two-factor";

type Mode = "loading" | "off" | "enrolling" | "backup" | "on" | "disabling";

const coralPrimary = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;
// One-off eyebrow above the authenticator secret key (the fields themselves are
// canonical LabelInputs).
const eyebrowStyle: React.CSSProperties = {
  display: "block", fontSize: 10, color: "#6b7280", textTransform: "uppercase",
  letterSpacing: 0.7, fontWeight: 500, marginBottom: 5,
};

export function TwoFactorCard() {
  const { toast } = useAgentToast();
  const [mode, setMode] = useState<Mode>("loading");
  const [hasPassword, setHasPassword] = useState(true);
  const [backupRemaining, setBackupRemaining] = useState(0);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const s = await getTwoFactorStatus();
    setHasPassword(s.hasPassword);
    setBackupRemaining(s.backupCodesRemaining);
    setMode(s.enabled ? "on" : "off");
  }
  useEffect(() => { void refresh(); }, []);

  async function startEnroll() {
    setBusy(true); setError("");
    const res = await startTwoFactorEnrollment();
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setQr(res.qrDataUrl); setSecret(res.secret); setToken(""); setMode("enrolling");
  }

  async function confirmEnable() {
    setBusy(true); setError("");
    const res = await enableTwoFactor({ token: token.trim() });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setBackupCodes(res.backupCodes);
    setMode("backup");
    toast.success("Two-step verification is on");
  }

  async function confirmDisable() {
    setBusy(true); setError("");
    const res = await disableTwoFactor({ password });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setPassword("");
    toast.success("Two-step verification turned off");
    void refresh();
  }

  const badge =
    mode === "on" ? <Badge tone="success">On</Badge>
      : mode === "off" ? <Badge tone="neutral">Off</Badge>
        : null;

  return (
    <AccountCard
      icon={<ShieldCheck size={18} weight="bold" />}
      title="Two-step verification"
      subtitle="Use a code from an authenticator app as an extra step when you sign in."
      headerAction={badge}
    >
      {mode === "loading" && <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Loading…</p>}

      {mode === "off" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 460 }}>
          {!hasPassword ? (
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
              Two-step verification is available for password sign-in. You use a linked Google or Microsoft account, which has its own two-step protection.
            </p>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                Add an extra layer of security at sign-in using an app like Google Authenticator, 1Password or Authy.
              </p>
              <div>
                <Button variant="primary" size="sm" style={coralPrimary} onClick={startEnroll} loading={busy}>
                  Set up two-step verification
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {mode === "enrolling" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 460 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
            Scan this with your authenticator app, then enter the 6-digit code it shows.
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Two-step verification QR code" width={168} height={168} style={{ borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.10)" }} />
            )}
            <div style={{ minWidth: 0 }}>
              <span style={eyebrowStyle}>Or enter this key</span>
              <code style={{ display: "block", fontSize: 12.5, letterSpacing: 1, wordBreak: "break-all", color: "#111827", background: "#f6f6f7", padding: "8px 10px", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.08)" }}>{secret}</code>
            </div>
          </div>
          <LabelInput field="Code" label="6-digit code" size="sm" fullWidth accent="#FF6B4A" inputMode="numeric" autoComplete="one-time-code" value={token} onChange={(e) => setToken(e.target.value)} />
          {error && <InlineAlert kind="danger">{error}</InlineAlert>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" size="sm" style={coralPrimary} onClick={confirmEnable} disabled={token.trim().length < 6} loading={busy}>
              Verify &amp; turn on
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setMode("off"); setError(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {mode === "backup" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 460 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#166534", fontSize: 13, fontWeight: 600 }}>
            <Check size={16} weight="bold" /> Two-step verification is on.
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
            Save these backup codes somewhere safe. Each can be used once if you lose access to your authenticator, and you won&apos;t see them again.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "#f6f6f7", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 14 }}>
            {backupCodes.map((c) => (
              <code key={c} style={{ fontSize: 13, letterSpacing: 1, color: "#111827", fontFamily: "ui-monospace, monospace" }}>{c}</code>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(backupCodes.join("\n")).then(() => toast.success("Backup codes copied")); }}>Copy codes</Button>
            <Button variant="primary" size="sm" style={coralPrimary} onClick={() => { setBackupCodes([]); void refresh(); }}>I&apos;ve saved these</Button>
          </div>
        </div>
      )}

      {mode === "on" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 460 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
            You&apos;ll be asked for a code each time you sign in. {backupRemaining} backup {backupRemaining === 1 ? "code" : "codes"} remaining.
          </p>
          <div>
            <Button variant="danger" size="sm" onClick={() => { setMode("disabling"); setError(""); setPassword(""); }}>
              Turn off two-step verification
            </Button>
          </div>
        </div>
      )}

      {mode === "disabling" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
            Enter your password to turn off two-step verification.
          </p>
          <LabelInput field="Password" label="Password" size="sm" fullWidth accent="#FF6B4A" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <InlineAlert kind="danger">{error}</InlineAlert>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="danger" size="sm" onClick={confirmDisable} disabled={!password} loading={busy}>
              Turn off
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setMode("on"); setError(""); }}>Cancel</Button>
          </div>
        </div>
      )}
    </AccountCard>
  );
}
