import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { SunriseBackground } from "@/components/login/SunriseBackground";
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <SunriseBackground />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "380px" }}>

        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ display: "inline-flex", marginBottom: "1.25rem" }}>
            <BrandMark />
          </div>
          <h1 style={{ margin: 0, fontSize: "1.625rem", fontWeight: 600, color: "#3D1F0E", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Welcome back.
          </h1>
          <p style={{ margin: "0.4rem 0 0", fontSize: "12px", color: "#7A4A2E", opacity: 0.85 }}>
            Sign in to Sales Progressor
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
          <WarmLoginForm />
        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            {["SSL encrypted", "GDPR compliant", "UK data"].map((item, i, arr) => (
              <span key={item} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "11px", color: "rgba(61,31,14,0.52)" }}>{item}</span>
                {i < arr.length - 1 && <span style={{ fontSize: "11px", color: "rgba(61,31,14,0.25)" }}>·</span>}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#4CAF50", animation: "lp-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "11px", color: "rgba(61,31,14,0.50)" }}>All systems operational</span>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
