"use client";

import { signIn, signOut } from "next-auth/react";
import { GoogleIcon } from "@/components/login/GoogleIcon";
import { MicrosoftIcon } from "@/components/login/MicrosoftIcon";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button, buttonClasses } from "@/components/arc/button/button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import type { ValidatedNegotiatorInvitation } from "@/lib/auth/validate-negotiator-invitation-token";

// Canonical auth shell — matches /login and /register: sunlit interior photo
// background + white veil, TSP lockup, solid white card, shared arc Button
// controls. Coral primary via the arc token override.
const CORAL = "#FF6B4A";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties;

interface Props {
  token: string;
  invitation: ValidatedNegotiatorInvitation;
  existingEmail: string | null;
  mismatch?: boolean;
}

export function NegotiatorInvitationLandingClient({ token, invitation, existingEmail, mismatch }: Props) {
  const acceptUrl = `/invite-negotiator/${token}/accept`;

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", overflow: "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes auth-enter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .auth-enter { animation: auth-enter 560ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes auth-bg-fade { from { opacity: 0; } to { opacity: 1; } }
        .auth-bg-enter { animation: auth-bg-fade 820ms ease both; }
        .auth-bg-img { background-image: url(/auth-bg-desktop.png); }
        @media (max-width: 1024px) { .auth-bg-img { background-image: url(/auth-bg-tablet.png); } }
        @media (max-width: 640px) { .auth-bg-img { background-image: url(/auth-bg-mobile.png); } }
        @media (prefers-reduced-motion: reduce) { .auth-enter, .auth-bg-enter { animation: none; } }
      ` }} />

      {/* Sunlit interior background photo (matches /login + /register). */}
      <div aria-hidden className="auth-bg-enter auth-bg-img" style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "100vh", zIndex: 0,
        backgroundColor: "#ffffff",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }} />
      <div aria-hidden style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "100vh", zIndex: 1,
        background: "radial-gradient(60% 55% at 50% 48%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.20) 55%, rgba(255,255,255,0) 100%)",
      }} />

      <div className="auth-enter" style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>

        {/* Brand lockup + heading */}
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "1.1rem" }}>
            <BrandMark size={38} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "#FF6B4A", letterSpacing: "0.02em" }}>TSP</span>
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#8A7A72", letterSpacing: "0.14em", marginTop: "3px" }}>SALES PROGRESSOR</span>
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600, color: "#2D1810", letterSpacing: "-0.01em", lineHeight: 1.15 }}>
            You&apos;ve been invited
          </h1>
          <p style={{ margin: "0.45rem 0 0", fontSize: "13px", color: "rgba(45,24,16,0.55)", lineHeight: 1.5 }}>
            <strong style={{ color: "#2D1810" }}>{invitation.invitedByName}</strong> has invited you to join{" "}
            <strong style={{ color: "#2D1810" }}>{invitation.agencyName}</strong> on Sales Progressor as a negotiator.
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

          {mismatch && (
            <div style={{ marginBottom: "14px" }}>
              <InlineAlert kind="warning">
                That account&apos;s email doesn&apos;t match the invitation. Please sign in with <strong>{invitation.negotiatorEmail}</strong>.
              </InlineAlert>
            </div>
          )}

          {existingEmail && existingEmail.toLowerCase() !== invitation.negotiatorEmail.toLowerCase() ? (
            /* Signed in with a different account — ask them to sign out first */
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(45,24,16,0.55)", lineHeight: 1.6 }}>
                You&apos;re currently signed in as <strong style={{ color: "#2D1810" }}>{existingEmail}</strong>.
                Sign out to accept this invitation with a different account.
              </p>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => signOut({ callbackUrl: `/invite-negotiator/${token}` })}
                style={{ ...coralVars, width: "100%" }}
              >
                Sign out and continue
              </Button>
            </div>
          ) : (
            /* Normal landing — show sign-up options */
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => signIn("google", { callbackUrl: acceptUrl })}
                style={{ width: "100%" }}
              >
                <GoogleIcon />
                Continue with Google
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => signIn("azure-ad", { callbackUrl: acceptUrl })}
                style={{ width: "100%" }}
              >
                <MicrosoftIcon />
                Continue with Microsoft
              </Button>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "2px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "rgba(32,36,46,0.10)" }} />
                <span style={{ fontSize: "11px", color: "rgba(32,36,46,0.42)", whiteSpace: "nowrap" }}>or</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(32,36,46,0.10)" }} />
              </div>

              <a
                href={`/invite-negotiator/${token}/password`}
                className={buttonClasses({ variant: "secondary", size: "lg" })}
                style={{ width: "100%", textDecoration: "none" }}
              >
                Continue with email &amp; password
              </a>

              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "rgba(45,24,16,0.45)", textAlign: "center" }}>
                Invitation sent to {invitation.negotiatorEmail}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
