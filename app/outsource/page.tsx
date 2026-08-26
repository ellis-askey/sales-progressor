// Public "hand us a file" landing page for the outsourced service — the front
// door the cold-email campaign points at. No auth (whitelisted in middleware.ts).
// Uses the app's real light look: iridescent AppBackground + frosted-glass cards
// (like the quote page + portal), not the flat claim styling.

import type { CSSProperties } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { OutsourceIntakeForm } from "./OutsourceIntakeForm";
import { A } from "./ui";
import "@/app/styles/elevra.css";

export const metadata = {
  title: "We'll progress your sales | Sales Progressor",
  description: "Hand us your agreed sales. We chase them through to exchange. You pay £250 per sale, only when it exchanges.",
};

export const dynamic = "force-dynamic";

const glassCard: CSSProperties = {
  background: A.cardBg,
  backdropFilter: A.cardBlur,
  WebkitBackdropFilter: A.cardBlur,
  border: `1px solid ${A.cardBorder}`,
  boxShadow: A.cardShadow,
  borderRadius: 18,
};

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
          height: 60, padding: "0 20px",
          background: A.barBg, backdropFilter: A.barBlur, WebkitBackdropFilter: A.barBlur,
          borderBottom: `1px solid ${A.barBorder}`,
          boxShadow: "0 1px 16px rgba(90,58,40,0.06)",
        }}
      >
        <img src="/logo.png" width={30} height={30} alt="" style={{ borderRadius: 8, display: "block" }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: A.textPrimary, letterSpacing: "-0.01em" }}>Sales Progressor</span>
      </header>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "40px 20px 64px" }}>
        {/* Hero */}
        <section style={{ marginBottom: 32 }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: A.coralDeep }}>Done for you</p>
          <h1 style={{ margin: "0 0 14px", fontSize: 34, fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.025em", color: A.textPrimary }}>
            We&apos;ll progress your sales to exchange.
          </h1>
          <p style={{ margin: "0 0 22px", fontSize: 16, lineHeight: 1.6, color: A.textSecondary }}>
            Hand us your agreed sales. We chase the solicitors, buyers, sellers, brokers and the rest of the chain, keeping everything moving through to exchange. You pay £250 per sale, and only when it exchanges.
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

        {/* How it works */}
        <section style={{ ...glassCard, padding: "22px 22px 8px", marginBottom: 20 }}>
          <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: A.textMuted }}>How it works</p>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "0 0 18px", borderTop: i === 0 ? "none" : undefined }}>
              <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, background: A.coralGradient, color: "#fff", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(255,107,74,0.25)" }}>{s.n}</span>
              <div>
                <p style={{ margin: "4px 0 4px", fontSize: 15.5, fontWeight: 700, color: A.textPrimary }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: 13.5, color: A.textSecondary, lineHeight: 1.55 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Why */}
        <section style={{ ...glassCard, padding: "6px 22px", marginBottom: 20 }}>
          {WHY.map((w, i) => (
            <div key={w.title} style={{ padding: "18px 0", borderTop: i === 0 ? "none" : `1px solid ${A.divider}` }}>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: A.textPrimary }}>{w.title}</p>
              <p style={{ margin: 0, fontSize: 13.5, color: A.textSecondary, lineHeight: 1.55 }}>{w.body}</p>
            </div>
          ))}
        </section>

        {/* Intake */}
        <section id="start" style={{ ...glassCard, padding: 24, scrollMarginTop: 76 }}>
          <OutsourceIntakeForm />
        </section>

        <footer style={{ marginTop: 26, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: A.textFaint }}>
            Questions? <a href="mailto:support@thesalesprogressor.co.uk" style={{ color: A.coralDeep, textDecoration: "none" }}>support@thesalesprogressor.co.uk</a>
          </p>
        </footer>
      </div>
    </main>
  );
}
