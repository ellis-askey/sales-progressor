"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SunriseBackground } from "@/components/login/SunriseBackground";

function BrandMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="12" fill="url(#bm-grad-r)" />
      <defs>
        <linearGradient id="bm-grad-r" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFAA7A" />
          <stop offset="100%" stopColor="#FF6B4A" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="22" r="3" fill="white" fillOpacity="0.55" />
      <line x1="13" y1="22" x2="18" y2="22" stroke="white" strokeWidth="1.5" strokeOpacity="0.40" strokeLinecap="round" />
      <circle cx="21" cy="22" r="3" fill="white" fillOpacity="0.78" />
      <line x1="24" y1="22" x2="29" y2="22" stroke="white" strokeWidth="1.5" strokeOpacity="0.40" strokeLinecap="round" />
      <circle cx="34" cy="22" r="4" fill="white" />
      <path d="M32.2 22l1.5 1.5 2.8-2.8" stroke="#FF7A54" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
        <Link href="/forgot-password" style={{ fontSize: "13px", color: "#D85A35", fontWeight: 500, textDecoration: "none" }}>
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
        <p style={{ fontSize: "14px", fontWeight: 500, color: "#3D1F0E", marginBottom: 4 }}>Password updated</p>
        <p style={{ fontSize: "12px", color: "#7A4A2E" }}>Redirecting you to sign in…</p>
      </div>
    );
  }

  const canSubmit = !!password && !!confirm && !loading;

  return (
    <>
      <style>{`
        .rp-wi::placeholder { color: rgba(61,31,14,0.42); }
        .rp-wi:focus {
          background: rgba(255,255,255,0.62) !important;
          border-color: rgba(255,255,255,0.95) !important;
          box-shadow: 0 0 0 3px rgba(255,138,101,0.16);
        }
        .rp-wi-pw { padding-right: 42px !important; }
        .rp-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(216,90,53,0.45) !important;
        }
        .rp-btn:active:not(:disabled) { transform: scale(0.98); }
      `}</style>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#7A4A2E", marginBottom: "6px", letterSpacing: "0.01em" }}>
            New password
          </label>
          <div style={{ position: "relative" }}>
            <input
              className="rp-wi rp-wi-pw"
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
              style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(61,31,14,0.40)", padding: 0, display: "flex" }}
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
        </div>

        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#7A4A2E", marginBottom: "6px", letterSpacing: "0.01em" }}>
            Confirm new password
          </label>
          <input
            className="rp-wi"
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
          className="rp-btn"
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            background: canSubmit ? "#D85A35" : "rgba(220,90,55,0.45)",
            color: "white",
            fontSize: "14px",
            fontWeight: 500,
            border: "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            boxShadow: "0 4px 20px rgba(216,90,53,0.35)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
          }}
        >
          {loading ? "Saving…" : "Set new password"}
        </button>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#7A4A2E", margin: 0 }}>
          Remember it?{" "}
          <Link href="/login" style={{ color: "#D2553A", fontWeight: 500, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>

      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <SunriseBackground />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "380px" }}>

        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ display: "inline-flex", marginBottom: "1.25rem" }}>
            <BrandMark />
          </div>
          <h1 style={{ margin: 0, fontSize: "1.625rem", fontWeight: 600, color: "#3D1F0E", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Choose a new password
          </h1>
          <p style={{ margin: "0.4rem 0 0", fontSize: "12px", color: "#7A4A2E", opacity: 0.85 }}>
            Make it at least 8 characters
          </p>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.38)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRadius: "16px",
          border: "0.5px solid rgba(255,255,255,0.60)",
          borderTop: "0.5px solid rgba(255,255,255,0.82)" as never,
          padding: "1.75rem",
          boxShadow: "0 20px 60px rgba(200,80,30,0.16), inset 0 0 0 0.5px rgba(255,255,255,0.14)",
        }}>
          <Suspense fallback={<p style={{ fontSize: "14px", color: "#7A4A2E", textAlign: "center" }}>Loading…</p>}>
            <ResetForm />
          </Suspense>
        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            {["SSL encrypted", "GDPR compliant", "UK data"].map((item, i, arr) => (
              <span key={item} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "11px", color: "rgba(61,31,14,0.52)" }}>{item}</span>
                {i < arr.length - 1 && <span style={{ fontSize: "11px", color: "rgba(61,31,14,0.25)" }}>·</span>}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#4CAF50", animation: "rp-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "11px", color: "rgba(61,31,14,0.50)" }}>All systems operational</span>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes rp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
