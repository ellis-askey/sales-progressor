import { redirect } from "next/navigation";
import { validateNegotiatorInvitationToken } from "@/lib/auth/validate-negotiator-invitation-token";
import { SunriseBackground } from "@/components/login/SunriseBackground";
import { BrandMark } from "@/components/brand/BrandMark";
import { InvitedNegotiatorPasswordSignupForm } from "./InvitedNegotiatorPasswordSignupForm";

interface PasswordPageProps {
  params: Promise<{ token: string }>;
}

export default async function NegotiatorInvitePasswordPage({ params }: PasswordPageProps) {
  const { token } = await params;

  const result = await validateNegotiatorInvitationToken(token);

  if (!result.valid) {
    redirect(`/invite-negotiator/${token}`);
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
            Joining <strong style={{ color: "#3D1F0E" }}>{result.invitation.agencyName}</strong> as a negotiator
          </p>
        </div>

        <InvitedNegotiatorPasswordSignupForm
          token={token}
          negotiatorEmail={result.invitation.negotiatorEmail}
          negotiatorName={result.invitation.negotiatorName}
        />
      </div>
    </div>
  );
}
