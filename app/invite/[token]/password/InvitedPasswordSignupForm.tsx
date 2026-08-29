"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { acceptInvitationPassword } from "@/app/actions/accept-invitation-password";
import { PasswordStrength } from "@/components/auth/PasswordStrength";

interface Props {
  token: string;
  directorEmail: string;
  directorName: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid rgba(255,138,101,0.28)",
  background: "rgba(255,255,255,0.70)",
  fontSize: "14px",
  color: "#3D1F0E",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase" as const,
  color: "#7A4A2E",
  marginBottom: "6px",
};

export function InvitedPasswordSignupForm({ token, directorEmail, directorName }: Props) {
  const [name, setName] = useState(directorName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    const fd = new FormData();
    fd.set("token", token);
    fd.set("name", name.trim());
    fd.set("password", password);

    startTransition(async () => {
      const result = await acceptInvitationPassword(null, fd);
      if (result?.ok) {
        await signIn("credentials", {
          email: directorEmail,
          password,
          callbackUrl: "/",
        });
      } else {
        setError(result?.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
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
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Email — pre-filled, read-only */}
        <div>
          <label style={labelStyle}>Email address</label>
          <input
            type="email"
            value={directorEmail}
            readOnly
            style={{ ...inputStyle, background: "rgba(255,255,255,0.40)", color: "rgba(61,31,14,0.55)" }}
          />
        </div>

        {/* Full name — pre-filled from invitation, editable */}
        <div>
          <label style={labelStyle}>Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        {/* Password */}
        <div>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="At least 8 characters"
            style={inputStyle}
          />
          <PasswordStrength password={password} />
        </div>

        {/* Confirm password */}
        <div>
          <label style={labelStyle}>Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            placeholder="Repeat your password"
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(216,90,53,0.08)",
            border: "1px solid rgba(216,90,53,0.25)",
            fontSize: "13px",
            color: "#7A2E0E",
            lineHeight: 1.5,
          }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            background: isPending ? "rgba(216,90,53,0.55)" : "#D85A35",
            color: "white",
            fontSize: "14px",
            fontWeight: 500,
            border: "none",
            cursor: isPending ? "not-allowed" : "pointer",
            boxShadow: "0 4px 20px rgba(216,90,53,0.35)",
            transition: "background 150ms",
          }}
        >
          {isPending ? "Setting up your account…" : "Create account"}
        </button>

        <p style={{ margin: 0, fontSize: "12px", color: "rgba(61,31,14,0.50)", textAlign: "center", lineHeight: 1.5 }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "#D85A35", textDecoration: "none", fontWeight: 500 }}>Sign in</a>
        </p>
      </form>
    </div>
  );
}
