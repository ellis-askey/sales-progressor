"use client";

// components/policies/PolicyNavBar.tsx
//
// Horizontal tab nav across all 5 legal documents — Privacy, Cookies,
// Terms, Billing, DPA. Active tab determined by usePathname(). One click
// jumps to any policy from any other policy (or from the hub).
//
// Animation pattern ported from .agent-tab in
// app/agent/styles/agent-system.css (lines 886–981). The agent stylesheet
// doesn't load on public routes (policy pages are outside AgentShell), so
// the ~20-line underline pattern is inlined here. Behavior matches the
// agent-app canonical pattern documented in
// docs/polish-pass/ANIMATION_STANDARDS.md §.agent-tab:
//   - Hover: underline previews at scaleX(0.4), opacity 0.35
//   - Active: full scaleX(1), opacity 1
//   - 180ms cubic-bezier(0.16, 1, 0.3, 1) easing
//   - Reduced-motion: snaps to the final state, no scale transition
//
// Mobile (<900px): the row scrolls horizontally; tabs stay full-size
// for touch (44px+ tap targets).

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

const TABS: Tab[] = [
  { href: "/privacy",         label: "Privacy"        },
  { href: "/cookie-policy",   label: "Cookies"        },
  { href: "/terms",           label: "Terms"          },
  { href: "/billing-terms",   label: "Billing"        },
  { href: "/legal/dpa",       label: "DPA"            },
  { href: "/provider-terms",  label: "Provider Terms" },
];

export function PolicyNavBar() {
  const pathname = usePathname();

  return (
    <nav className="policy-nav" aria-label="Policies">
      <ul className="policy-nav-list">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <li key={tab.href} className="policy-nav-item">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                aria-selected={isActive}
                className={`policy-tab${isActive ? " is-active" : ""}`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <style>{`
        .policy-nav {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: saturate(140%) blur(8px);
          -webkit-backdrop-filter: saturate(140%) blur(8px);
          border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          /* The slim top bar above already has its own border-bottom. The
             nav sits flush beneath it — the existing top-bar border serves
             as the visual divider between the two rows. */
        }
        .policy-nav::-webkit-scrollbar { display: none; }
        .policy-nav-list {
          list-style: none;
          margin: 0;
          padding: 0 32px;
          max-width: 1180px;
          margin-inline: auto;
          display: flex;
          gap: 4px;
          align-items: stretch;
          min-height: 44px;
        }
        .policy-nav-item { display: flex; }
        .policy-tab {
          position: relative;
          display: inline-flex;
          align-items: center;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          text-decoration: none;
          transition: color 180ms cubic-bezier(0.16, 1, 0.3, 1);
          white-space: nowrap;
        }
        .policy-tab:hover:not(.is-active) { color: #374151; }
        .policy-tab.is-active {
          color: var(--agent-coral-deep, #E84F2D);
          font-weight: 600;
        }
        .policy-tab::after {
          content: "";
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 0;
          height: 2px;
          border-radius: 1px;
          background: var(--agent-coral-deep, #E84F2D);
          transform: scaleX(0);
          opacity: 0;
          transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
                      opacity   180ms cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
        }
        .policy-tab:hover:not(.is-active)::after {
          transform: scaleX(0.4);
          opacity: 0.35;
        }
        .policy-tab.is-active::after {
          transform: scaleX(1);
          opacity: 1;
        }
        @media (max-width: 900px) {
          .policy-nav-list { padding: 0 20px; }
          .policy-tab { padding: 12px 12px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .policy-tab,
          .policy-tab::after {
            transition-property: color, opacity;
          }
        }
      `}</style>
    </nav>
  );
}
