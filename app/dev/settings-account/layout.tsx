"use client";

// /dev/settings-account — a fully-navigable CLONE of the agency "Account"
// settings area with the consolidation applied, so the whole thing can be
// walked tab by tab like the real app (founder ask, 2026-10-15). Real routing
// (each tab is a real /dev/settings-account/<tab> page), the real shell chrome
// (copied from components/account/chrome/AccountShell.tsx), and the real
// AgentNavRail sliding-spotlight nav pointed at the dev routes. Tabs mount the
// REAL settings components with mock props. Nothing is wired to the app.
// Dev-only: blocked in production.

import { notFound, usePathname } from "next/navigation";
import Link from "next/link";
import { CreditCard, User, Users, Bell, EnvelopeOpen, EnvelopeSimple, Lock, Browser, Repeat, Flask } from "@phosphor-icons/react";
import { AgentNavRail, type NavRailItem } from "@/components/layout/AgentNavRail";
import { AgentToaster } from "@/components/agent/AgentToaster";

import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";

// Consolidated Account nav (the proposed structure): Emails is the one email
// workspace; "Automated chasing" is the new single home; "What clients see" is
// the portal tab. Admin tabs keep their place, just aligned.
const NAV: NavRailItem[] = [
  { href: "/dev/settings-account/billing", label: "Billing", Icon: CreditCard },
  { href: "/dev/settings-account/profile", label: "Profile", Icon: User },
  { href: "/dev/settings-account/team", label: "Team", Icon: Users },
  { href: "/dev/settings-account/emails", label: "Emails", Icon: EnvelopeOpen },
  { href: "/dev/settings-account/chasing", label: "Automated chasing", Icon: Repeat },
  { href: "/dev/settings-account/clients", label: "What clients see", Icon: Browser },
  { href: "/dev/settings-account/notifications", label: "Notifications", Icon: Bell },
  { href: "/dev/settings-account/connections", label: "Connections", Icon: EnvelopeSimple },
  { href: "/dev/settings-account/security", label: "Security", Icon: Lock },
];

export default function DevSettingsAccountLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  const pathname = usePathname();

  return (
    <div data-theme="custom" style={{ minHeight: "100vh", display: "flex", color: "#111827", position: "relative", isolation: "isolate", background: "#FBF8F5" }}>
      <div className="account-bg-image" aria-hidden />

      <aside className="account-shell-nav">
        <div className="account-nav-head">
          <span className="account-brand">
            <span style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg, var(--agent-coral), var(--agent-coral-deep))", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 13 }}>S</span>
            <span className="account-brand-word">Sales Progressor</span>
          </span>
        </div>

        {/* Dev ribbon + clone switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 6px 10px", padding: "6px 9px", borderRadius: 8, background: "rgba(224,73,42,.08)", color: "#B2452E", fontSize: 11, fontWeight: 700 }}>
          <Flask size={13} weight="fill" /> DEV CLONE · Account
        </div>
        <div style={{ display: "flex", gap: 6, margin: "0 6px 12px" }}>
          <span style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, padding: "5px 0", borderRadius: 7, background: "var(--agent-coral-deep)", color: "#fff" }}>Account</span>
          <Link href="/dev/settings-business/profile" style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, padding: "5px 0", borderRadius: 7, background: "#fff", color: "var(--agent-text-secondary)", textDecoration: "none", border: "1px solid var(--agent-border-default)" }}>Business ›</Link>
        </div>

        <div className="account-nav-scroll">
          <nav aria-label="Account navigation">
            <AgentNavRail items={NAV} pathname={pathname} />
          </nav>
        </div>

        <div className="account-user-slot">
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 8px" }}>
            <span style={{ width: 30, height: 30, borderRadius: 999, background: "linear-gradient(135deg, var(--agent-coral), var(--agent-coral-deep))", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>EA</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 650, color: "#111827" }}>Ellis Askey</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Director</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="account-shell-main">
        <div className="account-shell-container">
          <AgentToaster>{children}</AgentToaster>
        </div>
      </main>

      <style>{`
        .account-bg-image { position: fixed; inset: 0; z-index: -1; pointer-events: none;
          background: linear-gradient(120deg, rgba(255,107,74,0.14) 0%, rgba(255,170,120,0.12) 25%, rgba(255,120,170,0.12) 50%, rgba(170,140,255,0.12) 75%, rgba(120,205,180,0.12) 100%), #FBF8F5; }
        .account-shell-nav { position: sticky; top: 0; align-self: flex-start; height: 100vh; width: 260px; flex-shrink: 0; display: flex; flex-direction: column; padding: 18px 14px 14px; background: rgba(255,255,255,0.72); backdrop-filter: saturate(140%) blur(8px); -webkit-backdrop-filter: saturate(140%) blur(8px); border-right: 0.5px solid rgba(0,0,0,0.08); }
        .account-nav-head { display: flex; align-items: center; justify-content: space-between; }
        .account-brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; padding: 6px 8px 14px; }
        .account-brand-word { font-size: 14px; font-weight: 700; color: #111827; letter-spacing: -0.01em; }
        .account-nav-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-top: 2px; }
        .account-user-slot { border-top: 0.5px solid rgba(0,0,0,0.07); padding-top: 10px; margin-top: 8px; }
        .account-shell-main { flex: 1; min-width: 0; }
        .account-shell-container { max-width: 1000px; margin: 0 auto; padding: 40px 32px 88px; display: flex; flex-direction: column; gap: 28px; }
        @media (max-width: 860px) { .account-shell-nav { width: 210px; } .account-shell-container { padding: 24px 18px 64px; } }
      `}</style>
    </div>
  );
}
