"use client";

// Uses the canonical agent-banner recipe documented in components/ui/AgentBanner.tsx:
// white-90% background + blur + 1px coloured border + tinted icon + heading
// in the kind colour + secondary body. AgentBanner only exposes
// info / warning / danger / success kinds; this banner is the "primary
// coral" variant for the outsourced/PM workflow, so it applies the same
// recipe inline with coral tokens rather than introducing a fifth kind.

import { Headset } from "@phosphor-icons/react";
import { useCardSurface } from "@/lib/glass/use-card-surface";

export function OutsourcedBanner() {
  const { surfaceClass, tag, picked } = useCardSurface("new-sale-outsourced-banner", "New sale · Outsourced banner", "");
  return (
    <div
      className={`agent-reveal-in ${surfaceClass}`.trim()}
      {...tag}
      role="status"
      style={{
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        // Coral banner recipe by default; a Design Lab pick takes over.
        ...(picked ? {} : {
          background: "rgba(255, 255, 255, 0.90)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(var(--agent-coral-base-rgb), 0.50)",
          boxShadow: "0 1px 3px rgba(var(--agent-coral-base-rgb), 0.10)",
        }),
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          marginTop: 1,
          color: "var(--agent-coral-deep)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Headset size={16} weight="fill" />
      </span>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--agent-coral-deep)",
            lineHeight: 1.35,
          }}
        >
          Our team is handling this file
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Add at least one seller and one buyer with a name and a phone number or email.
        </p>
      </div>
    </div>
  );
}
