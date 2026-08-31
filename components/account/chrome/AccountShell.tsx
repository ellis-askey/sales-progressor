"use client";

// components/account/chrome/AccountShell.tsx
//
// Chrome for the Account area: the Sales Progressor logo at the top, the
// Account nav (agent-rail interaction) in the middle, and the signed-in user
// at the bottom. Mirrors the agent shell's shape.
//
// Responsive: on desktop the sidebar is a sticky 260px left column. On tablet
// and mobile (<=860px) it becomes an off-canvas drawer (kept vertical, so the
// AgentNavRail spotlight still tracks correctly) opened from a slim top bar
// with a hamburger, exactly like AgentShell. This is a client component
// because the drawer needs open/close state; the page itself is still
// server-rendered and passed straight through as children.

import { useState, useEffect } from "react";
import Link from "next/link";
import { List, X } from "@phosphor-icons/react";
import type { UserRole } from "@prisma/client";
import { BrandMark } from "@/components/brand/BrandMark";
import { AccountLeftNav } from "./AccountLeftNav";
import { AccountSidebarUser } from "./AccountSidebarUser";

export function AccountShell({
  role,
  agencyHasDirector,
  displayName,
  image,
  theme,
  children,
}: {
  role: UserRole;
  agencyHasDirector: boolean;
  displayName: string;
  image: string | null;
  theme: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll while the drawer is open (mobile only).
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: "100vh",
        display: "flex",
        color: "#111827",
        position: "relative",
        isolation: "isolate",
        background:
          "radial-gradient(1100px 520px at 78% -8%, rgba(255,107,74,0.07), transparent 60%), linear-gradient(180deg, #fcf8f5 0%, #faf9f8 42%)",
      }}
    >
      {/* Faded, blurred streetscape backdrop — multiply drops the white so only
          the soft coral linework shows over the warm gradient. Sits behind
          content (z-index -1); the frosted cards let it read through. */}
      <div className="account-bg-image" aria-hidden />

      {/* Mobile-only top bar (hamburger + brand). Fixed, so it sits outside the
          flex row and the main column keeps full width. */}
      <header className="account-mobile-topbar">
        <button
          className="account-hamburger"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <List weight="regular" style={{ width: 20, height: 20 }} />
        </button>
        <Link href="/agent/hub" className="account-brand" aria-label="Sales Progressor">
          <BrandMark size={26} />
          <span className="account-brand-word">Sales Progressor</span>
        </Link>
      </header>

      {/* Drawer backdrop (mobile only; only rendered while open) */}
      {mobileOpen && <div className="account-nav-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside className={`account-shell-nav${mobileOpen ? " account-shell-nav-open" : ""}`}>
        <div className="account-nav-head">
          <Link href="/agent/hub" className="account-brand" aria-label="Sales Progressor">
            <BrandMark size={26} />
            <span className="account-brand-word">Sales Progressor</span>
          </Link>
          <button
            className="account-nav-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X weight="regular" style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="account-nav-scroll">
          <AccountLeftNav
            role={role}
            agencyHasDirector={agencyHasDirector}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>

        <div className="account-user-slot">
          <AccountSidebarUser name={displayName} role={role} image={image} />
        </div>
      </aside>

      <main className="account-shell-main">
        <div className="account-shell-container">{children}</div>
      </main>

      <style>{`
        .account-mobile-topbar { display: none; }
        .account-nav-close { display: none; }

        .account-bg-image {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background: url(/settings-bg.png) center bottom / cover no-repeat;
          opacity: 0.6;
          mix-blend-mode: multiply;
          filter: blur(2px);
        }
        @media (prefers-reduced-motion: reduce) { .account-bg-image { filter: none; } }

        .account-shell-nav {
          position: sticky;
          top: 0;
          align-self: flex-start;
          height: 100vh;
          width: 260px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          padding: 18px 14px 14px;
          background: rgba(255,255,255,0.72);
          backdrop-filter: saturate(140%) blur(8px);
          -webkit-backdrop-filter: saturate(140%) blur(8px);
          border-right: 0.5px solid rgba(0,0,0,0.08);
        }
        .account-nav-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .account-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          padding: 6px 8px 14px;
        }
        .account-brand-word { font-size: 14px; font-weight: 700; color: #111827; letter-spacing: -0.01em; }
        .account-nav-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-top: 2px; }
        .account-user-slot { border-top: 0.5px solid rgba(0,0,0,0.07); padding-top: 10px; margin-top: 8px; }

        .account-shell-main { flex: 1; min-width: 0; }
        .account-shell-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 40px 32px 88px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        @media (max-width: 860px) {
          .account-mobile-topbar {
            display: flex;
            align-items: center;
            gap: 10px;
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 60;
            height: 54px;
            padding: 0 14px;
            background: rgba(252,248,245,0.92);
            backdrop-filter: saturate(140%) blur(10px);
            -webkit-backdrop-filter: saturate(140%) blur(10px);
            border-bottom: 0.5px solid rgba(0,0,0,0.08);
          }
          .account-hamburger {
            display: inline-flex;
            background: none; border: none; cursor: pointer;
            padding: 6px; color: #374151;
          }
          /* Brand sits on the RIGHT of the mobile top bar; hamburger stays left. */
          .account-mobile-topbar .account-brand { padding: 0; margin-left: auto; }

          .account-shell-nav {
            position: fixed;
            top: 0; left: 0;
            height: 100vh;
            width: min(280px, 82vw);
            transform: translateX(-100%);
            transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
            z-index: 70;
            background: rgba(255,255,255,0.97);
            backdrop-filter: saturate(140%) blur(10px);
            -webkit-backdrop-filter: saturate(140%) blur(10px);
            border-right: 0.5px solid rgba(0,0,0,0.08);
            box-shadow: 0 8px 40px rgba(20,14,10,0.16);
          }
          .account-shell-nav-open { transform: translateX(0); }
          .account-nav-close {
            display: inline-flex;
            background: none; border: none; cursor: pointer;
            padding: 6px; color: #6b7280;
          }

          .account-nav-backdrop {
            position: fixed;
            inset: 0;
            z-index: 65;
            background: rgba(20,14,10,0.32);
            animation: account-backdrop-in 200ms ease both;
          }
          @keyframes account-backdrop-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }

          .account-shell-main { padding-top: 54px; }
          .account-shell-container { padding: 24px 18px 64px; gap: 22px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .account-shell-nav { transition: none; }
        }
      `}</style>
    </div>
  );
}
