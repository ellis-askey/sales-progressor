import { LoginForm } from "@/components/layout/LoginForm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) {
    if (session.user.role === "negotiator") {
      redirect("/agent/dashboard");
    }
    redirect("/dashboard");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "linear-gradient(145deg, #1e293b 0%, #1e3a5f 45%, #0f172a 100%)",
      }}
    >
      {/* Subtle blue glow centred behind the card */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(59,130,246,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm">

        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              boxShadow: "0 4px 20px rgba(59,130,246,0.5), 0 1px 4px rgba(0,0,0,0.25)",
            }}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Sales Progressor</h1>
          <p className="text-sm text-blue-200/60 mt-1">Sign in to your account</p>
        </div>

        {/* Frosted glass card — high-opacity white so form text is readable */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(28px) saturate(1.6)",
            WebkitBackdropFilter: "blur(28px) saturate(1.6)",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >
          <LoginForm />
        </div>

        <p className="text-center text-xs text-blue-200/40 mt-6">
          By signing in you agree to our{" "}
          <a href="/terms" className="underline underline-offset-2 hover:text-blue-200/70 transition-colors">Terms of Service</a>
          {" "}and{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-blue-200/70 transition-colors">Privacy Policy</a>.
        </p>

      </div>
    </div>
  );
}
