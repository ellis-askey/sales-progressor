"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function toTitleCase(str: string): string {
  return str.trim().replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

type Props = {
  token: string;
  stubEmail: string;
  stubAgencyName: string;
};

export function ClaimSignupForm({ token, stubEmail, stubAgencyName }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firmName, setFirmName] = useState(toTitleCase(stubAgencyName));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    password.length >= 8 &&
    firmName.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    const name = `${firstName.trim()} ${lastName.trim()}`;

    // Step 1: create account
    const registerRes = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: stubEmail, password, firmName: firmName.trim(), role: "director" }),
    });

    if (!registerRes.ok) {
      const data = await registerRes.json().catch(() => ({}));
      setLoading(false);
      if (registerRes.status === 409) {
        setError("An account with this email already exists.");
      } else {
        setError((data as { error?: string }).error ?? "Something went wrong. Please try again.");
      }
      return;
    }

    // Step 2: sign in
    const signInResult = await signIn("credentials", {
      email: stubEmail,
      password,
      redirect: false,
    });

    if (signInResult?.error || !signInResult?.ok) {
      setLoading(false);
      setError("Account created but sign-in failed. Try logging in manually.");
      return;
    }

    // Step 3: claim the chain link
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
        .cs-input:focus { border-color: #FF6B4A !important; box-shadow: 0 0 0 3px rgba(255,107,74,0.12); background: #fff !important; }
        .cs-btn:hover:not(:disabled) { background: #e85a38 !important; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,107,74,0.35) !important; }
        .cs-btn:active:not(:disabled) { transform: scale(0.98); }
        .cs-link:hover { color: #1a1d29 !important; }
      `}</style>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Name row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>First name</label>
            <input
              className="cs-input"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
              placeholder="Jane"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Last name</label>
            <input
              className="cs-input"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
              placeholder="Smith"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Email — locked */}
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={stubEmail}
            readOnly
            style={lockedInputStyle}
            title="Email address is set by the invite and cannot be changed"
          />
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>
            Locked to the invited address
          </p>
        </div>

        {/* Password */}
        <div>
          <label style={labelStyle}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              className="cs-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              style={{ ...inputStyle, paddingRight: 42 }}
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

        {/* Agency — pre-filled, editable */}
        <div>
          <label style={labelStyle}>Agency</label>
          <input
            className="cs-input"
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            required
            autoComplete="organization"
            placeholder="Your estate agency"
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>
            {error}
            {error.includes("already exists") && (
              <>
                {" "}
                <Link
                  href={`/claim/login?token=${token}`}
                  className="cs-link"
                  style={{ color: "#FF6B4A", fontWeight: 600, textDecoration: "none" }}
                >
                  Log in instead →
                </Link>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="cs-btn"
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
          {loading ? "Creating your account…" : "Create my account"}
        </button>

        <p style={{ textAlign: "center", fontSize: 13, color: "#8b91a3", margin: 0 }}>
          Already have an account?{" "}
          <Link
            href={`/claim/login?token=${token}`}
            className="cs-link"
            style={{ color: "#FF6B4A", fontWeight: 600, textDecoration: "none" }}
          >
            Log in →
          </Link>
        </p>

      </form>
    </>
  );
}
