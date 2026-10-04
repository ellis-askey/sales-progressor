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

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Buildings, User, Bell, Lock, CreditCard, UsersThree, EnvelopeSimple, PlugsConnected, ArrowLeft } from "@phosphor-icons/react";
import { AgentNavRail, type NavRailItem } from "@/components/layout/AgentNavRail";

// Render order = display order.
const ITEMS: NavRailItem[] = [
  { href: "/agent/settings/business", label: "Business", Icon: Buildings },
  { href: "/agent/settings/emails", label: "Emails", Icon: EnvelopeSimple },
  { href: "/agent/settings/profile", label: "Profile", Icon: User },
  { href: "/agent/team", label: "Team", Icon: UsersThree },
  { href: "/agent/settings/connections", label: "Connections", Icon: PlugsConnected },
  { href: "/agent/settings/notifications", label: "Notifications", Icon: Bell },
  { href: "/agent/settings/security", label: "Security", Icon: Lock },
  { href: "/agent/settings/billing", label: "Billing", Icon: CreditCard },
];

export function BusinessSettingsNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Business settings navigation">
      <AgentNavRail items={ITEMS} pathname={pathname} onNavigate={onNavigate} />

      {/* A consistent way back out of settings, below the last tab — mirrors the
          per-page "Back to progression" link (critique #183). The hub is the
          owner's main progression workspace. */}
      <Link href="/agent/hub" className="bsn-back" onClick={onNavigate}>
        <ArrowLeft size={15} weight="bold" className="bsn-back-arrow" />
        Back to progression
      </Link>

      <style>{`
        .bsn-back {
          display: flex; align-items: center; gap: 9px;
          margin-top: 8px; padding: 10px 12px;
          border-top: 0.5px solid rgba(0,0,0,0.07);
          font-size: 13px; font-weight: 600; color: #6b7280;
          text-decoration: none;
          transition: color 150ms ease;
        }
        .bsn-back:hover, .bsn-back:focus-visible { color: #111827; outline: none; }
        .bsn-back-arrow { transition: transform 200ms cubic-bezier(0.22,1,0.36,1); flex-shrink: 0; }
        .bsn-back:hover .bsn-back-arrow, .bsn-back:focus-visible .bsn-back-arrow { transform: translateX(-3px); }
      `}</style>
    </nav>
  );
}
