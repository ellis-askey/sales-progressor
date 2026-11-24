"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { acceptMoveInviteAction } from "@/app/actions/accept-move-invite";
import { PageTitle } from "@/components/ui/PageTitle";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Button, buttonClasses } from "@/components/arc/button/button";

interface Props {
  token: string;
  agencyName: string;
  invitedByName: string;
  // Present only when the signed-in account is NOT the invited email.
  mismatchEmail?: string;
  inviteEmail?: string;
}

// Canonical warm card shell — matches the sign-in family (PageTitle heading,
// arc Button controls, InlineAlert for errors). Single column, centred.
const CORAL = "#FF6B4A";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties;

const wrap: React.CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", background: "#F6F1EC" };
const card: React.CSSProperties = { width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, padding: "2.25rem 2rem", boxShadow: "0 18px 50px rgba(45,24,16,0.10), 0 4px 14px rgba(45,24,16,0.05)", border: "1px solid rgba(23,23,30,0.06)", textAlign: "center" };
const body: React.CSSProperties = { margin: "10px 0 20px", fontSize: 14, lineHeight: 1.6, color: "rgba(45,24,16,0.60)" };

export function MoveInviteClient({ token, agencyName, invitedByName, mismatchEmail, inviteEmail }: Props) {
  const [state, setState] = useState<"idle" | "working" | "moved" | "flagged" | "error">("idle");
  const [error, setError] = useState("");

  if (mismatchEmail) {
    return (
      <div style={wrap}>
        <div style={card}>
          <PageTitle title="Signed in as someone else." style={{ marginBottom: 10 }} />
          <p style={body}>
            You&apos;re signed in as <strong>{mismatchEmail}</strong>, but this invitation is for{" "}
            <strong>{inviteEmail}</strong>. Sign out and sign back in with that account to continue.
          </p>
          <Button variant="primary" size="lg" style={{ ...coralVars, width: "100%" }} onClick={() => signOut({ callbackUrl: `/move-invite/${token}` })}>
            Sign out and continue
          </Button>
        </div>
      </div>
    );
  }

  if (state === "moved") {
    return (
      <div style={wrap}>
        <div style={card}>
          <PageTitle title={`You're now part of ${agencyName}.`} style={{ marginBottom: 10 }} />
          <p style={body}>Please sign in again to load your new agency.</p>
          <Button variant="primary" size="lg" style={{ ...coralVars, width: "100%" }} onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  if (state === "flagged") {
    return (
      <div style={wrap}>
        <div style={card}>
          <PageTitle title="We're on it." style={{ marginBottom: 10 }} />
          <p style={body}>
            We&apos;ll move your existing sales into {agencyName} carefully and be in touch. Nothing has changed yet,
            so you can keep working as normal in the meantime.
          </p>
          <a href="/agent/hub" className={buttonClasses({ variant: "primary", size: "lg" })} style={{ ...coralVars, width: "100%", textDecoration: "none" }}>
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
        <PageTitle title={`Join ${agencyName}.`} style={{ marginBottom: 10 }} />
        <p style={body}>
          <strong>{invitedByName}</strong> has invited you to move your account into {agencyName}. You&apos;ll leave your
          current setup and join their team. If you have any live sales, we&apos;ll carry those across for you.
        </p>
        {state === "error" && (
          <div style={{ marginBottom: 16, textAlign: "left" }}>
            <InlineAlert kind="danger">{error}</InlineAlert>
          </div>
        )}
        <Button
          variant="primary"
          size="lg"
          loading={state === "working"}
          style={{ ...coralVars, width: "100%" }}
          onClick={confirm}
        >
          Join {agencyName}
        </Button>
        <div style={{ marginTop: 6 }}>
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
