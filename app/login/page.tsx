import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { WarmLoginForm } from "@/components/login/WarmLoginForm";
import { BrandMark } from "@/components/brand/BrandMark";
import { PageTitle } from "@/components/ui/PageTitle";
import { TrustStrip } from "@/components/ui/TrustStrip";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Sales Progressor to manage your residential property sales.",
  robots: { index: true, follow: true },
};

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) {
    if (session.user.role === "superadmin") redirect("/command/overview");
    redirect("/agent/hub");
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", overflow: "hidden" }}>
      {/* Entrance motion: the background develops in and the card rises + fades,
          so they appear together on load. Matches the register page's house
          motion. Disabled under prefers-reduced-motion. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes auth-enter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .auth-enter { animation: auth-enter 560ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes auth-bg-fade { from { opacity: 0; } to { opacity: 1; } }
        .auth-bg-enter { animation: auth-bg-fade 820ms ease both; }
        /* Responsive background photo: desktop (landscape) by default; tablet and
           mobile (portrait) crops swap in at their breakpoints. */
        .auth-bg-img { background-image: url(/auth-bg-desktop.png); }
        @media (max-width: 1024px) { .auth-bg-img { background-image: url(/auth-bg-tablet.png); } }
        @media (max-width: 640px) { .auth-bg-img { background-image: url(/auth-bg-mobile.png); } }
        @media (prefers-reduced-motion: reduce) { .auth-enter, .auth-bg-enter { animation: none; } }
      ` }} />

      {/* Sunlit minimalist interior background photo. A faint white veil keeps
          the card area legible on narrow screens where the image crops inward. */}
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

        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          {/* Logo lockup: coral mark + TSP / SALES PROGRESSOR wordmark. */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "1.25rem" }}>
            <BrandMark size={38} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "#FF6B4A", letterSpacing: "0.02em" }}>TSP</span>
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#8A7A72", letterSpacing: "0.14em", marginTop: "3px" }}>SALES PROGRESSOR</span>
            </span>
          </div>
          <PageTitle title="Welcome back." subtitle="Sign in to Sales Progressor" />
        </div>

        <div style={{
          background: "#ffffff",
          borderRadius: "18px",
          border: "1px solid rgba(23,23,30,0.06)",
          padding: "1.75rem",
          boxShadow: "0 18px 50px rgba(30,20,15,0.10), 0 4px 14px rgba(30,20,15,0.05)",
        }}>
          <WarmLoginForm />
        </div>

        <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "center" }}>
          <TrustStrip
            variant="plain"
            items={[{ label: "SSL encrypted" }, { label: "GDPR compliant" }, { label: "UK data" }]}
          />
        </div>

      </div>
    </div>
  );
}
