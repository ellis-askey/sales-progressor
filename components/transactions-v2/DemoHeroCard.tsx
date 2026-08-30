"use client";

// The demo hero on the New Sale page (replaces the old AddDemoCard banner).
// Shown to an agency with no real sales yet. "See how it works" opens the shared
// explore-demo flow (useDemoExplore) — intro modal, brief transition, then it
// routes straight into the demo's star file. See lib/services/demo-sale.ts,
// app/actions/demo.ts and docs/active/demo-sale/SPEC.md.

import { Play } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { HeroArt } from "@/components/agent/HeroArt";
import { useDemoExplore } from "@/components/transactions-v2/useDemoExplore";
import { useCardSurface } from "@/lib/glass/use-card-surface";

export function DemoHeroCard() {
  const { launch, node } = useDemoExplore();
  const { surfaceClass, tag, picked } = useCardSurface("new-sale-demo-hero", "New sale · Demo hero", "");

  return (
    <>
      <div
        className={surfaceClass}
        {...tag}
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)",
          marginBottom: 18,
          minHeight: 200,
          padding: "30px 32px",
          // Its own coral gradient by default; a Design Lab pick takes over.
          ...(picked ? {} : {
            border: "1px solid var(--agent-border-subtle)",
            background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
          }),
        }}
      >
        {/* Glass-house artwork, right side, fading into the card. */}
        <HeroArt light="/demo-hero-bg.png" dark="/demo-hero-bg-dark.png" maxWidth="44%" maskStart="42%" />
        <div style={{ position: "relative", maxWidth: 540 }}>
          <Pill glass tone="brand" size="sm" style={{ marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
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
