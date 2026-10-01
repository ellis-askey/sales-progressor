"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { PasswordStrength } from "@/components/auth/PasswordStrength";

// Matches the register / "Create your account" treatment: white backdrop + card,
// #F4F4F6 inputs with a coral hover/focus, coral primary button.
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#F4F4F6",
  border: "0.5px solid rgba(45,24,16,0.12)",
  borderRadius: "10px",
  padding: "11px 14px",
  color: "#20242E",
  fontSize: "16px",
  outline: "none",
  transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "#3F3F46",
  marginBottom: "6px",
  letterSpacing: "0.005em",
};

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!token || !email) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <p style={{ fontSize: "13px", color: "#8B2500", marginBottom: "12px" }}>Invalid reset link. Please request a new one.</p>
        <Link href="/forgot-password" style={{ fontSize: "13px", color: "#FF6B4A", fontWeight: 600, textDecoration: "none" }}>
          Request new link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
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
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#20242E", marginBottom: 4 }}>Password updated</p>
        <p style={{ fontSize: "12px", color: "#8A8A94" }}>Redirecting you to sign in…</p>
      </div>
    );
  }

  const canSubmit = !!password && !!confirm && !loading;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      <div>
        <label style={labelStyle}>New password</label>
        <div style={{ position: "relative" }}>
          <input
            className="ri ri-pr"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(32,36,46,0.40)", padding: 0, display: "flex" }}
          >
            {showPassword ? (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
        <PasswordStrength password={password} />
      </div>

      <div>
        <label style={labelStyle}>Confirm new password</label>
        <input
          className="ri"
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="Re-enter password"
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
        disabled={!canSubmit}
        className="rbtn"
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "8px",
          background: canSubmit ? "#FF6B4A" : "rgba(255,107,74,0.40)",
          color: "white",
          fontSize: "14px",
          fontWeight: 500,
          border: "none",
          cursor: canSubmit ? "pointer" : "not-allowed",
          boxShadow: "0 4px 20px rgba(255,107,74,0.30)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
        }}
      >
        {loading ? "Saving…" : "Set new password"}
      </button>

      <p style={{ textAlign: "center", fontSize: "12px", color: "#8A8A94", margin: 0 }}>
        Remember it?{" "}
        <Link href="/login" style={{ color: "#FF6B4A", fontWeight: 500, textDecoration: "none" }}>
          Sign in
        </Link>
      </p>

    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", overflow: "hidden" }}>
      {/* Architectural line-drawing background (matches /register). Centre is
          clean white space for the card; a faint white veil keeps it legible. */}
      <div aria-hidden style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "100vh", zIndex: 0,
        backgroundColor: "#ffffff",
        backgroundImage: "url(/register-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }} />
      <div aria-hidden style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "100vh", zIndex: 1,
        background: "radial-gradient(60% 55% at 50% 48%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.20) 55%, rgba(255,255,255,0) 100%)",
      }} />

      <style>{`
        .ri::placeholder { color: rgba(32,36,46,0.38); }
        .ri:hover:not(:focus) { border-color: rgba(255,138,101,0.45) !important; }
        .ri:focus { background: #ffffff !important; border-color: #FF6B4A !important; box-shadow: none !important; }
        .ri-pr { padding-right: 42px !important; }
        .rbtn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(255,107,74,0.45) !important; }
        .rbtn:active:not(:disabled) { transform: scale(0.98); }
        @keyframes rp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>

        {/* Brand mark + heading */}
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "1.1rem" }}>
            <BrandMark size={38} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "#FF6B4A", letterSpacing: "0.02em" }}>TSP</span>
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#8A7A72", letterSpacing: "0.14em", marginTop: "3px" }}>SALES PROGRESSOR</span>
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800, color: "#20242E", letterSpacing: "-0.025em", lineHeight: 1.15 }}>
            Choose a new password
          </h1>
          <p style={{ margin: "0.45rem 0 0", fontSize: "13px", color: "#8A8A94" }}>
            Make it at least 8 characters
          </p>
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

        {/* Trust footer */}
        <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            {["SSL encrypted", "GDPR compliant", "UK data"].map((item, i, arr) => (
              <span key={item} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "11px", color: "rgba(32,36,46,0.52)" }}>{item}</span>
                {i < arr.length - 1 && <span style={{ fontSize: "11px", color: "rgba(32,36,46,0.25)" }}>·</span>}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#4CAF50", animation: "rp-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "11px", color: "rgba(32,36,46,0.50)" }}>All systems operational</span>
          </div>
        </div>

      </div>
    </div>
  );
}
