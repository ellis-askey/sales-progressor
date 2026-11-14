"use client";

// Portal bottom navigation — B5 "magnify dock": a floating glass pill of the
// three destinations. The current page magnifies into a labelled pill (icon +
// label) with a lifted, softly glowing icon; the others stay as plain icons, so
// the dock is compact yet always names where you are. Real <Link> navigation,
// the unread badge, and aria-current are all preserved from the old tab bar.

import Link from "next/link";
import { House, ClockCounterClockwise, ChatCircle } from "@phosphor-icons/react/dist/ssr";
import { PortalNavGlass } from "./PortalNavGlass";

type Icon = typeof House;
type Tab = { href: string; label: string; Icon: Icon; active: boolean; badge?: number };

function DockTab({ tab }: { tab: Tab }) {
  const { Icon, active } = tab;
  return (
    <Link href={tab.href} aria-current={active ? "page" : undefined} aria-label={tab.label} className="pnav-tab" data-on={active ? "1" : undefined}>
      <span className="pnav-tab-ico">
        <Icon size={23} weight={active ? "fill" : "regular"} />
        {tab.badge && !active ? <span className="pnav-badge">{tab.badge > 9 ? "9+" : tab.badge}</span> : null}
      </span>
      <span className="pnav-tab-lbl">{tab.label}</span>
    </Link>
  );
}

export function PortalBottomNav({ base, isHome, isProgress, isUpdates, unreadCount = 0 }: { base: string; isHome: boolean; isProgress: boolean; isUpdates: boolean; unreadCount?: number }) {
  const tabs: Tab[] = [
    { href: base, label: "Overview", Icon: House, active: isHome },
    { href: `${base}/progress`, label: "Progress", Icon: ClockCounterClockwise, active: isProgress },
    { href: `${base}/updates`, label: "Updates", Icon: ChatCircle, active: isUpdates, badge: unreadCount > 0 ? unreadCount : undefined },
  ];
  return (
    <PortalNavGlass radius={28} className="pnav-dock">
      {tabs.map((t) => <DockTab key={t.href} tab={t} />)}
    </PortalNavGlass>
  );
}
