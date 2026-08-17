"use client";

// Wraps a money amount so "Hide money on this device" can blur it. The blur
// itself is CSS (attribute-driven, no flash); this adds the tap-to-reveal.
// Reveal is all-or-nothing (master toggle): tapping any hidden amount shows
// every amount again. Batch 4c.

import type { ReactNode } from "react";
import { usePortalSettings } from "./PortalSettingsProvider";

export function PortalMoney({ children }: { children: ReactNode }) {
  const { moneyHidden, setMoneyHidden } = usePortalSettings();
  return (
    <span
      className="portal-money-value"
      onClick={moneyHidden ? () => setMoneyHidden(false) : undefined}
      onKeyDown={moneyHidden ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMoneyHidden(false); } } : undefined}
      role={moneyHidden ? "button" : undefined}
      tabIndex={moneyHidden ? 0 : undefined}
      title={moneyHidden ? "Tap to show amounts" : undefined}
    >
      {children}
    </span>
  );
}
