"use client";
// Design-system comparison — missing loading states (auth SSO buttons).
//
// The gap: when you click "Continue with Google", the current form disables all
// the buttons but shows NO spinner on the one you pressed — so there's no
// feedback that anything's happening. Proposed: the pressed SSO button spins
// (the primary "Sign in" already does this). Dev-only; nothing writes data.

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/arc/button/button";
import { GoogleIcon } from "@/components/login/GoogleIcon";
import { MicrosoftIcon } from "@/components/login/MicrosoftIcon";

// The scenario: "Continue with Google" has just been pressed.
function ButtonStack({ fixed }: { fixed: boolean }) {
  return (
    <div style={{ width: 360, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 10, background: "#fff", borderRadius: 16, border: "1px solid rgba(23,23,30,0.06)", padding: 20, boxShadow: "0 1px 3px rgba(30,20,15,0.06)" }}>
      {/* The pressed button: before = just disabled (no spinner); after = loading */}
      <Button type="button" variant="secondary" size="lg" loading={fixed} disabled={!fixed} style={{ width: "100%" }}><GoogleIcon />Continue with Google</Button>
      {/* The others simply disable in both */}
      <Button type="button" variant="secondary" size="lg" disabled style={{ width: "100%" }}><MicrosoftIcon />Continue with Microsoft</Button>
    </div>
  );
}

function Column({ tag, title, note, children }: { tag: string; title: string; note: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a938a" }}>{tag}</span>
        <h2 style={{ margin: "4px 0 2px", fontSize: 15, fontWeight: 650, color: "#2D1810" }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 12, color: "#6b6258", maxWidth: 320 }}>{note}</p>
      </div>
      {children}
    </div>
  );
}

export default function LoadingStatesComparePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EF", color: "#2D1810", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 100px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <header style={{ marginBottom: 36 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · comparison</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em" }}>Loading states — SSO buttons</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 640 }}>
            You&rsquo;ve just pressed <strong>Continue with Google</strong>. Today the button only greys out — no sign anything is
            happening. The fix gives the pressed SSO button a spinner, the same feedback the <strong>Sign in</strong> button already has.
          </p>
        </header>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>
          <Column tag="Before" title="As it behaves today" note="The pressed button just disables — no spinner, no feedback.">
            <ButtonStack fixed={false} />
          </Column>
          <Column tag="After" title="With the loading state" note="The pressed button spins while the redirect is set up.">
            <ButtonStack fixed={true} />
          </Column>
        </div>
      </div>
    </div>
  );
}
