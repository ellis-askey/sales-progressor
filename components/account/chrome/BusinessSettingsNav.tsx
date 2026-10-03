"use client";

// components/account/chrome/BusinessSettingsNav.tsx
//
// Left navigation for an external progression-business owner's settings area
// (the "business" variant of AccountShell). Same interaction model as the agency
// AccountLeftNav — a single AgentNavRail with the sliding coral spotlight — but
// its tabs point at /agent/settings/* (the owner-gated business area) instead of
// /agent/account/*. Team links out to the business team screen we already built;
// Client-portal is intentionally absent (portal settings are per-client, managed
// in each client's workspace). Owner-only; mounted by AccountShell variant="business".

import { usePathname } from "next/navigation";
import { Buildings, User, Bell, Lock, CreditCard, UsersThree, EnvelopeSimple } from "@phosphor-icons/react";
import { AgentNavRail, type NavRailItem } from "@/components/layout/AgentNavRail";

// Render order = display order.
const ITEMS: NavRailItem[] = [
  { href: "/agent/settings/business", label: "Business", Icon: Buildings },
  { href: "/agent/settings/emails", label: "Emails", Icon: EnvelopeSimple },
  { href: "/agent/settings/profile", label: "Profile", Icon: User },
  { href: "/agent/team", label: "Team", Icon: UsersThree },
  { href: "/agent/settings/notifications", label: "Notifications", Icon: Bell },
  { href: "/agent/settings/security", label: "Security", Icon: Lock },
  { href: "/agent/settings/billing", label: "Billing", Icon: CreditCard },
];

export function BusinessSettingsNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Business settings navigation">
      <AgentNavRail items={ITEMS} pathname={pathname} onNavigate={onNavigate} />
    </nav>
  );
}
