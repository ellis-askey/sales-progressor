"use client";

// components/account/chrome/AccountLeftNav.tsx
//
// Left navigation for the Account area. Stripe / Vercel / Linear register
// — clean rows, hairline borders, coral accent for the active tab. Tabs
// are role-filtered: director sees everything; negotiator sees only
// Profile + Notifications when those exist.
//
// Stage 1: only the Billing tab exists. Future tabs (Profile, Team,
// Notifications, Referrals) are listed here as commented-out scaffolds
// so we can light them up tab-by-tab in Stage 2 without restructuring.
// Referrals is parked — no nav slot until designed.
//
// Mobile (≤768px): the vertical column collapses to a horizontal
// scrollable tab strip placed above the content. Same component, CSS
// only — no separate mobile nav.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { CreditCard, User, Users, Bell } from "@phosphor-icons/react";

type Tab = {
  href: string;
  label: string;
  Icon: typeof CreditCard;
  /** Roles that may see this tab. Directors get all listed; negotiators
   *  see only tabs that include "negotiator". The Team tab has an extra
   *  conditional gate for negotiators — see visibility filter below. */
  roles: UserRole[];
};

// Render order = display order. Future tab (Notifications) drops in
// here in the right slot without restructuring.
const TABS: Tab[] = [
  {
    href: "/agent/account/billing",
    label: "Billing",
    Icon: CreditCard,
    roles: ["director"],
  },
  {
    href: "/agent/account/profile",
    label: "Profile",
    Icon: User,
    roles: ["director", "negotiator"],
  },
  {
    href: "/agent/account/team",
    label: "Team",
    Icon: Users,
    // Listed for both so the negotiator branch (invite director) can show;
    // hidden from negotiators whose agency already has a director — see
    // the agencyHasDirector filter below.
    roles: ["director", "negotiator"],
  },
  {
    href: "/agent/account/notifications",
    label: "Notifications",
    Icon: Bell,
    roles: ["director", "negotiator"],
  },
];

export function AccountLeftNav({
  role,
  agencyHasDirector,
}: {
  role: UserRole;
  /** When false AND the viewer is a negotiator, the Team tab shows so
   *  they can invite a director. Otherwise negotiators don't see Team. */
  agencyHasDirector: boolean;
}) {
  const pathname = usePathname();
  const visible = TABS.filter((t) => {
    if (!t.roles.includes(role)) return false;
    if (t.href === "/agent/account/team" && role === "negotiator" && agencyHasDirector) {
      return false;
    }
    return true;
  });

  return (
    <nav className="account-leftnav" aria-label="Account navigation">
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {visible.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 14px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 13.5,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#111827" : "#374151",
                  background: isActive ? "rgba(0,0,0,0.04)" : "transparent",
                  borderLeft: isActive
                    ? "2px solid var(--agent-coral, #FF6B4A)"
                    : "2px solid transparent",
                  paddingLeft: 12,
                  transition: "background 120ms, color 120ms",
                }}
                className="account-leftnav-tab"
              >
                <tab.Icon
                  weight={isActive ? "fill" : "regular"}
                  style={{
                    width: 16,
                    height: 16,
                    color: isActive ? "var(--agent-coral, #FF6B4A)" : "#6b7280",
                  }}
                />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
