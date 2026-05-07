import { redirect } from "next/navigation";
import { validateNegotiatorInvitationToken } from "@/lib/auth/validate-negotiator-invitation-token";
import { SunriseBackground } from "@/components/login/SunriseBackground";
import { InvitedNegotiatorPasswordSignupForm } from "./InvitedNegotiatorPasswordSignupForm";

interface PasswordPageProps {
  params: Promise<{ token: string }>;
}

function BrandMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="12" fill="url(#bm-grad-neg-pw)" />
      <defs>
        <linearGradient id="bm-grad-neg-pw" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
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
