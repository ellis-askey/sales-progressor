"use client";

import { signIn, signOut } from "next-auth/react";
import { SunriseBackground } from "@/components/login/SunriseBackground";
import { GoogleIcon } from "@/components/login/GoogleIcon";
import { MicrosoftIcon } from "@/components/login/MicrosoftIcon";

interface InvitationLandingClientProps {
  token: string;
  invitation: {
    id: string;
    agencyName: string;
    directorName: string;
    directorEmail: string;
    invitedByName: string;
  };
  existingEmail: string | null;
  mismatch?: boolean;
}

function BrandMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="12" fill="url(#bm-grad-ilc)" />
      <defs>
        <linearGradient id="bm-grad-ilc" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
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

const oauthBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  width: "100%",
  minHeight: "44px",
  padding: "10px 12px",
  borderRadius: "8px",
  background: "#FFFFFF",
  border: "1px solid rgba(255,138,101,0.22)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)",
  color: "#3D1F0E",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s ease",
};

export function InvitationLandingClient({ token, invitation, existingEmail, mismatch }: InvitationLandingClientProps) {
  const acceptUrl = `/invite/${token}/accept`;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <SunriseBackground />

      <style>{`
        .ilc-oauth:hover:not(:disabled) {
          background: rgba(255,255,255,1) !important;
          border-color: rgba(255,138,101,0.40) !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.07), 0 4px 10px rgba(0,0,0,0.05) !important;
          transform: translateY(-1px);
        }
        .ilc-oauth:active:not(:disabled) { transform: scale(0.98); }
      `}</style>

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>

        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ display: "inline-flex", marginBottom: "1.25rem" }}>
            <BrandMark />
          </div>
          <h1 style={{ margin: 0, fontSize: "1.625rem", fontWeight: 600, color: "#3D1F0E", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            You&apos;ve been invited.
          </h1>
          <p style={{ margin: "0.4rem 0 0", fontSize: "13px", color: "#7A4A2E", opacity: 0.85, lineHeight: 1.5 }}>
            <strong style={{ color: "#3D1F0E" }}>{invitation.invitedByName}</strong> has invited you to join{" "}
            <strong style={{ color: "#3D1F0E" }}>{invitation.agencyName}</strong> on Sales Progressor as the director.
          </p>
        </div>

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

          {mismatch && (
            <div style={{
              marginBottom: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(216,90,53,0.08)",
              border: "1px solid rgba(216,90,53,0.25)",
              fontSize: "13px",
              color: "#7A2E0E",
              lineHeight: 1.5,
            }}>
              That account&apos;s email doesn&apos;t match the invitation. Please sign in with{" "}
              <strong>{invitation.directorEmail}</strong>.
            </div>
          )}

          {existingEmail ? (
            /* Already signed in — ask them to sign out first */
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#7A4A2E", lineHeight: 1.6 }}>
                You&apos;re currently signed in as <strong style={{ color: "#3D1F0E" }}>{existingEmail}</strong>.
                Sign out to accept this invitation with a different account.
              </p>
              <button
                onClick={() => signOut({ callbackUrl: `/invite/${token}` })}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "#D85A35",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(216,90,53,0.35)",
                }}
              >
                Sign out and continue
              </button>
            </div>
          ) : (
            /* Normal landing — show sign-up options */
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                className="ilc-oauth"
                onClick={() => signIn("google", { callbackUrl: acceptUrl })}
                style={oauthBtnStyle}
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <button
                type="button"
                className="ilc-oauth"
                onClick={() => signIn("azure-ad", { callbackUrl: acceptUrl })}
                style={oauthBtnStyle}
              >
                <MicrosoftIcon />
                Continue with Microsoft
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "2px 0" }}>
                <div style={{ flex: 1, height: "0.5px", background: "rgba(61,31,14,0.15)" }} />
                <span style={{ fontSize: "11px", color: "rgba(61,31,14,0.40)", whiteSpace: "nowrap" }}>or</span>
                <div style={{ flex: 1, height: "0.5px", background: "rgba(61,31,14,0.15)" }} />
              </div>

              <a
                href={`/invite/${token}/password`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  minHeight: "44px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.50)",
                  border: "1px solid rgba(220,100,70,0.25)",
                  color: "#3D1F0E",
                  fontSize: "13px",
                  fontWeight: 500,
                  textDecoration: "none",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              >
                Continue with email &amp; password
              </a>

              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "rgba(61,31,14,0.45)", textAlign: "center" }}>
                Invitation sent to {invitation.directorEmail}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
