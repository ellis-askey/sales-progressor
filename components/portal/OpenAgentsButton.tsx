"use client";

// Small client button for the "Your team" card (audit #16 phase 3). Dispatches
// the `portal:open-menu` event that PortalShell listens for — opening the menu
// drawer and scrolling it to the "Your agents" section. Keeps the team card a
// server component while giving it one interactive control.

import { PortalButton } from "@/components/portal/PortalButton";

export function OpenAgentsButton({ label }: { label: string }) {
  return (
    <span style={{ flexShrink: 0 }}>
      <PortalButton
        size="sm"
        full={false}
        onClick={() => window.dispatchEvent(new CustomEvent("portal:open-menu", { detail: { section: "agents" } }))}
      >
        {label}
      </PortalButton>
    </span>
  );
}
