"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { acceptMoveInviteAction } from "@/app/actions/accept-move-invite";

interface Props {
  token: string;
  agencyName: string;
  invitedByName: string;
  // Present only when the signed-in account is NOT the invited email.
  mismatchEmail?: string;
  inviteEmail?: string;
}

const wrap: React.CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", background: "#F4F4F6" };
const card: React.CSSProperties = { width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, padding: "2.25rem 2rem", boxShadow: "0 10px 40px rgba(32,36,46,0.10)", textAlign: "center" };
const h1: React.CSSProperties = { margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: "#20242E", letterSpacing: "-0.01em", lineHeight: 1.25 };
const p: React.CSSProperties = { margin: "0 0 20px", fontSize: 14, lineHeight: 1.6, color: "rgba(32,36,46,0.62)" };
const primary: React.CSSProperties = { width: "100%", padding: "13px", borderRadius: 10, background: "#FF6B4A", color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer" };
const ghost: React.CSSProperties = { marginTop: 12, background: "none", border: "none", color: "rgba(32,36,46,0.55)", fontSize: 13, textDecoration: "underline", cursor: "pointer" };

export function MoveInviteClient({ token, agencyName, invitedByName, mismatchEmail, inviteEmail }: Props) {
  const [state, setState] = useState<"idle" | "working" | "moved" | "flagged" | "error">("idle");
  const [error, setError] = useState("");

  if (mismatchEmail) {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={h1}>Signed in as someone else</h1>
          <p style={p}>
            You&apos;re signed in as <strong>{mismatchEmail}</strong>, but this invitation is for{" "}
            <strong>{inviteEmail}</strong>. Sign out and sign back in with that account to continue.
          </p>
          <button style={primary} onClick={() => signOut({ callbackUrl: `/move-invite/${token}` })}>
            Sign out and continue
          </button>
        </div>
      </div>
    );
  }

  if (state === "moved") {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={h1}>You&apos;re now part of {agencyName}</h1>
          <p style={p}>Please sign in again to load your new agency.</p>
          <button style={primary} onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign in to continue
          </button>
        </div>
      </div>
    );
  }

  if (state === "flagged") {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={h1}>We&apos;re on it</h1>
          <p style={p}>
            We&apos;ll move your existing sales into {agencyName} carefully and be in touch. Nothing has changed yet,
            so you can keep working as normal in the meantime.
          </p>
          <a href="/agent/hub" style={{ ...primary, display: "block", textDecoration: "none", boxSizing: "border-box" }}>
            Back to your dashboard
          </a>
        </div>
      </div>
    );
  }

  async function confirm() {
    setState("working");
    setError("");
    try {
      const res = await acceptMoveInviteAction(token);
      if (res.ok) {
        setState(res.outcome === "flagged" ? "flagged" : "moved");
      } else {
        setError(res.error);
        setState("error");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setState("error");
    }
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={h1}>Join {agencyName}?</h1>
        <p style={p}>
          <strong>{invitedByName}</strong> has invited you to move your account into {agencyName}. You&apos;ll leave your
          current setup and join their team. If you have any live sales, we&apos;ll carry those across for you.
        </p>
        {state === "error" && (
          <p style={{ ...p, color: "#8B2500", background: "rgba(255,210,190,0.5)", padding: "8px 12px", borderRadius: 8 }}>{error}</p>
        )}
        <button style={{ ...primary, opacity: state === "working" ? 0.7 : 1 }} disabled={state === "working"} onClick={confirm}>
          {state === "working" ? "Confirming…" : `Join ${agencyName}`}
        </button>
        <div>
          <button style={ghost} onClick={() => signOut({ callbackUrl: "/login" })}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
