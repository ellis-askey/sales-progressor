import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getLatestJoinRequestForUser } from "@/lib/services/agency-join-requests";
import { BrandMark } from "@/components/brand/BrandMark";
import { SignOutLink } from "./SignOutLink";

// Fix 8: shown to someone whose signup was routed as a request to join an
// existing agency, while they wait for that agency's director to approve.
// Shares the /register visual language (register-bg + radial veil + card) so
// the pending state feels like the same signup flow, not a bare page.
export default async function SignupPendingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  // Approved: their agency is set now — send them into the app.
  if (session.user.agencyId) redirect("/agent/hub");

  const latest = await getLatestJoinRequestForUser(session.user.id);
  // No open request (rejected / expired / none) — let them set up their own agency.
  if (!latest || latest.status !== "pending") redirect("/signup/complete");

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", overflow: "hidden" }}>
      {/* Same architectural line-drawing background as /register, with the
          faint white veil that keeps the card legible on narrow screens. */}
      <div aria-hidden style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "100vh", zIndex: 0,
        backgroundColor: "#ffffff",
        backgroundImage: "url(/register-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }} />
      <div aria-hidden style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "100vh", zIndex: 1,
        background: "radial-gradient(60% 55% at 50% 48%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.20) 55%, rgba(255,255,255,0) 100%)",
      }} />

      <style>{`
        @keyframes pend-card-in {
          from { opacity: 0; transform: translateY(18px) scale(0.965); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pend-rise {
          from { opacity: 0; transform: translateY(9px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pend-tick {
          from { transform: rotate(-8deg); }
          to   { transform: rotate(0deg); }
        }
        .pend-h { text-wrap: balance; }
        .pend-card { animation: pend-card-in 640ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .pend-icon { animation: pend-rise 520ms ease-out 140ms both; }
        .pend-hand { transform-origin: 12px 12px; animation: pend-tick 700ms cubic-bezier(0.22, 1, 0.36, 1) 260ms both; }
        .pend-h    { animation: pend-rise 520ms ease-out 220ms both; }
        .pend-p1   { animation: pend-rise 520ms ease-out 300ms both; }
        .pend-p2   { animation: pend-rise 520ms ease-out 370ms both; }
        .pend-p3   { animation: pend-rise 520ms ease-out 440ms both; }
        .pend-foot { animation: pend-rise 520ms ease-out 510ms both; }
        @media (prefers-reduced-motion: reduce) {
          .pend-card, .pend-icon, .pend-hand, .pend-h, .pend-p1, .pend-p2, .pend-p3, .pend-foot { animation: none !important; }
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 420 }}>

        {/* Brand mark — ties the pending state to the signup flow. */}
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
            <BrandMark size={36} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "#FF6B4A", letterSpacing: "0.02em" }}>TSP</span>
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#8A7A72", letterSpacing: "0.14em", marginTop: "3px" }}>SALES PROGRESSOR</span>
            </span>
          </div>
        </div>

        <div className="pend-card" style={{
          width: "100%",
          background: "#ffffff",
          borderRadius: 18,
          border: "1px solid rgba(23,23,30,0.06)",
          boxShadow: "0 18px 50px rgba(30,20,15,0.10), 0 4px 14px rgba(30,20,15,0.05)",
          padding: "2.25rem 2rem",
          textAlign: "center",
        }}>
          <div className="pend-icon" style={{ margin: "0 auto 1.15rem", width: 40, height: 40 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path className="pend-hand" d="M12 6v6l4 2" />
            </svg>
          </div>

          <h1 className="pend-h" style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: "#20242E", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
            Your request is with {latest.agencyName}
          </h1>

          <p className="pend-p1" style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.6, color: "rgba(32,36,46,0.62)" }}>
            You&apos;ve asked to join <strong>{latest.agencyName}</strong>{" "}on The Sales Progressor.
          </p>
          <p className="pend-p2" style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.6, color: "rgba(32,36,46,0.62)" }}>
            Their administrator needs to approve your account. We&apos;ll email you as soon as they do,
            and then you can sign in and get started.
          </p>

          <p className="pend-p3" style={{ margin: "0 0 20px", fontSize: 13, lineHeight: 1.6, color: "rgba(32,36,46,0.45)" }}>
            Signed in as {session.user.email}.
          </p>

          <div className="pend-foot">
            <SignOutLink />
          </div>
        </div>
      </div>
    </div>
  );
}
