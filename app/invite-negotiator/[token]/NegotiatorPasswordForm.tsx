"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { acceptNegotiatorInvitation } from "@/app/actions/accept-negotiator-invitation";

export function NegotiatorPasswordForm({
  token,
  negotiatorEmail,
  defaultName,
}: {
  token: string;
  negotiatorEmail: string;
  defaultName: string;
}) {
  const [name, setName] = useState(defaultName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setError(null);

    const fd = new FormData();
    fd.set("token", token);
    fd.set("name", name.trim());
    fd.set("password", password);

    startTransition(async () => {
      const result = await acceptNegotiatorInvitation(null, fd);
      if ("ok" in result && result.ok) {
        await signIn("credentials", {
          email: negotiatorEmail,
          password,
          callbackUrl: "/agent/hub",
        });
      } else if ("error" in result) {
        setError(result.error);
      }
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
    fontSize: 14, color: "#1a1d29", outline: "none", boxSizing: "border-box",
    background: "#fff",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600, color: "#475569",
    marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={negotiatorEmail}
          readOnly
          style={{ ...inputStyle, background: "#f8fafc", color: "#94a3b8", cursor: "not-allowed" }}
        />
      </div>

      <div>
        <label style={labelStyle}>Your name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          required
          autoFocus
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
          required
          style={inputStyle}
        />
      </div>

      {error && (
        <p style={{ margin: 0, fontSize: 13, color: "#ef4444", padding: "10px 14px", background: "#fef2f2", borderRadius: 8 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !password || !confirm}
        style={{
          padding: "13px", borderRadius: 12, background: "#FF6B4A", color: "#fff",
          fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
          opacity: isPending ? 0.6 : 1, transition: "opacity 0.15s",
        }}
      >
        {isPending ? "Setting up your account…" : "Set password and sign in"}
      </button>
    </form>
  );
}
