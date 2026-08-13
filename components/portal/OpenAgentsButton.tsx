"use client";

// Small client button for the "Your team" card (audit #16 phase 3). Dispatches
// the `portal:open-menu` event that PortalShell listens for — opening the menu
// drawer and scrolling it to the "Your agents" section. Keeps the team card a
// server component while giving it one interactive control.

import { P } from "@/components/portal/portal-ui";

export function OpenAgentsButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("portal:open-menu", { detail: { section: "agents" } }))}
      style={{
        flexShrink: 0,
        fontSize: 12,
        fontWeight: 700,
        padding: "7px 13px",
        borderRadius: 9,
        background: P.primary,
        color: "#fff",
        border: 0,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
