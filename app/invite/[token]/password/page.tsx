import { validateInvitationToken } from "@/lib/auth/validate-invitation-token";
import { SunriseBackground } from "@/components/login/SunriseBackground";
import { BrandMark } from "@/components/brand/BrandMark";
import { InvitedPasswordSignupForm } from "./InvitedPasswordSignupForm";

interface PasswordPageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePasswordPage({ params }: PasswordPageProps) {
  const { token } = await params;

  const result = await validateInvitationToken(token);

  if (!result.valid) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
        <SunriseBackground />
        <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", marginBottom: "1.25rem" }}>
            <BrandMark />
          </div>
          <div style={{
            background: "rgba(255,255,255,0.38)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            borderRadius: "16px",
            border: "0.5px solid rgba(255,255,255,0.60)",
            borderTop: "0.5px solid rgba(255,255,255,0.82)",
            padding: "2rem 1.75rem",
            boxShadow: "0 20px 60px rgba(200,80,30,0.16), inset 0 0 0 0.5px rgba(255,255,255,0.14)",
          }}>
            <h1 style={{ margin: "0 0 12px", fontSize: "1.25rem", fontWeight: 600, color: "#3D1F0E", letterSpacing: "-0.02em" }}>
              {result.error === "already_accepted" ? "Already accepted" : "Invitation unavailable"}
            </h1>
            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#7A4A2E", lineHeight: 1.6, opacity: 0.85 }}>
              {result.error === "already_accepted"
                ? "This invitation has already been used. Sign in if you've set up your account."
                : "This invitation link is no longer valid. Ask the person who invited you to send a new one."}
            </p>
            <a
              href="/login"
              style={{
                display: "inline-block",
                padding: "10px 24px",
                borderRadius: "8px",
                background: "#D85A35",
                color: "white",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Go to sign-in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <SunriseBackground />
      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ display: "inline-flex", marginBottom: "1.25rem" }}>
            <BrandMark />
          </div>
          <h1 style={{ margin: 0, fontSize: "1.625rem", fontWeight: 600, color: "#3D1F0E", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Create your account
          </h1>
          <p style={{ margin: "0.4rem 0 0", fontSize: "13px", color: "#7A4A2E", opacity: 0.85, lineHeight: 1.5 }}>
            Joining <strong style={{ color: "#3D1F0E" }}>{result.invitation.agencyName}</strong> as director
          </p>
        </div>

        <InvitedPasswordSignupForm
          token={token}
          directorEmail={result.invitation.directorEmail}
          directorName={result.invitation.directorName}
        />
      </div>
    </div>
  );
}
