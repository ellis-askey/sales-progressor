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
      // Surface (light white / dark "coral wash") lives in .outsourced-banner CSS
      // so it can switch by theme (critique #193). A Design Lab pick takes over the
      // surface via surfaceClass. Text colours are on .ob-banner so they apply in
      // both cases.
      className={`agent-reveal-in ob-banner ${picked ? "" : "outsourced-banner"} ${surfaceClass}`.trim()}
      {...tag}
      role="status"
      style={{
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <span
        aria-hidden
        className="ob-icon"
        style={{ flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center" }}
      >
        <Headset size={16} weight="fill" />
      </span>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <p className="ob-title" style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>
          Our team is handling this sale.
        </p>
        <p className="ob-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
          Add at least one seller and one buyer, with a name and either a phone number or email address.
        </p>
      </div>
    </div>
  );
}
