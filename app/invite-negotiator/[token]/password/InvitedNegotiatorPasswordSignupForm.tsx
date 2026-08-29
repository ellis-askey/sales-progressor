"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { acceptNegotiatorInvitationPassword } from "@/app/actions/accept-negotiator-invitation-password";
import { PasswordStrength } from "@/components/auth/PasswordStrength";

interface Props {
  token: string;
  negotiatorEmail: string;
  negotiatorName: string;
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

export function InvitedNegotiatorPasswordSignupForm({ token, negotiatorEmail, negotiatorName }: Props) {
  const [name, setName] = useState(negotiatorName);
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
    fd.set("confirm", confirm);

    startTransition(async () => {
      const result = await acceptNegotiatorInvitationPassword(fd);
      if (result?.ok) {
        await signIn("credentials", {
          email: negotiatorEmail,
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

        <div>
          <label style={labelStyle}>Email address</label>
          <input
            type="email"
            value={negotiatorEmail}
            readOnly
            style={{ ...inputStyle, background: "rgba(255,255,255,0.40)", color: "rgba(61,31,14,0.55)" }}
          />
        </div>

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
          <p style={{ margin: 0, fontSize: "13px", color: "#C0392B", lineHeight: 1.5 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || !name.trim() || !password || !confirm}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            background: isPending ? "rgba(216,90,53,0.6)" : "#D85A35",
            color: "white",
            fontSize: "14px",
            fontWeight: 500,
            border: "none",
            cursor: isPending ? "not-allowed" : "pointer",
            boxShadow: "0 4px 20px rgba(216,90,53,0.35)",
            transition: "opacity 0.15s",
          }}
        >
          {isPending ? "Creating account…" : "Create account"}
        </button>

      </form>
    </div>
  );
}
