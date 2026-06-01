"use client";

import { Headset } from "@phosphor-icons/react";
import { useSolidMode } from "@/lib/hooks/useSolidMode";

export function OutsourcedBanner() {
  const isSolid = useSolidMode();
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      background: isSolid ? "rgba(var(--agent-coral-base-rgb), 0.10)" : "rgba(var(--agent-coral-base-rgb), 0.05)",
      border: isSolid ? "1px solid rgba(var(--agent-coral-base-rgb), 0.28)" : "0.5px solid rgba(var(--agent-coral-base-rgb), 0.25)",
      borderRadius: 14,
      padding: "12px 16px",
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: "rgba(var(--agent-coral-base-rgb), 0.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 1,
      }}>
        <Headset size={14} color="var(--agent-coral-deep)" />
      </div>
      <div>
        <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)", lineHeight: 1.4 }}>
          Our team is handling this file
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--nv2-text-secondary)", lineHeight: 1.55 }}>
          Add at least one seller and one buyer with a name and a phone number or email.
        </p>
      </div>
    </div>
  );
}
