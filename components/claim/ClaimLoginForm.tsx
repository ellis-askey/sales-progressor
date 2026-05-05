"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  token: string;
  stubEmail: string;
};

export function ClaimLoginForm({ token, stubEmail }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = password.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    // Step 1: sign in
    const result = await signIn("credentials", {
      email: stubEmail,
      password,
      redirect: false,
    });

    if (result?.error || !result?.ok) {
      setLoading(false);
      setError("Incorrect password. Please try again.");
      return;
    }

    // Step 2: claim the chain link
    const claimRes = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "create" }),
    });

    if (!claimRes.ok) {
      const data = await claimRes.json().catch(() => ({}));
      setLoading(false);
      setError((data as { error?: string }).error ?? "Claim failed. Please try again.");
      return;
    }

    const { transactionId } = (await claimRes.json()) as { transactionId: string };
    router.push(`/agent/transactions/${transactionId}?claimed=1`);
    // loading stays true — component unmounts on navigation
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    color: "#1a1d29",
    outline: "none",
    boxSizing: "border-box",
  };

  const lockedInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: "#f1f5f9",
    color: "#64748b",
    cursor: "not-allowed",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#8b91a3",
    marginBottom: 6,
  };

  return (
    <>
      <style>{`
        .cl-input:focus { border-color: #FF6B4A !important; box-shadow: 0 0 0 3px rgba(255,107,74,0.12); background: #fff !important; }
        .cl-btn:hover:not(:disabled) { background: #e85a38 !important; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,107,74,0.35) !important; }
        .cl-btn:active:not(:disabled) { transform: scale(0.98); }
        .cl-link:hover { color: #1a1d29 !important; }
      `}</style>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Email — locked */}
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={stubEmail}
            readOnly
            style={lockedInputStyle}
            title="Email address is set by the invite"
          />
        </div>

        {/* Password */}
        <div>
          <label style={labelStyle}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              className="cl-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{ ...inputStyle, paddingRight: 42 }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex" }}
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

        {error && (
          <div style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link
            href="/forgot-password"
            className="cl-link"
            style={{ fontSize: 12, color: "#8b91a3", textDecoration: "none" }}
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="cl-btn"
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: 10,
            background: !canSubmit || loading ? "#f1a591" : "#FF6B4A",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            border: "none",
            cursor: !canSubmit || loading ? "not-allowed" : "pointer",
            boxShadow: "0 4px 16px rgba(255,107,74,0.28)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
          }}
        >
          {loading ? "Signing in…" : "Log in and claim"}
        </button>

      </form>
    </>
  );
}
