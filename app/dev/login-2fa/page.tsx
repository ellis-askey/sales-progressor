"use client";
// Dev sandbox for the login two-step (2FA) stage — so the coral OTP can be seen
// and driven locally without a real 2FA account. Mirrors the live stage in
// components/login/WarmLoginForm.tsx: coral OTP, auto-submit on the sixth digit,
// the token-danger error (type 000000 to see the shake), and the backup-code
// escape hatch. Dev-only; wires to nothing.

import { notFound } from "next/navigation";
import { useState } from "react";
import type { CSSProperties } from "react";
import { OtpInput } from "@/components/arc/otp-input/otp-input";
import { LabelInput } from "@/components/ui/LabelInput";
import { Button } from "@/components/arc/button/button";
import "@/components/arc/cookie-consent/scope.css";

const CORAL = "#FF6B4A";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties;
const otpScope = { "--accent": CORAL, "--accent-strong": CORAL, "--accent-subtle": "rgba(255,107,74,0.08)" } as CSSProperties;

export default function Login2faSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [status, setStatus] = useState<"idle" | "error" | "ok">("idle");

  const error = status === "error" ? "That code isn't right. Try again, or use a backup code." : null;

  // Sandbox rule: 000000 fails (to show the shake + banner), anything else passes.
  function verify(value: string) {
    const v = value.trim();
    if (!v) return;
    setStatus(v === "000000" || v.length < 6 ? "error" : "ok");
  }
  function reset() { setCode(""); setStatus("idle"); setUseBackup(false); }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FBF4EF", padding: "48px 20px", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#b09a8d", margin: "0 0 14px" }}>Dev sandbox · login 2FA</p>

        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid rgba(23,23,30,0.06)", boxShadow: "0 1px 3px rgba(30,20,15,0.06)", padding: "28px 26px" }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", color: "#2D1810" }}>Two-step verification</h1>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(45,24,16,0.55)" }}>This is a sandbox — type <strong>000000</strong> to see the wrong-code shake, any other 6 digits to pass.</p>

          {status === "ok" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(31,138,74,0.3)", background: "#fff" }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" stroke="#1F8A4A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span style={{ fontSize: 12.5, color: "#1F8A4A", fontWeight: 500 }}>Code accepted — you&rsquo;d be signed in.</span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={reset} style={{ width: "100%" }}>Try again</Button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); verify(code); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {!useBackup ? (
                <div className="arc-scope" style={otpScope}>
                  <OtpInput
                    label="Authenticator code"
                    length={6}
                    inputMode="numeric"
                    autoFocus
                    value={code}
                    onChange={(v: string) => { setCode(v); if (status === "error") setStatus("idle"); if (v.length === 6) verify(v); }}
                    description="Enter the 6-digit code from your authenticator app."
                    error={error ?? undefined}
                  />
                  <button type="button" onClick={() => { setUseBackup(true); setCode(""); setStatus("idle"); }} style={{ marginTop: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: CORAL, fontWeight: 500 }}>
                    Use a backup code instead
                  </button>
                </div>
              ) : (
                <div className="arc-scope" style={otpScope}>
                  <LabelInput label="Backup code" type="text" name="backup" accent={CORAL} fullWidth autoFocus value={code} onChange={(e) => { setCode(e.target.value); if (status === "error") setStatus("idle"); }} />
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: "rgba(61,31,14,0.55)" }}>Enter one of your backup codes (for example, a3f9k-mn2pq).</p>
                  <button type="button" onClick={() => { setUseBackup(false); setCode(""); setStatus("idle"); }} style={{ marginTop: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: CORAL, fontWeight: 500 }}>
                    Use authenticator code instead
                  </button>
                </div>
              )}

              {/* Banner suppressed in OTP mode — the field shows its own inline error there. */}
              {error && useBackup && (
                <div role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(199,62,62,0.3)", background: "#fff" }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.6" stroke="#C73E3E" strokeWidth="1.3" /><path d="M8 4.7v4" stroke="#C73E3E" strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="11" r="0.5" fill="#C73E3E" stroke="#C73E3E" strokeWidth="0.6" /></svg>
                  <span style={{ fontSize: 12.5, color: "#C73E3E", fontWeight: 500 }}>{error}</span>
                </div>
              )}

              <Button type="submit" variant="primary" size="lg" disabled={!code.trim()} style={{ ...coralVars, width: "100%" }}>Verify code</Button>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(45,24,16,0.4)", margin: "16px 0 0" }}>Also in the library: Components → Text inputs → “One-time-code input (OTP)”.</p>
      </div>
    </div>
  );
}
