"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { LabelInput } from "@/components/ui/LabelInput";
import { PageTitle } from "@/components/ui/PageTitle";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Button } from "@/components/arc/button/button";

// Canonical auth shell — matches /login and /register: the sunlit interior photo
// background + white veil, the TSP lockup, a solid white card, and the shared
// LabelInput / arc Button controls. Coral primary via the arc token override.
const CORAL = "#FF6B4A";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Too many attempts. Please wait a few minutes before trying again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
        .fp-link:hover { color: #E55B3D !important; }
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
          <PageTitle title="Reset your password" subtitle="We'll send a reset link to your email" />
        </div>

        {/* Card */}
        <div style={{
          background: "#ffffff",
          borderRadius: "18px",
          border: "1px solid rgba(23,23,30,0.06)",
          boxShadow: "0 18px 50px rgba(30,20,15,0.10), 0 4px 14px rgba(30,20,15,0.05)",
          padding: "1.75rem",
        }}>

          {sent ? (
            <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "rgba(255,107,74,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 1rem",
              }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#FF6B4A" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#2D1810", margin: "0 0 6px" }}>Check your email</p>
              <p style={{ fontSize: "12px", color: "rgba(45,24,16,0.55)", margin: 0, lineHeight: 1.5 }}>
                If an account exists for <strong>{email}</strong>, a reset link has been sent. It expires in 1 hour.
              </p>
              <Link href="/login" className="fp-link" style={{ display: "inline-block", marginTop: "1.25rem", fontSize: "12px", color: "rgba(45,24,16,0.55)", fontWeight: 500, textDecoration: "none", transition: "color 0.12s ease" }}>
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", "--lbi-top": "0px" } as React.CSSProperties}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <LabelInput
                  label="Email address"
                  type="email"
                  name="email"
                  autoComplete="email"
                  accent={emailError ? "#C73E3E" : CORAL}
                  fullWidth
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(false); }}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v) setEmail(v.toLowerCase());
                    setEmailError(v.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
                  }}
                />
                {emailError && <p style={{ fontSize: "11px", color: "#C73E3E", margin: 0 }}>Enter a valid email address</p>}
              </div>

              {error && <InlineAlert kind="danger">{error}</InlineAlert>}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={!email.trim()}
                style={{ ...coralVars, width: "100%" }}
              >
                Send reset link
              </Button>

              <p style={{ textAlign: "center", fontSize: "13px", color: "rgba(45,24,16,0.55)", margin: 0 }}>
                <Link href="/login" className="fp-link" style={{ color: CORAL, fontWeight: 500, textDecoration: "none", transition: "color 0.12s ease" }}>
                  Back to sign in
                </Link>
              </p>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
