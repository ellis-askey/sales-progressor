"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { GoogleIcon } from "./GoogleIcon"
import { MicrosoftIcon } from "./MicrosoftIcon"
import { loginPrecheck } from "@/app/actions/login-precheck"
import { LabelInput } from "@/components/ui/LabelInput"
import { Button } from "@/components/arc/button/button"
import { OtpInput } from "@/components/arc/otp-input/otp-input"
import "@/components/arc/cookie-consent/scope.css"

const CORAL = "#FF6B4A"

export function WarmLoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<"password" | "totp">("password")
  const [totp, setTotp] = useState("")
  // Backup codes are alphanumeric (xxxxx-xxxxx), so they can't go in the 6-box
  // numeric OTP — this swaps that field for a plain text one.
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [ssoLoading, setSsoLoading] = useState<string | null>(null)
  const [emailError, setEmailError] = useState("")

  const emailLooksValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

  async function completeSignIn(code?: string) {
    const result = await signIn("credentials", { email: email.trim(), password, totp: code ?? "", redirect: false })
    if (result?.error || !result?.ok) {
      setLoading(false)
      setError(code !== undefined ? "That code isn't right. Try again, or use a backup code." : "Incorrect email or password.")
    } else {
      // Full navigation (not router.push) so the pre-paint ThemeModeBoot script
      // runs on the agent app's first load — a client nav skips it and the shell
      // paints a frame with the wrong theme (the "weird nav" on first sign-in).
      window.location.assign("/")
      // loading stays true — component unmounts on navigation, no flash
    }
  }

  // Submit a 2FA code, setting the busy state the way handleSubmit does — so the
  // OTP can auto-submit the moment its sixth digit lands.
  function submitTotp(code: string) {
    setError(null)
    setLoading(true)
    void completeSignIn(code)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (stage === "totp") {
      await completeSignIn(totp.trim())
      return
    }

    // Check the password first so we only ask for a 2FA code when the account
    // actually has it on. authorize() still enforces the code independently.
    const pre = await loginPrecheck({ email: email.trim(), password })
    if (!pre.ok) {
      setLoading(false)
      setError("Incorrect email or password.")
      return
    }
    if (pre.needs2fa) {
      setLoading(false)
      setStage("totp")
      return
    }
    await completeSignIn()
  }

  // Fields-empty is kept separate from loading: the arc Button shows its own
  // busy state (spinner, stays focusable) via `loading` and only disables for
  // genuinely empty fields.
  const fieldsEmpty = stage === "password" ? (!email.trim() || !password) : !totp.trim()

  // Coral submit — the arc Button's style, the login's colour. Overriding the
  // primary's ink/slab tokens turns it coral without touching the component.
  const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties

  return (
    <>
      <style>{`
        .wlink:hover { color: #E55B3D !important; }
        .wcreate:hover { color: #E55B3D !important; }
      `}</style>

      {/* --lbi-top: 0 drops each field's label-room padding so the 14px gap is
          the real space between field outlines (the lifted label's ~6px of
          overhang lives inside the gap). */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", "--lbi-top": "0px" } as React.CSSProperties}>

        {stage === "password" && (
        <>
        {/* SSO buttons — top of form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            loading={ssoLoading === "google"}
            disabled={loading || ssoLoading !== null}
            onClick={() => { setSsoLoading("google"); signIn("google", { callbackUrl: "/" }); }}
            aria-label="Continue with Google"
            style={{ width: "100%" }}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            loading={ssoLoading === "azure-ad"}
            disabled={loading || ssoLoading !== null}
            onClick={() => { setSsoLoading("azure-ad"); signIn("azure-ad", { callbackUrl: "/" }); }}
            aria-label="Continue with Microsoft"
            style={{ width: "100%" }}
          >
            <MicrosoftIcon />
            Continue with Microsoft
          </Button>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ flex: 1, height: "1px", background: "rgba(32,36,46,0.10)" }} />
          <span style={{ fontSize: "11px", color: "rgba(32,36,46,0.42)", whiteSpace: "nowrap" }}>or sign in with email</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(32,36,46,0.10)" }} />
        </div>

        {/* The label lives inside the field now (no eyebrow). Email stays
            lower-cased on blur as before. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <LabelInput
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            accent={emailError ? "#C73E3E" : CORAL}
            fullWidth
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v) setEmail(v.toLowerCase());
              setEmailError(v && !emailLooksValid(v) ? "Enter a valid email address" : "");
            }}
          />
          {emailError && <p style={{ fontSize: "12px", color: "#C73E3E", fontWeight: 500, margin: 0 }}>{emailError}</p>}
        </div>

        <LabelInput
          field="Password"
          name="password"
          autoComplete="current-password"
          accent={CORAL}
          fullWidth
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        </>
        )}

        {stage === "totp" && (
          <div>
            {!useBackupCode ? (
              <div
                className="arc-scope"
                style={{ "--accent": CORAL, "--accent-strong": CORAL, "--accent-subtle": "rgba(255,107,74,0.08)" } as React.CSSProperties}
              >
                <OtpInput
                  label="Authenticator code"
                  length={6}
                  inputMode="numeric"
                  autoFocus
                  value={totp}
                  onChange={(v: string) => {
                    setTotp(v)
                    if (error) setError(null)
                    if (v.length === 6 && !loading) submitTotp(v)
                  }}
                  description="Enter the 6-digit code from your authenticator app."
                  error={error ?? undefined}
                />
                <button
                  type="button"
                  onClick={() => { setUseBackupCode(true); setTotp(""); setError(null) }}
                  className="wlink"
                  style={{ marginTop: "10px", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "11px", color: CORAL, fontWeight: 500 }}
                >
                  Use a backup code instead
                </button>
              </div>
            ) : (
              <div>
                <LabelInput
                  label="Backup code"
                  type="text"
                  name="totp"
                  accent={CORAL}
                  fullWidth
                  autoFocus
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                />
                <p style={{ margin: "8px 0 0", fontSize: "11px", color: "rgba(61,31,14,0.55)" }}>
                  Enter one of your backup codes (for example, a3f9k-mn2pq).
                </p>
                <button
                  type="button"
                  onClick={() => { setUseBackupCode(false); setTotp(""); setError(null) }}
                  className="wlink"
                  style={{ marginTop: "10px", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "11px", color: CORAL, fontWeight: 500 }}
                >
                  Use authenticator code instead
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setStage("password"); setTotp(""); setError(null); setUseBackupCode(false) }}
              className="wlink"
              style={{ marginTop: "10px", display: "block", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "11px", color: "#7A4A2E" }}
            >
              ← Back
            </button>
          </div>
        )}

        {/* Form-level error. In OTP mode the field shows its own inline error (and
            shakes), so the banner is suppressed there to avoid saying it twice. */}
        {error && !(stage === "totp" && !useBackupCode) && (
          <div role="alert" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderRadius: "8px", border: "1px solid rgba(199,62,62,0.30)", background: "#ffffff", margin: 0 }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flex: "none" }}>
              <circle cx="8" cy="8" r="6.6" stroke="#C73E3E" strokeWidth="1.3" />
              <path d="M8 4.7v4" stroke="#C73E3E" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11" r="0.5" fill="#C73E3E" stroke="#C73E3E" strokeWidth="0.6" />
            </svg>
            <span style={{ fontSize: "12.5px", color: "#C73E3E", fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {stage === "password" && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href="/forgot-password" className="wlink" style={{ fontSize: "12px", fontWeight: 500, color: CORAL, textDecoration: "none", transition: "color 0.12s ease" }}>
              Forgot password?
            </Link>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          disabled={fieldsEmpty}
          style={{ ...coralVars, width: "100%" }}
        >
          {stage === "totp" ? "Verify code" : "Sign in"}
        </Button>

        {stage === "password" && (
          <p style={{ textAlign: "center", fontSize: "13px", color: "rgba(45,24,16,0.55)", margin: 0 }}>
            New here?{" "}
            <Link href="/register" className="wcreate" style={{ color: CORAL, fontWeight: 600, textDecoration: "none", transition: "color 0.12s ease" }}>
              Create an account
            </Link>
          </p>
        )}

      </form>
    </>
  )
}
