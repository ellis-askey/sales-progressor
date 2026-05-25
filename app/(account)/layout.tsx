// app/(account)/layout.tsx
//
// Layout for the Account area. Same route-group escape mechanism as
// (billing-chrome) — lives at the app root so pages under it don't
// inherit app/agent/layout.tsx + AgentShell. Director gets a clean
// near-document environment with a slim header, a left nav listing
// the area tabs, and a calm canvas.
//
// File-tree: pages live at app/(account)/agent/account/<tab>/page.tsx.
// URLs: /agent/account/<tab> (route group is URL-invisible). Layout
// inheritance: app/layout.tsx + this layout — NOT app/agent/layout.tsx.
//
// Stage 1 surface: only Billing exists as a tab, and Billing is
// director-only — so the whole Account area is gated to directors via
// resolveDirectorSession here. When Stage 2 adds Profile / Notifications
// (both roles) and Team (director-only), this gate relaxes to
// resolveAgentSession and per-page gating takes over. The left nav
// already filters by role for that future, so no wiring change there.

import { resolveDirectorSession } from "@/lib/agent-session";
import { AccountChromeHeader } from "@/components/account/chrome/AccountChromeHeader";
import { AccountLeftNav } from "@/components/account/chrome/AccountLeftNav";
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, theme } = await resolveDirectorSession();

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: "100vh",
        background: "#fafafa",
        color: "#111827",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AccountChromeHeader />

      <div className="account-shell-body">
        <aside className="account-shell-nav">
          <AccountLeftNav role={role} />
        </aside>
        <main className="account-shell-main">{children}</main>
      </div>

      {/* Account-area chrome styles. Co-located with the layout because
          they're surface-specific and don't belong in the global agent
          stylesheet (this surface intentionally escapes the working-app
          register). */}
      <style>{`
        .account-shell-body {
          flex: 1;
          display: grid;
          grid-template-columns: 220px 1fr;
          min-height: 0;
        }
        .account-shell-nav {
          padding: 24px 12px;
          border-right: 0.5px solid rgba(0,0,0,0.08);
          background: #ffffff;
        }
        .account-shell-main {
          min-width: 0;
          background: #fafafa;
        }
        .account-leftnav-tab:hover {
          background: rgba(0,0,0,0.035) !important;
        }
        @media (max-width: 768px) {
          .account-shell-body {
            grid-template-columns: 1fr;
          }
          .account-shell-nav {
            padding: 10px 12px;
            border-right: none;
            border-bottom: 0.5px solid rgba(0,0,0,0.08);
            overflow-x: auto;
          }
          .account-shell-nav nav ul {
            flex-direction: row !important;
            gap: 4px !important;
          }
          .account-leftnav-tab {
            white-space: nowrap;
            border-left: none !important;
            padding-left: 12px !important;
          }
        }
      `}</style>
    </div>
  );
}
