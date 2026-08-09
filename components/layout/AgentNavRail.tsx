"use client";

// AgentNavRail — the main + secondary sidebar nav items, restyled to
// match Elevra's LeftRail interaction model (2026-08-09) in Sales
// Progressor's coral palette instead of Elevra's cobalt:
//
//   - Hover: item text turns coral and a chevron slides in from the
//     right (spring-ish ease).
//   - Active: a soft coral "spotlight" pill (radial gradient fading from
//     the left edge to transparent) with coral, medium-weight text. A
//     single shared pill SLIDES to the active item when the route
//     changes — the equivalent of Elevra's framer-motion layoutId, done
//     here with SP's existing measured-indicator pattern (see
//     lib/agent/use-tab-indicator) so we don't pull in framer-motion.
//   - Badge (when an item carries a count) replaces the chevron, exactly
//     like Elevra's "Check-ins 2".
//
// Only the main + secondary groups live here; the "New sale" CTA and the
// Recently-viewed list stay in AgentShell (Elevra has no equivalent, and
// they keep their own treatments).

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

export type NavRailItem = {
  href: string;
  label: string;
  Icon: Icon;
  badge?: number;
};

function isItemActive(pathname: string, href: string): boolean {
  // /agent/transactions matches exactly only — otherwise "My Files"
  // would light up on /agent/transactions/[id] detail pages.
  if (href === "/agent/transactions") return pathname === href;
  return pathname === href || pathname.startsWith(href);
}

export function AgentNavRail({
  items,
  pathname,
  onNavigate,
}: {
  items: NavRailItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [pill, setPill] = useState<{ top: number; height: number; visible: boolean }>({
    top: 0,
    height: 0,
    visible: false,
  });

  const activeIndex = items.findIndex((it) => isItemActive(pathname, it.href));

  // Measure the active item and slide the spotlight pill to it. Runs on
  // route change (pathname) and when the item set changes (role-based nav
  // visibility). useLayoutEffect so the pill is positioned before paint,
  // avoiding a flash at (0,0) on first render.
  useLayoutEffect(() => {
    const el = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    const container = containerRef.current;
    if (!el || !container) {
      setPill((p) => ({ ...p, visible: false }));
      return;
    }
    setPill({ top: el.offsetTop, height: el.offsetHeight, visible: true });
  }, [pathname, activeIndex, items.length]);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Sliding coral spotlight — sits behind the item content. Only the
          transform/height transition animates, so route changes glide the
          pill between items (Elevra's shared-pill behaviour). */}
      <span
        aria-hidden
        className="agent-rail-pill"
        style={{
          transform: `translateY(${pill.top}px)`,
          height: pill.height,
          opacity: pill.visible ? 1 : 0,
        }}
      />

      {items.map((item, i) => {
        const active = i === activeIndex;
        const { Icon } = item;
        return (
          <Link
            key={item.href}
            href={item.href}
            ref={(node) => { itemRefs.current[i] = node; }}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`agent-rail-item${active ? " agent-rail-item-active" : ""}`}
          >
            <Icon weight={active ? "fill" : "regular"} style={{ width: 17, height: 17, flexShrink: 0 }} />
            <span className="agent-rail-item-label">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span className="agent-rail-badge">{item.badge}</span>
            ) : (
              <span className="agent-rail-chevron" aria-hidden>
                <CaretRight size={12} weight="bold" />
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
