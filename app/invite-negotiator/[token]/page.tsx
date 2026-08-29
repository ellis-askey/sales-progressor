import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validateNegotiatorInvitationToken } from "@/lib/auth/validate-negotiator-invitation-token";
import { SunriseBackground } from "@/components/login/SunriseBackground";
import { BrandMark } from "@/components/brand/BrandMark";
import { NegotiatorInvitationLandingClient } from "./NegotiatorInvitationLandingClient";

interface InvitePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mismatch?: string }>;
}

function ErrorCard({ title, body }: { title: string; body: string }) {
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
            {title}
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#7A4A2E", lineHeight: 1.6, opacity: 0.85 }}>
            {body}
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

export default async function NegotiatorInvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const { mismatch } = await searchParams;

  const result = await validateNegotiatorInvitationToken(token);

  if (!result.valid) {
    if (result.error === "already_accepted") {
      return <ErrorCard title="Already accepted" body="This invitation has already been used. Sign in if you've set up your account." />;
    }
    if (result.error === "expired") {
      return <ErrorCard title="Invitation expired" body="This invitation link has expired. Ask the director who invited you to send a new one." />;
    }
    // not_found or cancelled
    return <ErrorCard title="Invitation not found" body="This invitation link is no longer valid. Ask the director who invited you to send a new one." />;
  }

  const session = await getServerSession(authOptions);
  const existingEmail = session?.user?.email ?? null;

  return (
    <NegotiatorInvitationLandingClient
      token={token}
      invitation={result.invitation}
      existingEmail={existingEmail}
      mismatch={mismatch === "1"}
    />
  );
}
