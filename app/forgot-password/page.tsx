"use client";

import { useState } from "react";
import Link from "next/link";
import { SunriseBackground } from "@/components/login/SunriseBackground";
import { BrandMark } from "@/components/brand/BrandMark";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.50)",
  border: "0.5px solid rgba(255,255,255,0.70)",
  borderRadius: "8px",
  padding: "10px 14px",
  color: "#3D1F0E",
  fontSize: "16px",
  outline: "none",
  transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
  boxSizing: "border-box",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <SunriseBackground />

      <style>{`
        .fp-input::placeholder { color: rgba(61,31,14,0.42); }
        .fp-input:focus {
          background: rgba(255,255,255,0.62) !important;
          border-color: rgba(255,255,255,0.95) !important;
          box-shadow: 0 0 0 3px rgba(255,138,101,0.16);
        }
        .fp-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(216,90,53,0.45) !important;
        }
        .fp-btn:active:not(:disabled) { transform: scale(0.98); }
        .fp-link:hover { color: #3D1F0E !important; }
      `}</style>

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "380px" }}>

        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ display: "inline-flex", marginBottom: "1.25rem" }}>
            <BrandMark />
          </div>
          <h1 style={{ margin: 0, fontSize: "1.625rem", fontWeight: 600, color: "#3D1F0E", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Reset your password
          </h1>
          <p style={{ margin: "0.4rem 0 0", fontSize: "12px", color: "#7A4A2E", opacity: 0.85 }}>
            We&apos;ll send a reset link to your email
          </p>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.38)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRadius: "16px",
          border: "0.5px solid rgba(255,255,255,0.60)",
          borderTop: "0.5px solid rgba(255,255,255,0.82)",
          padding: "1.75rem",
          boxShadow: "0 20px 60px rgba(200,80,30,0.16), inset 0 0 0 0.5px rgba(255,255,255,0.14)",
        }}>

          {sent ? (
            <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "rgba(255,138,101,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 1rem",
              }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#D85A35" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#3D1F0E", margin: "0 0 6px" }}>Check your email</p>
              <p style={{ fontSize: "12px", color: "#7A4A2E", margin: 0, lineHeight: 1.5 }}>
                If an account exists for <strong>{email}</strong>, a reset link has been sent. It expires in 1 hour.
              </p>
              <Link href="/login" className="fp-link" style={{ display: "inline-block", marginTop: "1.25rem", fontSize: "12px", color: "#7A4A2E", fontWeight: 500, textDecoration: "none", transition: "color 0.12s ease" }}>
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#7A4A2E", marginBottom: "6px", letterSpacing: "0.01em" }}>
                  Email address
                </label>
                <input
                  className="fp-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="you@agency.co.uk"
                  style={inputStyle}
                />
              </div>

              {error && (
                <p style={{ fontSize: "12px", color: "#8B2500", background: "rgba(255,210,190,0.55)", padding: "8px 12px", borderRadius: "8px", margin: 0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="fp-btn"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  background: loading || !email.trim() ? "rgba(220,90,55,0.45)" : "#D85A35",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 500,
                  border: "none",
                  cursor: loading || !email.trim() ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 20px rgba(216,90,53,0.35)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
                }}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>

              <p style={{ textAlign: "center", fontSize: "12px", color: "#7A4A2E", margin: 0 }}>
                <Link href="/login" className="fp-link" style={{ color: "#D2553A", fontWeight: 500, textDecoration: "none", transition: "color 0.12s ease" }}>
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
