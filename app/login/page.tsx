import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { WarmLoginForm } from "@/components/login/WarmLoginForm";
import { BrandMark } from "@/components/brand/BrandMark";

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
      {/* Architectural line-drawing background (agent desk + UK street). The
          centre of the artwork is clean white space, where the card sits. A
          faint white veil keeps the card area legible on narrow screens where
          the illustration crops inward. */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundColor: "#ffffff",
        backgroundImage: "url(/login-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }} />
      <div aria-hidden style={{
        position: "fixed", inset: 0, zIndex: 1,
        background: "radial-gradient(60% 55% at 50% 48%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.20) 55%, rgba(255,255,255,0) 100%)",
      }} />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>

        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          {/* Logo lockup: coral mark + TSP / SALES PROGRESSOR wordmark. */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "1.25rem" }}>
            <BrandMark size={38} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "#FF6B4A", letterSpacing: "0.02em" }}>TSP</span>
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#8A7A72", letterSpacing: "0.14em", marginTop: "3px" }}>SALES PROGRESSOR</span>
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800, color: "#20242E", letterSpacing: "-0.025em", lineHeight: 1.15 }}>
            Welcome back<span style={{ color: "#FF6B4A" }}>.</span>
          </h1>
          <p style={{ margin: "0.45rem 0 0", fontSize: "13px", color: "#8A8A94" }}>
            Sign in to Sales Progressor
          </p>
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

        <div style={{ marginTop: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          {["SSL encrypted", "GDPR compliant", "UK data"].map((item, i, arr) => (
            <span key={item} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "11px", color: "rgba(32,36,46,0.45)" }}>{item}</span>
              {i < arr.length - 1 && <span style={{ fontSize: "11px", color: "rgba(32,36,46,0.22)" }}>·</span>}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
