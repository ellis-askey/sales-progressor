// Public "hand us a file" landing page for the outsourced service — the front
// door the cold-email campaign points at. No auth (whitelisted in middleware.ts).
// Uses the app's real light look: iridescent AppBackground + frosted-glass cards.
// Desktop layout (hero beside the form, 3-across steps/reasons) is in outsource.css.

import type { CSSProperties } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { BrandMark } from "@/components/brand/BrandMark";
import { OutsourceIntakeForm } from "./OutsourceIntakeForm";
import { A } from "./ui";
import "@/app/styles/elevra.css";
import "./outsource.css";

export const metadata = {
  title: "We'll progress your sales | Sales Progressor",
  description: "Hand us your agreed sales. We chase them through to exchange. You pay £250 per sale, only when it exchanges.",
};

export const dynamic = "force-dynamic";

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "1", title: "Send us a sale", body: "Once you've agreed a sale, pass us the details. It takes about a minute." },
  { n: "2", title: "We take it from there", body: "We progress the sale under your agency's name, handling the day-to-day chasing and keeping your buyers and sellers updated along the way." },
  { n: "3", title: "You pay on exchange", body: "£250 per sale, only when it exchanges. Nothing if it falls through." },
];

const WHY: { title: string; body: string }[] = [
  { title: "Every sale, actively progressed", body: "We keep on top of every party, every outstanding step and the wider chain, so nothing is left sitting unnoticed." },
  { title: "Your team gets the time back", body: "The chasing, updates and day-to-day progression come to us. Your team can still see exactly what's happening." },
  { title: "Nothing to pay unless it exchanges", body: "No setup fee. No monthly fee. If the sale falls through before exchange, you don't pay us." },
];

export default function OutsourcePage() {
  return (
    <main style={{ minHeight: "100svh", background: "transparent", "--aurora-opacity": 0.55 } as CSSProperties}>
      {/* Fallback base behind the WebGL backdrop (pre-mount / no-WebGL). */}
      <div aria-hidden className="fixed inset-0 -z-20" style={{ background: "linear-gradient(180deg, #FFFDFB 0%, #FFF1E6 100%)" }} />
      <AppBackground />

      {/* Glass top bar */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 20,
          display: "flex", alignItems: "center", gap: 10,
          height: 60, padding: "0 24px",
          background: A.barBg, backdropFilter: A.barBlur, WebkitBackdropFilter: A.barBlur,
          borderBottom: `1px solid ${A.barBorder}`,
          boxShadow: "0 1px 16px rgba(90,58,40,0.06)",
        }}
      >
        <BrandMark size={30} />
        <span style={{ fontSize: 15, fontWeight: 700, color: A.textPrimary, letterSpacing: "-0.01em" }}>Sales Progressor</span>
      </header>

      <div className="os-wrap">
        {/* Hero beside the form */}
        <div className="os-top">
          <section>
            <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: A.coralDeep }}>Done for you</p>
            <h1 style={{ margin: "0 0 16px", fontSize: 38, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", color: A.textPrimary }}>
              We&apos;ll progress your sales to exchange.
            </h1>
            <p style={{ margin: "0 0 24px", fontSize: 16.5, lineHeight: 1.62, color: A.textSecondary }}>
              Take the day-to-day progression off your team. We chase solicitors, buyers, sellers, brokers and the rest of the chain, keeping every sale moving through to exchange. You stay in the picture throughout, and only pay £250 when the sale exchanges.
            </p>
            <a
              href="#start"
              style={{
                display: "inline-block", padding: "14px 28px", borderRadius: 12,
                background: A.coralGradient, color: "#fff", fontSize: 15, fontWeight: 700,
                textDecoration: "none", boxShadow: "0 6px 20px rgba(255,107,74,0.28)",
              }}
            >
              Hand us your first file
            </a>
          </section>

          <div className="os-form-sticky">
            <section className="os-card" id="start" style={{ padding: 24, scrollMarginTop: 76 }}>
              <OutsourceIntakeForm />
            </section>
          </div>
        </div>

        {/* How it works — 3 across on desktop */}
        <div style={{ marginTop: 44 }}>
          <p className="os-section-label">How it works</p>
          <div className="os-grid3">
            {STEPS.map((s) => (
              <div key={s.n} className="os-card" style={{ padding: "20px 20px 22px" }}>
                <span style={{ display: "inline-flex", width: 32, height: 32, borderRadius: 999, background: A.coralGradient, color: "#fff", fontWeight: 700, fontSize: 15, alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(255,107,74,0.25)", marginBottom: 12 }}>{s.n}</span>
                <p style={{ margin: "0 0 5px", fontSize: 15.5, fontWeight: 700, color: A.textPrimary }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: 13.5, color: A.textSecondary, lineHeight: 1.55 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Why — 3 across on desktop */}
        <div style={{ marginTop: 20 }}>
          <div className="os-grid3">
            {WHY.map((w) => (
              <div key={w.title} className="os-card" style={{ padding: "20px" }}>
                <p style={{ margin: "0 0 5px", fontSize: 15, fontWeight: 700, color: A.textPrimary }}>{w.title}</p>
                <p style={{ margin: 0, fontSize: 13.5, color: A.textSecondary, lineHeight: 1.55 }}>{w.body}</p>
              </div>
            ))}
          </div>
        </div>

        <footer style={{ marginTop: 30, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: A.textFaint }}>
            Questions? <a href="mailto:support@thesalesprogressor.co.uk" style={{ color: A.coralDeep, textDecoration: "none" }}>support@thesalesprogressor.co.uk</a>
          </p>
        </footer>
      </div>
    </main>
  );
}
