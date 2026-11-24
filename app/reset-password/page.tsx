"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { LabelInput } from "@/components/ui/LabelInput";
import { PageTitle } from "@/components/ui/PageTitle";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { TrustStrip } from "@/components/ui/TrustStrip";
import { Button } from "@/components/arc/button/button";

// Canonical auth shell — matches /login and /register: sunlit interior photo
// background + white veil, TSP lockup, solid white card, shared LabelInput /
// arc Button controls. Coral primary via the arc token override.
const CORAL = "#FF6B4A";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties;

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!token || !email) {
    return (
      <div style={{ padding: "8px 0" }}>
        <InlineAlert kind="danger">Invalid reset link. Please request a new one.</InlineAlert>
        <div style={{ textAlign: "center", marginTop: "14px" }}>
          <Link href="/forgot-password" style={{ fontSize: "13px", color: CORAL, fontWeight: 600, textDecoration: "none" }}>
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 10) { setError("Password must be at least 10 characters."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Reset failed. Please try again."); return; }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "rgba(31,138,74,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px",
        }}>
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#1F8A4A" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#2D1810", marginBottom: 4 }}>Password updated</p>
        <p style={{ fontSize: "12px", color: "rgba(45,24,16,0.55)" }}>Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", "--lbi-top": "0px" } as React.CSSProperties}>

      {/* Password group — the field, length hint and strength meter sit close
          together, apart from the 14px rhythm. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <LabelInput
          field="Password"
          label="New password"
          name="password"
          autoComplete="new-password"
          accent={CORAL}
          fullWidth
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {password.length > 0 && password.length < 10 && (
          <p style={{ fontSize: "11px", color: "#C97D1A", margin: 0 }}>At least 10 characters required</p>
        )}
        <PasswordStrength password={password} />
      </div>

      <LabelInput
        field="Password"
        label="Confirm new password"
        name="confirm"
        autoComplete="new-password"
        accent={CORAL}
        fullWidth
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      {error && <InlineAlert kind="danger">{error}</InlineAlert>}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        disabled={!password || !confirm}
        style={{ ...coralVars, width: "100%" }}
      >
        Set new password
      </Button>

      <p style={{ textAlign: "center", fontSize: "12px", color: "#8A8A94", margin: 0 }}>
        Remember it?{" "}
        <Link href="/login" className="rp-link" style={{ color: CORAL, fontWeight: 500, textDecoration: "none" }}>
          Sign in
        </Link>
      </p>

    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", overflow: "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes auth-enter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .auth-enter { animation: auth-enter 560ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes auth-bg-fade { from { opacity: 0; } to { opacity: 1; } }
        .auth-bg-enter { animation: auth-bg-fade 820ms ease both; }
        .auth-bg-img { background-image: url(/auth-bg-desktop.png); }
        @media (max-width: 1024px) { .auth-bg-img { background-image: url(/auth-bg-tablet.png); } }
        @media (max-width: 640px) { .auth-bg-img { background-image: url(/auth-bg-mobile.png); } }
        @media (prefers-reduced-motion: reduce) { .auth-enter, .auth-bg-enter { animation: none; } }
        .rp-link:hover { color: #E55B3D !important; }
      ` }} />

      {/* Sunlit interior background photo (matches /login + /register). */}
      <div aria-hidden className="auth-bg-enter auth-bg-img" style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "100vh", zIndex: 0,
        backgroundColor: "#ffffff",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }} />
      <div aria-hidden style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "100vh", zIndex: 1,
        background: "radial-gradient(60% 55% at 50% 48%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.20) 55%, rgba(255,255,255,0) 100%)",
      }} />

      <div className="auth-enter" style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>

        {/* Brand lockup + heading */}
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "1.1rem" }}>
            <BrandMark size={38} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "#FF6B4A", letterSpacing: "0.02em" }}>TSP</span>
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#8A7A72", letterSpacing: "0.14em", marginTop: "3px" }}>SALES PROGRESSOR</span>
            </span>
          </div>
          <PageTitle title="Choose a new password" subtitle="Make it at least 10 characters" />
        </div>

        {/* Card */}
        <div style={{
          background: "#ffffff",
          borderRadius: "18px",
          border: "1px solid rgba(23,23,30,0.06)",
          boxShadow: "0 18px 50px rgba(30,20,15,0.10), 0 4px 14px rgba(30,20,15,0.05)",
          padding: "1.75rem",
        }}>
          <Suspense fallback={<p style={{ fontSize: "14px", color: "#8A8A94", textAlign: "center" }}>Loading…</p>}>
            <ResetForm />
          </Suspense>
        </div>

        {/* Trust footer — canonical plain row (SSL · GDPR · UK data). */}
        <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center" }}>
          <TrustStrip
            variant="plain"
            items={[{ label: "SSL encrypted" }, { label: "GDPR compliant" }, { label: "UK data" }]}
          />
        </div>

      </div>
    </div>
  );
}
