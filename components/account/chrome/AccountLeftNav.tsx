"use client";

// components/account/chrome/AccountLeftNav.tsx
//
// Left navigation for the Account area. Kept as the Account nav component, but
// its rows now use the SAME interaction model as the agent app's main nav
// (AgentNavRail): a single sliding coral "spotlight" pill that glides to the
// active tab, hover turns the label coral and slides a chevron in from the
// right, active = filled icon + coral text. The agent-rail-* CSS is already
// imported by the Account layout, so this is reuse, not a reimplementation.
//
// Tabs are role-filtered: director sees everything; negotiators see a subset,
// and the Team tab only when their agency has no director yet (to invite one).

import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { CreditCard, User, Users, Bell, EnvelopeSimple, EnvelopeOpen } from "@phosphor-icons/react";
import { AgentNavRail, type NavRailItem } from "@/components/layout/AgentNavRail";

type Tab = NavRailItem & { roles: UserRole[] };

// Render order = display order.
const TABS: Tab[] = [
  { href: "/agent/account/billing", label: "Billing", Icon: CreditCard, roles: ["director"] },
  { href: "/agent/account/profile", label: "Profile", Icon: User, roles: ["director", "negotiator"] },
  { href: "/agent/account/team", label: "Team", Icon: Users, roles: ["director", "negotiator"] },
  { href: "/agent/account/notifications", label: "Notifications", Icon: Bell, roles: ["director", "negotiator"] },
  { href: "/agent/account/connections", label: "Connections", Icon: EnvelopeSimple, roles: ["director", "negotiator"] },
  { href: "/agent/account/emails", label: "Emails", Icon: EnvelopeOpen, roles: ["director"] },
];

export function AccountLeftNav({
  role,
  agencyHasDirector,
  onNavigate,
}: {
  role: UserRole;
  /** When false AND the viewer is a negotiator, the Team tab shows so they can
   *  invite a director. Otherwise negotiators don't see Team. */
  agencyHasDirector: boolean;
  /** Fired when a tab is clicked — used to close the mobile drawer. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items: NavRailItem[] = TABS.filter((t) => {
    if (!t.roles.includes(role)) return false;
    if (t.href === "/agent/account/team" && role === "negotiator" && agencyHasDirector) return false;
    return true;
  }).map(({ href, label, Icon }) => ({ href, label, Icon }));

  return (
    <nav aria-label="Account navigation">
      <AgentNavRail items={items} pathname={pathname} onNavigate={onNavigate} />
    </nav>
  );
}
