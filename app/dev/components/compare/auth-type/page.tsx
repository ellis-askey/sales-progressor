"use client";
// Design-system comparison — Auth typography & colour reconciliation.
//
// The whole auth card, rendered twice, so the foundation decisions are judged as
// pixels, not hex values: BEFORE = exactly as the login page ships (30px / 800 /
// cool #20242E ink, #B05A20 hint); AFTER = aligned to the canonical type scale
// and token colours (28px / semibold 600 / warm #2D1810, token warning #C97D1A).
// Nothing here writes data or touches production. Dev-only.

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { LabelInput } from "@/components/ui/LabelInput";
import { Button } from "@/components/arc/button/button";
import { GoogleIcon } from "@/components/login/GoogleIcon";
import { MicrosoftIcon } from "@/components/login/MicrosoftIcon";

const CORAL = "#FF6B4A";

type Variant = "before" | "after";
const CFG: Record<Variant, { h1Size: string; h1Weight: number; tracking: string; ink: string; sub: string; hint: string }> = {
  before: { h1Size: "1.9rem", h1Weight: 800, tracking: "-0.025em", ink: "#20242E", sub: "#8A8A94", hint: "#B05A20" },
  after: { h1Size: "28px", h1Weight: 600, tracking: "-0.01em", ink: "#2D1810", sub: "rgba(45,24,16,0.55)", hint: "#C97D1A" },
};

function AuthCard({ v }: { v: Variant }) {
  const c = CFG[v];
  const coral = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties;
  return (
    <div style={{ width: 400, maxWidth: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: "1.25rem" }}>
          <BrandMark size={38} />
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: CORAL, letterSpacing: "0.02em" }}>TSP</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#8A7A72", letterSpacing: "0.14em", marginTop: 3 }}>SALES PROGRESSOR</span>
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: c.h1Size, fontWeight: c.h1Weight, color: c.ink, letterSpacing: c.tracking, lineHeight: 1.15 }}>
          Welcome back<span style={{ color: CORAL }}>.</span>
        </h1>
        <p style={{ margin: "0.45rem 0 0", fontSize: 13, color: c.sub }}>Sign in to Sales Progressor</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 18, border: "1px solid rgba(23,23,30,0.06)", padding: "1.75rem", boxShadow: "0 18px 50px rgba(30,20,15,0.10), 0 4px 14px rgba(30,20,15,0.05)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, "--lbi-top": "0px" } as React.CSSProperties}>
          <Button type="button" variant="secondary" size="lg" style={{ width: "100%" }}><GoogleIcon />Continue with Google</Button>
          <Button type="button" variant="secondary" size="lg" style={{ width: "100%" }}><MicrosoftIcon />Continue with Microsoft</Button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(32,36,46,0.10)" }} />
            <span style={{ fontSize: 11, color: "rgba(32,36,46,0.42)", whiteSpace: "nowrap" }}>or sign in with email</span>
            <div style={{ flex: 1, height: 1, background: "rgba(32,36,46,0.10)" }} />
          </div>
          <LabelInput label="Email address" type="email" accent={CORAL} fullWidth />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <LabelInput field="Password" accent={CORAL} fullWidth />
            <p style={{ fontSize: 11, color: c.hint, margin: 0 }}>At least 10 characters required</p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, fontWeight: 500, color: CORAL, textDecoration: "none" }}>Forgot password?</a>
          </div>
          <Button type="button" variant="primary" size="lg" style={{ ...coral, width: "100%" }}>Sign in</Button>
          <p style={{ textAlign: "center", fontSize: 13, color: c.sub, margin: 0 }}>
            New here? <a href="#" onClick={(e) => e.preventDefault()} style={{ color: CORAL, fontWeight: 600, textDecoration: "none" }}>Create an account</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function Column({ tag, title, note, children }: { tag: string; title: string; note: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a938a" }}>{tag}</span>
        <h2 style={{ margin: "4px 0 2px", fontSize: 15, fontWeight: 650, color: "#20242E" }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 12, color: "#6b6258", maxWidth: 360 }}>{note}</p>
      </div>
      {children}
    </div>
  );
}

export default function AuthTypeComparePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EF", color: "#20242E", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 100px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <header style={{ marginBottom: 36 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · comparison</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 28, fontWeight: 680, letterSpacing: "-0.02em" }}>Auth typography &amp; colour</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 640 }}>
            The whole card, both ways — judge it as pixels, not hex. <strong>Three changes</strong> in “After”: the heading drops from
            30px/800 to the scale’s <strong>28px / semibold</strong>; the ink moves from cool <code>#20242E</code> to the warm token
            <code> #2D1810</code>; and the length hint moves from <code>#B05A20</code> to the token warning <code>#C97D1A</code>.
          </p>
        </header>

        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>
          <Column tag="Before" title="As it ships today" note="30px · weight 800 · cool #20242E · #B05A20 hint">
            <AuthCard v="before" />
          </Column>
          <Column tag="After" title="Aligned to the scale" note="28px · semibold 600 · warm #2D1810 · token warning #C97D1A">
            <AuthCard v="after" />
          </Column>
        </div>
      </div>
    </div>
  );
}
