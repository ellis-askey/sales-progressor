"use client";

// components/account/v2/TwoFactorCard.tsx
//
// Two-step verification (TOTP) card for the Security tab. Walks the user through
// scan-a-QR -> enter-a-code -> save-backup-codes, shows the on/off state, and
// lets them turn it off with their password. Server logic in
// app/actions/two-factor.ts; the login flow enforces the code.

import { useEffect, useState } from "react";
import { ShieldCheck, Check } from "@phosphor-icons/react";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import {
  getTwoFactorStatus,
  startTwoFactorEnrollment,
  enableTwoFactor,
  disableTwoFactor,
} from "@/app/actions/two-factor";

type Mode = "loading" | "off" | "enrolling" | "backup" | "on" | "disabling";

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, color: "#6b7280", textTransform: "uppercase",
  letterSpacing: 0.7, fontWeight: 500, marginBottom: 5,
};
const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 13.5, color: "#111827",
  background: "#fff", border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8, outline: "none",
};
const primaryBtn: React.CSSProperties = { padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
const secondaryBtn: React.CSSProperties = {
  padding: "8px 14px", fontSize: 12.5, fontWeight: 500, color: "#374151", background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8, cursor: "pointer",
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
    mode === "on"
      ? <span style={{ fontSize: 11, fontWeight: 700, color: "#166534", background: "#dcfce7", padding: "3px 9px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 0.4 }}>On</span>
      : mode === "off"
        ? <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", padding: "3px 9px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 0.4 }}>Off</span>
        : null;

  return (
    <AccountCard
      icon={<ShieldCheck size={18} weight="bold" />}
      title="Two-step verification"
      subtitle="Ask for a code from an authenticator app when you sign in."
      headerAction={badge}
    >
      {mode === "loading" && <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Loading…</p>}

      {mode === "off" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 460 }}>
          {!hasPassword ? (
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
              Two-step verification is available on password sign-in. Your account uses a linked Google or Microsoft login, which carries its own two-step protection.
            </p>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                Add a second step at sign-in using an app like Google Authenticator, 1Password or Authy.
              </p>
              <button type="button" onClick={startEnroll} disabled={busy} className="account-btn-primary" style={{ ...primaryBtn, alignSelf: "flex-start" }}>
                {busy ? "Starting…" : "Set up two-step verification"}
              </button>
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
              <span style={labelStyle}>Or enter this key</span>
              <code style={{ display: "block", fontSize: 12.5, letterSpacing: 1, wordBreak: "break-all", color: "#111827", background: "#f6f6f7", padding: "8px 10px", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.08)" }}>{secret}</code>
            </div>
          </div>
          <div>
            <label style={labelStyle}>6-digit code</label>
            <input className="account-input" style={fieldStyle} inputMode="numeric" autoComplete="one-time-code" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123 456" />
          </div>
          {error && <p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={confirmEnable} disabled={busy || token.trim().length < 6} className="account-btn-primary" style={primaryBtn}>
              {busy ? "Verifying…" : "Verify & turn on"}
            </button>
            <button type="button" onClick={() => { setMode("off"); setError(""); }} disabled={busy} className="account-btn-secondary account-press" style={secondaryBtn}>Cancel</button>
          </div>
        </div>
      )}

      {mode === "backup" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 460 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#166534", fontSize: 13, fontWeight: 600 }}>
            <Check size={16} weight="bold" /> Two-step verification is on.
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
            Save these backup codes somewhere safe. Each works once if you lose access to your authenticator. You won&apos;t see them again.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "#f6f6f7", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 14 }}>
            {backupCodes.map((c) => (
              <code key={c} style={{ fontSize: 13, letterSpacing: 1, color: "#111827", fontFamily: "ui-monospace, monospace" }}>{c}</code>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => { navigator.clipboard.writeText(backupCodes.join("\n")).then(() => toast.success("Backup codes copied")); }} className="account-btn-secondary account-press" style={secondaryBtn}>Copy codes</button>
            <button type="button" onClick={() => { setBackupCodes([]); void refresh(); }} className="account-btn-primary" style={primaryBtn}>I&apos;ve saved these</button>
          </div>
        </div>
      )}

      {mode === "on" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 460 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
            You&apos;ll be asked for a code when you sign in. {backupRemaining} backup {backupRemaining === 1 ? "code" : "codes"} remaining.
          </p>
          <button type="button" onClick={() => { setMode("disabling"); setError(""); setPassword(""); }} className="account-btn-secondary account-press" style={{ ...secondaryBtn, color: "#b91c1c", alignSelf: "flex-start" }}>
            Turn off two-step verification
          </button>
        </div>
      )}

      {mode === "disabling" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
            Enter your password to turn off two-step verification.
          </p>
          <div>
            <label style={labelStyle}>Password</label>
            <input className="account-input" style={fieldStyle} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={confirmDisable} disabled={busy || !password} className="account-btn-primary" style={primaryBtn}>
              {busy ? "Turning off…" : "Turn off"}
            </button>
            <button type="button" onClick={() => { setMode("on"); setError(""); }} disabled={busy} className="account-btn-secondary account-press" style={secondaryBtn}>Cancel</button>
          </div>
        </div>
      )}
    </AccountCard>
  );
}
