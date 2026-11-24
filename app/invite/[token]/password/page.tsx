import { validateInvitationToken } from "@/lib/auth/validate-invitation-token";
import { BrandMark } from "@/components/brand/BrandMark";
import { InvitedPasswordSignupForm } from "./InvitedPasswordSignupForm";

interface PasswordPageProps {
  params: Promise<{ token: string }>;
}

// Canonical auth shell — matches /login and /register: sunlit interior photo
// background + white veil, TSP lockup, solid white card.
const AUTH_BG_STYLE = `
  @keyframes auth-enter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  .auth-enter { animation: auth-enter 560ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  @keyframes auth-bg-fade { from { opacity: 0; } to { opacity: 1; } }
  .auth-bg-enter { animation: auth-bg-fade 820ms ease both; }
  .auth-bg-img { background-image: url(/auth-bg-desktop.png); }
  @media (max-width: 1024px) { .auth-bg-img { background-image: url(/auth-bg-tablet.png); } }
  @media (max-width: 640px) { .auth-bg-img { background-image: url(/auth-bg-mobile.png); } }
  @media (prefers-reduced-motion: reduce) { .auth-enter, .auth-bg-enter { animation: none; } }
`;

function AuthBackdrop() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: AUTH_BG_STYLE }} />
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
    </>
  );
}

function Lockup() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "1.1rem" }}>
      <BrandMark size={38} />
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
        <span style={{ fontSize: "20px", fontWeight: 800, color: "#FF6B4A", letterSpacing: "0.02em" }}>TSP</span>
        <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#8A7A72", letterSpacing: "0.14em", marginTop: "3px" }}>SALES PROGRESSOR</span>
      </span>
    </div>
  );
}

export default async function InvitePasswordPage({ params }: PasswordPageProps) {
  const { token } = await params;

  const result = await validateInvitationToken(token);

  if (!result.valid) {
    return (
      <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", overflow: "hidden" }}>
        <AuthBackdrop />
        <div className="auth-enter" style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>
          <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
            <Lockup />
          </div>
          <div style={{
            background: "#ffffff",
            borderRadius: "18px",
            border: "1px solid rgba(23,23,30,0.06)",
            boxShadow: "0 18px 50px rgba(30,20,15,0.10), 0 4px 14px rgba(30,20,15,0.05)",
            padding: "2rem 1.75rem",
            textAlign: "center",
          }}>
            <h1 style={{ margin: "0 0 10px", fontSize: "20px", fontWeight: 600, color: "#2D1810", letterSpacing: "-0.01em" }}>
              {result.error === "already_accepted" ? "Already accepted" : "Invitation unavailable"}
            </h1>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "rgba(45,24,16,0.55)", lineHeight: 1.6 }}>
              {result.error === "already_accepted"
                ? "This invitation has already been used. Sign in if you've set up your account."
                : "This invitation link is no longer valid. Ask the person who invited you to send a new one."}
            </p>
            <a
              href="/login"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: "10px",
                background: "#FF6B4A",
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 4px 20px rgba(255,107,74,0.30)",
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
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", overflow: "hidden" }}>
      <AuthBackdrop />
      <div className="auth-enter" style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <Lockup />
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600, color: "#2D1810", letterSpacing: "-0.01em", lineHeight: 1.15 }}>
            Create your account
          </h1>
          <p style={{ margin: "0.45rem 0 0", fontSize: "13px", color: "rgba(45,24,16,0.55)", lineHeight: 1.5 }}>
            Joining <strong style={{ color: "#2D1810" }}>{result.invitation.agencyName}</strong> as director
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
