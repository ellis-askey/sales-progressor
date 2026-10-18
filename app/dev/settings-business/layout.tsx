"use client";

// /dev/settings-business — fully-navigable CLONE of the external progression-
// business "Settings" area, consolidation applied, mirroring the Account clone
// (founder ask, 2026-10-15). Same shell chrome + AgentNavRail, pointed at
// /dev/settings-business/<tab>. Real components, mock props. Dev-only.

import { notFound, usePathname } from "next/navigation";
import Link from "next/link";
import { CreditCard, User, Users, Bell, EnvelopeOpen, EnvelopeSimple, Lock, Repeat, Buildings, Flask } from "@phosphor-icons/react";
import { AgentNavRail, type NavRailItem } from "@/components/layout/AgentNavRail";
import { AgentToaster } from "@/components/agent/AgentToaster";

import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";

// Mirrored structure: same tabs/order as Account, plus a "Business" tab and no
// "What clients see" (businesses manage the portal per client).
const NAV: NavRailItem[] = [
  { href: "/dev/settings-business/business", label: "Business", Icon: Buildings },
  { href: "/dev/settings-business/billing", label: "Billing", Icon: CreditCard },
  { href: "/dev/settings-business/profile", label: "Profile", Icon: User },
  { href: "/dev/settings-business/team", label: "Team", Icon: Users },
  { href: "/dev/settings-business/emails", label: "Emails", Icon: EnvelopeOpen },
  { href: "/dev/settings-business/chasing", label: "Automated chasing", Icon: Repeat },
  { href: "/dev/settings-business/notifications", label: "Notifications", Icon: Bell },
  { href: "/dev/settings-business/connections", label: "Connections", Icon: EnvelopeSimple },
  { href: "/dev/settings-business/security", label: "Security", Icon: Lock },
];

export default function DevSettingsBusinessLayout({ children }: { children: React.ReactNode }) {
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

        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 6px 10px", padding: "6px 9px", borderRadius: 8, background: "rgba(224,73,42,.08)", color: "#B2452E", fontSize: 11, fontWeight: 700 }}>
          <Flask size={13} weight="fill" /> DEV CLONE · Business
        </div>
        <div style={{ display: "flex", gap: 6, margin: "0 6px 12px" }}>
          <Link href="/dev/settings-account/emails" style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, padding: "5px 0", borderRadius: 7, background: "#fff", color: "var(--agent-text-secondary)", textDecoration: "none", border: "1px solid var(--agent-border-default)" }}>‹ Account</Link>
          <span style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, padding: "5px 0", borderRadius: 7, background: "var(--agent-coral-deep)", color: "#fff" }}>Business</span>
        </div>

        <div className="account-nav-scroll">
          <nav aria-label="Business settings navigation">
            <AgentNavRail items={NAV} pathname={pathname} />
          </nav>
        </div>

        <div className="account-user-slot">
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 8px" }}>
            <span style={{ width: 30, height: 30, borderRadius: 999, background: "linear-gradient(135deg, var(--agent-coral), var(--agent-coral-deep))", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>EA</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 650, color: "#111827" }}>Ellis Askey</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Owner</div>
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
