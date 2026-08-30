"use client";

// The demo hero on the New Sale page (replaces the old AddDemoCard banner).
// Shown to an agency with no real sales yet. "See how it works" opens the shared
// explore-demo flow (useDemoExplore) — intro modal, brief transition, then it
// routes straight into the demo's star file. See lib/services/demo-sale.ts,
// app/actions/demo.ts and docs/active/demo-sale/SPEC.md.

import { Play } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { useDemoExplore } from "@/components/transactions-v2/useDemoExplore";

export function DemoHeroCard() {
  const { launch, node } = useDemoExplore();

  return (
    <>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)",
          marginBottom: 18,
          minHeight: 200,
          padding: "30px 32px",
          border: "1px solid var(--agent-border-subtle)",
          background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
        }}
      >
        {/* Glass-house artwork, right side, fading into the card. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo-hero-bg.png" alt="" aria-hidden
          style={{
            position: "absolute", right: 0, top: 0, height: "100%", width: "auto", maxWidth: "44%",
            objectFit: "cover", objectPosition: "center", pointerEvents: "none",
            WebkitMaskImage: "linear-gradient(to right, transparent, #000 42%)",
            maskImage: "linear-gradient(to right, transparent, #000 42%)",
          }}
        />
        <div style={{ position: "relative", maxWidth: 540 }}>
          <Pill tone="brand" size="sm" style={{ marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            New here?
          </Pill>
          <p style={{ margin: "0 0 8px", fontSize: 27, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.15 }}>
            Let&apos;s add your first sale
          </p>
          <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 430 }}>
            Add a memo of sale to see how a sale runs through Sales Progressor, or fill in the details yourself.
          </p>
          <button
            type="button"
            onClick={() => launch()}
            className="agent-btn agent-btn-secondary agent-btn-md"
            style={{ gap: 10, paddingLeft: 6, paddingRight: 18 }}
          >
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--agent-coral-deep)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Play size={14} weight="fill" style={{ marginLeft: 1 }} />
            </span>
            See how it works
          </button>
        </div>
      </div>
      {node}
    </>
  );
}
